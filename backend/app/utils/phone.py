"""Normalizarea numerelor de telefon pentru programarile online.

Clientul scrie numarul cum vrea („0740 123 456", „+40 740-123-456",
„0040740123456"). Ca sa putem cauta programarile dupa telefon si sa legam
programarea de un client existent, il aducem la o singura forma: E.164
(„+40740123456").

Numerele romanesti se recunosc dupa prefix; un numar care incepe cu „+" sau
„00" si nu e romanesc e pastrat ca atare, daca are lungimea unui numar valid.
Nu validam planul de numerotare al altor tari.
"""
from __future__ import annotations
import re

_SEPARATORS = re.compile(r"[\s\-.()/]")


def normalize_phone(raw: str | None) -> str | None:
    """Intoarce numarul in forma E.164 sau None daca nu se poate interpreta."""
    if not raw:
        return None
    s = _SEPARATORS.sub("", raw.strip())
    if s.startswith("+"):
        digits = s[1:]
    elif s.startswith("00"):
        digits = s[2:]
    elif s.startswith("0"):
        # Numar national romanesc: 07xx xxx xxx, 02xx/03xx fix.
        digits = "40" + s[1:]
    elif s.startswith("40") and len(s) == 11:
        digits = s
    elif len(s) == 9 and s[0] in "723":
        # 740123456 — fara zeroul de inceput.
        digits = "40" + s
    else:
        return None
    if not digits.isdigit():
        return None
    if digits.startswith("40"):
        # Romania: 40 + 9 cifre, iar prima cifra nationala e 2, 3 sau 7.
        if len(digits) != 11 or digits[2] not in "237":
            return None
    elif not 8 <= len(digits) <= 15:
        return None
    return "+" + digits


def national_suffix(e164: str) -> str:
    """Ultimele 9 cifre — partea care se regaseste in orice forma de scriere a
    numarului, folosita la potrivirea cu `clienti.telefon` (text liber)."""
    return e164[-9:]
