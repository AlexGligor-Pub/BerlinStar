import roFontUrl from "../assets/fonts/NotoSans-Ro.ttf";
import { fetchLeaveSnapshot, type Leave, type LeaveType } from "../store/leavesStore";

// ── Romanian font (NotoSans) — reutilizam acelasi asset ca generateDocuments ──
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

const TYPE_LABEL: Record<LeaveType, string> = {
  "Concediu de odihna": "Concediu de odihnă",
  "Concediu medical": "Concediu medical",
  "Business Trip": "Deplasare (Business Trip)",
  "Concediu fara plata": "Concediu fără plată",
  // Tipuri pe ore — nu genereaza PDF (etichete doar pentru completitudine de tip).
  "Invoire": "Învoire",
  "Overtime": "Overtime",
  "Recuperare Ore invoire": "Recuperare ore învoire",
};

function fmtRoDate(ymd: string | null): string {
  if (!ymd) return "—";
  const d = new Date(ymd + (ymd.length === 10 ? "T12:00:00" : ""));
  if (isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtRoDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("ro-RO", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** Genereaza si descarca PDF-ul oficial al cererii de concediu, cu acordurile digitale. */
export async function generateLeaveRequestPdf(leave: Leave): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const b64 = await loadRoFontBase64();
  let font = "helvetica";
  if (b64) {
    doc.addFileToVFS("NotoSans-Ro.ttf", b64);
    doc.addFont("NotoSans-Ro.ttf", "NotoSans", "normal");
    doc.addFont("NotoSans-Ro.ttf", "NotoSans", "bold");
    font = "NotoSans";
  }

  // Snapshot-ul cu datele legale e protejat de gate-ul Rapoarte; il aducem la
  // cerere. Daca nu exista token Rapoarte valid, PDF-ul se genereaza fara
  // sectiunea de date legale (numele angajatului ramane din cerere).
  const snap = await fetchLeaveSnapshot(leave.id);
  const emp = snap?.employee ?? null;
  const company = snap?.company ?? null;
  const vac = snap?.vacation ?? null;

  const M = 18;            // margin
  const W = 210;           // a4 width
  let y = M;

  const setF = (style: "normal" | "bold", size: number) => { doc.setFont(font, style); doc.setFontSize(size); };
  const line = (label: string, value: string, gap = 6) => {
    setF("bold", 10);
    doc.text(label, M, y);
    const lw = doc.getTextWidth(label) + 2;
    setF("normal", 10);
    doc.text(value || "—", M + lw, y);
    y += gap;
  };

  // ── Antet firma ──
  if (company?.name) {
    setF("bold", 13);
    doc.text(company.name, M, y); y += 6;
    setF("normal", 9);
    const parts: string[] = [];
    if (company.cui) parts.push(`CUI ${company.cui}`);
    if (company.nr_reg_com) parts.push(`Reg. Com. ${company.nr_reg_com}`);
    if (parts.length) { doc.text(parts.join("  ·  "), M, y); y += 5; }
    if (company.address) {
      const addr = doc.splitTextToSize(company.address, W - 2 * M) as string[];
      doc.text(addr, M, y); y += addr.length * 4.5;
    }
    y += 2;
    doc.setDrawColor(180); doc.line(M, y, W - M, y); y += 8;
  }

  // ── Titlu ──
  setF("bold", 16);
  doc.text("CERERE DE CONCEDIU", W / 2, y, { align: "center" }); y += 7;
  setF("normal", 10);
  doc.text(`Data întocmirii: ${fmtRoDate(leave.requestDate)}`, W / 2, y, { align: "center" }); y += 10;

  // ── Date angajat ──
  setF("bold", 11);
  doc.text("Subsemnatul(a),", M, y); y += 7;
  line("Nume și prenume:", emp?.name ?? leave.employeeName ?? "—");
  if (emp?.cnp) line("CNP:", emp.cnp);
  if (emp?.job_title) line("Funcția:", emp.job_title);
  if (emp?.department) line("Departament:", emp.department);
  if (emp?.contract_number) line("Contract individual de muncă:", `nr. ${emp.contract_number} din ${fmtRoDate(emp.contract_date)}`);
  if (emp?.address_domicile) line("Domiciliu:", emp.address_domicile);
  if (leave.locationName) line("Punct de lucru:", leave.locationName);
  y += 3;

  // ── Cerere ──
  setF("normal", 11);
  const intro = `vă rog să îmi aprobați ${TYPE_LABEL[leave.type]} pentru perioada de mai jos:`;
  const introLines = doc.splitTextToSize(intro, W - 2 * M) as string[];
  doc.text(introLines, M, y); y += introLines.length * 5 + 3;

  line("Perioada:", `${fmtRoDate(leave.startDate)}  –  ${fmtRoDate(leave.endDate)}`);
  line("Zile lucrătoare:", String(leave.workingDays));
  if (vac) {
    line("Sold concediu anual:", `${vac.annual_allowance} zile/an`);
    line("Rămase după această cerere:", `${vac.remaining_after} zile`);
  }
  if (leave.notes) {
    y += 1;
    setF("bold", 10); doc.text("Motiv / observații:", M, y); y += 5;
    setF("normal", 10);
    const nl = doc.splitTextToSize(leave.notes, W - 2 * M) as string[];
    doc.text(nl, M, y); y += nl.length * 4.8;
  }
  y += 8;

  // ── Acorduri digitale ──
  doc.setDrawColor(180); doc.line(M, y, W - M, y); y += 7;
  setF("bold", 11);
  doc.text("Acorduri digitale", M, y); y += 7;

  // Acord angajat
  setF("normal", 10);
  const empMark = leave.employeeConsent ? "[X]" : "[ ]";
  const empText = `${empMark} Angajatul își dă acordul în mod digital pentru această cerere.`;
  const empLines = doc.splitTextToSize(empText, W - 2 * M) as string[];
  doc.text(empLines, M, y); y += empLines.length * 5;
  setF("normal", 9); doc.setTextColor(90);
  doc.text(`Acord dat la: ${fmtRoDateTime(leave.employeeConsentAt)}`, M + 6, y); y += 7;
  doc.setTextColor(0);

  // Acord aprobator
  setF("normal", 10);
  const apMark = leave.approverConsent ? "[X]" : "[ ]";
  const statusLabel = leave.status === "Approved" ? "APROBATĂ" : leave.status === "Rejected" ? "RESPINSĂ" : "ÎN AȘTEPTARE";
  const apText = `${apMark} Aprobatorul își dă acordul în mod digital. Status: ${statusLabel}.`;
  const apLines = doc.splitTextToSize(apText, W - 2 * M) as string[];
  doc.text(apLines, M, y); y += apLines.length * 5;
  setF("normal", 9); doc.setTextColor(90);
  const approverName = leave.approverNameSnapshot ?? leave.approverName ?? "—";
  doc.text(`Aprobat de: ${approverName}  ·  la: ${fmtRoDateTime(leave.approvedAt)}`, M + 6, y);
  doc.setTextColor(0);

  // ── Footer ──
  setF("normal", 8); doc.setTextColor(130);
  doc.text(
    "Document generat electronic. Acordurile bifate constituie consimțământ digital, conform politicii interne.",
    W / 2, 287, { align: "center" },
  );
  doc.setTextColor(0);

  const safeName = (emp?.name ?? leave.employeeName ?? "angajat").replace(/[^a-zA-Z0-9]+/g, "_");
  doc.save(`Cerere_concediu_${safeName}_${leave.startDate}.pdf`);
}
