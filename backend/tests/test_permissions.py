"""Matricea de roluri si consecventa ei cu oglinda din frontend.

De ce merita test: `app/permissions.py` e singura sursa de adevar pentru
autorizare, iar `frontend/src/store/permissions.ts` o copiaza ca sa ascunda UI.
Cand cele doua se desincronizeaza, userul vede butoane care intorc 403 — un bug
tacut, care nu pica nicaieri altundeva.

Rulabil cu pytest sau direct:  python -m tests.test_permissions  (din backend/)
"""
from __future__ import annotations
import pathlib
import re

from app.models.user import UserRole
from app.permissions import RESOURCE_ROLES, Resource, allowed_resources, role_can

# Adevarul asteptat, scris explicit. Daca schimbi intentionat matricea, schimba
# si tabelul asta — e exact momentul in care cineva trebuie sa se uite si la
# frontend.
EXPECTED = {
    UserRole.ADMIN:   {"operations", "settings", "advanced", "reports", "users"},
    UserRole.MANAGER: {"operations", "settings", "advanced"},
    UserRole.WORKER:  {"operations"},
}

FRONTEND_MATRIX = (
    pathlib.Path(__file__).resolve().parents[2]
    / "frontend" / "src" / "store" / "permissions.ts"
)


def test_matrix_is_what_we_think_it_is():
    for role, expected in EXPECTED.items():
        assert set(allowed_resources(role)) == expected, (
            f"{role.value}: {sorted(allowed_resources(role))} != {sorted(expected)}"
        )


def test_every_resource_is_declared():
    """O resursa fara intrare in RESOURCE_ROLES ar arunca KeyError in `role_can`,
    adica un 500 in loc de un refuz de acces."""
    for resource in Resource:
        assert resource in RESOURCE_ROLES, f"Resource.{resource.name} nu e in RESOURCE_ROLES"
        for role in UserRole:
            role_can(role, resource)  # nu trebuie sa arunce


def test_worker_cannot_reach_privileged_areas():
    for resource in (Resource.SETTINGS, Resource.ADVANCED, Resource.REPORTS, Resource.USERS):
        assert not role_can(UserRole.WORKER, resource)


def test_manager_has_no_reports_and_no_users():
    assert not role_can(UserRole.MANAGER, Resource.REPORTS)
    assert not role_can(UserRole.MANAGER, Resource.USERS)
    assert role_can(UserRole.MANAGER, Resource.SETTINGS)
    assert role_can(UserRole.MANAGER, Resource.ADVANCED)


def test_frontend_mirror_matches_backend():
    """Citim tabelul `ROLE_RESOURCES` din TypeScript si il comparam cu al nostru.

    E un parse pe text, nu o executie de JS — suficient cat sa prinda cazul real:
    cineva adauga un rol sau muta o resursa doar intr-o parte.
    """
    src = FRONTEND_MATRIX.read_text(encoding="utf-8")
    block = re.search(
        r"const ROLE_RESOURCES: Record<Role, Resource\[\]> = \{(.*?)\n\};", src, re.S
    )
    assert block, "nu am gasit ROLE_RESOURCES in permissions.ts"

    mirror: dict[str, set[str]] = {}
    for role_name, items in re.findall(r"(\w+):\s*\[([^\]]*)\]", block.group(1)):
        mirror[role_name] = set(re.findall(r'"([^"]+)"', items))

    backend = {role.value: set(allowed_resources(role)) for role in UserRole}
    assert mirror == backend, (
        f"matricea din frontend difera de backend:\n  frontend={mirror}\n  backend={backend}"
    )


if __name__ == "__main__":
    test_matrix_is_what_we_think_it_is()
    test_every_resource_is_declared()
    test_worker_cannot_reach_privileged_areas()
    test_manager_has_no_reports_and_no_users()
    test_frontend_mirror_matches_backend()
    print("OK — matricea de roluri e consecventa (backend + oglinda din frontend).")
