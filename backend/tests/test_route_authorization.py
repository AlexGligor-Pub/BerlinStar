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

from fastapi.routing import APIRoute

# `get_flat_dependant` e un helper privat, scos din FastAPI-urile noi. Testul
# trebuie sa ruleze pe versiunea care ajunge efectiv in productie, asa ca fara
# el aplatizam singuri arborele de dependinte (vezi `_dep_names`).
try:
    from fastapi.dependencies.utils import get_flat_dependant
except ImportError:  # FastAPI nou
    get_flat_dependant = None

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
    "/api/import",
    "/api/email-settings",
    "/api/global-settings",
)

# Dependinta care atesta contul de PLATFORMA (noi), nu un cont de client.
PLATFORM_DEP = "get_platform_admin_account"

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


def _expand(route, seen: set[int]):
    """Rutele HTTP efective din spatele unei intrari din `app.routes`.

    FastAPI-urile vechi tin acolo direct `APIRoute`. Cele noi tin cate un
    `_IncludedRouter` per `include_router(...)`, iar rutele reale (cu prefixul
    si dependintele routerului deja aplicate) se obtin din
    `effective_candidates` — obiecte cu `.path`, `.methods`, `.dependant`, sau
    alte `_IncludedRouter` imbricate. Nu importam clasele private: ne uitam doar
    dupa atribute, ca sa nu depindem de inca un nume intern.
    """
    if isinstance(route, APIRoute):
        if id(route) not in seen:
            seen.add(id(route))
            yield route
        return
    candidates = getattr(route, "effective_candidates", None)
    if candidates is None:
        return
    if callable(candidates):
        candidates = candidates()
    for candidate in candidates:
        if id(candidate) in seen:
            continue
        if getattr(candidate, "effective_candidates", None) is not None:
            yield from _expand(candidate, seen)
        elif (
            getattr(candidate, "dependant", None) is not None
            and getattr(candidate, "methods", None)
            and getattr(candidate, "path", None)
        ):
            # Rutele Starlette simple / WebSocket n-au `dependant`: le sarim,
            # la fel cum `isinstance(route, APIRoute)` le sarea inainte.
            seen.add(id(candidate))
            yield candidate


# Lista se construieste o singura data: obiectele efective trebuie sa ramana in
# viata cat timp le deduplicam dupa `id(...)`.
_ROUTES: list = []


def _routes():
    if not _ROUTES:
        seen: set[int] = set()
        for route in app.routes:
            _ROUTES.extend(_expand(route, seen))
    return _ROUTES


def _walk_dependant(dependant, names: set[str], visited: set[int]) -> None:
    for dep in getattr(dependant, "dependencies", None) or []:
        if id(dep) in visited:
            continue
        visited.add(id(dep))
        call = getattr(dep, "call", None)
        if call is not None:
            names.add(getattr(call, "__name__", str(call)))
        _walk_dependant(dep, names, visited)


def _dep_names(route) -> set[str]:
    names: set[str] = set()
    if get_flat_dependant is not None:
        flat = get_flat_dependant(route.dependant, skip_repeats=True)
        for dep in flat.dependencies:
            call = getattr(dep, "call", None)
            if call is not None:
                names.add(getattr(call, "__name__", str(call)))
        return names
    _walk_dependant(route.dependant, names, set())
    return names


def test_route_discovery_sees_the_real_routes():
    """Fara asta, o schimbare de structura in FastAPI ar face `_routes()` sa
    intoarca nimic, iar toate verificarile de mai jos ar trece in gol."""
    found = {(m, r.path) for r in _routes() for m in r.methods}
    for expected in (
        ("POST", "/api/auth/login"),
        ("GET", "/api/email-settings/smtp"),
        ("GET", "/api/global-settings/hotel-anvelope"),
    ):
        assert expected in found, f"{expected} nu apare printre cele {len(found)} rute gasite"
    # Dependintele puse pe ROUTER (nu pe handler) se vad si ele.
    smtp = [r for r in _routes() if r.path == "/api/email-settings/smtp"]
    assert all(_dep_names(r) & AUTH_DEPS for r in smtp), "dependintele routerului nu se vad"


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
        assert PLATFORM_DEP in _dep_names(route), (
            f"{sorted(route.methods)} {route.path} nu cere contul de platforma"
        )
    assert seen > 0, "nu am gasit rutele /api/accounts — s-a schimbat prefixul?"


def test_email_settings_belongs_to_the_platform_admin():
    """SMTP-ul platformei, sabloanele si jurnalul de email al TUTUROR conturilor:
    nici macar citirea nu e a unui client."""
    seen = 0
    for route in _routes():
        if not route.path.startswith("/api/email-settings"):
            continue
        seen += 1
        assert PLATFORM_DEP in _dep_names(route), (
            f"{sorted(route.methods)} {route.path} nu cere contul de platforma"
        )
    assert seen > 0, "nu am gasit rutele /api/email-settings — s-a schimbat prefixul?"


def test_global_settings_writes_belong_to_the_platform_admin():
    """Randul GlobalSettings e comun tuturor conturilor. Clientii il CITESC
    (imaginile din POS / Hotel), dar numai platforma il scrie."""
    writes = 0
    open_reads = set()
    for route in _routes():
        if not route.path.startswith("/api/global-settings"):
            continue
        names = _dep_names(route)
        if route.methods & WRITE_METHODS:
            writes += 1
            assert PLATFORM_DEP in names, (
                f"{sorted(route.methods)} {route.path} nu cere contul de platforma"
            )
        elif PLATFORM_DEP not in names:
            open_reads.add(route.path)
    assert writes > 0, "nu am gasit scrieri sub /api/global-settings — s-a schimbat prefixul?"
    # Cealalta jumatate a regulii: citirile de care are nevoie aplicatia normala
    # NU trebuie inchise din greseala odata cu scrierile.
    for path in (
        "/api/global-settings/hotel-anvelope",
        "/api/global-settings/montare-roti",
        "/api/global-settings/hotel-anvelope/image/{key}",
        "/api/global-settings/montare-roti/image/{pozitie}",
    ):
        assert path in open_reads, f"GET {path} a ajuns sa ceara contul de platforma"


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
