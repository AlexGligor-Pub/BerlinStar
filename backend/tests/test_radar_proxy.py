"""Proxy-ul catre serviciul Radar AI: pass-through, headere, 503 cand serviciul e jos.

Fara retea: upstream-ul e un httpx.MockTransport. Rulabil direct:
    python -m tests.test_radar_proxy
"""
from __future__ import annotations

import json
from contextlib import contextmanager

import httpx
from starlette.requests import Request

from app import radar_client
from app.config import RADAR_SHARED_SECRET
from tests._harness import raises_http, run


@contextmanager
def _upstream(handler):
    """Inlocuieste clientul module-level cu unul pe MockTransport."""
    seen: list[httpx.Request] = []

    def _wrapped(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    original = radar_client.client
    radar_client.client = radar_client.new_client(transport=httpx.MockTransport(_wrapped))
    try:
        yield seen
    finally:
        radar_client.client = original


def _request(method: str = "GET", path: str = "/api/radar/runs", query: str = "",
             headers: dict | None = None, body: bytes = b"") -> Request:
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "root_path": "",
        "query_string": query.encode(),
        "headers": [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()],
        "server": ("testserver", 80),
        "client": ("test", 1234),
    }

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    return Request(scope, receive)


async def test_json_and_query_pass_through():
    def handler(request):
        return httpx.Response(200, json={"ok": True, "url": str(request.url)})

    with _upstream(handler) as seen:
        resp = await radar_client.proxy(_request(query="months=3"), 7, "/v1/usage")

    assert resp.status_code == 200
    assert resp.media_type == "application/json"
    body = json.loads(resp.body)
    assert body["ok"] is True
    assert seen[0].url.path == "/v1/usage" and seen[0].url.query == b"months=3"
    assert seen[0].headers["X-Account-Id"] == "7"
    assert seen[0].headers["X-Service-Token"] == RADAR_SHARED_SECRET


async def test_error_status_and_body_pass_through():
    def handler(request):
        return httpx.Response(404, json={"detail": "Sursa nu a fost gasita."})

    with _upstream(handler):
        resp = await radar_client.proxy(_request(), 1, "/v1/sources/99")

    assert resp.status_code == 404
    assert json.loads(resp.body)["detail"] == "Sursa nu a fost gasita."


async def test_body_content_type_and_idempotency_key_forwarded():
    def handler(request):
        return httpx.Response(201, json={"id": 1})

    payload = b'{"kind":"manual"}'
    req = _request(
        method="POST",
        path="/api/radar/runs",
        headers={"Content-Type": "application/json", "Idempotency-Key": "radar:7:manual:abc"},
        body=payload,
    )
    with _upstream(handler) as seen:
        resp = await radar_client.proxy(req, 7, "/v1/runs")

    assert resp.status_code == 201
    sent = seen[0]
    assert sent.method == "POST" and sent.content == payload
    assert sent.headers["content-type"] == "application/json"
    assert sent.headers["Idempotency-Key"] == "radar:7:manual:abc"


async def test_pdf_keeps_content_disposition():
    def handler(request):
        return httpx.Response(
            200,
            content=b"%PDF-1.4 fake",
            headers={
                "content-type": "application/pdf",
                "content-disposition": "attachment; filename=radar-4.pdf",
            },
        )

    with _upstream(handler):
        resp = await radar_client.proxy(_request(), 7, "/v1/runs/4/pdf")

    assert resp.media_type == "application/pdf"
    assert resp.body == b"%PDF-1.4 fake"
    assert resp.headers["content-disposition"] == "attachment; filename=radar-4.pdf"


async def test_service_down_is_503():
    def handler(request):
        raise httpx.ConnectError("connection refused", request=request)

    with _upstream(handler):
        detail = await raises_http(503, radar_client.proxy(_request(), 7, "/v1/runs"))
        assert detail == radar_client.UNAVAILABLE
        await raises_http(503, radar_client.get_json("/v1/internal/usage", params={"months": 6}))


async def test_get_json_returns_payload_and_maps_errors():
    def handler(request):
        if request.url.path == "/v1/internal/usage":
            return httpx.Response(200, json=[{"account_id": 1, "tokens_in": 10}])
        return httpx.Response(500, json={"detail": "Eroare interna."})

    with _upstream(handler) as seen:
        rows = await radar_client.get_json("/v1/internal/usage", params={"months": 6})
        assert rows == [{"account_id": 1, "tokens_in": 10}]
        assert seen[0].url.query == b"months=6"
        assert "X-Account-Id" not in seen[0].headers
        detail = await raises_http(500, radar_client.get_json("/v1/altceva", account_id=3))
        assert detail == "Eroare interna."
        assert seen[1].headers["X-Account-Id"] == "3"


def main() -> None:
    run(test_json_and_query_pass_through())
    run(test_error_status_and_body_pass_through())
    run(test_body_content_type_and_idempotency_key_forwarded())
    run(test_pdf_keeps_content_disposition())
    run(test_service_down_is_503())
    run(test_get_json_returns_payload_and_maps_errors())
    print("OK test_radar_proxy")


if __name__ == "__main__":
    main()
