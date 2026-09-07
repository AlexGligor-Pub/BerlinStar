"""Collector Google Places (New): rezolvare afacere si recenzii."""
from __future__ import annotations

import re
from datetime import datetime, timezone

import httpx

from app.radar.types import CollectorError, PlaceHit, PlaceInfo, PlaceReviews, Review

_TIMEOUT = 20.0
_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
_DETAILS_URL = "https://places.googleapis.com/v1/places/{place_id}"

_SEARCH_FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount"
)
_DETAILS_FIELD_MASK = "id,displayName,rating,userRatingCount,reviews"

_PLACE_ID_RE = re.compile(r"[?&]?query_place_id=([\w-]+)|place_id[:=]([\w-]+)|/place/[^/]+/(ChIJ[\w-]+)")


def _extract_place_id(value: str) -> str | None:
    value = value.strip()
    if value.startswith("place:"):
        return value[len("place:"):].strip() or None
    if value.startswith("ChIJ") and " " not in value:
        return value
    match = _PLACE_ID_RE.search(value)
    if match:
        return next(g for g in match.groups() if g)
    return None


def _check_api_key(api_key: str | None) -> str:
    if not api_key:
        raise CollectorError("Cheia Google Places lipseste sau este invalida.")
    return api_key


async def resolve_place(
    query: str, api_key: str | None, client: httpx.AsyncClient | None = None
) -> PlaceInfo:
    """Rezolva o afacere din text liber, un id `place:ChIJ...` sau un URL Google Maps."""
    api_key = _check_api_key(api_key)
    query = (query or "").strip()
    if not query:
        raise CollectorError("Introduceti numele si adresa afacerii.")

    place_id = _extract_place_id(query)
    if place_id:
        reviews = await fetch_reviews(place_id, api_key, client=client)
        return PlaceInfo(
            place_id=reviews.place_id,
            name=reviews.name,
            rating=reviews.rating,
            reviews_count=reviews.reviews_count,
        )

    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": _SEARCH_FIELD_MASK,
        "Content-Type": "application/json",
    }
    body = {"textQuery": query, "languageCode": "ro", "regionCode": "RO"}
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=_TIMEOUT)
    try:
        try:
            resp = await client.post(_SEARCH_URL, json=body, headers=headers)
        except httpx.HTTPError as exc:
            raise CollectorError("Nu am putut contacta Google Places.") from exc
        if resp.status_code == 401 or resp.status_code == 403:
            raise CollectorError("Cheia Google Places lipseste sau este invalida.")
        if resp.status_code >= 400:
            raise CollectorError("Google Places a raspuns cu eroare la cautare.")
        try:
            data = resp.json()
        except ValueError as exc:
            raise CollectorError("Raspunsul Google Places este invalid.") from exc
    finally:
        if own_client:
            await client.aclose()

    places = data.get("places") or []
    if not places:
        raise CollectorError(f"Nu am gasit afacerea „{query}” in Google Places.")

    place = places[0]
    return PlaceInfo(
        place_id=place.get("id", ""),
        name=(place.get("displayName") or {}).get("text", ""),
        address=place.get("formattedAddress", "") or "",
        rating=place.get("rating"),
        reviews_count=place.get("userRatingCount"),
    )


async def fetch_reviews(
    place_id: str, api_key: str | None, client: httpx.AsyncClient | None = None
) -> PlaceReviews:
    """Detalii + recenzii (max 5, limitare API) pentru un place_id Google."""
    api_key = _check_api_key(api_key)
    place_id = (place_id or "").strip()
    if not place_id:
        raise CollectorError("Nu am gasit afacerea indicata.")

    headers = {"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": _DETAILS_FIELD_MASK}
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=_TIMEOUT)
    try:
        try:
            resp = await client.get(
                _DETAILS_URL.format(place_id=place_id),
                headers=headers,
                params={"languageCode": "ro"},
            )
        except httpx.HTTPError as exc:
            raise CollectorError("Nu am putut contacta Google Places pentru recenzii.") from exc
        if resp.status_code == 401 or resp.status_code == 403:
            raise CollectorError("Cheia Google Places lipseste sau este invalida.")
        if resp.status_code == 404:
            raise CollectorError("Nu am gasit afacerea indicata in Google Places.")
        if resp.status_code >= 400:
            raise CollectorError("Google Places a raspuns cu eroare la recenzii.")
        try:
            data = resp.json()
        except ValueError as exc:
            raise CollectorError("Raspunsul Google Places este invalid.") from exc
    finally:
        if own_client:
            await client.aclose()

    reviews: list[Review] = []
    for r in data.get("reviews") or []:
        author = ((r.get("authorAttribution") or {}).get("displayName")) or ""
        text_obj = r.get("originalText") or r.get("text") or {}
        reviews.append(
            Review(
                author=author,
                rating=r.get("rating"),
                text=(text_obj.get("text") or "").strip(),
                time=r.get("publishTime", "") or "",
                relative_time=r.get("relativePublishTimeDescription", "") or "",
            )
        )

    return PlaceReviews(
        place_id=data.get("id", place_id),
        name=(data.get("displayName") or {}).get("text", ""),
        rating=data.get("rating"),
        reviews_count=data.get("userRatingCount"),
        reviews=reviews,
        fetched_at=datetime.now(timezone.utc),
    )


