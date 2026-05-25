from __future__ import annotations
from datetime import date, timedelta
from functools import lru_cache


def _orthodox_easter(year: int) -> date:
    # Meeus algorithm for Orthodox Easter on the Gregorian calendar.
    a = year % 4
    b = year % 7
    c = year % 19
    d = (19 * c + 15) % 30
    e = (2 * a + 4 * b - d + 34) % 7
    month = (d + e + 114) // 31
    day = ((d + e + 114) % 31) + 1
    julian = date(year, month, day)
    offset = 13 if 1900 <= year < 2100 else 14
    return julian + timedelta(days=offset)


@lru_cache(maxsize=64)
def get_romanian_holidays(year: int) -> dict[date, str]:
    easter = _orthodox_easter(year)
    pentecost = easter + timedelta(days=49)
    holidays: dict[date, str] = {
        date(year, 1, 1):  "Anul Nou",
        date(year, 1, 2):  "Anul Nou",
        date(year, 1, 6):  "Boboteaza",
        date(year, 1, 7):  "Sfantul Ioan",
        date(year, 1, 24): "Ziua Unirii",
        easter - timedelta(days=2): "Vinerea Mare",
        easter:                     "Pastele",
        easter + timedelta(days=1): "A doua zi de Paste",
        date(year, 5, 1):  "Ziua Muncii",
        date(year, 6, 1):  "Ziua Copilului",
        pentecost:                       "Rusalii",
        pentecost + timedelta(days=1):   "A doua zi de Rusalii",
        date(year, 8, 15): "Adormirea Maicii Domnului",
        date(year, 11, 30): "Sfantul Andrei",
        date(year, 12, 1):  "Ziua Nationala",
        date(year, 12, 25): "Craciunul",
        date(year, 12, 26): "A doua zi de Craciun",
    }
    return holidays


def count_working_days(start: date, end: date) -> int:
    """Numar de zile lucratoare in intervalul [start, end] inclusiv.

    Exclude sambata, duminica si sarbatorile legale din Romania.
    """
    if end < start:
        return 0
    holidays_by_year: dict[int, dict[date, str]] = {}
    count = 0
    current = start
    while current <= end:
        year = current.year
        if year not in holidays_by_year:
            holidays_by_year[year] = get_romanian_holidays(year)
        if current.weekday() < 5 and current not in holidays_by_year[year]:
            count += 1
        current += timedelta(days=1)
    return count
