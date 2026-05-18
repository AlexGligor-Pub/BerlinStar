import { Show, createSignal, onMount } from "solid-js";
import { apiFetch, apiUpload, readJsonSafe } from "../../utils/api";
import { notify } from "../../store/notificationsStore";
import { setDisplayName } from "../../store/authStore";
import type { ApiMessageBody } from "../../types";

interface MeResponse {
  id: number;
  name: string;
  username: string;
  description: string | null;
  email: string | null;
  image_url: string | null;
}

/**
 * „Contul Meu" — panou in Configurari pentru parolele proprii.
 *
 *  - Parola Rapoarte: protejeaza pagina Rapoarte. La prima setare nu se cere
 *    parola veche; ulterior se cere parola veche + cea noua.
 *  - Parola Cont (login): parola de autentificare in BerlinStar. Mereu se
 *    cere parola veche.
 */
export default function ContulMeuPanel() {
  // ── Detalii cont ─────────────────────────────────────────────────────────
  const [me, setMe] = createSignal<MeResponse | null>(null);
  const [editMode, setEditMode] = createSignal(false);
  const [editName, setEditName] = createSignal("");
  const [editDesc, setEditDesc] = createSignal("");
  const [editEmail, setEditEmail] = createSignal("");
  const [meErr, setMeErr] = createSignal("");
  const [meSaving, setMeSaving] = createSignal(false);
  const [imgUploading, setImgUploading] = createSignal(false);
  const [imgErr, setImgErr] = createSignal("");
  let imgFileInput: HTMLInputElement | undefined;

  async function loadMe() {
    try {
      const res = await apiFetch("/api/auth/me");
      if (!res.ok) return;
      const d = (await res.json()) as MeResponse;
      setMe(d);
      setDisplayName(d.name);
    } catch {
      // ignore
    }
  }

  function startEdit() {
    const m = me();
    if (!m) return;
    setEditName(m.name ?? "");
    setEditDesc(m.description ?? "");
    setEditEmail(m.email ?? "");
    setMeErr("");
    setEditMode(true);
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImgErr("Selecteaza un fisier imagine.");
      return;
    }
    setImgErr("");
    setImgUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiUpload("/api/auth/me/image", fd);
      if (!res.ok) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        setImgErr(d.detail ?? "Eroare la upload.");
        return;
      }
      const d = (await res.json()) as MeResponse;
      setMe(d);
      setDisplayName(d.name);
      notify("Imaginea a fost incarcata.", "success");
    } catch {
      setImgErr("Eroare de conexiune.");
    } finally {
      setImgUploading(false);
      if (imgFileInput) imgFileInput.value = "";
    }
  }

  async function deleteImage() {
    setImgErr("");
    setImgUploading(true);
    try {
      const res = await apiFetch("/api/auth/me/image", { method: "DELETE" });
      if (!res.ok) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        setImgErr(d.detail ?? "Eroare la stergere.");
        return;
      }
      const d = (await res.json()) as MeResponse;
      setMe(d);
      notify("Imaginea a fost stearsa.", "success");
    } catch {
      setImgErr("Eroare de conexiune.");
    } finally {
      setImgUploading(false);
    }
  }

  function cancelEdit() {
    setEditMode(false);
    setMeErr("");
  }

  async function saveMe(e: Event) {
    e.preventDefault();
    setMeErr("");
    if (!editName().trim()) {
      setMeErr("Numele nu poate fi gol.");
      return;
    }
    setMeSaving(true);
    try {
      const res = await apiFetch("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: editName().trim(),
          description: editDesc().trim() || null,
          email: editEmail().trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        setMeErr(d.detail ?? "Eroare la salvare.");
        return;
      }
      const d = (await res.json()) as MeResponse;
      setMe(d);
      setDisplayName(d.name);
      setEditMode(false);
      notify("Detaliile contului au fost salvate.", "success");
    } catch {
      setMeErr("Eroare de conexiune.");
    } finally {
      setMeSaving(false);
    }
  }

  // ── Parola Rapoarte ──────────────────────────────────────────────────────
  const [hasReportsPwd, setHasReportsPwd] = createSignal<boolean | null>(null);
  const [rOld, setROld] = createSignal("");
  const [rNew, setRNew] = createSignal("");
  const [rNew2, setRNew2] = createSignal("");
  const [rErr, setRErr] = createSignal("");
  const [rSaving, setRSaving] = createSignal(false);

  async function loadStatus() {
    try {
      const res = await apiFetch("/api/auth/reports/status");
      if (!res.ok) return;
      const d = await readJsonSafe<{ has_password: boolean }>(res);
      setHasReportsPwd(!!d.has_password);
    } catch {
      // ignore
    }
  }

  async function doSaveReportsPwd(e: Event) {
    e.preventDefault();
    setRErr("");
    if (rNew().length < 10) {
      setRErr("Parola nouă trebuie să aibă minim 10 caractere.");
      return;
    }
    if (rNew() !== rNew2()) {
      setRErr("Parolele noi nu coincid.");
      return;
    }
    if (hasReportsPwd() && !rOld()) {
      setRErr("Introdu parola curentă pentru Rapoarte.");
      return;
    }
    setRSaving(true);
    try {
      const body: Record<string, string> = { new_password: rNew() };
      if (hasReportsPwd()) body.old_password = rOld();
      const res = await apiFetch("/api/auth/reports/set-password", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        setRErr(d.detail ?? "Eroare la salvare.");
        return;
      }
      notify(
        hasReportsPwd()
          ? "Parola pentru Rapoarte a fost schimbată."
          : "Parola pentru Rapoarte a fost setată.",
        "success",
      );
      setROld(""); setRNew(""); setRNew2("");
      setHasReportsPwd(true);
    } catch {
      setRErr("Eroare de conexiune.");
    } finally {
      setRSaving(false);
    }
  }

  // ── Parola Cont (login) ──────────────────────────────────────────────────
  const [lOld, setLOld] = createSignal("");
  const [lNew, setLNew] = createSignal("");
  const [lNew2, setLNew2] = createSignal("");
  const [lErr, setLErr] = createSignal("");
  const [lSaving, setLSaving] = createSignal(false);

  async function doSaveLoginPwd(e: Event) {
    e.preventDefault();
    setLErr("");
    if (lNew().length < 10) {
      setLErr("Parola nouă trebuie să aibă minim 10 caractere.");
      return;
    }
    if (lNew() !== lNew2()) {
      setLErr("Parolele noi nu coincid.");
      return;
    }
    if (!lOld()) {
      setLErr("Introdu parola curentă.");
      return;
    }
    setLSaving(true);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ old_password: lOld(), new_password: lNew() }),
      });
      if (!res.ok) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        setLErr(d.detail ?? "Eroare la salvare.");
        return;
      }
      notify("Parola contului a fost schimbată.", "success");
      setLOld(""); setLNew(""); setLNew2("");
    } catch {
      setLErr("Eroare de conexiune.");
    } finally {
      setLSaving(false);
    }
  }

  onMount(() => {
    void loadMe();
    void loadStatus();
  });

  return (
    <div class="cfg-panel">
      <h2 class="cfg-panel-title">Contul Meu</h2>
      <p class="cfg-hint" style="margin:0 0 18px">
        Schimbă parolele asociate contului tău: parola pentru accesul la pagina
        <strong> Rapoarte</strong> și parola pentru autentificarea în sistem.
      </p>

      {/* ── Detalii cont ── */}
      <div class="account-card" style="padding:18px;margin-bottom:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px">
          <h3 style="margin:0;font-size:1.05rem">👤 Detalii cont</h3>
          <Show when={!editMode() && me()}>
            <button class="btn btn-ghost btn-sm" onClick={startEdit}>
              ✎ Editează
            </button>
          </Show>
        </div>

        <Show when={me()} fallback={
          <div style="font-size:0.82rem;color:var(--text-muted)">Se încarcă…</div>
        }>
          {(m) => (
            <Show when={editMode()} fallback={
              <div style="display:grid;gap:10px;grid-template-columns:max-content 1fr;align-items:center;font-size:0.92rem">
                <div style="color:var(--text-muted)">Nume</div>
                <div style="font-weight:500">{m().name}</div>
                <div style="color:var(--text-muted)">Username</div>
                <div style="font-family:var(--font-mono,monospace);background:var(--surface-2,#f1f5f9);padding:2px 8px;border-radius:4px;width:fit-content">{m().username}</div>
                <div style="color:var(--text-muted)">Email</div>
                <div>{m().email || <span style="color:var(--text-muted);font-style:italic">—</span>}</div>
                <div style="color:var(--text-muted)">Descriere</div>
                <div style="white-space:pre-wrap">{m().description || <span style="color:var(--text-muted);font-style:italic">—</span>}</div>
                <div style="color:var(--text-muted)">Imagine</div>
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                  <Show
                    when={m().image_url}
                    fallback={
                      <div style="width:56px;height:56px;border-radius:50%;background:var(--surface-2,#f1f5f9);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-weight:700;font-size:1.2rem">
                        {(m().name?.charAt(0) || "?").toUpperCase()}
                      </div>
                    }
                  >
                    <img
                      src={m().image_url!}
                      alt={m().name}
                      style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:1px solid var(--border,#e5e7eb)"
                    />
                  </Show>
                  <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm"
                      onClick={() => imgFileInput?.click()}
                      disabled={imgUploading()}
                    >
                      {imgUploading() ? "Se încarcă…" : m().image_url ? "Schimbă imaginea" : "Upload imagine"}
                    </button>
                    <Show when={m().image_url}>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        style="color:var(--danger,#ef4444)"
                        onClick={deleteImage}
                        disabled={imgUploading()}
                      >
                        Șterge
                      </button>
                    </Show>
                  </div>
                  <input
                    ref={imgFileInput}
                    type="file"
                    accept="image/*"
                    style="display:none"
                    onChange={(e) => void uploadImage(e.currentTarget.files?.[0])}
                  />
                  <Show when={imgErr()}>
                    <div style="width:100%;color:var(--danger,#ef4444);font-size:0.82rem">{imgErr()}</div>
                  </Show>
                </div>
              </div>
            }>
              <form onSubmit={saveMe} autocomplete="off">
                <div class="form-group">
                  <label class="form-label">Nume</label>
                  <input
                    class="input"
                    type="text"
                    value={editName()}
                    onInput={(e) => setEditName(e.currentTarget.value)}
                    maxLength={200}
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">Username <span style="color:var(--text-muted);font-weight:400">(nu poate fi modificat)</span></label>
                  <input
                    class="input"
                    type="text"
                    value={m().username}
                    disabled
                    style="opacity:0.7;cursor:not-allowed"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">Email</label>
                  <input
                    class="input"
                    type="email"
                    value={editEmail()}
                    onInput={(e) => setEditEmail(e.currentTarget.value)}
                    maxLength={255}
                    placeholder="nume@exemplu.ro"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">Descriere</label>
                  <textarea
                    class="input"
                    rows={3}
                    value={editDesc()}
                    onInput={(e) => setEditDesc(e.currentTarget.value)}
                  />
                </div>
                <p class="cfg-hint" style="margin:4px 0 12px">
                  Imaginea de profil se gestionează direct (Upload / Șterge) — nu
                  face parte din acest formular.
                </p>
                <Show when={meErr()}>
                  <div class="login-error" style="margin:8px 0">{meErr()}</div>
                </Show>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
                  <button type="button" class="btn btn-ghost btn-sm" onClick={cancelEdit} disabled={meSaving()}>
                    Anulează
                  </button>
                  <button type="submit" class="btn btn-primary btn-sm" disabled={meSaving()}>
                    {meSaving() ? "Se salvează…" : "Salvează"}
                  </button>
                </div>
              </form>
            </Show>
          )}
        </Show>
      </div>

      <div style="display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
        {/* ── Parola Rapoarte ── */}
        <div class="account-card" style="padding:18px">
          <h3 style="margin:0 0 4px;font-size:1.05rem">🔐 Parola Rapoarte</h3>
          <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
            Protejează pagina <strong>Rapoarte</strong>. Accesul rămâne deschis
            timp de 1 oră după introducerea parolei.
          </div>

          <Show when={hasReportsPwd() === null}>
            <div style="font-size:0.82rem;color:var(--text-muted)">Se încarcă…</div>
          </Show>

          <Show when={hasReportsPwd() === false}>
            <div style="background:#fff7ed;border:1px solid #f59e0b;color:#92400e;padding:8px 10px;border-radius:6px;font-size:0.82rem;margin-bottom:12px">
              Nu este setată o parolă — accesul la Rapoarte este blocat până
              configurezi una.
            </div>
          </Show>

          <form onSubmit={doSaveReportsPwd} autocomplete="off">
            <Show when={hasReportsPwd()}>
              <div class="form-group">
                <label class="form-label">Parola curentă</label>
                <input
                  class="input"
                  type="password"
                  placeholder="••••••••"
                  value={rOld()}
                  onInput={(e) => setROld(e.currentTarget.value)}
                />
              </div>
            </Show>
            <div class="form-group">
              <label class="form-label">Parola nouă</label>
              <input
                class="input"
                type="password"
                placeholder="minim 10 caractere"
                value={rNew()}
                onInput={(e) => setRNew(e.currentTarget.value)}
              />
            </div>
            <div class="form-group">
              <label class="form-label">Confirmă parola nouă</label>
              <input
                class="input"
                type="password"
                placeholder="••••••••"
                value={rNew2()}
                onInput={(e) => setRNew2(e.currentTarget.value)}
              />
            </div>
            <Show when={rErr()}>
              <div class="login-error" style="margin:8px 0">{rErr()}</div>
            </Show>
            <button class="btn btn-primary w-full" type="submit" disabled={rSaving()}>
              {rSaving()
                ? "Se salvează…"
                : hasReportsPwd()
                ? "Schimbă parola"
                : "Setează parola"}
            </button>
          </form>
        </div>

        {/* ── Parola Cont (login) ── */}
        <div class="account-card" style="padding:18px">
          <h3 style="margin:0 0 4px;font-size:1.05rem">🔑 Parola Cont</h3>
          <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
            Parola folosită la autentificarea în BerlinStar.
          </div>

          <form onSubmit={doSaveLoginPwd} autocomplete="off">
            <div class="form-group">
              <label class="form-label">Parola curentă</label>
              <input
                class="input"
                type="password"
                placeholder="••••••••"
                value={lOld()}
                onInput={(e) => setLOld(e.currentTarget.value)}
              />
            </div>
            <div class="form-group">
              <label class="form-label">Parola nouă</label>
              <input
                class="input"
                type="password"
                placeholder="minim 10 caractere"
                value={lNew()}
                onInput={(e) => setLNew(e.currentTarget.value)}
              />
            </div>
            <div class="form-group">
              <label class="form-label">Confirmă parola nouă</label>
              <input
                class="input"
                type="password"
                placeholder="••••••••"
                value={lNew2()}
                onInput={(e) => setLNew2(e.currentTarget.value)}
              />
            </div>
            <Show when={lErr()}>
              <div class="login-error" style="margin:8px 0">{lErr()}</div>
            </Show>
            <button class="btn btn-primary w-full" type="submit" disabled={lSaving()}>
              {lSaving() ? "Se salvează…" : "Schimbă parola"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
