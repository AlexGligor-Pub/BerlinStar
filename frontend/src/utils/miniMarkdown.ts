/**
 * Convertor Markdown -> HTML minimal, suficient pentru fisierele din src/docs.
 * Continutul e static si de incredere (scris de noi), dar trecem oricum
 * rezultatul prin DOMPurify inainte de innerHTML.
 *
 * Suporta: # ## ###, **bold**, *italic*, `cod`, ```bloc```, liste - / 1.,
 * tabele | a | b |, > citat, --- linie, [text](url) si paragrafe.
 */
import DOMPurify from "dompurify";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return t;
}

function tableRow(line: string): string[] {
  return line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const flushList = (buf: string[], ordered: boolean) => {
    if (!buf.length) return;
    const tag = ordered ? "ol" : "ul";
    out.push(`<${tag}>${buf.map((li) => `<li>${inline(li)}</li>`).join("")}</${tag}>`);
    buf.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
      i++;
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^\s*$/.test(line)) { i++; continue; }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }

    if (/^\s*>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      out.push(`<blockquote>${inline(q.join(" "))}</blockquote>`);
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { out.push("<hr/>"); i++; continue; }

    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const head = tableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(tableRow(lines[i])); i++; }
      const thead = `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    const ul = /^\s*[-*]\s+(.*)$/;
    const ol = /^\s*\d+\.\s+(.*)$/;
    if (ul.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && ul.test(lines[i])) { buf.push(ul.exec(lines[i])![1]); i++; }
      flushList(buf, false);
      continue;
    }
    if (ol.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && ol.test(lines[i])) { buf.push(ol.exec(lines[i])![1]); i++; }
      flushList(buf, true);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4}\s|```|\s*>|\s*[-*]\s|\s*\d+\.\s|\s*\|)/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    // Linia deschide un bloc pe care nicio ramura nu l-a consumat (ex. tabel
    // fara rand separator): fara asta `i` nu ar mai avansa niciodata.
    if (!para.length) { para.push(line); i++; }
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return DOMPurify.sanitize(out.join("\n"), { ADD_ATTR: ["target", "rel"] });
}
