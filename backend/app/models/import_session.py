"""Sesiunile de import din fisiere si randurile lor.

O sesiune = un fisier incarcat de administrator. Pastram TOATE randurile, nu doar
pe cele cu probleme: istoricul trebuie sa arate si ce a intrat (cu legatura la
clientul creat), si ce a fost respins si de cine.

`kind` = tipul importului: `clienti` (un rand = un client) sau `hotel`
(un rand = o cazare cu anvelopele ei, adica mai multe linii din fisier).

Starea unui rand:
  * `imported` — datele au fost create (`client_id`, detaliile in `created`);
  * `pending`  — are o problema (`issue`) si asteapta decizia utilizatorului:
                 completeaza si importa, sau respinge;
  * `rejected` — utilizatorul l-a respins (poate fi readus in lista);
  * `reverted` — importul a fost anulat, iar ce crease randul a fost sters.

`issue` (doar pentru `pending`), dupa tip — vezi serviciul fiecarui import
(ex. `error`, `missing`, `duplicate`, `new_client`, `ambiguous`).

„Necesita actiuni" nu se stocheaza: e adevarat cat timp sesiunea are randuri
`pending` — calculat din randuri, deci nu se poate desincroniza.
"""
from __future__ import annotations
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base

_JSON = JSON().with_variant(JSONB, "postgresql")


class ImportSession(Base):
    __tablename__ = "import_sessions"
    __table_args__ = (
        Index("ix_import_sessions_account_id_kind_id", "account_id", "kind", "id"),
        # Cautarea „acelasi fisier a mai fost importat?" la fiecare pornire de import.
        Index("ix_import_sessions_account_id_file_hash", "account_id", "file_hash"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)  # "clienti"
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    encoding: Mapped[str | None] = mapped_column(String(20), nullable=True)
    delimiter: Mapped[str | None] = mapped_column(String(5), nullable=True)
    columns_recognized: Mapped[list | None] = mapped_column(_JSON, nullable=True)
    file_warnings: Mapped[list | None] = mapped_column(_JSON, nullable=True)
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Procesarea ruleaza in fundal: `processing` -> `done` | `failed`.
    # `processed_rows` alimenteaza bara de progres; `updated_at` e si semn de viata
    # (o sesiune `processing` fara actualizari recente a murit odata cu procesul).
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="done", server_default="done")
    processed_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    # SHA-256 al fisierului: acelasi fisier incarcat de doua ori e oprit (dublu click,
    # reincarcare din greseala), cu optiunea explicita „importa oricum".
    file_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Punctul de lucru pe care intra ce se importa. Hotelul de anvelope il
    # foloseste: pagina Hotel arata doar cazarile locatiei statiei curente, deci
    # o cazare fara locatie nu s-ar vedea nicaieri. Ramane NULL pentru importurile
    # care nu au legatura cu o locatie (clientii sunt ai contului, nu ai unui punct).
    location_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )
    # Ce a creat sesiunea in afara randurilor (ex. locuri de cazare, profiluri,
    # coduri DOT noi) — sters la revert daca nu e folosit intre timp.
    created: Mapped[dict | None] = mapped_column(_JSON, nullable=True)
    reverted_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reverted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ImportRow(Base):
    __tablename__ = "import_rows"
    __table_args__ = (
        Index("ix_import_rows_session_id_status_row_number", "session_id", "status", "row_number"),
        Index("ix_import_rows_account_id_status", "account_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("import_sessions.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)  # linia din fisier
    status: Mapped[str] = mapped_column(String(20), nullable=False)   # imported | pending | rejected
    issue: Mapped[str | None] = mapped_column(String(20), nullable=True)  # error | missing | duplicate
    original: Mapped[dict] = mapped_column(_JSON, nullable=False)     # valorile citite din fisier
    values: Mapped[dict] = mapped_column(_JSON, nullable=False)       # valorile curente (editate)
    messages: Mapped[list | None] = mapped_column(_JSON, nullable=True)
    client_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("clienti.id"), nullable=True)
    # Ce a creat randul la import (ex. {"client_created": true, "cazare_id": 7,
    # "anvelopa_ids": [...], "vehicol_ids": [...]}) — baza pentru revert.
    created: Mapped[dict | None] = mapped_column(_JSON, nullable=True)
    resolved_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
