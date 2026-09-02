import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/authStore", () => ({ auth: { token: null }, logout: vi.fn() }));
vi.mock("../store/connectivityStore", () => ({
  reportServerReachable: vi.fn(),
  reportServerUnreachable: vi.fn(),
}));

import { ApiError, buildQuery, crudApi, http } from "./client";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("buildQuery", () => {
  it("skips null, undefined and empty values", () => {
    expect(buildQuery({ a: 1, b: null, c: undefined, d: "", e: false })).toBe("?a=1&e=false");
  });
  it("returns an empty string when nothing remains", () => {
    expect(buildQuery()).toBe("");
    expect(buildQuery({ a: null })).toBe("");
  });
});

describe("crudApi", () => {
  const api = crudApi<{ id: number }, { name: string }>("/api/things");

  it("builds list URLs with query params", async () => {
    fetchMock.mockResolvedValue(json({ items: [{ id: 1 }], next_cursor: null }));
    const page = await api.list({ limit: 10, q: "x" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/things?limit=10&q=x");
    expect(page.items).toEqual([{ id: 1 }]);
  });

  it("listAll follows next_cursor until exhausted", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ items: [{ id: 1 }, { id: 2 }], next_cursor: 2 }))
      .mockResolvedValueOnce(json({ items: [{ id: 3 }], next_cursor: null }));
    const all = await api.listAll({ limit: 2 });
    expect(all.map((t) => t.id)).toEqual([1, 2, 3]);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/things?limit=2&last_id=2");
  });

  it("uses PATCH for update and DELETE for remove", async () => {
    fetchMock.mockResolvedValue(json({ id: 5 }));
    await api.update(5, { name: "n" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/things/5");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("PATCH");
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.remove(5)).resolves.toBeUndefined();
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("DELETE");
  });

  it("throws ApiError with status and server message", async () => {
    fetchMock.mockResolvedValue(json({ detail: "Nume duplicat" }, 409));
    const err = await api.create({ name: "dup" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect((err as ApiError).message).toBe("Nume duplicat");
  });

  it("http.get falls back to a generic message when the body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(http.get("/api/x")).rejects.toThrow("Eroare la procesare. (HTTP 500)");
  });
});
