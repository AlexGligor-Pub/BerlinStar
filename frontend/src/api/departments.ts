import { crudApi, http, type Schemas } from "./client";

export type Department = Schemas["DepartmentRead"];
export type DepartmentCreate = Schemas["DepartmentCreate"];
export type DepartmentUpdate = Schemas["DepartmentUpdate"];

const base = crudApi<Department, DepartmentCreate, DepartmentUpdate>("/api/departments");

export const departmentsApi = {
  ...base,
  uploadImage: (id: number, fd: FormData) =>
    http.upload<{ image_path: string | null }>(`/api/departments/${id}/image`, fd, {
      errorMessage: "Eroare la upload imagine.",
    }),
};
