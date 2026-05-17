"""Generator XML UBL 2.1 conform CIUS-RO v1.0.9 din InvoicePayload.

Folosim Jinja2 pentru template-ul XML + lxml pentru validare well-formed.
"""
from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape
from lxml import etree

from app.efactura.exceptions import EFacturaError
from app.efactura.mapping import InvoicePayload

_TEMPLATE_DIR = Path(__file__).parent / "templates"
_TEMPLATE_NAME = "ubl_invoice_2_1.xml.j2"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(disabled_extensions=("j2",), default=False),
    keep_trailing_newline=True,
    trim_blocks=False,
    lstrip_blocks=False,
    undefined=StrictUndefined,
)


def build_xml(payload: InvoicePayload) -> str:
    """Randeaza payload-ul ca XML UBL 2.1 si valideaza well-formed-ness.

    Ridica EFacturaError daca XML-ul rezultat nu se parseaza.
    """
    template = _env.get_template(_TEMPLATE_NAME)
    xml_str = template.render(payload=payload)
    try:
        etree.fromstring(xml_str.encode("utf-8"))
    except etree.XMLSyntaxError as exc:
        raise EFacturaError(f"XML generat nu este well-formed: {exc}") from exc
    return xml_str


def pretty_print(xml_str: str) -> str:
    """Returneaza XML-ul reformatat (indentat) pentru afisare in UI."""
    parser = etree.XMLParser(remove_blank_text=True)
    try:
        root = etree.fromstring(xml_str.encode("utf-8"), parser)
    except etree.XMLSyntaxError:
        return xml_str
    return etree.tostring(root, pretty_print=True, encoding="unicode")
