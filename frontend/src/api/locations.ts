import { crudApi, http, type Schemas } from "./client";

export type LocationDetail = Schemas["LocationDetail"];
export type LocationCreate = Schemas["LocationCreate"];
export type LocationUpdate = Partial<LocationCreate>;

const base = crudApi<LocationDetail, LocationCreate, LocationUpdate>("/api/locations");

export const locationsApi = {
  ...base,
  uploadImage: (id: number, fd: FormData) =>
    http.upload<{ image_path: string | null }>(`/api/locations/${id}/image`, fd, {
      errorMessage: "Eroare la upload imagine.",
    }),
  // Corpul e `IdsBody` ({ ids }) pe ambele rute. `satisfies` leaga obiectul de
  // schema generata din OpenAPI: daca backend-ul o schimba, pica la compilare,
  // nu cu 422 la salvare.
  setDepartments: (id: number, ids: number[]) =>
    http.put<LocationDetail>(`/api/locations/${id}/departments`, { ids } satisfies Schemas["IdsBody"]),
  setEmployees: (id: number, ids: number[]) =>
    http.put<LocationDetail>(`/api/locations/${id}/employees`, { ids } satisfies Schemas["IdsBody"]),
};
