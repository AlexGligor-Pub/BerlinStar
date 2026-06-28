"""Regresie BR-RO-100: pentru judetul RO-B (Bucuresti) localitatea (BT-52) trebuie sa fie
EXACT SECTOR1..6, altfel ANAF respinge factura. Acopera si canonicalizarea codului de judet
(BT-54), fiindca un judet trimis ca 'B'/'Bucuresti' ar ocoli altfel regula.

Vezi mapping.normalize_ro_b_city + mapping.normalize_county_code.
Rulabil cu pytest sau direct:  python -m tests.test_efactura_sector  (din backend/, in venv)
"""
from app.efactura.mapping import (
    _parse_county_city,
    _resolve_address,
    normalize_county_code,
    normalize_ro_b_city,
)

# (county_code, city, fallback_text) -> expected city
CITY_CASES = [
    (("RO-B", "Bucuresti", None), "SECTOR1"),                    # text liber -> fallback valid
    (("RO-B", "—", None), "SECTOR1"),                            # placeholder -> fallback valid
    (("RO-B", "", "Bucuresti, Sectorul 5, str X"), "SECTOR5"),   # sector din adresa text-liber
    (("RO-B", "Sector 3", None), "SECTOR3"),                     # varianta cu spatiu -> canonic
    (("RO-B", "SECTORUL 4", None), "SECTOR4"),                   # 'SECTORUL n' -> canonic
    (("RO-B", "SECTOR2", None), "SECTOR2"),                      # deja canonic -> neschimbat
    (("RO-B", "Bucuresti sector 6", None), "SECTOR6"),           # diacritice + sector
    # judetul ca forma necanonica trebuie sa declanseze totusi regula:
    (("B", "Bucuresti", None), "SECTOR1"),                       # cod scurt 'B' -> tot RO-B
    (("Bucuresti", "Sector 3", None), "SECTOR3"),                # nume judet -> tot RO-B
    (("RO-B ", "Bucuresti", None), "SECTOR1"),                   # spatiu in coada -> tot RO-B
    # alte judete: city NU se atinge:
    (("RO-AB", "Alba Iulia", None), "Alba Iulia"),
    (("RO-CJ", "Cluj-Napoca", "ceva sector 2"), "Cluj-Napoca"),
    (("IF", "Otopeni", None), "Otopeni"),                        # Ilfov (cod scurt) -> intact
]

# raw -> expected ISO code
COUNTY_CASES = [
    ("RO-B", "RO-B"), ("B", "RO-B"), ("b", "RO-B"), ("RO-B ", "RO-B"),
    ("Bucuresti", "RO-B"), ("BUCURESTI", "RO-B"),
    ("CJ", "RO-CJ"), ("Cluj", "RO-CJ"), ("RO-CJ", "RO-CJ"),
    ("IF", "RO-IF"), ("Ilfov", "RO-IF"),
    ("Satu Mare", "RO-SM"), ("Caras-Severin", "RO-CS"),
    ("", ""), (None, ""), ("XYZ", ""), ("RO", ""),               # nedeterminabil -> ""
]


def test_normalize_ro_b_city():
    for (county, city, fb), expected in CITY_CASES:
        got = normalize_ro_b_city(county, city, fb)
        assert got == expected, f"city: county={county!r} city={city!r} fb={fb!r}: {got!r} != {expected!r}"


def test_normalize_county_code():
    for raw, expected in COUNTY_CASES:
        got = normalize_county_code(raw)
        assert got == expected, f"county: raw={raw!r}: {got!r} != {expected!r}"


# text -> (county_code, city). Verifica si ca un judet explicit invinge un substring "BUCURESTI"
# si ca un nume de strada cu "Bucuresti-..." NU mai eticheteaza adresa drept RO-B.
PARSE_CASES = [
    ("JUD. TIMIS, MUN. TIMISOARA, STR. GLAD, NR.60", ("RO-TM", "Timisoara")),
    ("Str X, Sector 3, Bucuresti", ("RO-B", "SECTOR3")),
    ("Bd. Unirii 10, Bucuresti", ("RO-B", None)),
    ("Soseaua Bucuresti-Ploiesti 42, Otopeni, jud Ilfov", ("RO-IF", None)),  # jud explicit castiga
    ("Soseaua Bucuresti-Ploiesti 42, Otopeni", (None, None)),                 # hyphen exclus, fara jud
    ("Bd. Bucurestiului 5, Otopeni", (None, None)),                            # 'Bucurestiului' != Bucuresti
]


def test_parse_county_city():
    for text, expected in PARSE_CASES:
        got = _parse_county_city(text)
        assert got == expected, f"parse: {text!r}: {got!r} != {expected!r}"


# (structured_parts, fallback_text) -> (county_code, city). Acopera ordinea corecta a
# defaultului RO-B fata de normalizarea sectorului: un client FARA adresa (cazul real al
# facturii respinse 90449) trebuie sa iasa RO-B + SECTOR1, NU RO-B + '—' (care e respins).
RESOLVE_CASES = [
    ({}, None, ("RO-B", "SECTOR1")),
    ({"county_code": "RO-B", "city": "Bucuresti"}, None, ("RO-B", "SECTOR1")),
    ({}, "Str X, Sector 4, Bucuresti", ("RO-B", "SECTOR4")),
    ({"county_code": "B"}, None, ("RO-B", "SECTOR1")),
    ({}, "JUD. TIMIS, MUN. TIMISOARA, STR. GLAD", ("RO-TM", "Timisoara")),
    ({"county_code": "RO-CJ", "city": "Cluj-Napoca"}, None, ("RO-CJ", "Cluj-Napoca")),
]


def test_resolve_address():
    for parts, fb, (exp_county, exp_city) in RESOLVE_CASES:
        a = _resolve_address(parts, fb)
        assert (a.county_code, a.city) == (exp_county, exp_city), (
            f"resolve: parts={parts} fb={fb!r}: {(a.county_code, a.city)} != {(exp_county, exp_city)}"
        )


if __name__ == "__main__":
    test_normalize_ro_b_city()
    test_normalize_county_code()
    test_parse_county_city()
    test_resolve_address()
    print(
        f"OK — {len(CITY_CASES)} city + {len(COUNTY_CASES)} judet + {len(PARSE_CASES)} parse "
        f"+ {len(RESOLVE_CASES)} resolve trecute."
    )
