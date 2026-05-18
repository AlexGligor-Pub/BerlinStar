"""Catalog static de Items pentru contul demo, structurat pe divizii."""
from __future__ import annotations
from decimal import Decimal
from typing import Iterable

# Definitie compacta de item: (nume, pret_ron, unit, tip, cost_factor_min, cost_factor_max, stoc_minim)
# tip: "P" = produs, "S" = serviciu (default pe produse → stoc_minim 10)

# Vulcanizare — anvelope (produse) + servicii montaj/echilibrare
VULCANIZARE_PRODUSE = [
    # Anvelope vara (combinatii populare)
    ("Anvelopa vara Michelin 195/65 R15", "420.00"),
    ("Anvelopa vara Michelin 205/55 R16", "490.00"),
    ("Anvelopa vara Continental 195/65 R15", "395.00"),
    ("Anvelopa vara Continental 205/55 R16", "465.00"),
    ("Anvelopa vara Continental 215/55 R17", "550.00"),
    ("Anvelopa vara Bridgestone 205/55 R16", "455.00"),
    ("Anvelopa vara Goodyear 195/65 R15", "385.00"),
    ("Anvelopa vara Pirelli 225/45 R17", "620.00"),
    ("Anvelopa vara Hankook 205/55 R16", "350.00"),
    ("Anvelopa vara Yokohama 215/55 R17", "510.00"),
    # Anvelope iarna
    ("Anvelopa iarna Michelin 195/65 R15", "445.00"),
    ("Anvelopa iarna Michelin 205/55 R16", "520.00"),
    ("Anvelopa iarna Continental 205/55 R16", "490.00"),
    ("Anvelopa iarna Continental 215/55 R17", "580.00"),
    ("Anvelopa iarna Nokian 205/55 R16", "510.00"),
    ("Anvelopa iarna Nokian 215/55 R17", "590.00"),
    ("Anvelopa iarna Goodyear UltraGrip 195/65 R15", "405.00"),
    ("Anvelopa iarna Pirelli 225/45 R17", "640.00"),
    # All-season
    ("Anvelopa all-season Michelin CrossClimate 205/55 R16", "540.00"),
    ("Anvelopa all-season Goodyear Vector 205/55 R16", "475.00"),
    # Consumabile
    ("Valva anvelopa (TR-414)", "8.00"),
    ("Plumbi echilibrare set 4 roti", "12.00"),
    ("Petic anvelopa universal", "18.00"),
]

VULCANIZARE_SERVICII = [
    ("Montare anvelopa", "25.00"),
    ("Demontare anvelopa", "15.00"),
    ("Echilibrare roata", "20.00"),
    ("Schimb sezonier set 4 roti", "100.00"),
    ("Reparatie pana cu petic", "35.00"),
    ("Verificare presiune si umflare", "10.00"),
]

# Mecanica — produse + servicii
MECANICA_PRODUSE = [
    ("Ulei motor Castrol GTX 5W-30 4L", "165.00"),
    ("Ulei motor Mobil 1 5W-40 4L", "210.00"),
    ("Filtru ulei Mann W712", "35.00"),
    ("Filtru ulei Bosch P9097", "42.00"),
    ("Filtru aer Mann C2774", "65.00"),
    ("Filtru polen Bosch", "55.00"),
    ("Antigel G12 5L", "85.00"),
    ("Lichid frana DOT4 500ml", "30.00"),
    ("Placute frana fata Bosch", "240.00"),
    ("Placute frana spate Bosch", "190.00"),
    ("Disc frana fata Bosch (buc)", "180.00"),
    ("Set placute + discuri fata premium", "650.00"),
    ("Bujie NGK (set 4)", "120.00"),
    ("Curea distributie kit Gates", "480.00"),
    ("Amortizor fata Monroe (buc)", "350.00"),
    ("Amortizor spate Monroe (buc)", "295.00"),
    ("Arc elicoidal", "180.00"),
    ("Kit bara directie", "280.00"),
    ("Bujie incandescenta diesel", "95.00"),
    ("Curea accesorii", "85.00"),
]

