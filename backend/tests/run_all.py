"""Ruleaza toate testele dintr-o comanda, fara pytest.

    cd backend && venv/bin/python -m tests.run_all

Repo-ul nu are pytest instalat, iar fiecare fisier de test e deja rulabil
standalone. Modulul asta le aduna, ca sa nu fie nevoie de sase comenzi separate
inainte de un commit. Cand pytest ajunge in requirements, fisierele merg si asa,
fara modificari — asertiunile sunt simple `assert`.
"""
from __future__ import annotations
import importlib
import os
import pkgutil
import sys
import traceback

os.environ.setdefault("BERLINSTAR_DEV_SQLITE", "1")


def _test_modules() -> list[str]:
    import tests
    return sorted(
        m.name for m in pkgutil.iter_modules(tests.__path__)
        if m.name.startswith("test_")
    )


def main() -> int:
    failed: list[tuple[str, BaseException]] = []
    for name in _test_modules():
        module = importlib.import_module(f"tests.{name}")
        runner = getattr(module, "main", None)
        try:
            if runner is not None:
                runner()
            else:
                # Fiecare test isi are runner-ul in `__main__`; il reexecutam
                # importand modulul ca script.
                _run_module_tests(module)
        except BaseException as exc:  # noqa: BLE001 — raportam, nu oprim suita
            failed.append((name, exc))
            print(f"ESEC — {name}")
            traceback.print_exc()
    total = len(_test_modules())
    if failed:
        print(f"\n{len(failed)}/{total} module au picat: {', '.join(n for n, _ in failed)}")
        return 1
    print(f"\nToate cele {total} module de test au trecut.")
    return 0


def _run_module_tests(module) -> None:
    """Apeleaza toate functiile `test_*` din modul, sincron sau async."""
    from tests._harness import run

    fns = [v for k, v in sorted(vars(module).items())
           if k.startswith("test_") and callable(v)]
    for fn in fns:
        result = fn()
        if hasattr(result, "__await__"):
            run(result)
    print(f"OK — {module.__name__}: {len(fns)} teste.")


if __name__ == "__main__":
    sys.exit(main())
