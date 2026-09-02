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
  setDepartments: (id: number, department_ids: number[]) =>
    http.put<unknown>(`/api/locations/${id}/departments`, { department_ids }),
  setEmployees: (id: number, employee_ids: number[]) =>
    http.put<unknown>(`/api/locations/${id}/employees`, { employee_ids }),
};
