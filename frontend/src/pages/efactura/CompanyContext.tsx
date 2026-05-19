import { createContext, useContext, type Accessor, type Setter, type JSX } from "solid-js";

export interface EFacturaCompany {
  company_id: number;
  account_id: number;
  name: string;
  cui: number;
  is_vat_payer: boolean | null;
  settings: unknown;
  token_status: {
    company_id: number;
    connected: boolean;
    expires_at: string | null;
    days_until_expiry: number | null;
    state: "disconnected" | "connected" | "expiring_soon" | "expired";
  };
}

export interface EFacturaCtx {
  companies: Accessor<EFacturaCompany[]>;
  loading: Accessor<boolean>;
  companyId: Accessor<number | null>;
  setCompanyId: Setter<number | null>;
  selectedCompany: Accessor<EFacturaCompany | undefined>;
  unreadCount: Accessor<number>;
  setUnreadCount: Setter<number>;
  refreshCompanies: () => Promise<void>;
}

const Ctx = createContext<EFacturaCtx>();

export function EFacturaProvider(props: { value: EFacturaCtx; children: JSX.Element }) {
  return <Ctx.Provider value={props.value}>{props.children}</Ctx.Provider>;
}

export function useEFactura(): EFacturaCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEFactura must be used inside EFacturaProvider");
  return v;
}
