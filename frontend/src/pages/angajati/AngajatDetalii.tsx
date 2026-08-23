import { For, Show, createSignal, onMount } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { apiFetch } from "../../utils/api";
import { notify } from "../../store/notificationsStore";

/** Dosar de personal (date legale) — toate campurile optionale. */
interface EmployeeDetail {
  company_id: number | null;
  cnp: string | null;
  nif: string | null;
  nationality: string | null;
  country_of_origin: string | null;
  id_series: string | null;
  id_number: string | null;
  id_issuer: string | null;
  id_issued_date: string | null;
  birth_date: string | null;
  birth_place: string | null;
  phone: string | null;
  personal_email: string | null;
  address_domicile: string | null;
  address_residence: string | null;
  contract_number: string | null;
  contract_date: string | null;
  activity_start_date: string | null;
  contract_type: string | null;
  contract_duration_months: number | null;
  probation_end_date: string | null;
  job_title: string | null;
  cor_code: string | null;
  department: string | null;
  work_norm: string | null;
  hours_per_day: number | string | null;
  base_salary_gross: number | string | null;
  seniority_months: number | null;
  bank_name: string | null;
  iban: string | null;
  medical_check_date: string | null;
  medical_check_expiry: string | null;
  marital_status: string | null;
  dependents_count: number | null;
  education: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
}

interface EmployeeQuick {
  id: number;
  name: string;
  image_path: string | null;
  annual_vacation_days: number;
}

interface CompanyOption {
  id: number;
  name: string;
}

const EMPTY: EmployeeDetail = {
  company_id: null, cnp: null, nif: null, nationality: null, country_of_origin: null,
  id_series: null, id_number: null, id_issuer: null, id_issued_date: null, birth_date: null,
  birth_place: null, phone: null, personal_email: null, address_domicile: null, address_residence: null,
  contract_number: null, contract_date: null, activity_start_date: null, contract_type: null,
  contract_duration_months: null, probation_end_date: null, job_title: null, cor_code: null,
  department: null, work_norm: null, hours_per_day: null, base_salary_gross: null, seniority_months: null,
  bank_name: null, iban: null, medical_check_date: null, medical_check_expiry: null, marital_status: null,
  dependents_count: null, education: null, emergency_contact_name: null, emergency_contact_phone: null,
  emergency_contact_relation: null,
};

type TabKey = "identitate" | "contract" | "banca" | "urgenta" | "firma";

const TABS: { key: TabKey; label: string }[] = [
  { key: "identitate", label: "Identitate" },
  { key: "contract", label: "Contract & Job" },
  { key: "banca", label: "Bancă & Medical" },
  { key: "urgenta", label: "Contact urgență" },
  { key: "firma", label: "Firmă" },
];

