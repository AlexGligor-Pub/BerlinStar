import { Show, createSignal } from "solid-js";
import { readJsonSafe } from "../../utils/api";
import type { ApiMessageBody } from "../../types";
import { adminUpload } from "./admin-auth";
import { compressToPng } from "./shared";

export default function ImageUploadDialog(props: {
  title: string;
  currentUrl: string | null;
  endpoint: string;
  compress?: boolean;
  onSaved: (url: string) => void;
  onClose: () => void;
}) {
  const [dragging, setDragging] = createSignal(false);
  const [previewUrl, setPreviewUrl] = createSignal<string | null>(props.currentUrl);
  const [pendingFile, setPendingFile] = createSignal<File | null>(null);
  const [uploading, setUploading] = createSignal(false);
  const [err, setErr] = createSignal("");

  let fileInput!: HTMLInputElement;

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) { setErr("Selectează un fișier imagine."); return; }
    setErr("");
    setPendingFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  async function doUpload() {
    const file = pendingFile();
    if (!file) return;
    setUploading(true);
    setErr("");
    try {
      const toUpload = props.compress ? await compressToPng(file, 500_000) : file;
      const fd = new FormData();
      fd.append("file", toUpload);
      const res = await adminUpload(props.endpoint, fd);
      if (!res.ok) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        setErr(d.detail ?? "Eroare la upload.");
        return;
      }
      const data = await res.json() as { url: string };
      props.onSaved(data.url);
      props.onClose();
    } catch {
      setErr("Eroare de conexiune.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div class="sl-modal-overlay">
      <div class="sl-modal adminv2-upload-modal">
        <div class="sl-modal-header">
          <span class="sl-modal-title">{props.title}</span>
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>✕</button>
        </div>

        <div class="sl-modal-body">
          {/* Drag & drop zone */}
          <div
            class="hotel-upload-drop"
            classList={{ "hotel-upload-drop--active": dragging() }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer?.files ?? null); }}
            onClick={() => fileInput.click()}
          >
            <Show
              when={previewUrl()}
              fallback={
                <div class="hotel-upload-drop__placeholder">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M4 16l4-4 4 4 4-6 4 6" />
                    <rect x="2" y="3" width="20" height="18" rx="2" />
                  </svg>
                  <span>Trage imaginea aici sau apasă pentru a alege</span>
                </div>
              }
            >
              <img src={previewUrl()!} class="hotel-upload-drop__preview" alt="preview" />
            </Show>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            style="display:none"
            onChange={(e) => handleFiles(e.currentTarget.files)}
          />

          <button
            class="btn btn-ghost btn-sm"
            style="width:100%;margin-top:8px"
            onClick={() => fileInput.click()}
          >
            Alege fișier
          </button>

          <Show when={err()}>
            <p style="color:var(--danger);font-size:13px;margin:8px 0 0">{err()}</p>
          </Show>
        </div>

        <div class="sl-modal-footer">
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>Anulează</button>
          <button
            class="btn btn-primary btn-sm"
            disabled={!pendingFile() || uploading()}
            onClick={doUpload}
          >
            {uploading() ? "Se încarcă..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}
