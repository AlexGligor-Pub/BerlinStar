"""Normalizarea numarului de inmatriculare, intr-un singur loc.

Acelasi numar se tasteaza in trei feluri — „TM01ABC", „TM 01 ABC", „tm-01-abc" —
si pana acum fiecare parte a aplicatiei decidea singura cat de mult sa ignore:
cautarea dupa placuta scotea doar spatiile, iar legarea masinii de client compara
sirurile ca atare. Din diferenta asta se nasteau masini duplicate in garajul
clientului: cautarea le vedea ca fiind aceeasi masina, salvarea ca doua.

Regula unica: majuscule, fara spatii si fara cratime. Nu atingem nimic altceva —
nu „reparam" caractere si nu validam formatul, fiindca in sistem exista si numere
straine sau provizorii.
"""
from __future__ import annotations

from sqlalchemy import func


def normalize_plate(value: str | None) -> str:
    """Forma canonica folosita la comparatii. Pentru afisare pastram ce a tastat
    operatorul — normalizarea e doar cheie de potrivire, nu date."""
    if not value:
        return ""
    return value.replace(" ", "").replace("-", "").upper()


def normalized_plate_column(column):
    """Acelasi calcul, dar in SQL, ca sa putem compara direct intr-un WHERE fara
    sa aducem toate randurile in Python."""
    return func.upper(func.replace(func.replace(column, " ", ""), "-", ""))
