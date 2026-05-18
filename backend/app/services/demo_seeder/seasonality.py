"""Funcții pentru curba de sezonalitate + ponderi pe divizii."""
from __future__ import annotations
import math
import random
from datetime import date


def season_of(d: date) -> str:
    """Returneaza sezonul pentru o data (folosit la ponderi pe divizie)."""
    m = d.month
    if m in (12, 1, 2):
        return "winter"
    if m in (3, 4, 5):
        return "spring"
    if m in (6, 7, 8):
        return "summer"
    return "autumn"


def multiplier(d: date, rng: random.Random) -> float:
    """Multiplicator zilnic: bumps primavara + toamna, weekday weighting, noise gaussian."""
    doy = d.timetuple().tm_yday
    spring = math.cos(2 * math.pi * (doy - 120) / 365)   # varf ~ 30 aprilie
    autumn = math.cos(2 * math.pi * (doy - 285) / 365)   # varf ~ 12 octombrie
    seasonal = 1.0 + 0.55 * max(spring, autumn)          # ~0.45 .. 1.55

    weekday_w = {0: 1.00, 1: 1.05, 2: 1.05, 3: 1.05, 4: 1.10, 5: 1.10, 6: 0.30}[d.weekday()]
    noise = max(0.40, rng.gauss(1.0, 0.12))
    return seasonal * weekday_w * noise


def receipts_for_day(d: date, base_avg: int, rng: random.Random) -> int:
    """Câte devize generam într-o zi data."""
    return max(0, round(base_avg * multiplier(d, rng)))


def pick_department_weights(d: date, dept_weights: dict[str, dict[str, float]]) -> dict[str, float]:
    """Returneaza dict {dept_name: weight} pentru ziua data, normalizat."""
    s = season_of(d)
    raw = {name: w[s] for name, w in dept_weights.items()}
    total = sum(raw.values())
    return {name: v / total for name, v in raw.items()}
