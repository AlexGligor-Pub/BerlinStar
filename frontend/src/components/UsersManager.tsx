/**
 * Gestionarea utilizatorilor unui cont: CRUD, resetare parola si dispozitivele
 * pe care fiecare user e logat (cu deconectare).
 *
 * Aceeasi componenta serveste doua ecrane, fiindca endpointurile au forme
 * identice sub doua prefixe diferite (vezi backend app/routers/users.py si
 * app/routers/admin_users.py):
 *   - pagina Utilizatori (adminul contului):  basePath="/api/users"
 *   - AdminV2, per cont (super-admin):        basePath="/api/admin/accounts/{id}/users"
 *
 * Regulile de business (ultimul admin, unicitate username, revocarea
 * sesiunilor la reset de parola) sunt validate pe server — aici afisam doar
 * mesajele lui.
 */
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import {
  createSolidTable, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel,
  type ColumnDef, type SortingState,
} from "@tanstack/solid-table";
import Modal from "./ui/Modal";
import { readApiError, type ApiFetchOptions } from "../utils/api";
import { notify } from "../store/notificationsStore";
import { ALL_ROLES, ROLE_DESCRIPTION, ROLE_LABEL, type Role } from "../store/permissions";
import { exportCSV, exportPDF } from "../pages/configurari/shared";

const PASSWORD_MIN = 10;

export interface SessionRow {
  id: number;
  device_id: number | null;
  device_name: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  location_name: string | null;
  is_current: boolean;
}

export interface UserRow {
  id: number;
  account_id: number;
  username: string;
  name: string;
  email: string | null;
  role: Role;
  employee_id: number | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  active_sessions: number;
  sessions: SessionRow[];
}

export interface UsersManagerProps {
  /** Prefixul endpointurilor, fara slash final. */
  basePath: string;
  /** `apiFetch` pentru contul propriu, `adminFetch` pentru AdminV2. */
  fetcher: (url: string, options?: ApiFetchOptions) => Promise<Response>;
  /** Angajatii contului, pentru a lega un user de o fisa de angajat. */
  employees?: { id: number; name: string }[];
  /** Randare compacta (in modal), fara titlu si cu paddinguri mai mici. */
  embedded?: boolean;
  /** Codul firmei — apare in credentialele copiate, fiindca la login se cere. */
  companyCode?: string | null;
  /** Apelat dupa orice modificare — folosit ca sa reincarcam profilul propriu. */
  onChanged?: () => void;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ro-RO", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** „acum", „acum 12 min", „acum 3 h", „acum 2 zile" — mai lizibil decat data
 * completa pentru coloana „ultima activitate". */
function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "acum";
  if (mins < 60) return `acum ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `acum ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `acum ${days} ${days === 1 ? "zi" : "zile"}`;
  return fmtDateTime(iso);
}

/** Eticheta scurta din user-agent: „Chrome · Windows". Nu incercam parsing
 * exhaustiv — e doar un indiciu pentru admin ca sa recunoasca dispozitivul. */
function browserLabel(ua: string | null): string {
  if (!ua) return "Dispozitiv necunoscut";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" : "";
  const os =
    /Windows/i.test(ua) ? "Windows" :
    /Android/i.test(ua) ? "Android" :
    /iPhone|iPad|iPod/i.test(ua) ? "iOS" :
    /Mac OS X/i.test(ua) ? "macOS" :
    /Linux/i.test(ua) ? "Linux" : "";
  return [browser, os].filter(Boolean).join(" · ") || "Dispozitiv necunoscut";
}

const ROLE_COLOR: Record<Role, string> = {
  admin: "#5b7cfa",
  manager: "#0d9488",
  worker: "#6b7280",
};

function RoleBadge(props: { role: Role }) {
  return (
    <span
      style={`display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:600;color:#fff;background:${ROLE_COLOR[props.role] ?? "#6b7280"}`}
      title={ROLE_DESCRIPTION[props.role]}
    >
      {ROLE_LABEL[props.role] ?? props.role}
    </span>
  );
}

interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

const MENU_WIDTH = 210;

/**
 * Meniu „⋮" pentru actiunile unui rand.
 *
 * Dropdown-ul se randeaza intr-un Portal cu `position:fixed`, nu in interiorul
 * celulei: tabelul sta intr-un container cu `overflow:auto`, care altfel ar
 * decupa meniul. Fiind fixat pe ecran, il inchidem la scroll/resize, ca sa nu
 * rămână „agatat" langa randul care s-a mutat.
 */
