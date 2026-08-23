from __future__ import annotations
import enum
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class UserRole(str, enum.Enum):
    """Rolurile disponibile in interiorul unui cont (tenant).

    admin   — acces la toate resursele contului, inclusiv Rapoarte si gestionarea
              utilizatorilor.
    manager — tot in afara de Rapoarte.
    worker  — doar operational (POS, Receptie, Clienti, Programari, Hotel
              Anvelope, Concedii); fara Rapoarte si fara Setari/zone avansate.

    Ierarhia e definita in app/permissions.py (ROLE_LEVEL), nu aici, ca sa
    ramana un singur loc de adevar pentru autorizare.
    """
    ADMIN   = "admin"
    MANAGER = "manager"
    WORKER  = "worker"


class User(Base):
    """Utilizator de login din interiorul unui cont.

    Un `Account` este tenant-ul (firma, abonament, trial); `User` este identitatea
    care se autentifica. Username-ul este unic *per cont*, nu global, de aceea
    login-ul cere si codul firmei (`accounts.code`).
    """
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("account_id", "username", name="uq_users_account_id_username"),
        Index("ix_users_account_id_id", "account_id", "id"),
        Index("ix_users_employee_id", "employee_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=UserRole.WORKER,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Legatura opuionala cu angajatul existent — pentru atribuire pe bonuri /
    # rapoarte de productie. Nu e obligatorie: un admin poate sa nu fie angajat.
    employee_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    sessions: Mapped[list[UserSession]] = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan"
    )


class UserSession(Base):
    """Sesiune de login activa — o intrare per (user, dispozitiv/browser).

    Token-ul JWT ramane purtatorul autentificarii, dar poarta un `jti` care
    referenta rândul de aici. Asta face token-ul *revocabil*: adminul poate
    deconecta un dispozitiv, iar dezactivarea unui user are efect imediat, fara
    sa asteptam expirarea token-ului.
    """
    __tablename__ = "user_sessions"
    __table_args__ = (
        Index("ix_user_sessions_jti", "jti", unique=True),
        Index("ix_user_sessions_user_id_id", "user_id", "id"),
        Index("ix_user_sessions_account_id_id", "account_id", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    # Identificatorul unic al token-ului (JWT claim "jti").
    jti: Mapped[str] = mapped_column(String(64), nullable=False)
    # Dispozitivul POS inregistrat (devices), cand clientul il trimite la login.
    device_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True
    )
    # Numele dispozitivului la momentul login-ului — pastrat separat ca sa avem
    # ce afisa si daca device-ul a fost sters intre timp.
    device_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship("User", back_populates="sessions")
    device: Mapped[Device | None] = relationship("Device")


from .device import Device  # noqa: E402
