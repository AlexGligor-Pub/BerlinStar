"""utilizatori per cont (roluri) + sesiuni + cod firma

Revision ID: usr01users
Revises: veh01anfab
Create Date: 2026-07-01 10:00:00.000000

Introduce RBAC per cont:
  - `accounts.code`  — codul firmei, introdus la login (username e unic per cont).
  - `users`          — utilizatorii de login ai unui cont, cu rol admin/manager/worker.
  - `user_sessions`  — sesiuni active (jti), ca sa putem lista dispozitivele logate
                       si sa revocam accesul fara sa asteptam expirarea token-ului.

Backfill (idempotent, fara downtime):
  - genereaza un `code` unic pentru fiecare cont existent, derivat din nume;
  - creeaza pentru fiecare cont un user cu rol `admin` care preia exact
    username-ul + hash-ul de parola existente, ca nimeni sa nu piarda accesul.

`accounts.username`/`password` NU se sterg aici: login-ul trece pe `users`, dar
coloanele rămân pentru rollback si pentru fluxurile de platforma (super-admin).
"""
import re
import unicodedata

import sqlalchemy as sa
from alembic import op


revision = "usr01users"
down_revision = "veh01anfab"
branch_labels = None
depends_on = None


def _slugify(value: str) -> str:
    """Cod firma lizibil: fara diacritice, doar [a-z0-9-], max 40 caractere."""
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_only).strip("-").lower()
    return slug[:40] or "firma"


def upgrade() -> None:
    op.add_column("accounts", sa.Column("code", sa.String(length=50), nullable=True))

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("password", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("admin", "manager", "worker", name="user_role"),
            nullable=False,
            server_default="worker",
        ),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("employee_id", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], name="fk_users_account_id_accounts"),
        sa.ForeignKeyConstraint(
            ["employee_id"], ["employees.id"], name="fk_users_employee_id_employees", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("account_id", "username", name="uq_users_account_id_username"),
    )
    op.create_index("ix_users_account_id_id", "users", ["account_id", "id"])
    op.create_index("ix_users_employee_id", "users", ["employee_id"])

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=True),
        sa.Column("device_name", sa.String(length=200), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_user_sessions_user_id_users", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], name="fk_user_sessions_account_id_accounts"),
        sa.ForeignKeyConstraint(
            ["device_id"], ["devices.id"], name="fk_user_sessions_device_id_devices", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_user_sessions"),
    )
    op.create_index("ix_user_sessions_jti", "user_sessions", ["jti"], unique=True)
    op.create_index("ix_user_sessions_user_id_id", "user_sessions", ["user_id", "id"])
    op.create_index("ix_user_sessions_account_id_id", "user_sessions", ["account_id", "id"])

    _backfill()

    # Indexul unic pe `code` se creeaza DUPA backfill, ca sa nu pice pe NULL-uri
    # duplicate in dialectele care le trateaza strict.
    op.create_index("ix_accounts_code", "accounts", ["code"], unique=True)


def _backfill() -> None:
    """Cod firma + user admin pentru fiecare cont existent."""
    conn = op.get_bind()
    accounts = conn.execute(
        sa.text("SELECT id, name, username, password, email FROM accounts ORDER BY id")
    ).fetchall()

    used_codes: set[str] = set()
    for acc in accounts:
        base = _slugify(acc.name or acc.username or f"firma-{acc.id}")
        code = base
        # Coliziuni: sufixam cu id-ul contului, care e unic prin definitie.
        if code in used_codes:
            code = f"{base}-{acc.id}"[:50]
        used_codes.add(code)
        conn.execute(
            sa.text("UPDATE accounts SET code = :code WHERE id = :id"),
            {"code": code, "id": acc.id},
        )

        # Userul admin preia exact credentialele contului (hash-ul e copiat ca
        # atare, deci parola veche functioneaza mai departe).
        conn.execute(
            sa.text(
                "INSERT INTO users (account_id, username, password, role, name, email, "
                "is_active, created_at, is_deleted) "
                "VALUES (:account_id, :username, :password, 'admin', :name, :email, "
                "true, NOW(), false) "
                "ON CONFLICT (account_id, username) DO NOTHING"
            ),
            {
                "account_id": acc.id,
                "username": acc.username,
                "password": acc.password,
                "name": acc.name or acc.username,
                "email": acc.email,
            },
        )


def downgrade() -> None:
    op.drop_index("ix_accounts_code", table_name="accounts")
    op.drop_index("ix_user_sessions_account_id_id", table_name="user_sessions")
    op.drop_index("ix_user_sessions_user_id_id", table_name="user_sessions")
    op.drop_index("ix_user_sessions_jti", table_name="user_sessions")
    op.drop_table("user_sessions")
    op.drop_index("ix_users_employee_id", table_name="users")
    op.drop_index("ix_users_account_id_id", table_name="users")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS user_role")
    op.drop_column("accounts", "code")