function RowMenu(props: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = createSignal(false);
  const [pos, setPos] = createSignal({ top: 0, left: 0 });
  let btn: HTMLButtonElement | undefined;

  function place() {
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    // Aliniat la dreapta butonului, dar tinut in ecran pe ambele axe.
    const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    const openUp = r.bottom + 190 > window.innerHeight;
    setPos({ top: openUp ? Math.max(8, r.top - 8) : r.bottom + 6, left });
  }

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    if (open()) { setOpen(false); return; }
    place();
    setOpen(true);
  }

  function onDocPointerDown(e: PointerEvent) {
    if (!open()) return;
    const t = e.target as HTMLElement;
    if (!t.closest("[data-row-menu]")) setOpen(false);
  }
  function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
  function onScrollOrResize() { if (open()) setOpen(false); }

  onMount(() => {
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
  });
  onCleanup(() => {
    document.removeEventListener("pointerdown", onDocPointerDown);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onScrollOrResize);
    window.removeEventListener("scroll", onScrollOrResize, true);
  });

  return (
    <>
      <button
        ref={btn}
        data-row-menu
        type="button"
        class="btn btn-ghost btn-sm"
        style="padding:2px 9px;font-size:16px;line-height:1.2"
        aria-haspopup="menu"
        aria-expanded={open()}
        aria-label={props.label ?? "Acțiuni"}
        title={props.label ?? "Acțiuni"}
        onClick={toggle}
      >
        ⋮
      </button>
      <Show when={open()}>
        <Portal>
          <div
            data-row-menu
            role="menu"
            style={`position:fixed;top:${pos().top}px;left:${pos().left}px;width:${MENU_WIDTH}px;z-index:1200;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);padding:4px;display:flex;flex-direction:column`}
          >
            <For each={props.items}>
              {(it) => (
                <button
                  type="button"
                  role="menuitem"
                  class="btn btn-ghost btn-sm"
                  style={`justify-content:flex-start;text-align:left;width:100%;font-size:13px;padding:7px 10px;${it.danger ? "color:var(--danger)" : ""}`}
                  onClick={() => { setOpen(false); it.onSelect(); }}
                >
                  {it.label}
                </button>
              )}
            </For>
          </div>
        </Portal>
      </Show>
    </>
  );
}

/** Parola generata pentru un coleg: usor de citit cu voce tare si de tastat pe
 *  o tastatura de POS. Fara caractere ambigue (O/0, l/1/I) si fara simboluri
 *  care difera intre layout-uri de tastatura. */
const PWD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePassword(len = 14): string {
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PWD_ALPHABET[b % PWD_ALPHABET.length]).join("");
}

interface FormState {
  username: string;
  name: string;
  email: string;
  role: Role;
  employee_id: string;
  is_active: boolean;
  password: string;
  password2: string;
}

function emptyForm(): FormState {
  return { username: "", name: "", email: "", role: "worker", employee_id: "", is_active: true, password: "", password2: "" };
}

