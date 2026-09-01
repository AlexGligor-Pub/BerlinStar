import { Router, Route, useNavigate, useLocation, Navigate } from "@solidjs/router";
import { Show, Suspense, lazy, createEffect, onCleanup, onMount } from "solid-js";
import { auth, trialExpired } from "./store/authStore";
import { canAdvanced, canReports, canSettings, canUsers } from "./store/permissions";
import { refreshProfile } from "./store/profile";
import { deviceReady } from "./store/deviceStore";
import NavBar from "./components/NavBar";
import DeviceSetupModal from "./components/DeviceSetupModal";
import Login from "./pages/Login";
import AppErrorBoundary from "./components/layout/AppErrorBoundary";
import Notifications from "./components/layout/Notifications";
import SubscriptionBanner from "./components/layout/SubscriptionBanner";
import ConnectivityBanner from "./components/layout/ConnectivityBanner";
import { initConnectivity } from "./store/connectivityStore";

// Lazy-load route pages to enable per-route code-splitting.
const POS = lazy(() => import("./pages/POS"));
const Reception = lazy(() => import("./pages/Reception"));
const Configurari = lazy(() => import("./pages/Configurari"));
const Rapoarte = lazy(() => import("./pages/Rapoarte"));
const Stocuri = lazy(() => import("./pages/Stocuri"));
const StocActivitate = lazy(() => import("./pages/StocActivitate"));
const Clienti = lazy(() => import("./pages/Clienti"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const HotelAnvelope = lazy(() => import("./pages/HotelAnvelope"));
const Programari = lazy(() => import("./pages/Programari"));
const Concedii = lazy(() => import("./pages/Concedii"));
const AngajatDetalii = lazy(() => import("./pages/angajati/AngajatDetalii"));
const NoAccess = lazy(() => import("./pages/NoAccess"));
const AdminV2 = lazy(() => import("./pages/AdminV2"));
const Utilizatori = lazy(() => import("./pages/Utilizatori"));
const HealthCheck = lazy(() => import("./pages/HealthCheck"));
const Ghid = lazy(() => import("./pages/Ghid"));
const EFacturaLayout = lazy(() => import("./pages/efactura/EFacturaLayout"));
const EFacturaReceived = lazy(() => import("./pages/efactura/EFacturaReceived"));
const EFacturaSent = lazy(() => import("./pages/efactura/EFacturaSent"));
const FacturaRapida = lazy(() => import("./pages/FacturaRapida"));

function PageSuspense(props: { children: any }) {
  return (
    <Suspense fallback={<div class="page-content" style="padding:24px"><div class="skeleton" style="height:24px;width:160px;margin-bottom:12px" /><div class="skeleton" style="height:120px" /></div>}>
      {props.children}
    </Suspense>
  );
}

function Protected(props: { component: () => any }) {
  const navigate = useNavigate();
  const location = useLocation();

  createEffect(() => {
    if (auth.token && trialExpired()) {
      navigate("/no-access", { replace: true });
    }
  });

  // Rolul si resursele se re-citesc de la server la fiecare intrare in
  // aplicatie: daca adminul a schimbat rolul cuiva, UI-ul se aliniaza la
  // primul refresh, fara re-login.
  onMount(() => { void refreshProfile(); });

  onMount(() => {
    const handler = () => {
      const from = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?from=${from}`, { replace: true });
    };
    window.addEventListener("bs:unauthorized", handler);
    onCleanup(() => window.removeEventListener("bs:unauthorized", handler));
  });

  return (
    <Show when={auth.token} fallback={<Login />}>
      <div class="app-shell">
        <SubscriptionBanner />
        <NavBar />
        <PageSuspense>
          {props.component()}
        </PageSuspense>
        <Show when={!deviceReady()}>
          <DeviceSetupModal />
        </Show>
      </div>
    </Show>
  );
}

export default function App() {
  onMount(() => initConnectivity());
  return (
    <AppErrorBoundary>
      <ConnectivityBanner />
      <Notifications />
      <Router base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Route path="/health" component={HealthCheck} />
        <Route path="/ghid" component={Ghid} />
        <Route path="/login" component={Login} />
        <Route path="/no-access" component={NoAccess} />
        <Route path="/" component={() => <Protected component={POS} />} />
        <Route path="/receptie" component={() => <Protected component={Reception} />} />
        <Route path="/configurari" component={() => (
          <Show when={canSettings()} fallback={<Navigate href="/" />}>
            <Protected component={Configurari} />
          </Show>
        )} />
        <Route path="/rapoarte" component={() => (
          <Show when={canReports()} fallback={<Navigate href="/" />}>
            <Protected component={Rapoarte} />
          </Show>
        )} />
        <Route path="/stocuri" component={() => (
          <Show when={canAdvanced()} fallback={<Navigate href="/" />}>
            <Protected component={Stocuri} />
          </Show>
        )} />
        <Route path="/stocuri/:itemId/activitate" component={() => (
          <Show when={canAdvanced()} fallback={<Navigate href="/" />}>
            <Protected component={StocActivitate} />
          </Show>
        )} />
        <Route path="/clienti" component={() => <Protected component={Clienti} />} />
        <Route path="/clienti/:id" component={() => <Protected component={ClientDetail} />} />
        <Route path="/hotel-anvelope" component={() => <Protected component={HotelAnvelope} />} />
        <Route path="/programari" component={() => <Protected component={Programari} />} />
        <Route path="/concedii" component={() => <Protected component={Concedii} />} />
        <Route path="/angajati/:id" component={() => (
          <Show when={canAdvanced()} fallback={<Navigate href="/" />}>
            <Protected component={AngajatDetalii} />
          </Show>
        )} />
        <Route path="/utilizatori" component={() => (
          <Show when={canUsers()} fallback={<Navigate href="/" />}>
            <Protected component={Utilizatori} />
          </Show>
        )} />
        <Route path="/adminv2" component={() => <Protected component={AdminV2} />} />
        <Route path="/factura-rapida" component={() => (
          <Show when={canAdvanced()} fallback={<Navigate href="/" />}>
            <Protected component={FacturaRapida} />
          </Show>
        )} />
        <Route path="/efactura-primite" component={() => <Navigate href="/efactura/primite" />} />
        <Route path="/efactura" component={(p: any) => (
          <Show when={canAdvanced()} fallback={<Navigate href="/" />}>
            <Protected component={() => <EFacturaLayout>{p.children}</EFacturaLayout>} />
          </Show>
        )}>
          <Route path="/" component={() => <Navigate href="/efactura/primite" />} />
          <Route path="/primite" component={EFacturaReceived} />
          <Route path="/trimise" component={EFacturaSent} />
        </Route>
      </Router>
    </AppErrorBoundary>
  );
}
