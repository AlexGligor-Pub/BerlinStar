"""CLI entry-point pentru demo seeder.

Utilizare (din backend/):
    python -m app.seed_demo

Refuza daca un cont cu username "ProfessorPrimeDemo" exista deja.
Pentru re-rulare, sterge contul manual din baza de date.
"""
from __future__ import annotations

import asyncio
import logging
import sys

from app.services.demo_seeder import seed_demo_account


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    try:
        summary = asyncio.run(seed_demo_account(force=False))
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        logging.getLogger("berlinstar").exception("Demo seed failed")
        print(f"FATAL: {exc}", file=sys.stderr)
        return 2

    print("\n=== Demo seed COMPLET ===")
    for k, v in summary.items():
        print(f"  {k}: {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