MECANICA_SERVICII = [
    ("Revizie completa", "350.00"),
    ("Schimb ulei + filtru", "80.00"),
    ("Inlocuire placute frana axa", "120.00"),
    ("Inlocuire discuri + placute axa", "180.00"),
    ("Inlocuire amortizoare fata", "150.00"),
    ("Inlocuire kit distributie", "650.00"),
    ("Diagnoza electronica", "80.00"),
    ("Verificare suspensie", "60.00"),
    ("Verificare frane", "50.00"),
]

# Hotel Anvelope — strict servicii
HOTEL_ANVELOPE_SERVICII = [
    ("Depozitare anvelope sezon (set 4)", "150.00"),
    ("Depozitare roti complete (set 4)", "200.00"),
    ("Spalare anvelope la depozitare", "40.00"),
    ("Verificare uzura anvelope la check-out", "30.00"),
    ("Transport anvelope la cerere", "60.00"),
]

# Geometrie — produse + servicii
GEOMETRIE_PRODUSE = [
    ("Kit pivot inferior", "220.00"),
    ("Bieleta directie", "85.00"),
    ("Capat de bara", "75.00"),
    ("Bucsa bara stabilizatoare", "55.00"),
]

GEOMETRIE_SERVICII = [
    ("Reglaj geometrie axa fata", "120.00"),
    ("Reglaj geometrie 4 roti", "200.00"),
    ("Verificare suspensie pre-geometrie", "40.00"),
    ("Optimizare convergenta + cadere", "150.00"),
]

# Spalatorie Auto — strict servicii (manual)
SPALATORIE_SERVICII = [
    ("Spalare exterior manual", "30.00"),
    ("Spalare interior aspirare", "40.00"),
    ("Spalare exterior + interior", "60.00"),
    ("Pachet premium (ceara + uscare)", "100.00"),
    ("Polish detailing complet", "250.00"),
    ("Curatare tapiserie + scaune", "180.00"),
    ("Decontaminare caroserie", "150.00"),
    ("Spalare motor", "70.00"),
    ("Curatare jante chimic", "40.00"),
    ("Aplicare ceara protectie", "50.00"),
]
SPALATORIE_PRODUSE = [
    ("Solutie spuma activa 5L", "55.00"),
    ("Ceara protectoare caroserie 1L", "85.00"),
    ("Sampon auto pH neutru 1L", "35.00"),
]

# Clima Auto — produse + servicii
CLIMA_PRODUSE = [
    ("Freon R134a (kg)", "120.00"),
    ("Freon R1234yf (kg)", "350.00"),
    ("Filtru habitaclu carbon activ", "75.00"),
    ("Ulei compresor clima", "65.00"),
]

CLIMA_SERVICII = [
    ("Incarcare freon clima R134a", "180.00"),
    ("Incarcare freon clima R1234yf", "350.00"),
    ("Dezinfectie sistem clima (ozon)", "120.00"),
    ("Verificare etansare clima cu UV", "80.00"),
    ("Diagnoza si reparatie clima", "200.00"),
]


def items_for_department(dept_name: str) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """Returneaza (produse, servicii) pentru o divizie."""
    mapping = {
        "Vulcanizare":     (VULCANIZARE_PRODUSE, VULCANIZARE_SERVICII),
        "Mecanica":        (MECANICA_PRODUSE, MECANICA_SERVICII),
        "Hotel Anvelope":  ([], HOTEL_ANVELOPE_SERVICII),
        "Geometrie":       (GEOMETRIE_PRODUSE, GEOMETRIE_SERVICII),
        "Spalatorie Auto": (SPALATORIE_PRODUSE, SPALATORIE_SERVICII),
        "Clima Auto":      (CLIMA_PRODUSE, CLIMA_SERVICII),
    }
    return mapping.get(dept_name, ([], []))


def category_name_for(dept_name: str, item_type: str) -> str:
    base = {
        "Vulcanizare": "Anvelope si accesorii",
        "Mecanica": "Piese si consumabile",
        "Hotel Anvelope": "Servicii hotel anvelope",
        "Geometrie": "Geometrie si suspensie",
        "Spalatorie Auto": "Servicii spalatorie",
        "Clima Auto": "Sistem clima",
    }.get(dept_name, dept_name)
    if item_type == "S":
        return base if "Servicii" in base else f"{base} (servicii)"
    return base
