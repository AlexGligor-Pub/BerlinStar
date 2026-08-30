"""Fiecare ruta HTTP are gate-ul de autorizare pe care il asteptam.

De ce e nevoie de un test care se uita la rute, nu la functii: gaura reala nu a
fost o regula gresita, ci o ruta care nu avea NICIO regula. `/api/accounts/*` a
stat neautentificat, iar create/update pe nomenclatoare foloseau
`get_account_id` (orice rol) desi paginile lor sunt admin + manager. Astfel de
scapari nu se vad in review si nu pica nicaieri — pana acum.

Testul introspecteaza aplicatia FastAPI reala si compara dependintele efective
ale fiecarei rute cu politica declarata mai jos. Cand adaugi o ruta noua, ori
respecta politica, ori o treci explicit in `PUBLIC` / `OPERATIONAL_EXCEPTIONS` —
adica decizia devine vizibila.

Rulabil cu pytest sau direct:  python -m tests.test_route_authorization
"""
from __future__ import annotations
import os

os.environ.setdefault("BERLINSTAR_DEV_SQLITE", "1")

from fastapi.dependencies.utils import get_flat_dependant
from fastapi.routing import APIRoute

from app.main import app

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Dependintele care ATESTA o identitate (oricare dintre ele inseamna „ruta e
# autentificata").
AUTH_DEPS = {
    "get_account_id",
    "get_account_id_from_query",
    "get_auth_context",
    "get_current_account",
    "get_admin_account",
    "get_settings_account_id",
    "get_advanced_account_id",
    "get_reports_account_id",
    "get_platform_admin_account",
    "_require_super_admin",
    "_require_assistant_admin_from_query",
    "_dep",  # closure-ul intors de require_resource(...)
}

# Dependintele care implica un ROL peste simpla autentificare.
ROLE_DEPS = {
    "get_settings_account_id",
    "get_advanced_account_id",
    "get_reports_account_id",
    "get_admin_account",
    "get_platform_admin_account",
    "_require_super_admin",
    "_dep",
}

# Rute intentionat publice. Fiecare are un motiv scris — daca lista creste fara
# motiv, se vede in diff.
PUBLIC = {
    ("POST", "/api/auth/login"),            # chiar login-ul
    ("POST", "/api/auth/token"),            # OAuth2, pentru butonul Authorize din Swagger
    ("POST", "/api/auth/register"),         # inregistrare self-service
    ("GET", "/api/subscription/config"),    # preturi publice, afisate inainte de autentificare
    ("GET", "/api/efactura/callback"),      # redirect OAuth de la ANAF (poarta propriul state)
    ("GET", "/api/admin/subscription/anaf/callback"),  # idem, pentru firma noastra
    ("POST", "/api/subscription/webhook"),  # Stripe (semnatura verificata in handler)
    ("POST", "/api/admin/verify"),          # login-ul AdminV2 (emite el token-ul)
    # Imagini servite in <img src> si in PDF-uri, fara header Authorization.
    # URL-urile din spate sunt scrise doar de endpointuri autentificate.
    ("GET", "/api/global-settings/hotel-anvelope/image/{key}"),
    ("GET", "/api/global-settings/montare-roti/image/{pozitie}"),
    ("GET", "/api/health"),
    ("GET", "/health"),
    ("GET", "/"),
}

# Prefixe unde ORICE scriere trebuie sa ceara un rol, nu doar autentificare.
# Sunt zonele care in UI stau in spatele Configurări / Stocuri / e-Factura.
ROLE_REQUIRED_PREFIXES = (
    "/api/accounts",
    "/api/items",
    "/api/categories",
    "/api/departments",
    "/api/locations",
    "/api/companies",
    "/api/disclaimers",
    "/api/registers",
    "/api/stocuri",
    "/api/users",
    "/api/admin",
)

# Scrieri operationale, permise tuturor rolurilor, in prefixe care altfel cer rol.
# Fiecare exceptie e o decizie de business, nu o scapare.
OPERATIONAL_EXCEPTIONS = {
    # Statia isi face singura inregistrarea la prima pornire, inainte sa existe
    # cineva cu rol care sa o adauge.
    ("POST", "/api/devices"),
}

# Nomenclatoarele de anvelope se completeaza din fluxuri operationale: cand o
# dimensiune/profil/cod DOT lipseste, omul de la receptie trebuie sa o poata
# adauga pe loc, din modalul de cazare sau de montaj. Le tinem in afara
# prefixelor de mai sus tocmai ca sa fie evident ca e o decizie, nu o omisiune.


def _routes():
    for route in app.routes:
        if isinstance(route, APIRoute):
            yield route


def _dep_names(route: APIRoute) -> set[str]:
    flat = get_flat_dependant(route.dependant, skip_repeats=True)
    names = set()
    for dep in flat.dependencies:
        call = getattr(dep, "call", None)
        if call is not None:
            names.add(getattr(call, "__name__", str(call)))
    return names


def test_every_api_route_is_authenticated():
    unprotected = []
    for route in _routes():
        if not route.path.startswith("/api"):
            continue
        names = _dep_names(route)
        for method in route.methods - {"HEAD", "OPTIONS"}:
            if (method, route.path) in PUBLIC:
                continue
            if not (names & AUTH_DEPS):
                unprotected.append(f"{method} {route.path}")
    assert not unprotected, (
        "rute fara autentificare (adauga un Depends sau treci-le explicit in PUBLIC):\n  "
        + "\n  ".join(sorted(unprotected))
    )


def test_privileged_areas_require_a_role_on_writes():
    ungated = []
    for route in _routes():
        if not route.path.startswith(ROLE_REQUIRED_PREFIXES):
            continue
        names = _dep_names(route)
        for method in route.methods & WRITE_METHODS:
            if (method, route.path) in PUBLIC or (method, route.path) in OPERATIONAL_EXCEPTIONS:
                continue
            if not (names & ROLE_DEPS):
                ungated.append(f"{method} {route.path} -> {sorted(names & AUTH_DEPS) or 'nimic'}")
    assert not ungated, (
        "scrieri in zone privilegiate care cer doar autentificare, nu si rol:\n  "
        + "\n  ".join(sorted(ungated))
    )


def test_accounts_router_belongs_to_the_platform_admin():
    """Regresie directa: routerul care creeaza TENANTI era complet deschis."""
    seen = 0
    for route in _routes():
        if not route.path.startswith("/api/accounts"):
            continue
        seen += 1
        assert "get_platform_admin_account" in _dep_names(route), (
            f"{sorted(route.methods)} {route.path} nu cere contul de platforma"
        )
    assert seen > 0, "nu am gasit rutele /api/accounts — s-a schimbat prefixul?"


def test_reports_are_admin_only():
    for route in _routes():
        if route.path.startswith("/api/reports"):
            assert "get_reports_account_id" in _dep_names(route), route.path


def test_user_management_requires_the_users_resource():
    for route in _routes():
        if route.path.startswith("/api/users"):
            assert "_dep" in _dep_names(route), (
                f"{route.path} nu trece prin require_resource(Resource.USERS)"
            )


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for fn in TESTS:
        fn()
    total = sum(len(r.methods - {"HEAD", "OPTIONS"}) for r in _routes())
    print(f"OK — {len(TESTS)} verificari peste {total} rute.")
