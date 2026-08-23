"""Matricea de permisiuni pe roluri — singurul loc de adevar pentru autorizare.

Regula: nu punem `if role == "admin"` prin routere. Fiecare zona protejata are o
"resursa" declarata aici, iar routerele cer `require_resource(Resource.X)` din
app/dependencies.py. Asa se vede intr-un singur ecran cine are acces la ce, iar
adaugarea unui rol nou nu inseamna vanatoare de if-uri prin tot codul.

Frontend-ul oglindeste aceeasi matrice (frontend/src/store/permissions.ts) pentru
a ascunde UI, dar ascunderea nu e securitate: enforcement-ul real e aici.
"""
from __future__ import annotations
import enum

from app.models.user import UserRole


class Resource(str, enum.Enum):
    """Zonele protejate ale aplicatiei."""
    # Operational — accesibil tuturor rolurilor.
    OPERATIONS = "operations"       # POS, Receptie, Clienti, Programari, Hotel, Concedii
    # Administrativ — admin + manager.
    SETTINGS   = "settings"         # Configurari / setari generale
    ADVANCED   = "advanced"         # Stocuri, e-Factura, Factura Rapida, fisa angajat
    # Rezervat adminului de cont.
    REPORTS    = "reports"          # Rapoarte (cifra de afaceri, target-uri)
    USERS      = "users"            # gestionarea utilizatorilor contului


# Rolurile care au acces la fiecare resursa. Explicit, nu derivat din ierarhie:
# vrem sa fie evident la citire cine intra unde.
RESOURCE_ROLES: dict[Resource, frozenset[UserRole]] = {
    Resource.OPERATIONS: frozenset({UserRole.ADMIN, UserRole.MANAGER, UserRole.WORKER}),
    Resource.SETTINGS:   frozenset({UserRole.ADMIN, UserRole.MANAGER}),
    Resource.ADVANCED:   frozenset({UserRole.ADMIN, UserRole.MANAGER}),
    Resource.REPORTS:    frozenset({UserRole.ADMIN}),
    Resource.USERS:      frozenset({UserRole.ADMIN}),
}


def role_can(role: UserRole, resource: Resource) -> bool:
    return role in RESOURCE_ROLES[resource]


def allowed_resources(role: UserRole) -> list[str]:
    """Resursele permise pentru un rol — trimise clientului la login/`/me` ca sa
    nu dublam matricea in frontend prin ghicit."""
    return [r.value for r in Resource if role_can(role, r)]