_NEARBY_FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,places.location,places.rating,"
    "places.userRatingCount,places.websiteUri,places.nationalPhoneNumber,places.primaryType,"
    "places.types"
)
_GEOCODE_FIELD_MASK = "places.location"


async def _search_text(
    body: dict, field_mask: str, api_key: str, client: httpx.AsyncClient | None = None
) -> dict:
    """POST places:searchText cu FieldMask dat; erorile devin CollectorError."""
    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": field_mask,
        "Content-Type": "application/json",
    }
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=_TIMEOUT)
    try:
        try:
            resp = await client.post(_SEARCH_URL, json=body, headers=headers)
        except httpx.HTTPError as exc:
            raise CollectorError("Nu am putut contacta Google Places.") from exc
        if resp.status_code in (401, 403):
            raise CollectorError("Cheia Google Places lipseste sau este invalida.")
        if resp.status_code >= 400:
            raise CollectorError("Google Places a raspuns cu eroare la cautare.")
        try:
            return resp.json()
        except ValueError as exc:
            raise CollectorError("Raspunsul Google Places este invalid.") from exc
    finally:
        if own_client:
            await client.aclose()


async def geocode(
    address: str, api_key: str | None, client: httpx.AsyncClient | None = None
) -> tuple[float, float] | None:
    """Coordonatele unei adrese (searchText); None daca Google nu gaseste nimic."""
    api_key = _check_api_key(api_key)
    address = (address or "").strip()
    if not address:
        return None
    body = {"textQuery": address, "languageCode": "ro", "regionCode": "RO", "pageSize": 1}
    data = await _search_text(body, _GEOCODE_FIELD_MASK, api_key, client)
    for place in data.get("places") or []:
        loc = place.get("location") or {}
        lat, lng = loc.get("latitude"), loc.get("longitude")
        if lat is not None and lng is not None:
            return float(lat), float(lng)
    return None


async def search_nearby(
    query: str,
    api_key: str | None,
    lat: float,
    lng: float,
    radius_m: float,
    limit: int = 20,
    client: httpx.AsyncClient | None = None,
) -> list[PlaceHit]:
    """Afacerile care raspund la `query` in cercul (lat, lng, radius_m)."""
    api_key = _check_api_key(api_key)
    query = (query or "").strip()
    if not query:
        return []
    body = {
        "textQuery": query,
        "languageCode": "ro",
        "regionCode": "RO",
        "pageSize": max(1, min(int(limit), 20)),
        "locationBias": {
            "circle": {
                "center": {"latitude": float(lat), "longitude": float(lng)},
                "radius": float(radius_m),
            }
        },
    }
    data = await _search_text(body, _NEARBY_FIELD_MASK, api_key, client)
    hits: list[PlaceHit] = []
    for place in data.get("places") or []:
        loc = place.get("location") or {}
        hits.append(
            PlaceHit(
                place_id=place.get("id", "") or "",
                name=(place.get("displayName") or {}).get("text", "") or "",
                address=place.get("formattedAddress", "") or "",
                lat=loc.get("latitude"),
                lng=loc.get("longitude"),
                rating=place.get("rating"),
                reviews_count=place.get("userRatingCount"),
                website=place.get("websiteUri", "") or "",
                phone=place.get("nationalPhoneNumber", "") or "",
                primary_type=place.get("primaryType", "") or "",
                types=list(place.get("types") or []),
            )
        )
    return [h for h in hits if h.place_id][:limit]
