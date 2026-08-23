/**
 * Panoul „Utilizatori" din Configurări — accesibil doar rolului `admin`.
 *
 * Acelasi continut e servit si de pagina de sine statatoare `/utilizatori`
 * (plăcuța din meniu), ca sa nu existe doua implementari care se pot
 * desincroniza. Tot ce tine de CRUD e in components/UsersManager.tsx.
 */
import { Show, createMemo, onMount } from "solid-js";
import { auth } from "../../store/authStore";
import { refreshProfile } from "../../store/profile";
import { employees, loadEmployees } from "../../store/employeesStore";
import { notify } from "../../store/notificationsStore";
import UsersManager from "../../components/UsersManager";
import { apiFetch } from "../../utils/api";

export default function UtilizatoriPanel() {
  onMount(() => {
    // Lista de angajati permite legarea unui utilizator de o fisa de angajat.
    void loadEmployees(null);
  });

  const empOptions = createMemo(() => employees().map((e) => ({ id: e.id, name: e.name })));

  function copyCode() {
    const code = auth.code;
    if (!code) return;
    void navigator.clipboard?.writeText(code)
      .then(() => notify("Codul firmei a fost copiat.", "success"))
      .catch(() => {});
  }

  return (
    <div class="cfg-panel">
      <h2 class="cfg-panel-title">Utilizatori</h2>
      <p class="cfg-hint" style="margin:0 0 18px">
        Conturile de acces ale colegilor tăi. Fiecare are utilizator, parolă și rol,
        iar la autentificare folosesc <strong>codul firmei</strong> de mai jos.
      </p>

      <div class="account-card" style="padding:14px 16px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
        <div style="min-width:0">
          <div style="font-weight:600;font-size:0.95rem">Autentificarea colegilor</div>
          <div style="font-size:12.5px;color:var(--text-muted);margin-top:2px">
            La login se cer trei lucruri: codul firmei, utilizatorul și parola.
            Utilizatorul trebuie unic doar în interiorul firmei.
          </div>
        </div>
        <Show
          when={auth.code}
          fallback={<div style="font-size:12.5px;color:var(--text-muted)">Codul firmei se încarcă…</div>}
        >
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Cod firmă</span>
            <span style="font-family:var(--font-mono,monospace);font-weight:700;font-size:1rem;color:var(--text);background:var(--surface2);border:1px solid var(--border);padding:4px 12px;border-radius:6px">
              {auth.code}
            </span>
            <button class="btn btn-ghost btn-sm" style="font-size:12px" onClick={copyCode}>Copiază</button>
          </div>
        </Show>
      </div>

      <UsersManager
        basePath="/api/users"
        fetcher={apiFetch}
        employees={empOptions()}
        companyCode={auth.code}
        embedded
        // Adminul isi poate schimba propriul rol; reimprospatam profilul ca
        // meniul si rutele sa reflecte imediat noile drepturi.
        onChanged={() => void refreshProfile({ force: true })}
      />
    </div>
  );
}
