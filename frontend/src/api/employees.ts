import { crudApi, http, type CursorQuery, type Schemas } from "./client";

export type Employee = Schemas["EmployeeRead"];
export type EmployeeCreate = Schemas["EmployeeCreate"];
export type EmployeeUpdate = Schemas["EmployeeUpdate"];

export interface EmployeesQuery extends CursorQuery {
  q?: string | null;
  sort?: string | null;
  location_id?: number | null;
  include_deleted?: boolean;
}

const base = crudApi<Employee, EmployeeCreate, EmployeeUpdate, EmployeesQuery>("/api/employees");

export const employeesApi = {
  ...base,
  uploadImage: (id: number, fd: FormData) =>
    http.upload<{ image_path: string | null }>(`/api/employees/${id}/image`, fd, {
      errorMessage: "Eroare la upload imagine.",
    }),
};