export default function UsersManager(props: UsersManagerProps) {
  const [users, setUsers] = createSignal<UserRow[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [loadErr, setLoadErr] = createSignal("");
  const [filter, setFilter] = createSignal("");
  const [sorting, setSorting] = createSignal<SortingState>([{ id: "username", desc: false }]);

  const [isMobile, setIsMobile] = createSignal(window.innerWidth < 900);
  function onResize() { setIsMobile(window.innerWidth < 900); }

  // Modaluri: „create" | „edit" | „password" | „delete" | „sessions"
  const [modal, setModal] = createSignal<null | "create" | "edit" | "password" | "delete" | "sessions">(null);
  const [target, setTarget] = createSignal<UserRow | null>(null);
  const [form, setForm] = createSignal<FormState>(emptyForm());
  const [formErr, setFormErr] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  // Parolele existente nu pot fi citite (sunt stocate ca hash bcrypt, functie
  // ireversibila). Singurul moment in care exista in clar e cand adminul o
  // seteaza — atunci o poate dezvalui si copia.
  const [revealPwd, setRevealPwd] = createSignal(false);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function load() {
    setLoadErr("");
    try {
      const res = await props.fetcher(props.basePath);
      if (!res.ok) {
        setLoadErr(await readApiError(res, "Nu am putut încărca utilizatorii."));
        return;
      }
      setUsers((await res.json()) as UserRow[]);
    } catch {
      setLoadErr("Eroare de conexiune.");
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    window.addEventListener("resize", onResize);
    void load();
  });
  onCleanup(() => window.removeEventListener("resize", onResize));

  function closeModal() {
    setModal(null);
    setTarget(null);
    setFormErr("");
    setRevealPwd(false);
    setForm(emptyForm());
  }

  function afterChange() {
    void load();
    props.onChanged?.();
  }

  function openCreate() {
    setForm(emptyForm());
    setFormErr("");
    setTarget(null);
    setModal("create");
  }

  function openEdit(u: UserRow) {
    setForm({
      username: u.username,
      name: u.name,
      email: u.email ?? "",
      role: u.role,
      employee_id: u.employee_id != null ? String(u.employee_id) : "",
      is_active: u.is_active,
      password: "",
      password2: "",
    });
    setFormErr("");
    setTarget(u);
    setModal("edit");
  }

  function openPassword(u: UserRow) {
    setForm({ ...emptyForm(), username: u.username });
    setFormErr("");
    setTarget(u);
    setModal("password");
  }

  function openDelete(u: UserRow) {
    setFormErr("");
    setTarget(u);
    setModal("delete");
  }

  function openSessions(u: UserRow) {
    setFormErr("");
    setTarget(u);
    setModal("sessions");
  }

  /** Sesiunile userului deschis in modal, mereu proaspete din lista reincarcata. */
  const targetLive = createMemo(() => {
    const t = target();
    if (!t) return null;
    return users().find((u) => u.id === t.id) ?? t;
  });

  function validatePassword(): string | null {
    const f = form();
    if (f.password.length < PASSWORD_MIN) return `Parola trebuie să aibă minim ${PASSWORD_MIN} caractere.`;
    if (f.password !== f.password2) return "Parolele nu coincid.";
    return null;
  }

  async function doCreate(e: Event) {
    e.preventDefault();
    setFormErr("");
    const f = form();
    if (!f.username.trim()) { setFormErr("Utilizatorul este obligatoriu."); return; }
    if (/\s/.test(f.username.trim())) { setFormErr("Utilizatorul nu poate conține spații."); return; }
    const pErr = validatePassword();
    if (pErr) { setFormErr(pErr); return; }
    setSaving(true);
    try {
      const res = await props.fetcher(props.basePath, {
        method: "POST",
        body: JSON.stringify({
          username: f.username.trim(),
          password: f.password,
          name: f.name.trim() || f.username.trim(),
          email: f.email.trim() || null,
          role: f.role,
          employee_id: f.employee_id ? Number(f.employee_id) : null,
        }),
      });
      if (!res.ok) { setFormErr(await readApiError(res, "Eroare la creare.")); return; }
      notify(`Utilizatorul „${f.username.trim()}" a fost creat.`, "success");
      closeModal();
      afterChange();
    } catch {
      setFormErr("Eroare de conexiune.");
    } finally {
      setSaving(false);
    }
  }

  async function doEdit(e: Event) {
    e.preventDefault();
    setFormErr("");
    const u = target();
    if (!u) return;
    const f = form();
    if (!f.username.trim()) { setFormErr("Utilizatorul este obligatoriu."); return; }
    setSaving(true);
    try {
      const res = await props.fetcher(`${props.basePath}/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          username: f.username.trim(),
          name: f.name.trim() || f.username.trim(),
          email: f.email.trim() || null,
          role: f.role,
          employee_id: f.employee_id ? Number(f.employee_id) : null,
          is_active: f.is_active,
        }),
      });
      if (!res.ok) { setFormErr(await readApiError(res, "Eroare la salvare.")); return; }
      notify("Modificările au fost salvate.", "success");
      closeModal();
      afterChange();
    } catch {
      setFormErr("Eroare de conexiune.");
    } finally {
      setSaving(false);
    }
  }

  async function doSetPassword(e: Event) {
    e.preventDefault();
    setFormErr("");
    const u = target();
    if (!u) return;
    const pErr = validatePassword();
    if (pErr) { setFormErr(pErr); return; }
    setSaving(true);
    try {
      const res = await props.fetcher(`${props.basePath}/${u.id}/password`, {
        method: "POST",
        body: JSON.stringify({ new_password: form().password }),
      });
      if (!res.ok) { setFormErr(await readApiError(res, "Eroare la schimbarea parolei.")); return; }
      notify(`Parola pentru „${u.username}" a fost schimbată. Sesiunile lui au fost închise.`, "success");
      closeModal();
      afterChange();
    } catch {
      setFormErr("Eroare de conexiune.");
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    const u = target();
    if (!u) return;
    setFormErr("");
    setSaving(true);
    try {
      const res = await props.fetcher(`${props.basePath}/${u.id}`, { method: "DELETE" });
      if (!res.ok) { setFormErr(await readApiError(res, "Eroare la ștergere.")); return; }
      notify(`Utilizatorul „${u.username}" a fost șters.`, "success");
      closeModal();
      afterChange();
    } catch {
      setFormErr("Eroare de conexiune.");
    } finally {
      setSaving(false);
    }
  }

  async function revokeSession(sessionId: number) {
    setFormErr("");
    try {
      const res = await props.fetcher(`${props.basePath}/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) { setFormErr(await readApiError(res, "Eroare la deconectare.")); return; }
      notify("Dispozitivul a fost deconectat.", "success");
      afterChange();
    } catch {
      setFormErr("Eroare de conexiune.");
    }
  }

  async function revokeAll(u: UserRow) {
    setFormErr("");
    try {
      const res = await props.fetcher(`${props.basePath}/${u.id}/sessions`, { method: "DELETE" });
      if (!res.ok) { setFormErr(await readApiError(res, "Eroare la deconectare.")); return; }
      notify(`„${u.username}" a fost deconectat de pe toate dispozitivele.`, "success");
      afterChange();
    } catch {
      setFormErr("Eroare de conexiune.");
    }
  }

  const columns: ColumnDef<UserRow>[] = [
    {
      id: "nr",
      header: "#",
      enableSorting: false,
      // Numerotare vizuala: urmareste ordinea si filtrul curent, nu id-ul din DB.
      cell: (info) => (
        <span style="color:var(--text-muted);font-variant-numeric:tabular-nums">
          {info.row.index + 1}
        </span>
      ),
    },
    {
      id: "username",
      header: "Utilizator",
      accessorFn: (u) => u.username,
      cell: (info) => {
        const u = info.row.original;
        return (
          <div>
            <div style="font-weight:600;font-family:var(--font-mono,monospace)">{u.username}</div>
            <div style="color:var(--text-muted);font-size:12px">{u.name}</div>
          </div>
        );
      },
    },
    {
      id: "role",
      header: "Rol",
      accessorFn: (u) => u.role,
      cell: (info) => <RoleBadge role={info.row.original.role} />,
    },
    {
      id: "is_active",
      header: "Status",
      accessorFn: (u) => (u.is_active ? 1 : 0),
      cell: (info) => (
        <Show
          when={info.row.original.is_active}
          fallback={<span style="font-size:12px;color:var(--danger,#dc2626);font-weight:600">Dezactivat</span>}
        >
          <span style="font-size:12px;color:#198754;font-weight:600">Activ</span>
        </Show>
      ),
    },
    {
      id: "email",
      header: "Email",
      accessorFn: (u) => u.email ?? "",
      cell: (info) => (
        <span style="font-size:12.5px">{info.row.original.email || <span style="color:var(--text-muted)">—</span>}</span>
      ),
    },
    {
      id: "last_login_at",
      header: "Ultima logare",
      accessorFn: (u) => u.last_login_at ?? "",
      cell: (info) => (
        <span style="font-size:12.5px" title={fmtDateTime(info.row.original.last_login_at)}>
          {fmtRelative(info.row.original.last_login_at)}
        </span>
      ),
    },
    {
      id: "sessions",
      header: "Dispozitive",
      enableSorting: false,
      accessorFn: (u) => u.active_sessions,
      cell: (info) => {
        const u = info.row.original;
        return (
          <button
            class="btn btn-ghost btn-sm"
            style="font-size:12px;padding:2px 8px"
            onClick={() => openSessions(u)}
            title="Vezi dispozitivele pe care e logat"
          >
            {u.active_sessions === 0 ? "Niciunul" : `${u.active_sessions} activ${u.active_sessions === 1 ? "" : "e"}`}
          </button>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: (info) => {
        const u = info.row.original;
        return (
          <div style="display:flex;justify-content:flex-end">
            <RowMenu
              label={`Acțiuni pentru ${u.username}`}
              items={[
                { label: "Editează",       onSelect: () => openEdit(u) },
                { label: "Schimbă parola", onSelect: () => openPassword(u) },
                { label: "Șterge",         onSelect: () => openDelete(u), danger: true },
              ]}
            />
          </div>
        );
      },
    },
  ];

  const table = createSolidTable({
    get data() { return users(); },
    columns,
    state: {
      get sorting() { return sorting(); },
      get globalFilter() { return filter(); },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    globalFilterFn: (row, _colId, value) => {
      const v = (value as string)?.toLowerCase() ?? "";
      if (!v) return true;
      const u = row.original;
      return (
        u.username.toLowerCase().includes(v) ||
        u.name.toLowerCase().includes(v) ||
        (u.email ?? "").toLowerCase().includes(v) ||
        (ROLE_LABEL[u.role] ?? u.role).toLowerCase().includes(v)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  /** Numele angajatului legat de utilizator, cand exista legatura. */
  function employeeName(u: UserRow): string {
    if (u.employee_id == null) return "";
    return (props.employees ?? []).find((e) => e.id === u.employee_id)?.name ?? `#${u.employee_id}`;
  }

  const EXPORT_HEADERS = [
    "#", "Utilizator", "Nume", "Email", "Rol", "Status", "Angajat",
    "Ultima logare", "Dispozitive active", "Dispozitive", "Creat la",
  ];

  /** Exportam randurile in ordinea si cu filtrul de pe ecran — ce vede adminul
   *  in tabel e ce primeste in fisier. */
  function exportRows(): string[][] {
    return table.getRowModel().rows.map((row, idx) => {
      const u = row.original;
      const devices = u.sessions
        .map((sx) => [sx.device_name || browserLabel(sx.user_agent), sx.location_name].filter(Boolean).join(" — "))
        .join("; ");
      return [
        String(idx + 1),
        u.username,
        u.name,
        u.email ?? "",
        ROLE_LABEL[u.role] ?? u.role,
        u.is_active ? "Activ" : "Dezactivat",
        employeeName(u),
        fmtDateTime(u.last_login_at),
        String(u.active_sessions),
        devices,
        fmtDateTime(u.created_at),
      ];
    });
  }

  function fileStamp(): string {
    const d = new Date();
    const p2 = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  }

  /** Codul firmei sus, in ambele formate: fara el, lista de utilizatori e
   *  inutilizabila — la login se cere cod + utilizator + parola. */
  function doExportCSV() {
    const preamble: string[][] = [
      ["Cod firmă", props.companyCode ?? "—"],
      ["Exportat la", new Date().toLocaleString("ro-RO")],
      ["Utilizatori", String(table.getRowModel().rows.length)],
    ];
    exportCSV(`utilizatori_${fileStamp()}`, EXPORT_HEADERS, exportRows(), preamble);
  }

  function doExportPDF() {
    exportPDF(`Utilizatori — ${fileStamp()}`, EXPORT_HEADERS, exportRows(), [
      { label: "Cod firmă (necesar la autentificare)", value: props.companyCode ?? "—" },
      { label: "Utilizatori", value: String(table.getRowModel().rows.length) },
    ]);
  }

  const counts = createMemo(() => {
    const list = users();
    return {
      total: list.length,
      admins: list.filter((u) => u.role === "admin" && u.is_active).length,
      devices: list.reduce((s, u) => s + u.active_sessions, 0),
    };
  });

  function RoleSelect() {
    return (
      <>
        <select class="input" value={form().role} onChange={(e) => setField("role", e.currentTarget.value as Role)}>
          <For each={ALL_ROLES}>
            {(r) => <option value={r}>{ROLE_LABEL[r]}</option>}
          </For>
        </select>
        <div style="margin-top:4px;font-size:0.78rem;color:var(--text-muted)">
          {ROLE_DESCRIPTION[form().role]}
        </div>
      </>
    );
  }

  function EmployeeSelect() {
    return (
      <Show when={(props.employees ?? []).length > 0}>
        <div class="form-group">
          <label class="form-label">Angajat (opțional)</label>
          <select
            class="input"
            value={form().employee_id}
            onChange={(e) => setField("employee_id", e.currentTarget.value)}
          >
            <option value="">— fără legătură —</option>
            <For each={props.employees ?? []}>
              {(emp) => <option value={String(emp.id)}>{emp.name}</option>}
            </For>
          </select>
          <div style="margin-top:4px;font-size:0.78rem;color:var(--text-muted)">
            Notează cine e persoana din spatele contului. Momentan e doar
            informativ — nu schimbă drepturile și nu filtrează nimic.
          </div>
        </div>
      </Show>
    );
  }

  function generateAndFill() {
    const pwd = generatePassword();
    setForm((prev) => ({ ...prev, password: pwd, password2: pwd }));
    setRevealPwd(true);
  }

  function copyCredentials() {
    const lines = [
      props.companyCode ? `Cod firmă: ${props.companyCode}` : null,
      `Utilizator: ${form().username || target()?.username || ""}`,
      `Parolă: ${form().password}`,
    ].filter(Boolean).join("\n");
    void navigator.clipboard?.writeText(lines)
      .then(() => notify("Credențialele au fost copiate.", "success"))
      .catch(() => notify("Nu am putut copia în clipboard.", "error"));
  }

  function PasswordFields(props2: { label?: string }) {
    return (
      <>
        <div class="form-group">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <label class="form-label" style="margin:0">{props2.label ?? "Parolă"}</label>
            <div style="display:flex;gap:6px">
              <button type="button" class="btn btn-ghost btn-sm" style="font-size:11.5px;padding:2px 8px" onClick={generateAndFill}>
                Generează
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                style="font-size:11.5px;padding:2px 8px"
                onClick={() => setRevealPwd((v) => !v)}
              >
                {revealPwd() ? "Ascunde" : "Arată"}
              </button>
            </div>
          </div>
          <input
            class="input"
            type={revealPwd() ? "text" : "password"}
            autocomplete="new-password"
            placeholder={`minim ${PASSWORD_MIN} caractere`}
            value={form().password}
            onInput={(e) => setField("password", e.currentTarget.value)}
          />
        </div>
        <div class="form-group">
          <label class="form-label">Confirmă parola</label>
          <input
            class="input"
            type={revealPwd() ? "text" : "password"}
            autocomplete="new-password"
            placeholder="••••••••"
            value={form().password2}
            onInput={(e) => setField("password2", e.currentTarget.value)}
          />
        </div>
        <Show when={form().password.length >= PASSWORD_MIN}>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;margin-bottom:12px">
            <div style="font-size:11.5px;color:var(--text-muted);line-height:1.5">
              Notează parola acum — după salvare nu mai poate fi citită de nimeni,
              nici de tine: se stochează criptată ireversibil.
            </div>
            <button type="button" class="btn btn-ghost btn-sm" style="font-size:11.5px;white-space:nowrap" onClick={copyCredentials}>
              Copiază credențialele
            </button>
          </div>
        </Show>
      </>
    );
  }

  return (
    <div style={props.embedded ? "" : "padding:12px 16px;max-width:1400px;margin:0 auto"}>
      <Show when={!props.embedded}>
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px">
          <div>
            <h2 style="margin:0;font-size:1.3rem">Utilizatori</h2>
            <div style="color:var(--text-muted);font-size:13px;margin-top:2px">
              {counts().total} utilizatori · {counts().admins} administrator(i) · {counts().devices} dispozitiv(e) conectate
            </div>
          </div>
        </div>
      </Show>

      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
        <input
          class="input"
          style="max-width:260px"
          placeholder="Caută utilizator, nume, email…"
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
        />
        <button class="btn btn-primary btn-sm" onClick={openCreate}>+ Utilizator nou</button>
        <button class="btn btn-ghost btn-sm" onClick={() => void load()} title="Reîncarcă">⟳</button>
        <div style="margin-left:auto;display:flex;gap:6px">
          <button
            class="btn btn-ghost btn-sm"
            style="font-size:12px"
            disabled={users().length === 0}
            title="Descarcă lista în format CSV (Excel)"
            onClick={doExportCSV}
          >
            ⬇ CSV
          </button>
          <button
            class="btn btn-ghost btn-sm"
            style="font-size:12px"
            disabled={users().length === 0}
            title="Deschide lista pentru tipărire / salvare ca PDF"
            onClick={doExportPDF}
          >
            ⬇ PDF
          </button>
        </div>
      </div>

      <Show when={loadErr()}>
        <div class="login-error" style="margin-bottom:12px">{loadErr()}</div>
      </Show>

      <Show when={loading()}>
        <div class="skeleton" style="height:120px" />
      </Show>

      <Show when={!loading() && users().length === 0 && !loadErr()}>
        <div class="card" style="padding:18px;color:var(--text-muted);font-size:13px">
          Nu există utilizatori. Creează primul cu „+ Utilizator nou".
        </div>
      </Show>

      {/* Mobile: carduri */}
      <Show when={!loading() && isMobile() && table.getRowModel().rows.length > 0}>
        <div style="display:flex;flex-direction:column;gap:8px">
          <For each={table.getRowModel().rows}>
            {(row) => {
              const u = row.original;
              return (
                <div class="card" style="padding:12px">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
                    <div>
                      <div style="font-weight:600;font-family:var(--font-mono,monospace)">{u.username}</div>
                      <div style="color:var(--text-muted);font-size:12px">{u.name}</div>
                    </div>
                    <RoleBadge role={u.role} />
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;font-size:12.5px">
                    <div>
                      <div style="color:var(--text-muted);font-size:11px">Status</div>
                      <div style={u.is_active ? "color:#198754;font-weight:600" : "color:var(--danger,#dc2626);font-weight:600"}>
                        {u.is_active ? "Activ" : "Dezactivat"}
                      </div>
                    </div>
                    <div>
                      <div style="color:var(--text-muted);font-size:11px">Ultima logare</div>
                      <div>{fmtRelative(u.last_login_at)}</div>
                    </div>
                    <div>
                      <div style="color:var(--text-muted);font-size:11px">Email</div>
                      <div style="word-break:break-all">{u.email || "—"}</div>
                    </div>
                    <div>
                      <div style="color:var(--text-muted);font-size:11px">Dispozitive</div>
                      <button class="btn btn-ghost btn-sm" style="font-size:12px;padding:2px 8px" onClick={() => openSessions(u)}>
                        {u.active_sessions === 0 ? "Niciunul" : `${u.active_sessions} activ${u.active_sessions === 1 ? "" : "e"}`}
                      </button>
                    </div>
                  </div>
                  <div style="display:flex;justify-content:flex-end;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
                    <RowMenu
                      label={`Acțiuni pentru ${u.username}`}
                      items={[
                        { label: "Editează",       onSelect: () => openEdit(u) },
                        { label: "Schimbă parola", onSelect: () => openPassword(u) },
                        { label: "Șterge",         onSelect: () => openDelete(u), danger: true },
                      ]}
                    />
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Desktop: tabel */}
      <Show when={!loading() && !isMobile() && table.getRowModel().rows.length > 0}>
        <div class="card" style="padding:0;overflow:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <For each={table.getHeaderGroups()}>
                {(hg) => (
                  <tr style="background:var(--surface2);position:sticky;top:0;z-index:1">
                    <For each={hg.headers}>
                      {(h) => {
                        const sort = h.column.getIsSorted();
                        const canSort = h.column.getCanSort();
                        return (
                          <th
                            style={`padding:10px;text-align:left;font-weight:600;border-bottom:1px solid var(--border);${canSort ? "cursor:pointer;user-select:none" : ""}`}
                            onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                          >
                            <span style="display:inline-flex;align-items:center;gap:4px">
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              <Show when={sort === "asc"}><span style="font-size:11px">▲</span></Show>
                              <Show when={sort === "desc"}><span style="font-size:11px">▼</span></Show>
                            </span>
                          </th>
                        );
                      }}
                    </For>
                  </tr>
                )}
              </For>
            </thead>
            <tbody>
              <For each={table.getRowModel().rows}>
                {(row) => (
                  <tr
                    style={`border-bottom:1px solid var(--border);${row.original.is_active ? "" : "opacity:0.6"}`}
                  >
                    <For each={row.getVisibleCells()}>
                      {(cell) => (
                        <td style="padding:8px 10px">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      {/* ── Creare ── */}
      <Modal open={modal() === "create"} onClose={closeModal} title="Utilizator nou" size="md">
        <form onSubmit={doCreate} autocomplete="off">
          <div class="form-group">
            <label class="form-label">Utilizator *</label>
            <input
              class="input"
              autocapitalize="none"
              spellcheck={false}
              placeholder="ex: ion"
              value={form().username}
              onInput={(e) => setField("username", e.currentTarget.value)}
            />
            <div style="margin-top:4px;font-size:0.78rem;color:var(--text-muted)">
              Trebuie unic doar în acest cont. La autentificare se folosește împreună cu codul firmei.
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Nume complet</label>
            <input
              class="input"
              placeholder="ex: Ion Popescu"
              value={form().name}
              onInput={(e) => setField("name", e.currentTarget.value)}
            />
          </div>
          <div class="form-group">
            <label class="form-label">Email (opțional)</label>
            <input class="input" type="email" value={form().email} onInput={(e) => setField("email", e.currentTarget.value)} />
          </div>
          <div class="form-group">
            <label class="form-label">Rol *</label>
            <RoleSelect />
          </div>
          <EmployeeSelect />
          <PasswordFields />
          <Show when={formErr()}>
            <div class="login-error" style="margin:8px 0">{formErr()}</div>
          </Show>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button type="button" class="btn btn-ghost btn-sm" onClick={closeModal}>Anulează</button>
            <button type="submit" class="btn btn-primary btn-sm" disabled={saving()}>
              {saving() ? "Se creează…" : "Creează"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Editare ── */}
      <Modal open={modal() === "edit"} onClose={closeModal} title={`Editează ${target()?.username ?? ""}`} size="md">
        <form onSubmit={doEdit} autocomplete="off">
          <div class="form-group">
            <label class="form-label">Utilizator *</label>
            <input
              class="input"
              autocapitalize="none"
              spellcheck={false}
              value={form().username}
              onInput={(e) => setField("username", e.currentTarget.value)}
            />
          </div>
          <div class="form-group">
            <label class="form-label">Nume complet</label>
            <input class="input" value={form().name} onInput={(e) => setField("name", e.currentTarget.value)} />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="input" type="email" value={form().email} onInput={(e) => setField("email", e.currentTarget.value)} />
          </div>
          <div class="form-group">
            <label class="form-label">Rol *</label>
            <RoleSelect />
          </div>
          <EmployeeSelect />
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
              <input
                type="checkbox"
                checked={form().is_active}
                onChange={(e) => setField("is_active", e.currentTarget.checked)}
              />
              Cont activ
            </label>
            <div style="margin-top:4px;font-size:0.78rem;color:var(--text-muted)">
              La dezactivare, utilizatorul e deconectat imediat de pe toate dispozitivele.
            </div>
          </div>
          <Show when={formErr()}>
            <div class="login-error" style="margin:8px 0">{formErr()}</div>
          </Show>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button type="button" class="btn btn-ghost btn-sm" onClick={closeModal}>Anulează</button>
            <button type="submit" class="btn btn-primary btn-sm" disabled={saving()}>
              {saving() ? "Se salvează…" : "Salvează"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Parolă ── */}
      <Modal open={modal() === "password"} onClose={closeModal} title={`Parolă pentru ${target()?.username ?? ""}`} size="sm">
        <form onSubmit={doSetPassword} autocomplete="off">
          <p style="margin:0 0 12px;font-size:13px;color:var(--text-muted)">
            Setezi direct o parolă nouă, fără să o știi pe cea veche. Toate sesiunile
            utilizatorului se închid, deci va trebui să se autentifice din nou.
          </p>
          <PasswordFields label="Parolă nouă" />
          <Show when={formErr()}>
            <div class="login-error" style="margin:8px 0">{formErr()}</div>
          </Show>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button type="button" class="btn btn-ghost btn-sm" onClick={closeModal}>Anulează</button>
            <button type="submit" class="btn btn-primary btn-sm" disabled={saving()}>
              {saving() ? "Se salvează…" : "Schimbă parola"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Ștergere ── */}
      <Modal open={modal() === "delete"} onClose={closeModal} title="Confirmare ștergere" size="sm">
        <p style="margin:0 0 10px;font-size:13px">
          Ștergi utilizatorul <strong>{target()?.username}</strong>
          {target()?.name ? ` (${target()!.name})` : ""}?
        </p>
        <ul style="margin:0 0 12px;padding-left:18px;font-size:12.5px;color:var(--text-muted);line-height:1.6">
          <li>Dispare din listă și nu se mai poate autentifica.</li>
          <li>Este deconectat imediat de pe toate dispozitivele.</li>
          <li>
            Ștergerea este <strong>logică</strong> (soft delete): contul rămâne în baza
            de date, iar bonurile și mișcările de stoc făcute de el își păstrează
            atribuirea.
          </li>
        </ul>
        <Show when={formErr()}>
          <div class="login-error" style="margin:8px 0">{formErr()}</div>
        </Show>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost btn-sm" onClick={closeModal}>Anulează</button>
          <button type="button" class="btn btn-danger btn-sm" disabled={saving()} onClick={() => void doDelete()}>
            {saving() ? "Se șterge…" : "Șterge"}
          </button>
        </div>
      </Modal>

      {/* ── Dispozitive ── */}
      <Modal
        open={modal() === "sessions"}
        onClose={closeModal}
        title={`Dispozitive — ${targetLive()?.username ?? ""}`}
        size="md"
      >
        <Show
          when={(targetLive()?.sessions ?? []).length > 0}
          fallback={
            <p style="margin:0;font-size:13px;color:var(--text-muted)">
              Utilizatorul nu este logat pe niciun dispozitiv.
            </p>
          }
        >
          <div style="display:flex;flex-direction:column;gap:8px">
            <For each={targetLive()!.sessions}>
              {(s) => (
                <div
                  class="card"
                  style={`padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;${s.is_current ? "border-color:var(--accent,#5b7cfa)" : ""}`}
                >
                  <div style="min-width:0">
                    <div style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                      <span>{s.device_name || browserLabel(s.user_agent)}</span>
                      <Show when={s.location_name}>
                        <span style="font-size:11px;padding:1px 7px;border-radius:999px;background:var(--surface2);color:var(--text-muted)">
                          {s.location_name}
                        </span>
                      </Show>
                      <Show when={s.is_current}>
                        <span style="font-size:11px;padding:1px 7px;border-radius:999px;background:var(--accent,#5b7cfa);color:#fff">
                          sesiunea curentă
                        </span>
                      </Show>
                    </div>
                    <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">
                      {browserLabel(s.user_agent)}
                      {s.ip ? ` · ${s.ip}` : ""}
                      {" · activ "}{fmtRelative(s.last_seen_at)}
                    </div>
                    <div style="font-size:11px;color:var(--text-muted)">
                      Conectat: {fmtDateTime(s.created_at)}
                    </div>
                  </div>
                  <button
                    class="btn btn-ghost btn-sm"
                    style="font-size:12px;color:var(--danger,#dc2626);flex-shrink:0"
                    onClick={() => void revokeSession(s.id)}
                  >
                    Deconectează
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={formErr()}>
          <div class="login-error" style="margin:10px 0 0">{formErr()}</div>
        </Show>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
          <Show when={(targetLive()?.sessions ?? []).length > 1}>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              style="margin-right:auto;color:var(--danger,#dc2626)"
              onClick={() => { const u = targetLive(); if (u) void revokeAll(u); }}
            >
              Deconectează toate
            </button>
          </Show>
          <button type="button" class="btn btn-primary btn-sm" onClick={closeModal}>Închide</button>
        </div>
      </Modal>
    </div>
  );
}
