"""Export PDF pentru un raport Radar AI (reportlab platypus, diacritice romanesti)."""
from __future__ import annotations

import io
import logging
import re
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

log = logging.getLogger("berlinstar.radar.pdf")

IMAGE_TIMEOUT = 5.0
IMAGE_MAX_WIDTH = 600
_FONT_CANDIDATES = [
    ("DejaVuSans", "DejaVuSans-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
     "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("DejaVuSans", "DejaVuSans-Bold", "/usr/share/fonts/dejavu/DejaVuSans.ttf",
     "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"),
    ("DejaVuSans", "DejaVuSans-Bold", "/usr/share/fonts/TTF/DejaVuSans.ttf",
     "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"),
]

IMPACT_COLORS = {
    "high": colors.HexColor("#b91c1c"),
    "medium": colors.HexColor("#b45309"),
    "low": colors.HexColor("#4b5563"),
}
SENTIMENT_COLORS = {
    "positive": colors.HexColor("#15803d"),
    "negative": colors.HexColor("#b91c1c"),
    "neutral": colors.HexColor("#4b5563"),
}

_fonts: tuple[str, str] | None = None


def _register_fonts() -> tuple[str, str]:
    """Fontul cu diacritice; daca lipseste, cadem pe Helvetica (fara diacritice complete)."""
    global _fonts
    if _fonts is not None:
        return _fonts
    import os

    for regular, bold, path_regular, path_bold in _FONT_CANDIDATES:
        if not os.path.exists(path_regular):
            continue
        try:
            pdfmetrics.registerFont(TTFont(regular, path_regular))
            if os.path.exists(path_bold):
                pdfmetrics.registerFont(TTFont(bold, path_bold))
            else:
                bold = regular
            pdfmetrics.registerFontFamily(regular, normal=regular, bold=bold)
            _fonts = (regular, bold)
            return _fonts
        except Exception:  # noqa: BLE001
            log.warning("Nu am putut inregistra fontul %s", path_regular)
    _fonts = ("Helvetica", "Helvetica-Bold")
    return _fonts


def _styles(font: str, font_bold: str) -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    make = lambda name, **kw: ParagraphStyle(name, parent=base["Normal"], **kw)  # noqa: E731
    return {
        "title": make("RadarTitle", fontName=font_bold, fontSize=18, leading=22, spaceAfter=6),
        "meta": make("RadarMeta", fontName=font, fontSize=9, leading=12,
                     textColor=colors.HexColor("#6b7280"), spaceAfter=10),
        "h2": make("RadarH2", fontName=font_bold, fontSize=13, leading=16,
                   spaceBefore=12, spaceAfter=6),
        "h3": make("RadarH3", fontName=font_bold, fontSize=11, leading=14,
                   spaceBefore=8, spaceAfter=4),
        "body": make("RadarBody", fontName=font, fontSize=9.5, leading=13,
                     alignment=TA_LEFT, spaceAfter=4),
        "bullet": make("RadarBullet", fontName=font, fontSize=9.5, leading=13,
                       leftIndent=10, bulletIndent=2, spaceAfter=2),
        "small": make("RadarSmall", fontName=font, fontSize=8, leading=10,
                      textColor=colors.HexColor("#6b7280")),
        "cell": make("RadarCell", fontName=font, fontSize=8.5, leading=11),
        "cellb": make("RadarCellB", fontName=font_bold, fontSize=8.5, leading=11),
        "chip": make("RadarChip", fontName=font_bold, fontSize=8, leading=10,
                     textColor=colors.white),
    }


def _esc(text: Any) -> str:
    value = "" if text is None else str(text)
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _inline(text: Any) -> str:
    out = _esc(text)
    out = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", out)
    out = re.sub(r"(?<!\*)\*([^*\n]+?)\*(?!\*)", r"<i>\1</i>", out)
    return out


