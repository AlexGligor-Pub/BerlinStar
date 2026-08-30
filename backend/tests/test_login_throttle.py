"""Blocarea la brute-force se numara pe credential, nu pe IP.

Motivul e practic: intr-un service toata echipa iese prin acelasi NAT. O limita
strict pe IP inseamna ca la schimbul de tura oamenii se blocheaza reciproc, desi
fiecare tasteaza corect. Testele de mai jos fixeaza exact separarea asta.

Rulabil cu pytest sau direct:  python -m tests.test_login_throttle
"""
from __future__ import annotations
from datetime import timedelta

from app.utils import login_throttle as t


def _fail(times: int, code="firma", user="ion") -> None:
    for _ in range(times):
        t.record_failure(code, user)


def _raises_429(code="firma", user="ion") -> str:
    from fastapi import HTTPException
    try:
        t.assert_not_locked(code, user)
    except HTTPException as exc:
        assert exc.status_code == 429, exc.status_code
        return exc.detail
    raise AssertionError("astept 429, dar combinatia nu era blocata")


def test_below_the_threshold_nothing_happens():
    t.reset_all()
    _fail(t.MAX_FAILURES - 1)
    t.assert_not_locked("firma", "ion")


def test_threshold_locks_the_combination():
    t.reset_all()
    _fail(t.MAX_FAILURES)
    detail = _raises_429()
    assert "Reincearca in" in detail


def test_a_colleague_on_the_same_ip_is_unaffected():
    """Miezul problemei: blocarea lui `ion` nu are voie sa il opreasca pe `maria`."""
    t.reset_all()
    _fail(t.MAX_FAILURES, user="ion")
    _raises_429(user="ion")
    t.assert_not_locked("firma", "maria")


def test_same_username_in_another_company_is_unaffected():
    t.reset_all()
    _fail(t.MAX_FAILURES, code="firma", user="ion")
    _raises_429(code="firma", user="ion")
    t.assert_not_locked("alta-firma", "ion")


def test_a_correct_password_clears_the_counter():
    t.reset_all()
    _fail(t.MAX_FAILURES - 1)
    t.record_success("firma", "ion")
    _fail(t.MAX_FAILURES - 1)
    t.assert_not_locked("firma", "ion")  # contorul a repornit, nu s-a cumulat


def test_lock_expires():
    t.reset_all()
    _fail(t.MAX_FAILURES)
    _raises_429()
    # Impingem expirarea in trecut, ca sa nu asteptam efectiv 5 minute.
    entry = t._entries[t._key("firma", "ion")]
    entry.locked_until = t._now() - timedelta(seconds=1)
    t.assert_not_locked("firma", "ion")


def test_old_failures_fall_out_of_the_window():
    t.reset_all()
    _fail(t.MAX_FAILURES - 1)
    entry = t._entries[t._key("firma", "ion")]
    entry.failures = [f - t.WINDOW - timedelta(seconds=1) for f in entry.failures]
    _fail(1)
    t.assert_not_locked("firma", "ion")


def test_username_and_code_are_compared_case_insensitively():
    t.reset_all()
    _fail(t.MAX_FAILURES, code="Firma", user="ION")
    _raises_429(code="  firma ", user="ion")


def test_memory_does_not_grow_without_bound():
    t.reset_all()
    for i in range(t.MAX_TRACKED + 500):
        t.record_failure("firma", f"user{i}")
    assert len(t._entries) <= t.MAX_TRACKED


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for fn in TESTS:
        fn()
    t.reset_all()
    print(f"OK — {len(TESTS)} scenarii de throttling la login trecute.")
