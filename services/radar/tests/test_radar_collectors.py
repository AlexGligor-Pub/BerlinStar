"""Teste unitare pentru app.radar.collectors — fara retea, httpx.MockTransport.
Rulabil cu:  cd backend && venv/bin/python -m tests.run_all
"""
from __future__ import annotations

import sys
import types
from datetime import date

import httpx

from app.radar.collectors import anaf, gplaces, website, youtube
from app.radar.types import CollectorError


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=True)


CHANNEL_PAGE_HTML = """
<html><head>
<meta property="og:title" content="Canal Test SRL">
<script>var ytInitialData = {"channelId":"UCabcdefghijklmnopqrstuv","x":1};</script>
</head><body></body></html>
"""

RSS_XML = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns:media="http://search.yahoo.com/mrss/">
  <entry>
    <yt:videoId>vid123</yt:videoId>
    <title>Titlu video</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=vid123"/>
    <published>2026-01-15T10:00:00+00:00</published>
    <media:group>
      <media:description>Descriere scurta</media:description>
    </media:group>
  </entry>
  <entry>
    <yt:videoId>vid456</yt:videoId>
    <title>Al doilea</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=vid456"/>
    <published>2026-02-01T08:30:00+00:00</published>
    <media:group>
      <media:description>Alta descriere</media:description>
    </media:group>
  </entry>
