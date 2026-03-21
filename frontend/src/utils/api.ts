import { auth } from "../store/authStore";

export const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (auth.token) {
    headers["Authorization"] = `Bearer ${auth.token}`;
  }
  return fetch(API_BASE + url, { ...options, headers });
}
