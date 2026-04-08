import { createSignal } from "solid-js";
import type { CartItem } from "./cartStore";
import type { VehicolData } from "./receiptsStore";

interface ResumeData {
  id?: string;
  titlu: string;
  descriere: string;
  dateTehn: string;
  items: CartItem[];
  clientId?: number | null;
  clientNume?: string | null;
  clientCui?: string | null;
  clientTip?: string | null;
  programareId?: number | null;
  vehicol?: VehicolData | null;
}

const [resumeData, setResumeData] = createSignal<ResumeData | null>(null);

export function setResume(data: ResumeData) {
  setResumeData(data);
}

export function consumeResume(): ResumeData | null {
  const d = resumeData();
  setResumeData(null);
  return d;
}

export { resumeData };

// Reactive load for already-mounted ShoppingList (e.g. loading from "Deviz existent")
const [pendingLoad, setPendingLoad] = createSignal<ResumeData | null>(null);

export function triggerLoad(data: ResumeData) {
  setPendingLoad(data);
}

export function clearPendingLoad() {
  setPendingLoad(null);
}

export { pendingLoad };
