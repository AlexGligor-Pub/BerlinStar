import { createSignal } from "solid-js";
import { apiFetch } from "../utils/api";

const STORAGE_KEY = "bs_device";

interface DeviceInfo {
  id: number;
  name: string;
  locationId: number | null;
}

const ADJECTIVE = ["Rapid", "Albastru", "Verde", "Auriu", "Argintiu", "Polar", "Solar", "Lunar"];
const NOUN      = ["Vultur", "Leu", "Urs", "Tigru", "Cerb", "Corb", "Bison", "Capra"];

function generateDeviceName(): string {
  const a    = ADJECTIVE[Math.floor(Math.random() * ADJECTIVE.length)];
  const n    = NOUN[Math.floor(Math.random() * NOUN.length)];
  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${a}-${n}-${code}`;
}

function loadStored(): DeviceInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

const stored = loadStored();

const [device, setDevice]           = createSignal<DeviceInfo | null>(stored);
const [deviceReady, setDeviceReady] = createSignal(stored !== null);

// Numele generat o singura data pana la inregistrare
const pendingName = stored ? stored.name : generateDeviceName();

export { device, deviceReady, pendingName };

export async function registerDevice(locationId: number): Promise<void> {
  const res = await apiFetch("/api/devices", {
    method: "POST",
    body: JSON.stringify({ name: pendingName, location_id: locationId }),
  });
  if (!res.ok) throw new Error("Eroare la inregistrarea dispozitivului.");
  const data = await res.json();
  const info: DeviceInfo = { id: data.id, name: data.name, locationId: data.location_id };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  setDevice(info);
  setDeviceReady(true);
}
