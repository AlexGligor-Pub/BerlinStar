"""Collector site web: text vizibil, imagini, linkuri interne."""
from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import httpx
from lxml import html as lxml_html

from app.radar.types import CollectorError, PageImage, PageInfo

BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
_HEADERS = {"User-Agent": BROWSER_UA, "Accept-Language": "ro,en;q=0.8"}
_TIMEOUT = 20.0
_MAX_TEXT = 20000
_MAX_IMAGES = 40
_MAX_LINKS = 80

_STRIP_TAGS = ("script", "style", "noscript", "nav", "footer", "header", "svg", "iframe")
_SKIP_IMAGE_EXT = re.compile(r"\.(svg|ico|gif)(\?.*)?$", re.IGNORECASE)
_SKIP_IMAGE_NAME = re.compile(r"logo|icon|sprite|pixel|tracking|badge", re.IGNORECASE)
_LAZY_ATTRS = ("data-src", "data-lazy-src", "data-original")


def normalize_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return url
    if not re.match(r"^https?://", url, re.IGNORECASE):
        url = f"https://{url}"
    return url


def _first_srcset_url(srcset: str) -> str | None:
    parts = [p.strip() for p in srcset.split(",") if p.strip()]
    if not parts:
        return None
    return parts[0].split()[0]


async def fetch_page(url: str, client: httpx.AsyncClient | None = None) -> PageInfo:
    """Extrage text vizibil, imagini si linkuri interne dintr-o pagina web."""
    url = normalize_url(url)
    if not url:
        raise CollectorError("Introduceti un URL de site valid.")

    own_client = client is None
    client = client or httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True)
    try:
        try:
            resp = await client.get(url, headers=_HEADERS)
        except httpx.HTTPError as exc:
            raise CollectorError(f"Nu am putut accesa site-ul: {url}") from exc
        if resp.status_code >= 400:
            raise CollectorError(f"Site-ul a raspuns cu eroare ({resp.status_code}): {url}")
        final_url = str(resp.url)
        content = resp.content
    finally:
        if own_client:
            await client.aclose()

    try:
        tree = lxml_html.fromstring(content)
    except Exception as exc:
        raise CollectorError(f"Continutul paginii nu a putut fi interpretat: {url}") from exc

    title = ""
    title_el = tree.find(".//title")
    if title_el is not None and title_el.text:
        title = title_el.text.strip()
    if not title:
        og_title = tree.xpath('//meta[@property="og:title"]/@content')
        if og_title:
            title = og_title[0].strip()

    for tag in _STRIP_TAGS:
        for el in tree.xpath(f"//{tag}"):
            el.drop_tree()

    text = tree.text_content() or ""
    text = re.sub(r"\s+", " ", text).strip()[:_MAX_TEXT]

    images: list[PageImage] = []
    seen_src: set[str] = set()
    for img in tree.xpath("//img"):
        src = img.get("src") or ""
        if not src:
            for attr in _LAZY_ATTRS:
                src = img.get(attr) or ""
                if src:
                    break
        if not src:
            srcset = img.get("srcset")
            if srcset:
                src = _first_srcset_url(srcset) or ""
        if not src or src.startswith("data:"):
            continue
        abs_src = urljoin(final_url, src)
        if _SKIP_IMAGE_EXT.search(abs_src) or _SKIP_IMAGE_NAME.search(abs_src):
            continue
        if abs_src in seen_src:
            continue
        seen_src.add(abs_src)
        images.append(PageImage(src=abs_src, alt=(img.get("alt") or "").strip()))
        if len(images) >= _MAX_IMAGES:
            break

    host = urlparse(final_url).netloc
    links: list[dict] = []
    seen_links: set[str] = set()
    for a in tree.xpath("//a[@href]"):
        href = a.get("href") or ""
        if not href or href.startswith("#") or href.lower().startswith("javascript:"):
            continue
        abs_href = urljoin(final_url, href)
        if urlparse(abs_href).netloc != host:
            continue
        if abs_href in seen_links:
            continue
        text_content = (a.text_content() or "").strip()
        seen_links.add(abs_href)
        links.append({"url": abs_href, "text": text_content})
        if len(links) >= _MAX_LINKS:
            break

    content_hash = hashlib.sha1(text.encode("utf-8")).hexdigest()

    return PageInfo(
        url=final_url,
        title=title,
        text=text,
        images=images,
        links=links,
        content_hash=content_hash,
        fetched_at=datetime.now(timezone.utc),
    )
