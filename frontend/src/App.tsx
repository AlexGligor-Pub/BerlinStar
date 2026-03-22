import { Router, Route, useNavigate } from "@solidjs/router";
import { Show, createEffect } from "solid-js";
import { auth, trialExpired } from "./store/authStore";
import { deviceReady } from "./store/deviceStore";
import NavBar from "./components/NavBar";
import DeviceSetupModal from "./components/DeviceSetupModal";
import Login from "./pages/Login";
import POS from "./pages/POS";
import Reception from "./pages/Reception";
import Configurari from "./pages/Configurari";
import Clienti from "./pages/Clienti";
import NoAccess from "./pages/NoAccess";

function Protected(props: { component: () => any }) {
  const navigate = useNavigate();

  createEffect(() => {
    if (auth.token && trialExpired()) {
      navigate("/no-access", { replace: true });
    }
  });

  return (
    <Show when={auth.token} fallback={<Login />}>
      <div class="app-shell">
        <NavBar />
        {props.component()}
        <Show when={!deviceReady()}>
          <DeviceSetupModal />
        </Show>
      </div>
    </Show>
  );
}

export default function App() {
  return (
    <Router base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Route path="/login" component={Login} />
      <Route path="/no-access" component={NoAccess} />
      <Route path="/" component={() => <Protected component={POS} />} />
      <Route path="/receptie" component={() => <Protected component={Reception} />} />
      <Route path="/configurari" component={() => <Protected component={Configurari} />} />
      <Route path="/clienti" component={() => <Protected component={Clienti} />} />
    </Router>
  );
}
