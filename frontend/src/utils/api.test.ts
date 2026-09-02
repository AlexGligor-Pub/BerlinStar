import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authState, logout } = vi.hoisted(() => ({
  authState: { token: "TOK" as string | null },
  logout: vi.fn(),
}));
vi.mock("../store/authStore", () => ({ auth: authState, logout }));
vi.mock("../store/connectivityStore", () => ({
  reportServerReachable: vi.fn(),
  reportServerUnreachable: vi.fn(),
}));

import { apiFetch, apiFetchJson, parseApiError, readApiError } from "./api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("apiFetch", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    logout.mockReset();
    authState.token = "TOK";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("collapses duplicate slashes and keeps the path", async () => {
    await apiFetch("//api//clienti");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/clienti");
  });

  it("sends the bearer token and JSON content type for string bodies", async () => {
    await apiFetch("/api/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer TOK");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("does not force a content type for FormData and honours authToken override", async () => {
    await apiFetch("/api/x", { method: "POST", body: new FormData(), authToken: "ADMIN" });
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers.Authorization).toBe("Bearer ADMIN");
  });

  it("logs out on 401 unless handleUnauthorized is false", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 401 }));
    await apiFetch("/api/x", { handleUnauthorized: false });
    expect(logout).not.toHaveBeenCalled();
    await apiFetch("/api/x");
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("apiFetchJson throws the server detail on error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Nu ai drepturi." }, 403));
    await expect(apiFetchJson("/api/x")).rejects.toThrow("Nu ai drepturi.");
  });
});

describe("parseApiError", () => {
  it("returns the fallback for empty input", () => {
    expect(parseApiError(null, "fb")).toBe("fb");
    expect(parseApiError(undefined)).toBe("Eroare necunoscuta.");
  });

  it("passes strings through", () => {
    expect(parseApiError("Boom")).toBe("Boom");
  });

  it("formats Pydantic 422 arrays as loc: msg", () => {
    const detail = [
      { loc: ["body", "cui"], msg: "field required" },
      { loc: ["body", "nume"], msg: "too short" },
    ];
    expect(parseApiError(detail)).toBe("cui: field required; nume: too short");
  });

  it("recurses into nested detail objects and message fields", () => {
    expect(parseApiError({ detail: { detail: "deep" } })).toBe("deep");
    expect(parseApiError({ message: "msg" })).toBe("msg");
  });

  it("readApiError falls back on invalid JSON bodies", async () => {
    expect(await readApiError(new Response("<html>", { status: 500 }), "fb")).toBe("fb");
    expect(await readApiError(jsonResponse({ detail: "x" }, 400))).toBe("x");
  });
});
