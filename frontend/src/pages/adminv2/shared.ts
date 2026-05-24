/** Utilitati partajate intre sectiunile AdminV2. */

export type TaskRunStatus = "running" | "success" | "error";

/** Mapare status -> text romanesc + culoare + icon (folosita in Tasks + Logs). */
export function statusDisplay(s: TaskRunStatus | null) {
  if (s === null) return { text: "Niciodata", color: "var(--text-muted)", icon: "—" };
  if (s === "success") return { text: "Succes", color: "var(--success)", icon: "✓" };
  if (s === "error") return { text: "Eroare", color: "var(--danger)", icon: "✕" };
  return { text: "Ruleaza", color: "var(--accent)", icon: "⟳" };
}

/** Formateaza o data ISO la dd.MM.yyyy HH:mm in limba romana. */
export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("ro-RO") +
    " " +
    d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
  );
}

/** Comprima un fisier imagine la PNG sub `maxBytes`, scaland progresiv cu 75%. */
export async function compressToPng(file: File, maxBytes = 500_000): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      const tryRender = () => {
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            if (blob.size <= maxBytes || w <= 200) {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" }));
            } else {
              w = Math.round(w * 0.75);
              h = Math.round(h * 0.75);
              tryRender();
            }
          },
          "image/png"
        );
      };
      tryRender();
    };
    img.src = url;
  });
}
