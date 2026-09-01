// Conținutul stă în content/<id>.<lang>.md — editabil fără a atinge codul.
import type { GuideLang } from "../store/guideStore";

export interface GuideSection {
  id: string;
  icon: string;
  title: Record<GuideLang, string>;
}

export const SECTIONS: GuideSection[] = [
  { id: "autentificare", icon: "🔑", title: { ro: "Autentificare", en: "Sign in", hu: "Bejelentkezés" } },
  { id: "roluri", icon: "🛡️", title: { ro: "Roluri și permisiuni", en: "Roles & permissions", hu: "Szerepek és jogosultságok" } },
  { id: "utilizatori", icon: "👥", title: { ro: "Utilizatori", en: "Users", hu: "Felhasználók" } },
  { id: "pos", icon: "🧾", title: { ro: "POS — vânzare", en: "POS — sales", hu: "POS — értékesítés" } },
  { id: "receptie", icon: "🛠️", title: { ro: "Recepție (devize, plăți, reduceri)", en: "Reception (estimates, payments, discounts)", hu: "Recepció (kalkuláció, fizetés, kedvezmény)" } },
  { id: "clienti", icon: "🚗", title: { ro: "Clienți", en: "Clients", hu: "Ügyfelek" } },
  { id: "programari", icon: "📅", title: { ro: "Programări", en: "Appointments", hu: "Időpontok" } },
  { id: "hotel", icon: "🏬", title: { ro: "Hotel anvelope", en: "Tyre hotel", hu: "Gumihotel" } },
  { id: "concedii", icon: "🌴", title: { ro: "Concedii", en: "Leaves", hu: "Szabadságok" } },
  { id: "stocuri", icon: "📦", title: { ro: "Stocuri", en: "Stock", hu: "Készlet" } },
  { id: "rapoarte", icon: "📊", title: { ro: "Rapoarte", en: "Reports", hu: "Jelentések" } },
  { id: "efactura", icon: "📤", title: { ro: "e-Factura", en: "e-Invoice", hu: "e-Számla" } },
  { id: "factura-rapida", icon: "⚡", title: { ro: "Factură Rapidă", en: "Quick Invoice", hu: "Gyors számla" } },
  { id: "configurari", icon: "⚙️", title: { ro: "Configurări și abonament", en: "Settings & subscription", hu: "Beállítások és előfizetés" } },
];

const RAW = import.meta.glob("./content/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export function sectionMarkdown(id: string, lang: GuideLang): string {
  return (
    RAW[`./content/${id}.${lang}.md`] ??
    RAW[`./content/${id}.ro.md`] ??
    ""
  );
}
