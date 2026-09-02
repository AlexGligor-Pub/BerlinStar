import { Router, Route, useNavigate, useLocation, Navigate, type RouteSectionProps } from "@solidjs/router";
import { Show, Suspense, createEffect, onCleanup, onMount, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { auth, trialExpired } from "./store/authStore";
import { can, type Resource } from "./store/permissions";
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
import { APP_ROUTES, EFACTURA_CHILDREN, PUBLIC_ROUTES, type AppRoute } from "./routes";

function PageSuspense(props: { children: JSX.Element }) {
  return (
    <Suspense
      fallback={
        <div class="page-content" style={{ padding: "24px" }}>
          <div class="skeleton" style={{ height: "24px", width: "160px", "margin-bottom": "12px" }} />
          <div class="skeleton" style={{ height: "120px" }} />
        </div>
      }
    >
      {props.children}
    </Suspense>
  );
}

function Guarded(props: { requires?: Resource; children: JSX.Element }) {
  return (
    <Show when={!props.requires || can(props.requires)} fallback={<Navigate href="/" />}>
      {props.children}
    </Show>
  );
}

// Layout-ul se monteaza o singura data: NavBar, bannerele si /api/auth/me nu se
// mai refac la fiecare navigare intre pagini.
function Shell(props: RouteSectionProps) {
  const navigate = useNavigate();
  const location = useLocation();

  createEffect(() => {
    if (auth.token && trialExpired()) {
      navigate("/no-access", { replace: true });
    }
  });

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
        <PageSuspense>{props.children}</PageSuspense>
        <Show when={!deviceReady()}>
          <DeviceSetupModal />
        </Show>
      </div>
    </Show>
  );
}

function routeComponent(r: AppRoute) {
  return (p: RouteSectionProps) => (
    <Guarded requires={r.requires}>
      <Dynamic component={r.component} {...p} />
    </Guarded>
  );
}

export default function App() {
  onMount(() => initConnectivity());
  return (
    <AppErrorBoundary>
      <ConnectivityBanner />
      <Notifications />
      <Router base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        {/* eslint-disable-next-line solid/prefer-for -- <Route> e config pentru router, nu DOM */}
        {PUBLIC_ROUTES.map((r) => <Route path={r.path} component={r.component} />)}
        <Route path="/" component={Shell}>
          {/* eslint-disable-next-line solid/prefer-for -- <Route> e config pentru router, nu DOM */}
          {APP_ROUTES.filter((r) => r.path !== "/efactura").map((r) => (
            <Route path={r.path} component={routeComponent(r)} />
          ))}
          <Route path="/efactura-primite" component={() => <Navigate href="/efactura/primite" />} />
          <Route path="/efactura" component={routeComponent(APP_ROUTES.find((r) => r.path === "/efactura")!)}>
            <Route path="/" component={() => <Navigate href="/efactura/primite" />} />
            <Route path="/primite" component={EFACTURA_CHILDREN.received} />
            <Route path="/trimise" component={EFACTURA_CHILDREN.sent} />
          </Route>
        </Route>
      </Router>
    </AppErrorBoundary>
  );
}