</feed>
"""


async def test_resolve_channel_direct_id():
    def handler(request: httpx.Request) -> httpx.Response:
        assert "UCabcdefghijklmnopqrstuv" in str(request.url)
        return httpx.Response(200, text=CHANNEL_PAGE_HTML)

    async with _client(handler) as client:
        info = await youtube.resolve_channel("UCabcdefghijklmnopqrstuv", client=client)
    assert info.channel_id == "UCabcdefghijklmnopqrstuv"
    assert info.title == "Canal Test SRL"


async def test_resolve_channel_from_channel_url():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=CHANNEL_PAGE_HTML)

    async with _client(handler) as client:
        info = await youtube.resolve_channel(
            "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv", client=client
        )
    assert info.channel_id == "UCabcdefghijklmnopqrstuv"


async def test_resolve_channel_from_handle():
    def handler(request: httpx.Request) -> httpx.Response:
        assert "/@somebrand" in str(request.url)
        return httpx.Response(200, text=CHANNEL_PAGE_HTML)

    async with _client(handler) as client:
        info = await youtube.resolve_channel("@somebrand", client=client)
    assert info.channel_id == "UCabcdefghijklmnopqrstuv"


async def test_resolve_channel_not_found():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html><body>nimic</body></html>")

    async with _client(handler) as client:
        try:
            await youtube.resolve_channel("@lipsa", client=client)
        except CollectorError:
            pass
        else:
            raise AssertionError("astept CollectorError")


async def test_fetch_recent_videos_parses_rss():
    def handler(request: httpx.Request) -> httpx.Response:
        assert "channel_id=UCxyz" in str(request.url)
        return httpx.Response(200, content=RSS_XML.encode("utf-8"))

    async with _client(handler) as client:
        videos = await youtube.fetch_recent_videos("UCxyz", client=client)
    assert len(videos) == 2
    assert videos[0].video_id == "vid123"
    assert videos[0].title == "Titlu video"
    assert videos[0].description == "Descriere scurta"
    assert videos[0].published_at.year == 2026
    assert videos[1].video_id == "vid456"


async def test_fetch_transcript_joins_and_caps():
    fake_module = types.ModuleType("youtube_transcript_api")

    class _Snippet:
        def __init__(self, text: str) -> None:
            self.text = text

    class _FakeApi:
        def fetch(self, video_id, languages=None):
            return [_Snippet("a" * 40000), _Snippet("b" * 40000)]

    fake_module.YouTubeTranscriptApi = _FakeApi
    sys.modules["youtube_transcript_api"] = fake_module
    try:
        text = await youtube.fetch_transcript("vid123")
    finally:
        del sys.modules["youtube_transcript_api"]
    assert text is not None
    assert len(text) == 60000


async def test_fetch_transcript_none_on_error():
    fake_module = types.ModuleType("youtube_transcript_api")

    class _FakeApi:
        def fetch(self, video_id, languages=None):
            raise RuntimeError("no transcript")

    fake_module.YouTubeTranscriptApi = _FakeApi
    sys.modules["youtube_transcript_api"] = fake_module
    try:
        text = await youtube.fetch_transcript("vid123")
    finally:
        del sys.modules["youtube_transcript_api"]
    assert text is None


ANAF_TVA_FOUND = {
    "found": [
        {
            "date_generale": {
                "cui": 14399840,
                "denumire": "DANTE INTERNATIONAL SA",
                "adresa": "STR. X, NR. 6",
                "stare_inregistrare": "INREGISTRAT din data 29.08.2006",
                "data_inregistrare": "2002-01-23",
                "cod_CAEN": "4754",
            },
            "inregistrare_scop_Tva": {"scpTVA": True},
        }
    ]
}

ANAF_BILANT_JSON = {
    "an": 2023,
    "cui": 14399840,
    "caen": 4754,
    "den_caen": "Comert cu amanuntul",
    "i": [
        {"indicator": "I1", "val_indicator": 100, "val_den_indicator": "ACTIVE IMOBILIZATE - TOTAL "},
        {"indicator": "I2", "val_indicator": 200, "val_den_indicator": "ACTIVE CIRCULANTE - TOTAL, din care:"},
        {"indicator": "I7", "val_indicator": 50, "val_den_indicator": "DATORII"},
        {"indicator": "I13", "val_indicator": 7719798207, "val_den_indicator": "Cifra de afaceri neta"},
        {"indicator": "I18", "val_indicator": 119060358, "val_den_indicator": "Profit net"},
        {"indicator": "I19", "val_indicator": 0, "val_den_indicator": "Pierdere neta"},
        {"indicator": "I20", "val_indicator": 3231, "val_den_indicator": "Numar mediu de salariati"},
    ],
}


async def test_fetch_company_maps_fields():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        return httpx.Response(200, json=ANAF_TVA_FOUND)

    async with _client(handler) as client:
        info = await anaf.fetch_company(14399840, client=client)
    assert info.name == "DANTE INTERNATIONAL SA"
    assert info.vat_payer is True
    assert info.caen == "4754"


async def test_fetch_company_not_found_raises():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"found": []})

    async with _client(handler) as client:
        try:
            await anaf.fetch_company(999, client=client)
        except CollectorError:
            pass
        else:
            raise AssertionError("astept CollectorError")


async def test_fetch_bilant_maps_indicators():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=ANAF_BILANT_JSON)

    async with _client(handler) as client:
        info = await anaf.fetch_bilant(14399840, 2023, client=client)
    assert info is not None
    assert info.turnover == 7719798207
    assert info.profit == 119060358
    assert info.employees == 3231
    assert info.total_assets == 300
    assert info.total_debts == 50


async def test_fetch_bilant_none_on_404():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404)

    async with _client(handler) as client:
        info = await anaf.fetch_bilant(14399840, 1999, client=client)
    assert info is None


PAGE_HTML = """
<html><head><title>Pagina Test</title></head>
<body>
<nav>Meniu care se ignora</nav>
<header>Antet ignorat</header>
<main>
  <h1>Bun venit</h1>
  <p>Text   vizibil   cu spatii multiple.</p>
  <img src="/img/produs.jpg" alt="Produs">
  <img data-src="/img/lazy.png" alt="Lazy">
  <img srcset="/img/set-1x.jpg 1x, /img/set-2x.jpg 2x" alt="Srcset">
  <img src="/img/logo-mare.png" alt="Logo">
  <img src="/img/icon.svg" alt="Icon">
  <img src="data:image/png;base64,AAAA" alt="Inline">
  <a href="/despre">Despre noi</a>
  <a href="https://alt-domeniu.ro/pagina">Extern</a>
  <a href="#sectiune">Ancora</a>
