import { lazy, type Component, type JSX } from "solid-js";
import type { RouteSectionProps } from "@solidjs/router";
import type { Resource } from "./store/permissions";
import { generalSettings } from "./store/generalSettingsStore";

export interface NavEntry {
  label: string;
  icon: () => JSX.Element;
  /** Tinta de navigare cand difera de `path` (ex. /efactura -> /efactura/primite). */
  href?: string;
  hidden?: () => boolean;
}

export interface AppRoute {
  path: string;
  component: Component<RouteSectionProps>;
  requires?: Resource;
  nav?: NavEntry;
}

const svg = (paths: string) => () => (
  // eslint-disable-next-line solid/no-innerhtml -- doar string-uri statice din acest fisier
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" innerHTML={paths} />
);

/** Rute publice, randate in afara shell-ului (fara NavBar / guard de token). */
export const PUBLIC_ROUTES: AppRoute[] = [
  { path: "/health", component: lazy(() => import("./pages/HealthCheck")) },
  { path: "/ghid", component: lazy(() => import("./pages/Ghid")) },
  { path: "/login", component: lazy(() => import("./pages/Login")) },
  { path: "/no-access", component: lazy(() => import("./pages/NoAccess")) },
];

/** Rute din shell (token + NavBar). Ordinea = ordinea din meniu. */
export const APP_ROUTES: AppRoute[] = [
  {
    path: "/",
    component: lazy(() => import("./pages/POS")),
    nav: { label: "POS", icon: svg('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>') },
  },
  {
    path: "/receptie",
    component: lazy(() => import("./pages/Reception")),
    nav: { label: "Recepție", icon: svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>') },
  },
  {
    path: "/programari",
    component: lazy(() => import("./pages/Programari")),
    nav: { label: "Programări", icon: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="12" y1="14" x2="14" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/>') },
  },
  {
    path: "/clienti",
    component: lazy(() => import("./pages/Clienti")),
    nav: { label: "Clienți", icon: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>') },
  },
  { path: "/clienti/:id", component: lazy(() => import("./pages/ClientDetail")) },
  {
    path: "/concedii",
    component: lazy(() => import("./pages/Concedii")),
    nav: { label: "Concedii", icon: svg('<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>') },
  },
  {
    path: "/hotel-anvelope",
    component: lazy(() => import("./pages/HotelAnvelope")),
    nav: {
      label: "Hotel Anvelope",
      icon: svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>'),
      hidden: () => !!generalSettings()?.dezactiveazaHotelAnvelope,
    },
  },
  {
    path: "/stocuri",
    component: lazy(() => import("./pages/Stocuri")),
    requires: "advanced",
    nav: { label: "Stocuri", icon: svg('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>') },
  },
  { path: "/stocuri/:itemId/activitate", component: lazy(() => import("./pages/StocActivitate")), requires: "advanced" },
  {
    path: "/rapoarte",
    component: lazy(() => import("./pages/Rapoarte")),
    requires: "reports",
    nav: { label: "Rapoarte", icon: svg('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>') },
  },
  {
    path: "/efactura",
    component: lazy(() => import("./pages/efactura/EFacturaLayout")),
    requires: "advanced",
    nav: {
      label: "e-Factura",
      href: "/efactura/primite",
      icon: svg('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'),
    },
  },
  {
    path: "/factura-rapida",
    component: lazy(() => import("./pages/FacturaRapida")),
    requires: "advanced",
    nav: { label: "Factura Rapida", icon: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="10" y2="9"/>') },
  },
  {
    path: "/utilizatori",
    component: lazy(() => import("./pages/Utilizatori")),
    requires: "users",
    nav: { label: "Utilizatori", icon: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/><path d="M19 8v6"/>') },
  },
  {
    path: "/configurari",
    component: lazy(() => import("./pages/Configurari")),
    requires: "settings",
    nav: { label: "Configurări", icon: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>') },
  },
  { path: "/angajati/:id", component: lazy(() => import("./pages/angajati/AngajatDetalii")), requires: "advanced" },
  { path: "/adminv2", component: lazy(() => import("./pages/AdminV2")), requires: "users" },
];

export const EFACTURA_CHILDREN = {
  received: lazy(() => import("./pages/efactura/EFacturaReceived")),
  sent: lazy(() => import("./pages/efactura/EFacturaSent")),
};

export const NAV_ITEMS = APP_ROUTES.filter((r) => r.nav).map((r) => ({
  href: r.nav!.href ?? r.path,
  requires: r.requires,
  ...r.nav!,
}));
