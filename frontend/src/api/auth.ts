import { http, type Schemas } from "./client";

export type LoginRequest = Schemas["LoginRequest"];
export type RegisterRequest = Schemas["RegisterRequest"];
export type RegisterResponse = Schemas["RegisterResponse"];
export type ChangePasswordRequest = Schemas["ChangePasswordRequest"];

export interface LoginResponse {
  access_token: string;
  is_locked?: boolean;
  locked_at?: string | null;
  role?: string;
  resources?: string[];
  code?: string | null;
}

export interface MeResponse {
  id: number;
  name: string;
  username: string;
  description: string | null;
  email: string | null;
  image_url: string | null;
  code: string | null;
  user_id: number | null;
  user_name: string | null;
  user_username: string | null;
  role: string | null;
  resources: string[];
}

export const authApi = {
  /** Raspuns brut: Login.tsx trateaza 401/423/429 diferit. */
  loginRaw: (body: LoginRequest) =>
    http.raw("/api/auth/login", { method: "POST", handleUnauthorized: false, body: JSON.stringify(body) }),
  registerRaw: (body: RegisterRequest) =>
    http.raw("/api/auth/register", { method: "POST", handleUnauthorized: false, body: JSON.stringify(body) }),
  logout: () => http.raw("/api/auth/logout", { method: "POST", handleUnauthorized: false }),
  me: () => http.get<MeResponse>("/api/auth/me"),
  updateMe: (body: Record<string, unknown>) => http.patch<MeResponse>("/api/auth/me", body),
  uploadMeImage: (fd: FormData) => http.upload<MeResponse>("/api/auth/me/image", fd),
  deleteMeImage: () => http.delete<MeResponse>("/api/auth/me/image"),
  changePassword: (body: ChangePasswordRequest) =>
    http.post<unknown>("/api/auth/change-password", body, { errorMessage: "Eroare la schimbarea parolei." }),
};
