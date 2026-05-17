"""Validare Schematron CIUS-RO v1.0.9 (optionala, controlata prin AnafSettings.validate_schematron).

NOTA: Pentru a folosi validarea Schematron, descarca artefactele de la
https://mfinante.gov.ro/web/efactura/informatii-tehnice (zip-ul `ro16931-ubl-1.0.9.zip`)
si pune fisierul `.sch` compilat la `SCHEMATRON_PATH` (vezi env).

In lipsa fisierului, validate_schematron() returneaza un dictionar gol (nimic de raportat),
fara sa ridice eroare — pentru a permite flow-ul sa continue.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

log = logging.getLogger("berlinstar.efactura.schematron")

_SCHEMATRON_PATH = os.getenv(
    "ANAF_SCHEMATRON_PATH",
    "/var/lib/berlinstar/anaf/schematron/CIUS-RO.sch",
)

# Cache compiled schema in process memory
_compiled = None


def _load_schematron():
    global _compiled
    if _compiled is not None:
        return _compiled
    path = Path(_SCHEMATRON_PATH)
    if not path.exists():
        log.info(
            "Fisierul Schematron CIUS-RO nu este disponibil la %s. "
            "Validarea Schematron va fi sarita.",
            _SCHEMATRON_PATH,
        )
        return None
    try:
        from lxml import etree
        from lxml.isoschematron import Schematron
    except ImportError:
        log.warning("lxml nu suporta isoschematron in acest mediu.")
        return None
    try:
        sch_doc = etree.parse(str(path))
        _compiled = Schematron(sch_doc, store_report=True)
        return _compiled
    except Exception as exc:  # noqa: BLE001
        log.error("Eroare la incarcarea Schematron CIUS-RO: %s", exc)
        return None


def validate_schematron(xml: str) -> list[str]:
    """Returneaza lista de mesaje de eroare (gol daca XML-ul e valid sau Schematron e indisponibil)."""
    schematron = _load_schematron()
    if schematron is None:
        return []
    try:
        from lxml import etree
        doc = etree.fromstring(xml.encode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        return [f"XML invalid pentru Schematron: {exc}"]

    valid = schematron.validate(doc)
    if valid:
        return []

    report = schematron.validation_report
    issues: list[str] = []
    if report is not None:
        ns = {"svrl": "http://purl.oclc.org/dsdl/svrl"}
        for failed in report.findall(".//svrl:failed-assert", ns):
            text = (failed.findtext("svrl:text", default="", namespaces=ns) or "").strip()
            location = failed.get("location", "")
            issues.append(f"{text} (la {location})")
    if not issues:
        issues.append("Schematron a respins XML-ul, dar fara mesaje specifice.")
    return issues


def is_available() -> bool:
    return Path(_SCHEMATRON_PATH).exists()