</main>
<footer>Subsol ignorat</footer>
</body></html>
"""


async def test_fetch_page_extracts_text_images_links():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=PAGE_HTML, request=request)

    async with _client(handler) as client:
        page = await website.fetch_page("example.ro", client=client)
    assert page.title == "Pagina Test"
    assert "Meniu care se ignora" not in page.text
    assert "Antet ignorat" not in page.text
    assert "Subsol ignorat" not in page.text
    assert "Text vizibil cu spatii multiple." in page.text
    srcs = [img.src for img in page.images]
    assert any(s.endswith("/img/produs.jpg") for s in srcs)
    assert any(s.endswith("/img/lazy.png") for s in srcs)
    assert any(s.endswith("/img/set-1x.jpg") for s in srcs)
    assert not any("logo" in s for s in srcs)
    assert not any(s.endswith(".svg") for s in srcs)
    assert not any(s.startswith("data:") for s in srcs)
    link_urls = [l["url"] for l in page.links]
    assert any(l.endswith("/despre") for l in link_urls)
    assert not any("alt-domeniu.ro" in l for l in link_urls)
    assert page.content_hash


async def test_fetch_page_normalizes_missing_scheme():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        return httpx.Response(200, text="<html><body>ok</body></html>", request=request)

    async with _client(handler) as client:
        await website.fetch_page("www.exemplu.ro", client=client)
    assert calls[0].startswith("https://")


PLACES_SEARCH_JSON = {
    "places": [
        {
            "id": "ChIJabc123",
            "displayName": {"text": "Service Auto SRL"},
            "formattedAddress": "Str. Exemplu 1, Timisoara",
            "rating": 4.5,
            "userRatingCount": 120,
        }
    ]
}

PLACES_DETAILS_JSON = {
    "id": "ChIJabc123",
    "displayName": {"text": "Service Auto SRL"},
    "rating": 4.5,
    "userRatingCount": 120,
    "reviews": [
        {
            "authorAttribution": {"displayName": "Ion P."},
            "rating": 5,
            "originalText": {"text": "Servicii foarte bune."},
            "publishTime": "2026-01-10T00:00:00Z",
            "relativePublishTimeDescription": "o luna in urma",
        }
    ],
}


async def test_resolve_place_maps_search_result():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["X-Goog-Api-Key"] == "key123"
        return httpx.Response(200, json=PLACES_SEARCH_JSON)

    async with _client(handler) as client:
        place = await gplaces.resolve_place("Service Auto SRL, Timisoara", "key123", client=client)
    assert place.place_id == "ChIJabc123"
    assert place.name == "Service Auto SRL"
    assert place.rating == 4.5


async def test_resolve_place_missing_key_raises():
    try:
        await gplaces.resolve_place("orice", None)
    except CollectorError as exc:
        assert "Cheia Google Places" in str(exc)
    else:
        raise AssertionError("astept CollectorError")


async def test_resolve_place_not_found_raises():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"places": []})

    async with _client(handler) as client:
        try:
            await gplaces.resolve_place("nu exista", "key123", client=client)
        except CollectorError as exc:
            assert "Nu am gasit" in str(exc)
        else:
            raise AssertionError("astept CollectorError")


async def test_fetch_reviews_maps_reviews():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=PLACES_DETAILS_JSON)

    async with _client(handler) as client:
        result = await gplaces.fetch_reviews("ChIJabc123", "key123", client=client)
    assert result.name == "Service Auto SRL"
    assert len(result.reviews) == 1
    assert result.reviews[0].author == "Ion P."
    assert result.reviews[0].text == "Servicii foarte bune."


async def test_resolve_place_accepts_place_prefix():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=PLACES_DETAILS_JSON)

    async with _client(handler) as client:
        place = await gplaces.resolve_place("place:ChIJabc123", "key123", client=client)
    assert place.place_id == "ChIJabc123"