export default function AngajatDetalii() {
  const params = useParams();
  const navigate = useNavigate();
  const employeeId = (): number => Number(params.id);

  const [employee, setEmployee] = createSignal<EmployeeQuick | null>(null);
  const [form, setForm] = createSignal<EmployeeDetail>({ ...EMPTY });
  const [companies, setCompanies] = createSignal<CompanyOption[]>([]);
  const [hasDetails, setHasDetails] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [tab, setTab] = createSignal<TabKey>("identitate");
  const [editMode, setEditMode] = createSignal(false);  // implicit: view-only

  function set<K extends keyof EmployeeDetail>(key: K, value: EmployeeDetail[K]) {
    setForm({ ...form(), [key]: value });
  }

  // Helper: leaga un input text de un camp; "" -> null.
  function bind(key: keyof EmployeeDetail) {
    const v = form()[key];
    return {
      value: v === null || v === undefined ? "" : String(v),
      onInput: (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement }) => {
        const raw = e.currentTarget.value;
        set(key, (raw === "" ? null : raw) as EmployeeDetail[keyof EmployeeDetail]);
      },
    };
  }

  function bindNum(key: keyof EmployeeDetail) {
    const v = form()[key];
    return {
      value: v === null || v === undefined ? "" : String(v),
      onInput: (e: { currentTarget: HTMLInputElement }) => {
        const raw = e.currentTarget.value;
        set(key, (raw === "" ? null : Number(raw)) as EmployeeDetail[keyof EmployeeDetail]);
      },
    };
  }

  async function loadEmployee() {
    try {
      const res = await apiFetch(`/api/employees/${employeeId()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const e = await res.json();
      setEmployee({ id: e.id, name: e.name, image_path: e.image_path ?? null, annual_vacation_days: e.annual_vacation_days ?? 21 });
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la încărcare angajat.", "error");
    }
  }

  async function loadDetails() {
    try {
      const res = await apiFetch(`/api/employees/${employeeId()}/details`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d) {
        setHasDetails(true);
        setForm({ ...EMPTY, ...d });
      } else {
        setHasDetails(false);
        setForm({ ...EMPTY });
      }
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la încărcare dosar.", "error");
    }
  }

  async function loadCompanies() {
    try {
      const res = await apiFetch("/api/companies?limit=200");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCompanies((data.items ?? []).map((c: any) => ({ id: c.id, name: c.name })));
    } catch {
      // firmele sunt optionale; nu blocam pagina
    }
  }

  onMount(async () => {
    setLoading(true);
    await Promise.all([loadEmployee(), loadDetails(), loadCompanies()]);
    setLoading(false);
  });

  async function save() {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/employees/${employeeId()}/details`, {
        method: "PUT",
        body: JSON.stringify(form()),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const d = await res.json();
      setHasDetails(true);
      setForm({ ...EMPTY, ...d });
      setEditMode(false);
      notify("Dosar salvat.", "success");
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la salvare.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function cancelEdit() {
    await loadDetails();  // re-incarca valorile salvate, anuland modificarile
    setEditMode(false);
  }

  async function removeDetails() {
    if (!confirm("Ștergi dosarul de personal? Datele legale vor fi pierdute.")) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/employees/${employeeId()}/details`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      setHasDetails(false);
      setForm({ ...EMPTY });
      setEditMode(false);
      notify("Dosar șters.", "success");
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la ștergere.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="client-detail-page">
      <div class="client-detail-header">
        <button type="button" class="btn btn-ghost btn-sm" onClick={() => navigate("/configurari")}>
          ← Înapoi
        </button>
        <div class="client-detail-title" style="display:flex;align-items:center;gap:12px">
          <Show when={employee()?.image_path} fallback={
            <div class="cfg-employee-avatar cfg-employee-avatar--placeholder">
              {(employee()?.name ?? "?").charAt(0).toUpperCase()}
            </div>
          }>
            <img src={employee()!.image_path!} class="cfg-employee-avatar" alt="avatar" />
          </Show>
          <div>
            <h1 class="client-detail-name">{employee()?.name ?? "Angajat"}</h1>
            <p class="client-detail-meta">
              Dosar de personal {hasDetails() ? "· completat" : "· necompletat"}
            </p>
          </div>
        </div>
      </div>

      <Show when={loading()} fallback={
        <>
          {/* Tab bar */}
          <div class="cfg-tabs" style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0;border-bottom:1px solid var(--border, #2a2a2a);padding-bottom:8px">
            <For each={TABS}>
              {(t) => (
                <button
                  type="button"
                  class={`btn btn-sm ${tab() === t.key ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              )}
            </For>
          </div>

          <div class="cfg-panel" style="max-width:780px">
            <fieldset disabled={!editMode()} style="border:0;margin:0;padding:0;min-width:0">
            {/* IDENTITATE */}
            <Show when={tab() === "identitate"}>
              <div class="cfg-field-row"><label>CNP</label><input class="input" maxlength="13" placeholder="13 cifre" {...bind("cnp")} /></div>
              <div class="cfg-field-row"><label>NIF (străini)</label><input class="input" {...bind("nif")} /></div>
              <div class="cfg-field-row"><label>Naționalitate</label><input class="input" {...bind("nationality")} /></div>
              <div class="cfg-field-row"><label>Țară origine</label><input class="input" {...bind("country_of_origin")} /></div>
              <div class="cfg-field-row"><label>CI serie</label><input class="input" {...bind("id_series")} /></div>
              <div class="cfg-field-row"><label>CI număr</label><input class="input" {...bind("id_number")} /></div>
              <div class="cfg-field-row"><label>CI emis de</label><input class="input" {...bind("id_issuer")} /></div>
              <div class="cfg-field-row"><label>CI dată emitere</label><input class="input" type="date" {...bind("id_issued_date")} /></div>
              <div class="cfg-field-row"><label>Data nașterii</label><input class="input" type="date" {...bind("birth_date")} /></div>
              <div class="cfg-field-row"><label>Loc naștere</label><input class="input" {...bind("birth_place")} /></div>
              <div class="cfg-field-row"><label>Telefon</label><input class="input" {...bind("phone")} /></div>
              <div class="cfg-field-row"><label>Email personal</label><input class="input" type="email" {...bind("personal_email")} /></div>
              <div class="cfg-field-row"><label>Adresă domiciliu</label><textarea class="input" rows="2" {...bind("address_domicile")} /></div>
              <div class="cfg-field-row"><label>Adresă reședință</label><textarea class="input" rows="2" {...bind("address_residence")} /></div>
              <div class="cfg-field-row"><label>Stare civilă</label><input class="input" {...bind("marital_status")} /></div>
              <div class="cfg-field-row"><label>Persoane în întreținere</label><input class="input" type="number" min="0" {...bindNum("dependents_count")} /></div>
              <div class="cfg-field-row"><label>Studii / calificări</label><textarea class="input" rows="2" {...bind("education")} /></div>
            </Show>

            {/* CONTRACT & JOB */}
            <Show when={tab() === "contract"}>
              <div class="cfg-field-row"><label>Nr. contract (CIM)</label><input class="input" {...bind("contract_number")} /></div>
              <div class="cfg-field-row"><label>Data contractului</label><input class="input" type="date" {...bind("contract_date")} /></div>
              <div class="cfg-field-row"><label>Data început activitate</label><input class="input" type="date" {...bind("activity_start_date")} /></div>
              <div class="cfg-field-row">
                <label>Tip contract</label>
                <select class="input" {...bind("contract_type")}>
                  <option value="">—</option>
                  <option value="nedeterminata">Durată nedeterminată</option>
                  <option value="determinata">Durată determinată</option>
                </select>
              </div>
              <div class="cfg-field-row"><label>Durată contract (luni)</label><input class="input" type="number" min="0" {...bindNum("contract_duration_months")} /></div>
              <div class="cfg-field-row"><label>Sfârșit perioadă probă</label><input class="input" type="date" {...bind("probation_end_date")} /></div>
              <div class="cfg-field-row"><label>Funcție</label><input class="input" {...bind("job_title")} /></div>
              <div class="cfg-field-row"><label>Cod COR</label><input class="input" maxlength="10" {...bind("cor_code")} /></div>
              <div class="cfg-field-row"><label>Departament</label><input class="input" {...bind("department")} /></div>
              <div class="cfg-field-row">
                <label>Normă de muncă</label>
                <select class="input" {...bind("work_norm")}>
                  <option value="">—</option>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                </select>
              </div>
              <div class="cfg-field-row"><label>Ore / zi</label><input class="input" type="number" step="0.5" min="0" max="24" {...bindNum("hours_per_day")} /></div>
              <div class="cfg-field-row"><label>Salariu brut bază (lei)</label><input class="input" type="number" step="0.01" min="0" {...bindNum("base_salary_gross")} /></div>
              <div class="cfg-field-row"><label>Vechime (luni)</label><input class="input" type="number" min="0" {...bindNum("seniority_months")} /></div>
            </Show>

            {/* BANCA & MEDICAL */}
            <Show when={tab() === "banca"}>
              <div class="cfg-field-row"><label>Bancă</label><input class="input" {...bind("bank_name")} /></div>
              <div class="cfg-field-row"><label>IBAN</label><input class="input" maxlength="34" {...bind("iban")} /></div>
              <div class="cfg-field-row"><label>Aviz medical (dată)</label><input class="input" type="date" {...bind("medical_check_date")} /></div>
              <div class="cfg-field-row"><label>Aviz medical (valabil până)</label><input class="input" type="date" {...bind("medical_check_expiry")} /></div>
            </Show>

            {/* CONTACT URGENTA */}
            <Show when={tab() === "urgenta"}>
              <div class="cfg-field-row"><label>Nume contact urgență</label><input class="input" {...bind("emergency_contact_name")} /></div>
              <div class="cfg-field-row"><label>Telefon contact urgență</label><input class="input" {...bind("emergency_contact_phone")} /></div>
              <div class="cfg-field-row"><label>Relație</label><input class="input" {...bind("emergency_contact_relation")} /></div>
            </Show>

            {/* FIRMA */}
            <Show when={tab() === "firma"}>
              <div class="cfg-field-row">
                <label>Firma angajatorului</label>
                <select
                  class="input"
                  value={form().company_id === null ? "" : String(form().company_id)}
                  onInput={(e) => set("company_id", e.currentTarget.value === "" ? null : Number(e.currentTarget.value))}
                >
                  <option value="">— Selectează firma —</option>
                  <For each={companies()}>
                    {(c) => <option value={String(c.id)}>{c.name}</option>}
                  </For>
                </select>
              </div>
              <Show when={companies().length === 0}>
                <p class="cfg-hint">Nu există firme. Adaugă-le din Configurări → Companiile mele.</p>
              </Show>
            </Show>

            </fieldset>

            <div class="cfg-location-actions" style="margin-top:16px;display:flex;gap:8px;align-items:center">
              <Show
                when={editMode()}
                fallback={
                  <>
                    <span class="cfg-hint" style="margin:0">Mod vizualizare — datele sunt doar pentru citire.</span>
                    <div style="flex:1" />
                    <button class="btn btn-sm btn-primary" onClick={() => setEditMode(true)}>✏ Editează</button>
                  </>
                }
              >
                <Show when={hasDetails()}>
                  <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={removeDetails}>Șterge dosar</button>
                </Show>
                <div style="flex:1" />
                <button class="btn btn-sm btn-ghost" disabled={saving()} onClick={cancelEdit}>Anulează</button>
                <button class="btn btn-sm btn-primary" disabled={saving()} onClick={save}>
                  {saving() ? "Se salvează…" : "Salvează dosar"}
                </button>
              </Show>
            </div>
          </div>
        </>
      }>
        <p class="cfg-hint">Se încarcă…</p>
      </Show>
    </div>
  );
}
