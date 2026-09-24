"""Abonamentul primit la activarea unui cont (AdminV2 › Conturi).

Bannerul „Abonament neconfigurat” vine din lipsa rândului din
`account_subscription`, nu din `is_locked`; iar un abonament deja expirat ar
bloca imediat contul la loc, la prima autentificare (`auth._apply_subscription_lock`)
sau la jobul de noapte. Cine scoate contul din trial se așteaptă ca ambele să se
rezolve.

Rulabil cu pytest sau direct:  python -m tests.test_account_subscription
"""
from __future__ import annotations

from datetime import date, timedelta

from fastapi import BackgroundTasks
from sqlalchemy import select

from app.models.subscription import AccountSubscription
from app.routers.accounts import SUBSCRIPTION_DAYS, create_account, patch_account
from app.schemas.account import AccountCreate, AccountUpdate
from tests._harness import make_account, make_session, run


async def _sub(db, account_id: int) -> AccountSubscription | None:
    return (await db.execute(
        select(AccountSubscription).where(AccountSubscription.account_id == account_id)
    )).scalar_one_or_none()


def _scadenta_noua(inceput: date) -> set[date]:
    """Datele acceptabile — testul poate trece peste miezul nopții."""
    return {inceput + timedelta(days=SUBSCRIPTION_DAYS),
            inceput + timedelta(days=SUBSCRIPTION_DAYS + 1)}


async def _cont_blocat(db):
    acc = await make_account(db)
    acc.is_locked = True
    await db.commit()
    return acc


# ─── Ieșirea din trial ───────────────────────────────────────────────────────

async def test_unlocking_creates_the_missing_subscription():
    db = await make_session()
    acc = await _cont_blocat(db)
    assert await _sub(db, acc.id) is None
    azi = date.today()

    await patch_account(acc.id, AccountUpdate(is_locked=False), db)

    sub = await _sub(db, acc.id)
    assert sub is not None, "contul scos din trial a rămas fără abonament"
    assert sub.next_payment_date in _scadenta_noua(azi), sub.next_payment_date
    await db.refresh(acc)
    assert acc.locked_at is None, "a rămas data de trial pe un cont activ"


async def test_unlocking_extends_an_expired_subscription():
    """Altfel login-ul l-ar bloca la loc imediat și activarea ar părea că nu s-a salvat."""
    db = await make_session()
    acc = await _cont_blocat(db)
    db.add(AccountSubscription(
        account_id=acc.id, next_payment_date=date.today() - timedelta(days=10),
    ))
    await db.commit()
    azi = date.today()

    await patch_account(acc.id, AccountUpdate(is_locked=False), db)

    sub = await _sub(db, acc.id)
    assert sub is not None and sub.next_payment_date in _scadenta_noua(azi), sub.next_payment_date


async def test_a_valid_subscription_is_left_alone():
    """Data vine din plăți sau din AdminV2 › Abonament; nu se rescrie aici."""
    db = await make_session()
    acc = await _cont_blocat(db)
    scadenta = date.today() + timedelta(days=30)
    db.add(AccountSubscription(account_id=acc.id, next_payment_date=scadenta))
    await db.commit()

    await patch_account(acc.id, AccountUpdate(is_locked=False), db)

    sub = await _sub(db, acc.id)
    assert sub is not None and sub.next_payment_date == scadenta, sub and sub.next_payment_date


# ─── Salvări care NU sunt o activare ─────────────────────────────────────────

async def test_saving_an_already_active_account_grants_nothing():
    """AdminV2 trimite `is_locked` la fiecare salvare: o redenumire nu e un abonament."""
    db = await make_session()
    acc = await make_account(db)          # activ din start
    await db.commit()

    await patch_account(acc.id, AccountUpdate(name="Alt nume", is_locked=False), db)

    assert await _sub(db, acc.id) is None


async def test_patch_without_is_locked_grants_nothing():
    db = await make_session()
    acc = await _cont_blocat(db)

    await patch_account(acc.id, AccountUpdate(email="a@b.ro"), db)

    assert await _sub(db, acc.id) is None


async def test_locking_back_creates_nothing():
    db = await make_session()
    acc = await make_account(db)
    await db.commit()

    await patch_account(acc.id, AccountUpdate(is_locked=True), db)

    assert await _sub(db, acc.id) is None


# ─── Contul nou ──────────────────────────────────────────────────────────────

async def test_a_new_active_account_gets_a_subscription():
    db = await make_session()
    azi = date.today()

    acc = await create_account(
        AccountCreate(name="Firma Noua", username="firmanoua", password="x" * 12),
        BackgroundTasks(), db,
    )

    sub = await _sub(db, acc.id)
    assert sub is not None and sub.next_payment_date in _scadenta_noua(azi), sub and sub.next_payment_date


async def test_a_new_trial_account_gets_none():
    db = await make_session()

    acc = await create_account(
        AccountCreate(name="Firma Trial", username="firmatrial", password="x" * 12, is_locked=True),
        BackgroundTasks(), db,
    )

    assert acc.is_locked is True
    assert await _sub(db, acc.id) is None


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de abonament la activarea contului trecute.")
