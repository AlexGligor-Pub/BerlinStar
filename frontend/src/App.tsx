import { Router, Route, useNavigate, useLocation, Navigate } from "@solidjs/router";
import { Show, Suspense, lazy, createEffect, onCleanup, onMount } from "solid-js";
import { auth, trialExpired } from "./store/authStore";
import { adminVisible } from "./store/adminStore";
import { deviceReady } from "./store/deviceStore";
import NavBar from "./components/NavBar";
import DeviceSetupModal from "./components/DeviceSetupModal";
import Login from "./pages/Login";
import AppErrorBoundary from "./components/layout/AppErrorBoundary";
import Notifications from "./components/layout/Notifications";

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
const NoAccess = lazy(() => import("./pages/NoAccess"));
const AdminV2 = lazy(() => import("./pages/AdminV2"));
const HealthCheck = lazy(() => import("./pages/HealthCheck"));
const EFacturaPrimite = lazy(() => import("./pages/EFacturaPrimite"));

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
  return (
    <AppErrorBoundary>
      <Notifications />
      <Router base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Route path="/health" component={HealthCheck} />
        <Route path="/login" component={Login} />
        <Route path="/no-access" component={NoAccess} />
        <Route path="/" component={() => <Protected component={POS} />} />
        <Route path="/receptie" component={() => <Protected component={Reception} />} />
        <Route path="/configurari" component={() => (
          <Show when={adminVisible()} fallback={<Navigate href="/" />}>
            <Protected component={Configurari} />
          </Show>
        )} />
        <Route path="/rapoarte" component={() => (
          <Show when={adminVisible()} fallback={<Navigate href="/" />}>
            <Protected component={Rapoarte} />
          </Show>
        )} />
        <Route path="/stocuri" component={() => (
          <Show when={adminVisible()} fallback={<Navigate href="/" />}>
            <Protected component={Stocuri} />
          </Show>
        )} />
        <Route path="/stocuri/:itemId/activitate" component={() => (
          <Show when={adminVisible()} fallback={<Navigate href="/" />}>
            <Protected component={StocActivitate} />
          </Show>
        )} />
        <Route path="/clienti" component={() => <Protected component={Clienti} />} />
        <Route path="/clienti/:id" component={() => <Protected component={ClientDetail} />} />
        <Route path="/hotel-anvelope" component={() => <Protected component={HotelAnvelope} />} />
        <Route path="/programari" component={() => <Protected component={Programari} />} />
        <Route path="/adminv2" component={() => <Protected component={AdminV2} />} />
        <Route path="/efactura-primite" component={() => (
          <Show when={adminVisible()} fallback={<Navigate href="/" />}>
            <Protected component={EFacturaPrimite} />
          </Show>
        )} />
      </Router>
    </AppErrorBoundary>
  );
}
