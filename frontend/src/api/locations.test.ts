import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/authStore", () => ({ auth: { token: null }, logout: vi.fn() }));
vi.mock("../store/connectivityStore", () => ({
  reportServerReachable: vi.fn(),
  reportServerUnreachable: vi.fn(),
}));

import { locationsApi } from "./locations";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

// Regresie: backend-ul asteapta `IdsBody` ({ ids }) pe ambele rute. Cu alta
// cheie raspunde 422 si nicio asociere nu se salveaza.
describe("locationsApi associations", () => {
  it("setEmployees sends { ids }", async () => {
    fetchMock.mockResolvedValue(json({ id: 7 }));
    await locationsApi.setEmployees(7, [3, 5]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/locations/7/employees");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ ids: [3, 5] });
  });

  it("setDepartments sends { ids }, including an empty list", async () => {
    fetchMock.mockResolvedValue(json({ id: 7 }));
    await locationsApi.setDepartments(7, []);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/locations/7/departments");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ ids: [] });
  });
});
