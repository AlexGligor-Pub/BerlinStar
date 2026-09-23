/**
 * PDF-ul cu datele de acces ale unui cont nou (cod client, utilizator, parolă).
 *
 * Parola nu mai poate fi citită nicăieri după creare — se salvează doar hash-ul —
 * deci fișierul ăsta e singura ocazie de a o preda clientului. De aceea poartă
 * și avertismentul de confidențialitate.
 */
import roFontUrl from "../assets/fonts/NotoSans-Ro.ttf";

let _roFontB64: string | null | false = false;

function _bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length))));
  }
  return btoa(chunks.join(""));
}

async function loadRoFontBase64(): Promise<string | null> {
  if (_roFontB64 !== false) return _roFontB64;
  try {
    const resp = await fetch(roFontUrl);
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      if (buf.byteLength > 5_000) {
        _roFontB64 = _bufToB64(buf);
        return _roFontB64;
      }
    }
  } catch { /* ignore */ }
  _roFontB64 = null;
  return null;
}

/** Fara fontul cu diacritice, jsPDF cade pe Helvetica (Latin-1), unde ș/ț/ă nu
 *  exista. Textele fixe se scriu atunci fara diacritice; o valoare cu diacritice
 *  (parola, numele) nu se aproximeaza — s-ar tipari gresit, fara niciun semn. */
const FARA_DIACRITICE: Record<string, string> = {
  ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t",
  Ă: "A", Â: "A", Î: "I", Ș: "S", Ş: "S", Ț: "T", Ţ: "T",
};

function ascii(s: string): string {
  return s.replace(/[ăâîșşțţĂÂÎȘŞȚŢ]/g, (ch) => FARA_DIACRITICE[ch] ?? ch);
}

// eslint-disable-next-line no-control-regex
const DOAR_ASCII = /^[\x00-\x7F]*$/;

export interface AccountCredentials {
  /** Numele contului (firma). */
  name: string;
  /** Codul de firmă, cerut la login alături de utilizator și parolă. */
  code: string | null;
  username: string;
  password: string;
}

/** Numele fisierului: fara diacritice si fara caractere interzise de sistemul de fisiere. */
function safeName(s: string): string {
  return (s || "cont")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(0, 60)
    .replace(/^_+|_+$/g, "") || "cont";
}

/** Aduce din timp fontul si biblioteca, ca descarcarea sa porneasca din clicul
 *  utilizatorului (unele browsere blocheaza un download pornit prea tarziu). */
export async function preloadAccountCredentialsPdf(): Promise<void> {
  try {
    await Promise.all([import("jspdf"), loadRoFontBase64()]);
  } catch { /* se reincearca la descarcare */ }
}

export async function generateAccountCredentialsPdf(cred: AccountCredentials): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const b64 = await loadRoFontBase64();
  let font = "helvetica";
  if (b64) {
    doc.addFileToVFS("NotoSans-Ro.ttf", b64);
    doc.addFont("NotoSans-Ro.ttf", "NotoSans", "normal");
    doc.addFont("NotoSans-Ro.ttf", "NotoSans", "bold");
    font = "NotoSans";
  } else if (!DOAR_ASCII.test(cred.password) || !DOAR_ASCII.test(cred.name)) {
    throw new Error("Fontul cu diacritice nu s-a incarcat, iar datele contin diacritice.");
  }
  // Fara font: textele fixe pierd diacriticele, dar raman corecte.
  const tx = (s: string) => (b64 ? s : ascii(s));

  const M = 20;
  const W = 210;
  let y = M;
  const setF = (style: "normal" | "bold", size: number) => { doc.setFont(font, style); doc.setFontSize(size); };

  setF("bold", 18);
  doc.text(tx("BerlinStar — date de acces"), W / 2, y, { align: "center" }); y += 9;
  setF("normal", 10);
  doc.setTextColor(90);
  const numeLinii = doc.splitTextToSize(tx(`Cont: ${cred.name}`), W - 2 * M) as string[];
  doc.text(numeLinii, W / 2, y, { align: "center" }); y += numeLinii.length * 5;
  doc.text(
    tx(`Emis la ${new Date().toLocaleString("ro-RO", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    })}`),
    W / 2, y, { align: "center" },
  ); y += 10;
  doc.setTextColor(0);

  // ── Caseta cu datele de acces ──
  const boxTop = y;
  const VALUE_X = M + 55;
  const VALUE_W = W - M - 8 - VALUE_X;   // latimea utila pentru valoare
  const rows: [string, string][] = [
    ["Cod client", cred.code ?? "—"],
    ["Utilizator", cred.username],
    ["Parolă", cred.password],
  ];
  // Valorile se rup pe mai multe linii: o parola lunga taiata la marginea paginii
  // ar fi tiparita gresit, fara niciun semn.
  setF("bold", 14);
  const wrapped = rows.map(([label, value]) => ({
    label: tx(label),
    linii: doc.splitTextToSize(tx(value), VALUE_W) as string[],
  }));
  const boxH = 12 + wrapped.reduce((h, r) => h + Math.max(1, r.linii.length) * 7 + 5, 0);
  doc.setDrawColor(150); doc.setLineWidth(0.4);
  doc.roundedRect(M, boxTop, W - 2 * M, boxH, 3, 3);
  y = boxTop + 13;
  for (const r of wrapped) {
    setF("normal", 11);
    doc.setTextColor(90);
    doc.text(r.label, M + 8, y);
    setF("bold", 14);
    doc.setTextColor(0);
    doc.text(r.linii, VALUE_X, y);
    y += Math.max(1, r.linii.length) * 7 + 5;
  }
  y = boxTop + boxH + 12;

  // ── Avertisment ──
  setF("bold", 12);
  doc.setTextColor(180, 30, 30);
  doc.text(tx("DATE STRICT CONFIDENȚIALE"), M, y); y += 7;
  doc.setTextColor(0);
  setF("normal", 10);
  const avertisment = [
    "Documentul conține datele de autentificare ale contului. Sunt strict confidențiale și se",
    "predau doar titularului contului. Nu le trimiteți pe canale nesecurizate și nu le lăsați la",
    "vedere. Oricine le deține poate intra în cont cu drepturi de administrator.",
    "",
    "Parola nu mai poate fi citită ulterior din aplicație: se păstrează doar criptată. Schimbați-o",
    "la prima autentificare, din Configurări › Contul Meu, apoi ștergeți acest fișier.",
    "",
    "Dacă parola se pierde, administratorul platformei poate seta una nouă din AdminV2 ›",
    "Conturi › Utilizatori.",
  ];
  for (const linie of avertisment) {
    if (linie) doc.text(tx(linie), M, y);
    y += 5.5;
  }
  y += 6;

  setF("bold", 11);
  doc.text(tx("Autentificare"), M, y); y += 6;
  setF("normal", 10);
  doc.text(tx("Pe pagina de login se completează toate trei: codul de client (codul firmei),"), M, y); y += 5.5;
  doc.text(tx("utilizatorul și parola."), M, y);

  doc.save(`BerlinStar_acces_${safeName(cred.name)}.pdf`);
}
