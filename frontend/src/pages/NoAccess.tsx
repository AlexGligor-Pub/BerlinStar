import { logout } from "../store/authStore";
import logo from "../assets/logo-nav.webp";

export default function NoAccess() {
  function handleLogout() {
    logout();
  }

  return (
    <div class="no-access-page">
      <img src={logo} alt="Berlin Star" class="no-access-logo" />
      <h1 class="no-access-title">Perioada de trial a expirat</h1>
      <p class="no-access-body">
        Accesul la Berlin Star a expirat. Pentru a continua sa folosesti aplicatia,
        te rugam sa contactezi echipa Professor Prime.
      </p>
      <a
        class="btn btn-primary no-access-link"
        href="https://professorprime.ro/"
        target="_blank"
        rel="noopener noreferrer"
      >
        professorprime.ro
      </a>
      <button class="btn btn-ghost no-access-logout" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}
