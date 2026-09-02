import { http } from "./client";

const companyBase = (companyId: number) => `/api/efactura/companies/${companyId}`;

export const efacturaApi = {
  myCompanies: <T>() => http.get<T>("/api/efactura/my-companies"),
  updateSettings: <T>(companyId: number, body: unknown) => http.patch<T>(`${companyBase(companyId)}/settings`, body),
  connect: <T>(companyId: number, body?: unknown) => http.post<T>(`${companyBase(companyId)}/connect`, body),
  disconnect: <T>(companyId: number) => http.post<T>(`${companyBase(companyId)}/disconnect`),
  testConnection: <T>(companyId: number) => http.post<T>(`${companyBase(companyId)}/test-connection`),
};
