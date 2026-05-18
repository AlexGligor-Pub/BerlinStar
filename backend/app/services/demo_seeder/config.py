"""Constante pentru demo seeder: master data, splits, weights."""
from __future__ import annotations
from datetime import date

# ────────── Cont demo ──────────
DEMO_USERNAME = "ProfessorPrimeDemo"
DEMO_PASSWORD = "ProfessorPrimeDemo"
DEMO_ACCOUNT_NAME = "BerlinStar Demo (Professor Prime)"
DEMO_EMAIL = "demo@berlinstar.ro"
DEMO_COMPANY_NAME = "Professor Prime SRL"
DEMO_CUI = 48217350  # CUI fictiv, 8 cifre

# ────────── Interval temporal ──────────
DATE_START = date(2024, 5, 1)
DATE_END = date(2026, 5, 18)
INITIAL_STOCK_DATE = date(2024, 4, 15)
AVG_RECEIPTS_PER_DAY = 40

# ────────── Locatii ──────────
LOCATIONS = [
    {"name": "BerlinStar Centru", "city": "Bucuresti", "weight": 0.55},
    {"name": "BerlinStar Nord",   "city": "Voluntari",  "weight": 0.45},
]

# ────────── Angajati (5 per locatie: 1 manager + 4 tehnicieni) ──────────
EMPLOYEES_CENTRU = [
    ("Popescu Mihai",   "Manager"),
    ("Ionescu Adrian",  "Tehnician vulcanizare"),
    ("Popa Mihai",      "Tehnician mecanica"),
    ("Stoica Andrei",   "Tehnician geometrie & clima"),
    ("Dumitru Bogdan",  "Spalator auto"),
]
EMPLOYEES_NORD = [
    ("Constantin Diana", "Manager"),
    ("Vasile Costin",    "Tehnician vulcanizare"),
    ("Marin Stefan",     "Tehnician mecanica"),
    ("Radu Alex",        "Tehnician geometrie & clima"),
    ("Nistor Razvan",    "Spalator auto"),
]

# ────────── Divizii ──────────
DEPARTMENTS = [
    "Vulcanizare",
    "Mecanica",
    "Hotel Anvelope",
    "Geometrie",
    "Spalatorie Auto",
    "Clima Auto",
]

# ────────── Catalog anvelope ──────────
TIRE_BRANDS = [
    "Michelin", "Continental", "Bridgestone", "Goodyear", "Pirelli",
    "Hankook", "Nokian", "Dunlop", "Yokohama", "Kumho",
]
TIRE_SIZES = [
    "175/65 R14", "185/65 R15", "195/65 R15", "195/55 R16", "205/55 R16",
    "205/60 R16", "215/55 R17", "225/45 R17", "225/50 R17", "225/55 R17",
    "235/45 R18", "235/55 R18", "245/40 R18", "245/45 R19", "255/35 R20",
]
TIRE_PROFILES = ["Iarna", "Vara", "All-Season (M+S)"]

# Locuri cazare (rafturi) — vor avea un set pentru fiecare locatie
TIRE_HOTEL_RACKS = ["Raft A", "Raft B", "Raft C", "Raft D"]

# ────────── Distributia diviziilor pe sezon (probabilitati nenormalizate) ──────────
# sezoane: winter (dec-feb), spring (mar-mai), summer (iun-aug), autumn (sep-nov)
DEPT_WEIGHTS = {
    "Vulcanizare":    {"winter": 0.20, "spring": 0.45, "summer": 0.10, "autumn": 0.50},
    "Mecanica":       {"winter": 0.22, "spring": 0.18, "summer": 0.20, "autumn": 0.18},
    "Spalatorie Auto":{"winter": 0.13, "spring": 0.18, "summer": 0.40, "autumn": 0.15},
    "Geometrie":      {"winter": 0.10, "spring": 0.08, "summer": 0.07, "autumn": 0.08},
    "Clima Auto":     {"winter": 0.05, "spring": 0.08, "summer": 0.20, "autumn": 0.05},
    "Hotel Anvelope": {"winter": 0.30, "spring": 0.03, "summer": 0.03, "autumn": 0.04},
}

# Split metode plata (pentru receipts platite)
PAY_METHOD_SPLIT = {
    "PLATIT_RATE": 0.85,    # 85% sunt platite (CARD/CASH/OP)
    "PARTIAL_RATE": 0.05,
    "NEPLATIT_RATE": 0.10,
    # din cei "platit": 50% card, 35% cash, 15% OP
    "CARD_RATE": 0.50,
    "CASH_RATE": 0.35,
    "OP_RATE": 0.15,
}

# Clienti
N_CLIENTS_FIZICI = 600
N_CLIENTS_JURIDICI = 200

# Performanta
COMMIT_BATCH_SIZE = 2000        # receipts per commit
RECEIPTS_REPORT_EVERY_DAYS = 30

# Hotel anvelope
TIRE_HOTEL_CLIENT_RATIO = 0.10   # 10% din clienti cu masina
TIRE_HOTEL_CYCLES = [
    # (checkin_year_offset, checkin_month, checkin_day,
    #  checkout_year_offset, checkout_month, checkout_day,
    #  season_stored)
    (0, 10, 15, 1, 4, 10, "vara"),    # cazare oct 2024 → apr 2025 (depozitate anv vara)
    (1, 4, 10, 1, 10, 15, "iarna"),   # apr 2025 → oct 2025 (depozitate anv iarna)
    (1, 10, 15, 2, 4, 10, "vara"),    # oct 2025 → apr 2026 (depozitate anv vara)
]
