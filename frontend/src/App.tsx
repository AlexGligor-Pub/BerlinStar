import { Router, Route } from "@solidjs/router";
import { Show } from "solid-js";
import { auth } from "./store/authStore";
import { deviceReady } from "./store/deviceStore";
import NavBar from "./components/NavBar";
import DeviceSetupModal from "./components/DeviceSetupModal";
import Login from "./pages/Login";
import POS from "./pages/POS";
import Reception from "./pages/Reception";
import Configurari from "./pages/Configurari";
import Clienti from "./pages/Clienti";

function Protected(props: { component: () => any }) {
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
      <Route path="/" component={() => <Protected component={POS} />} />
      <Route path="/receptie" component={() => <Protected component={Reception} />} />
      <Route path="/configurari" component={() => <Protected component={Configurari} />} />
      <Route path="/clienti" component={() => <Protected component={Clienti} />} />
    </Router>
  );
}
