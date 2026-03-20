import { Router, Route } from "@solidjs/router";
import { Show } from "solid-js";
import { auth } from "./store/authStore";
import NavBar from "./components/NavBar";
import Login from "./pages/Login";
import POS from "./pages/POS";
import Reception from "./pages/Reception";

function Protected(props: { component: () => any }) {
  return (
    <Show when={auth.token} fallback={<Login />}>
      <div class="app-shell">
        <NavBar />
        {props.component()}
      </div>
    </Show>
  );
}

export default function App() {
  return (
    <Router>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <Protected component={POS} />} />
      <Route path="/receptie" component={() => <Protected component={Reception} />} />
    </Router>
  );
}