def _markdown(text: str, st: dict) -> list:
    """Markdown minimal: paragrafe, liste cu -/*/1., **bold**."""
    flow = []
    for raw in (text or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#"):
            flow.append(Paragraph(_inline(line.lstrip("#").strip()), st["h3"]))
        elif re.match(r"^[-*•]\s+", line):
            flow.append(Paragraph(_inline(re.sub(r"^[-*•]\s+", "", line)),
                                  st["bullet"], bulletText="•"))
        elif re.match(r"^\d+[.)]\s+", line):
            flow.append(Paragraph(_inline(line), st["bullet"]))
        else:
            flow.append(Paragraph(_inline(line), st["body"]))
    return flow


def _chip(text: str, color, st: dict) -> Table:
    cell = Table([[Paragraph(_esc(text).upper(), st["chip"])]], colWidths=[26 * mm])
    cell.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return cell


def _grid(data: list[list], widths: list[float]) -> Table:
    table = Table(data, colWidths=widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return table


def _download_image(url: str):
    try:
        import httpx

        with httpx.Client(timeout=IMAGE_TIMEOUT, follow_redirects=True) as client:
            response = client.get(url)
            response.raise_for_status()
            data = response.content
        image = Image(io.BytesIO(data))
        width, height = image.imageWidth, image.imageHeight
        if not width or not height:
            return None
        max_width = min(IMAGE_MAX_WIDTH * 0.75, 110 * mm)
        if width > max_width:
            image.drawHeight = height * (max_width / width)
            image.drawWidth = max_width
        return image
    except Exception:  # noqa: BLE001
        return None


def build_report_pdf(run: Any, account_name: str) -> bytes:
    """Randeaza ReportDoc-ul unui run in PDF A4."""
    font, font_bold = _register_fonts()
    st = _styles(font, font_bold)
    report = getattr(run, "report", None) or {}
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=16 * mm, rightMargin=16 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
        title=f"Radar AI — {account_name}", author="Berlin Star",
    )
    flow: list = []
    period = report.get("period") or {}

    flow.append(Paragraph(_esc(report.get("title") or "Raport Radar AI"), st["title"]))
    flow.append(Paragraph(
        f"{_esc(account_name)} · perioada {_esc(period.get('from') or '—')} – "
        f"{_esc(period.get('to') or '—')} · generat {_esc((report.get('generated_at') or '')[:19])}",
        st["meta"],
    ))

    flow.append(Paragraph("Sumar executiv", st["h2"]))
    flow.extend(_markdown(report.get("executive_summary") or "Fără sumar.", st))

    flow.extend(_key_signals(report, st))
    flow.extend(_recommendations(report, st))
    flow.extend(_decision_frame(report, st))
    flow.extend(_sections(report, st))

    flow.append(Paragraph("Față de raportul precedent", st["h2"]))
    flow.extend(_markdown(report.get("history_delta") or "—", st))

    gaps = report.get("data_gaps") or []
    if gaps:
        flow.append(Paragraph("Limitări și date lipsă", st["h2"]))
        for gap in gaps:
            flow.append(Paragraph(_inline(gap), st["bullet"], bulletText="•"))

    flow.append(Spacer(1, 8 * mm))
    flow.append(Paragraph(
        f"Generat de Berlin Star Radar AI · tokeni: {int(getattr(run, 'tokens_in', 0) or 0)} in / "
        f"{int(getattr(run, 'tokens_out', 0) or 0)} out",
        st["small"],
    ))

    doc.build(flow)
    return buffer.getvalue()


def _key_signals(report: dict, st: dict) -> list:
    signals = report.get("key_signals") or []
    if not signals:
        return []
    rows = [[Paragraph("Semnal", st["cellb"]), Paragraph("Interpretare", st["cellb"]),
             Paragraph("Impact", st["cellb"]), Paragraph("Ton", st["cellb"])]]
    for signal in signals:
        impact = str(signal.get("impact") or "low").lower()
        sentiment = str(signal.get("sentiment") or "neutral").lower()
        rows.append([
            Paragraph(_inline(signal.get("title")), st["cell"]),
            Paragraph(_inline(signal.get("insight")), st["cell"]),
            _chip(impact, IMPACT_COLORS.get(impact, IMPACT_COLORS["low"]), st),
            _chip(sentiment, SENTIMENT_COLORS.get(sentiment, SENTIMENT_COLORS["neutral"]), st),
        ])
    return [
        Paragraph("Semnale cheie", st["h2"]),
        _grid(rows, [42 * mm, 68 * mm, 27 * mm, 27 * mm]),
    ]


def _recommendations(report: dict, st: dict) -> list:
    recs = report.get("recommendations") or []
    if not recs:
        return []
    ordered = sorted(recs, key=lambda r: _as_int(r.get("priority"), 9))
    flow = [Paragraph("Recomandări", st["h2"])]
    for rec in ordered:
        block = [
            Paragraph(
                f"{_as_int(rec.get('priority'), 0)}. {_inline(rec.get('title'))}", st["h3"]
            ),
            Paragraph(_inline(rec.get("rationale")), st["body"]),
            Paragraph(f"<b>Acțiune:</b> {_inline(rec.get('action'))}", st["body"]),
            Paragraph(
                f"Orizont: {_esc(rec.get('horizon') or '—')} · "
                f"încredere: {_esc(rec.get('confidence') or '—')}",
                st["small"],
            ),
            Spacer(1, 3 * mm),
        ]
        flow.append(KeepTogether(block))
    return flow


def _decision_frame(report: dict, st: dict) -> list:
    frame = report.get("decision_frame") or {}
    if not (frame.get("question") or frame.get("options")):
        return []
    flow = [Paragraph("Cadrul de decizie", st["h2"])]
    if frame.get("question"):
        flow.append(Paragraph(_inline(frame.get("question")), st["body"]))
    options = frame.get("options") or []
    if options:
        rows = [[Paragraph("Opțiune", st["cellb"]), Paragraph("Pro", st["cellb"]),
                 Paragraph("Contra", st["cellb"])]]
        for option in options:
            rows.append([
                Paragraph(_inline(option.get("option")), st["cell"]),
                Paragraph(_inline("; ".join(option.get("pros") or [])), st["cell"]),
                Paragraph(_inline("; ".join(option.get("cons") or [])), st["cell"]),
            ])
        flow.append(_grid(rows, [44 * mm, 60 * mm, 60 * mm]))
    if frame.get("recommended"):
        flow.append(Paragraph(f"<b>Recomandat:</b> {_inline(frame.get('recommended'))}",
                              st["body"]))
    for risk in frame.get("risks") or []:
        flow.append(Paragraph(_inline(risk), st["bullet"], bulletText="•"))
    return flow


def _sections(report: dict, st: dict) -> list:
    sections = report.get("sections") or {}
    flow: list = []
    flow.extend(_youtube_section(sections.get("youtube") or [], st))
    flow.extend(_companies_section(sections.get("companies") or [], st))
    flow.extend(_websites_section(sections.get("websites") or [], st))
    flow.extend(_reviews_section(sections.get("reviews") or [], st))
    return flow


def _youtube_section(items: list, st: dict) -> list:
    if not items:
        return []
    flow = [Paragraph("YouTube", st["h2"])]
    for item in items:
        flow.append(Paragraph(_inline(item.get("video_title") or item.get("url")), st["h3"]))
        flow.append(Paragraph(
            f"{_esc(item.get('source_label'))} · {_esc(item.get('published_at') or '')} · "
            f"relevanță {_esc(item.get('relevance'))}",
            st["small"],
        ))
        flow.append(Paragraph(_inline(item.get("summary")), st["body"]))
        for achievement in item.get("achievements") or []:
            flow.append(Paragraph(_inline(achievement), st["bullet"], bulletText="•"))
        if item.get("selling"):
            flow.append(Paragraph(
                f"<b>Vinde:</b> {_inline(item.get('selling_what'))} · "
                f"CTA: {_inline(item.get('call_to_action'))}", st["body"]))
    return flow


def _companies_section(items: list, st: dict) -> list:
    if not items:
        return []
    flow = [Paragraph("Firme concurente", st["h2"])]
    for item in items:
        flow.append(Paragraph(
            f"{_inline(item.get('name'))} (CUI {_esc(item.get('cui'))})", st["h3"]))
        flow.append(Paragraph(
            f"Status: {_esc(item.get('status') or '—')} · TVA: "
            f"{_esc('da' if item.get('vat_payer') else 'nu' if item.get('vat_payer') is False else '—')}"
            f" · trend: {_esc(item.get('trend') or 'unknown')}",
            st["small"],
        ))
        financials = item.get("financials") or []
        if financials:
            rows = [[Paragraph("An", st["cellb"]), Paragraph("Cifră afaceri", st["cellb"]),
                     Paragraph("Profit", st["cellb"]), Paragraph("Angajați", st["cellb"])]]
            for year in financials:
                rows.append([
                    Paragraph(_esc(year.get("year")), st["cell"]),
                    Paragraph(_money(year.get("turnover")), st["cell"]),
                    Paragraph(_money(year.get("profit")), st["cell"]),
                    Paragraph(_esc(year.get("employees") if year.get("employees") is not None else "—"),
                              st["cell"]),
                ])
            flow.append(_grid(rows, [24 * mm, 50 * mm, 50 * mm, 30 * mm]))
        if item.get("commentary"):
            flow.append(Paragraph(_inline(item.get("commentary")), st["body"]))
    return flow


def _websites_section(items: list, st: dict) -> list:
    if not items:
        return []
    flow = [Paragraph("Site-uri urmărite", st["h2"])]
    for item in items:
        flow.append(Paragraph(_inline(item.get("title") or item.get("url")), st["h3"]))
        flow.append(Paragraph(_esc(item.get("url")), st["small"]))
        for novelty in item.get("novelties") or []:
            block = [
                Paragraph(
                    f"<b>{_inline(novelty.get('title'))}</b> "
                    f"({_esc(novelty.get('category') or 'altceva')})", st["body"]),
                Paragraph(_inline(novelty.get("description")), st["body"]),
            ]
            image = _download_image(novelty.get("image_url")) if novelty.get("image_url") else None
            if image is not None:
                block.append(image)
                block.append(Spacer(1, 2 * mm))
            flow.append(KeepTogether(block))
        if item.get("commentary"):
            flow.append(Paragraph(_inline(item.get("commentary")), st["body"]))
    return flow


def _reviews_section(items: list, st: dict) -> list:
    if not items:
        return []
    flow = [Paragraph("Recenzii Google", st["h2"])]
    for item in items:
        flow.append(Paragraph(_inline(item.get("name") or item.get("source_label")), st["h3"]))
        flow.append(Paragraph(
            f"Rating {_esc(item.get('rating') or '—')} din {_esc(item.get('reviews_count') or 0)} recenzii",
            st["small"],
        ))
        themes = item.get("themes") or []
        if themes:
            rows = [[Paragraph("Temă", st["cellb"]), Paragraph("Ton", st["cellb"]),
                     Paragraph("Apariții", st["cellb"]), Paragraph("Exemplu", st["cellb"])]]
            for theme in themes:
                sentiment = str(theme.get("sentiment") or "neutral").lower()
                rows.append([
                    Paragraph(_inline(theme.get("theme")), st["cell"]),
                    _chip(sentiment, SENTIMENT_COLORS.get(sentiment,
                                                          SENTIMENT_COLORS["neutral"]), st),
                    Paragraph(_esc(theme.get("count") or ""), st["cell"]),
                    Paragraph(_inline(theme.get("example")), st["cell"]),
                ])
            flow.append(_grid(rows, [38 * mm, 28 * mm, 20 * mm, 78 * mm]))
        if item.get("commentary"):
            flow.append(Paragraph(_inline(item.get("commentary")), st["body"]))
    return flow


def _money(value: Any) -> str:
    if value is None:
        return "—"
    try:
        return f"{float(value):,.0f}".replace(",", ".")
    except (TypeError, ValueError):
        return _esc(value)


def _as_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
