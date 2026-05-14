import { createSignal } from "solid-js";

export type NotificationKind = "success" | "error" | "info" | "warn";

export interface NotificationItem {
  id: number;
  kind: NotificationKind;
  message: string;
  createdAt: number;
}

const [items, setItems] = createSignal<NotificationItem[]>([]);
let nextId = 1;

const DEFAULT_TTL_MS: Record<NotificationKind, number> = {
  success: 3500,
  info: 3500,
  warn: 5000,
  error: 6000,
};

export const notifications = items;

export function notify(message: string, kind: NotificationKind = "info", ttlMs?: number): number {
  const id = nextId++;
  const item: NotificationItem = { id, kind, message, createdAt: Date.now() };
  setItems([...items(), item]);
  const ttl = ttlMs ?? DEFAULT_TTL_MS[kind];
  if (ttl > 0) {
    setTimeout(() => dismissNotification(id), ttl);
  }
  return id;
}

export function dismissNotification(id: number): void {
  setItems(items().filter((n) => n.id !== id));
}

export function clearNotifications(): void {
  setItems([]);
}
