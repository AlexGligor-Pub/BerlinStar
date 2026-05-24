import { createSignal } from "solid-js";

const STORAGE_KEY = "bs_pos_hotel_ctx";

export interface PosHotelContext {
  receiptId: string;
  titlu: string;
  clientId: number;
  clientNume: string;
  employeeId?: number | null;
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

const PENDING_RETURN_KEY = "bs_pos_hotel_pending_return";

export type PosHotelAction = "cazare" | "scoatere" | "scoatere_si_cazare";

export interface PosHotelPendingReturn {
  action: PosHotelAction;
  titlu: string;
}

function loadPending(): PosHotelPendingReturn | null {
  try {
    const s = localStorage.getItem(PENDING_RETURN_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

const [pendingPosReturn, setPendingPosReturnSignal] = createSignal<PosHotelPendingReturn | null>(loadPending());

export { pendingPosReturn };

export function setPendingPosReturn(data: PosHotelPendingReturn) {
  localStorage.setItem(PENDING_RETURN_KEY, JSON.stringify(data));
  setPendingPosReturnSignal(data);
}

export function consumePendingPosReturn(): PosHotelPendingReturn | null {
  const d = pendingPosReturn();
  if (d) {
    localStorage.removeItem(PENDING_RETURN_KEY);
    setPendingPosReturnSignal(null);
  }
  return d;
}
