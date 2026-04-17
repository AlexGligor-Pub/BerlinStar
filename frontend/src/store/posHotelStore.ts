import { createSignal } from "solid-js";

const STORAGE_KEY = "bs_pos_hotel_ctx";

export interface PosHotelContext {
  receiptId: string;
  titlu: string;
  clientId: number;
  clientNume: string;
}

function loadCtx(): PosHotelContext | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

const [posHotelCtx, setPosHotelCtxSignal] = createSignal<PosHotelContext | null>(loadCtx());

export { posHotelCtx };

export function savePosHotelCtx(data: PosHotelContext) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  setPosHotelCtxSignal(data);
}

export function clearPosHotelCtx() {
  localStorage.removeItem(STORAGE_KEY);
  setPosHotelCtxSignal(null);
}
