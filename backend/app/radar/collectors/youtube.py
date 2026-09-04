"""Collector YouTube: rezolvare canal, RSS video-uri recente, transcript."""
from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone

import httpx
from lxml import etree

from app.radar.types import ChannelInfo, CollectorError, VideoItem

BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent": BROWSER_UA,
    "Accept-Language": "ro,en;q=0.8",
    "Cookie": "CONSENT=YES+1; SOCS=CAI",
}
_TIMEOUT = 20.0

_CHANNEL_ID_RE = re.compile(r"UC[\w-]{22}")
_CHANNEL_ID_JSON_RE = re.compile(r'"channelId":"(UC[\w-]{22})"|"externalId":"(UC[\w-]{22})"')
_META_IDENTIFIER_RE = re.compile(
    r'<meta[^>]+itemprop="identifier"[^>]+content="(UC[\w-]{22})"', re.IGNORECASE
)
_META_CHANNEL_ID_RE = re.compile(
    r'<meta[^>]+itemprop="channelId"[^>]+content="(UC[\w-]{22})"', re.IGNORECASE
)
_OG_TITLE_RE = re.compile(
    r'<meta[^>]+property="og:title"[^>]+content="([^"]*)"', re.IGNORECASE
)

_NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "media": "http://search.yahoo.com/mrss/",
}


def _channel_page_url(value: str) -> str:
    value = value.strip()
    m = _CHANNEL_ID_RE.fullmatch(value)
    if m:
        return f"https://www.youtube.com/channel/{value}"
    if value.startswith("@"):
        return f"https://www.youtube.com/{value}"
    if "youtube.com/channel/" in value:
        return value if value.startswith("http") else f"https://{value}"
    if "youtube.com/@" in value or "youtube.com/c/" in value:
        return value if value.startswith("http") else f"https://{value}"
    return f"https://www.youtube.com/{value.lstrip('/')}" if value else value


async def resolve_channel(value: str, client: httpx.AsyncClient | None = None) -> ChannelInfo:
    """Rezolva un canal YouTube din UC-id, URL de canal/handle, sau handle @."""
    value = (value or "").strip()
    if not value:
        raise CollectorError("Introduceti un canal YouTube (URL, @handle sau ID).")
    m = _CHANNEL_ID_RE.fullmatch(value)
    if m and "youtube.com" not in value:
        channel_id = value
        url = f"https://www.youtube.com/channel/{channel_id}"
        title = await _fetch_title_only(url, client) or channel_id
        return ChannelInfo(channel_id=channel_id, title=title, url=url)

    page_url = _channel_page_url(value)
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True)
    try:
        try:
            resp = await client.get(page_url, headers=_HEADERS)
        except httpx.HTTPError as exc:
            raise CollectorError(f"Nu am putut accesa canalul YouTube: {page_url}") from exc
        if resp.status_code >= 400:
            raise CollectorError(f"Canalul YouTube nu a fost gasit: {page_url}")
        html = resp.text
    finally:
        if own_client:
            await client.aclose()

    channel_id = None
    for pattern in (_CHANNEL_ID_JSON_RE, _META_IDENTIFIER_RE, _META_CHANNEL_ID_RE):
        found = pattern.search(html)
        if found:
            channel_id = next(g for g in found.groups() if g)
            break
    if not channel_id:
        raise CollectorError("Nu am gasit ID-ul canalului YouTube pe pagina indicata.")

    title_match = _OG_TITLE_RE.search(html)
    title = title_match.group(1) if title_match else channel_id
    return ChannelInfo(
        channel_id=channel_id,
        title=title,
        url=f"https://www.youtube.com/channel/{channel_id}",
    )


async def _fetch_title_only(url: str, client: httpx.AsyncClient | None) -> str | None:
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True)
    try:
        resp = await client.get(url, headers=_HEADERS)
        if resp.status_code >= 400:
            return None
        found = _OG_TITLE_RE.search(resp.text)
        return found.group(1) if found else None
    except httpx.HTTPError:
        return None
    finally:
        if own_client:
            await client.aclose()


def _text(node, path: str, ns=_NS) -> str:
    found = node.find(path, ns)
    return found.text.strip() if found is not None and found.text else ""


async def fetch_recent_videos(
    channel_id: str, limit: int = 10, client: httpx.AsyncClient | None = None
) -> list[VideoItem]:
    """Video-uri recente dintr-un canal, via feed RSS public."""
    url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True)
    try:
        try:
            resp = await client.get(url, headers=_HEADERS)
        except httpx.HTTPError as exc:
            raise CollectorError("Nu am putut citi lista de video-uri YouTube.") from exc
        if resp.status_code >= 400:
            raise CollectorError("Canalul YouTube nu are un feed de video-uri disponibil.")
        content = resp.content
    finally:
        if own_client:
            await client.aclose()

    try:
        root = etree.fromstring(content)
    except etree.XMLSyntaxError as exc:
        raise CollectorError("Feed-ul YouTube este invalid.") from exc

    videos: list[VideoItem] = []
    for entry in root.findall("atom:entry", _NS)[:limit]:
        video_id = _text(entry, "yt:videoId")
        title = _text(entry, "atom:title")
        link_el = entry.find("atom:link", _NS)
        link = link_el.get("href") if link_el is not None else ""
        published_raw = _text(entry, "atom:published")
        try:
            published_at = datetime.fromisoformat(published_raw.replace("Z", "+00:00"))
        except ValueError:
            published_at = datetime.now(timezone.utc)
        group = entry.find("media:group", _NS)
        description = _text(group, "media:description") if group is not None else ""
        if not video_id:
            continue
        videos.append(
            VideoItem(
                video_id=video_id,
                title=title,
                url=link or f"https://www.youtube.com/watch?v={video_id}",
                published_at=published_at,
                description=description,
            )
        )
    return videos


_TRANSCRIPT_CHAR_LIMIT = 60000


async def fetch_transcript(video_id: str, languages: tuple[str, ...] = ("ro", "en")) -> str | None:
    """Transcript video (daca exista), altfel None. Nu ridica exceptii — sursa e opționala."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        return None

    def _run() -> str | None:
        try:
            if hasattr(YouTubeTranscriptApi, "get_transcript"):
                snippets = YouTubeTranscriptApi.get_transcript(video_id, languages=list(languages))
                text = " ".join(s.get("text", "") for s in snippets)
            else:
                fetched = YouTubeTranscriptApi().fetch(video_id, languages=list(languages))
                text = " ".join(s.text for s in fetched)
            text = text.strip()
            return text or None
        except Exception:
            return None

    text = await asyncio.to_thread(_run)
    if text is None:
        return None
    return text[:_TRANSCRIPT_CHAR_LIMIT]
