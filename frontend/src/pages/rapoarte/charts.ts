/**
 * Chart drawing functions partajate pentru pagina Rapoarte.
 * Toate functiile primesc un HTMLDivElement container si datele tipate.
 * Tipurile de input (DailyTotal, DonutItem, etc.) sunt exportate pentru
 * a putea fi utilizate si de panourile care construiesc datele.
 */

import * as d3 from "d3";
import { toNumber, fmtMoney, fmtMoneyInt } from "./format";
import { PALETTE, fmtMonth, RO_DOW, RO_DOW_SHORT } from "./constants";

export interface DailyTotal {
  report_date: string;
  sum_total: string | number;
  sum_paid: string | number;
  sum_unpaid: string | number;
  count_total: number;
}

export interface DonutItem {
  label: string;
  value: number;
  color: string;
}

export interface BarItem {
  label: string;
  value: number;
  color: string;
}

export interface GroupedBarItem {
  label: string;          // e.g. departamentul
  produse: number;
  servicii: number;
  produse_count?: number;
  servicii_count?: number;
}

export interface MonthlyItem {
  month: string;          // "YYYY-MM"
  total: number;
  delta_pct: number | null;
}

export interface MonthlySeriesItem {
  month: string; // "YYYY-MM"
  series: { key: string; label: string; value: number; color: string }[];
}

export interface ProgramariHeatmapCell {
  day_of_week: number;
  hour: number;
  count: number;
}

export function drawLine(container: HTMLDivElement, daily: DailyTotal[]) {
  d3.select(container).selectAll("*").remove();
  if (daily.length === 0) return;

  const w = container.clientWidth || 600;
  const h = 240;
  const margin = { top: 12, right: 20, bottom: 32, left: 60 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", "100%")
    .attr("height", h);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const parseDate = d3.timeParse("%Y-%m-%d");
  const points = daily.map((d) => ({
    date: parseDate(d.report_date)!,
    total: toNumber(d.sum_total),
  }));

  const x = d3.scaleTime()
    .domain(d3.extent(points, (d) => d.date) as [Date, Date])
    .range([0, iw]);

  const yMax = d3.max(points, (d) => d.total) || 100;
  const y = d3.scaleLinear()
    .domain([0, yMax * 1.1])
    .range([ih, 0])
    .nice();

  // Gridlines
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(() => ""))
    .selectAll("line")
    .attr("stroke", "var(--border, #2a3045)")
    .attr("stroke-opacity", 0.4);
  g.selectAll(".domain").remove();

  // X axis
  const tickCount = Math.min(8, points.length);
  g.append("g")
    .attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(tickCount).tickFormat(d3.timeFormat("%d.%m") as any))
    .selectAll("text")
    .attr("fill", "var(--text-muted, #8b90a0)")
    .style("font-size", "11px");
  g.selectAll(".domain").attr("stroke", "var(--border, #2a3045)");

  // Y axis
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((v) => {
      const n = +v;
      if (n >= 1000) return (n / 1000).toFixed(1) + "k";
      return String(n);
    }))
    .selectAll("text")
    .attr("fill", "var(--text-muted, #8b90a0)")
    .style("font-size", "11px");

  // Area
  const area = d3.area<typeof points[0]>()
    .x((d) => x(d.date))
    .y0(ih)
    .y1((d) => y(d.total))
    .curve(d3.curveCatmullRom);

  const line = d3.line<typeof points[0]>()
    .x((d) => x(d.date))
    .y((d) => y(d.total))
    .curve(d3.curveCatmullRom);

  g.append("path")
    .datum(points)
    .attr("fill", "var(--accent, #5b7cfa)")
    .attr("fill-opacity", 0.12)
    .attr("d", area);

  const path = g.append("path")
    .datum(points)
    .attr("fill", "none")
    .attr("stroke", "var(--accent, #5b7cfa)")
    .attr("stroke-width", 2.5)
    .attr("d", line);

  const totalLen = (path.node() as SVGPathElement).getTotalLength();
  path.attr("stroke-dasharray", totalLen)
    .attr("stroke-dashoffset", totalLen)
    .transition().duration(900).ease(d3.easeLinear).attr("stroke-dashoffset", 0);

  // Hover dot + tooltip
  const tooltip = d3.select(container)
    .append("div")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "var(--surface, #1e2330)")
    .style("border", "1px solid var(--border, #2a3045)")
    .style("border-radius", "6px")
    .style("padding", "6px 10px")
    .style("font-size", "12px")
    .style("color", "var(--text, #e8eaf0)")
    .style("opacity", 0)
    .style("transition", "opacity 0.12s");

  d3.select(container).style("position", "relative");

  const hoverDot = g.append("circle")
    .attr("r", 5)
    .attr("fill", "var(--accent, #5b7cfa)")
    .attr("stroke", "var(--surface, #1e2330)")
    .attr("stroke-width", 2)
    .style("opacity", 0);

  svg.append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", iw)
    .attr("height", ih)
    .attr("fill", "transparent")
    .on("mousemove", function (event) {
      const [mx] = d3.pointer(event, this);
      const xp = mx - margin.left;
      const xDate = x.invert(xp);
      const bisect = d3.bisector<typeof points[0], Date>((d) => d.date).left;
      const i = Math.min(points.length - 1, Math.max(0, bisect(points, xDate)));
      const p = points[i];
      hoverDot.style("opacity", 1).attr("cx", x(p.date)).attr("cy", y(p.total));
      const rect = container.getBoundingClientRect();
      tooltip
        .style("opacity", 1)
        .style("left", (event.clientX - rect.left + 14) + "px")
        .style("top", (event.clientY - rect.top - 10) + "px")
        .html(`<strong style="display:block;color:var(--accent,#5b7cfa)">${d3.timeFormat("%d %b %Y")(p.date)}</strong>${fmtMoney(p.total)} lei`);
    })
    .on("mouseout", () => {
      hoverDot.style("opacity", 0);
      tooltip.style("opacity", 0);
    });
}

export function drawDonut(container: HTMLDivElement, items: DonutItem[], centerLabelText: string = "lei total") {
  d3.select(container).selectAll("*").remove();

  const filtered = items.filter((d) => d.value > 0);
  const total = filtered.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    d3.select(container)
      .append("div")
      .style("padding", "32px 0")
      .style("text-align", "center")
      .style("color", "var(--text-muted, #8b90a0)")
      .style("font-size", "0.85rem")
      .text("Nicio valoare de afișat.");
    return;
  }

  const w = 260;
  const h = 240;
  const r = Math.min(w, h) / 2 - 18;

  d3.select(container).style("position", "relative");

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", "100%")
    .style("max-width", w + "px")
    .attr("height", h);

  const g = svg.append("g").attr("transform", `translate(${w / 2},${h / 2 - 10})`);

  const pie = d3.pie<DonutItem>().value((d) => d.value).sort(null);
  const arc = d3.arc<d3.PieArcDatum<DonutItem>>()
    .innerRadius(r * 0.58)
    .outerRadius(r);
  const arcHover = d3.arc<d3.PieArcDatum<DonutItem>>()
    .innerRadius(r * 0.55)
    .outerRadius(r + 6);

  // Center label
  const centerLabel = g.append("text")
    .attr("text-anchor", "middle")
    .attr("pointer-events", "none");
  centerLabel.append("tspan")
    .attr("class", "donut-center-value")
    .attr("x", 0)
    .attr("dy", "-0.2em")
    .attr("font-size", "20px")
    .attr("font-weight", 700)
    .attr("fill", "var(--text, #e8eaf0)")
    .text(fmtMoneyInt(total));
  centerLabel.append("tspan")
    .attr("class", "donut-center-label")
    .attr("x", 0)
    .attr("dy", "1.4em")
    .attr("font-size", "10px")
    .attr("fill", "var(--text-muted, #8b90a0)")
    .text(centerLabelText);

  const tooltip = d3.select(container)
    .append("div")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "var(--surface, #1e2330)")
    .style("border", "1px solid var(--border, #2a3045)")
    .style("border-radius", "6px")
    .style("padding", "6px 10px")
    .style("font-size", "12px")
    .style("color", "var(--text, #e8eaf0)")
    .style("opacity", 0)
    .style("transition", "opacity 0.12s");

  g.selectAll("path")
    .data(pie(filtered))
    .join("path")
    .attr("fill", (d) => d.data.color)
    .attr("stroke", "var(--surface, #1e2330)")
    .attr("stroke-width", 2)
    .attr("d", arc as any)
    .style("cursor", "pointer")
    .on("mouseover", function (_event, d) {
      d3.select(this).transition().duration(120).attr("d", arcHover as any);
      const pct = Math.round((d.data.value / total) * 100);
      centerLabel.select(".donut-center-value")
        .attr("fill", d.data.color)
        .text(pct + "%");
      centerLabel.select(".donut-center-label").text(d.data.label);
    })
    .on("mousemove", function (event, d) {
      const rect = container.getBoundingClientRect();
      const pct = Math.round((d.data.value / total) * 100);
      tooltip
        .style("opacity", 1)
        .style("left", (event.clientX - rect.left + 14) + "px")
        .style("top", (event.clientY - rect.top - 10) + "px")
        .html(`<strong style="display:block;color:${d.data.color}">${d.data.label}</strong>${fmtMoneyInt(d.data.value)} lei (${pct}%)`);
    })
    .on("mouseout", function () {
      d3.select(this).transition().duration(120).attr("d", arc as any);
      centerLabel.select(".donut-center-value")
        .attr("fill", "var(--text, #e8eaf0)")
        .text(fmtMoneyInt(total));
      centerLabel.select(".donut-center-label").text(centerLabelText);
      tooltip.style("opacity", 0);
    });

  // Legend (limitat la primele 8 pentru claritate)
  const legend = d3.select(container)
    .append("div")
    .style("display", "flex")
    .style("flex-wrap", "wrap")
    .style("gap", "8px")
    .style("justify-content", "center")
    .style("margin-top", "8px")
    .style("max-width", "260px");

  filtered.slice(0, 8).forEach((item) => {
    const pct = Math.round((item.value / total) * 100);
    const entry = legend.append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "5px")
      .style("font-size", "11px")
      .style("color", "var(--text-muted, #8b90a0)");
    entry.append("span")
      .style("width", "10px")
      .style("height", "10px")
      .style("border-radius", "2px")
      .style("background", item.color);
    entry.append("span").text(`${item.label} ${pct}%`);
  });
  if (filtered.length > 8) {
    legend.append("div")
      .style("font-size", "11px")
      .style("color", "var(--text-muted, #8b90a0)")
      .text(`+ ${filtered.length - 8} mai puține`);
  }
}

export function drawBar(container: HTMLDivElement, items: BarItem[]) {
  d3.select(container).selectAll("*").remove();
  const filtered = items.filter((d) => d.value > 0);
  if (filtered.length === 0) {
    d3.select(container)
      .append("div")
      .style("padding", "32px 0")
      .style("text-align", "center")
      .style("color", "var(--text-muted, #8b90a0)")
      .style("font-size", "0.85rem")
      .text("Nicio valoare de afișat.");
    return;
  }

  const w = container.clientWidth || 600;
  const barH = 26;
  const gap = 4;
  const margin = { top: 8, right: 60, bottom: 12, left: 180 };
  const ih = filtered.length * (barH + gap);
  const h = ih + margin.top + margin.bottom;
  const iw = w - margin.left - margin.right;

  d3.select(container).style("position", "relative");

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", "100%")
    .attr("height", h);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const xMax = d3.max(filtered, (d) => d.value) || 1;
  const x = d3.scaleLinear().domain([0, xMax * 1.05]).range([0, iw]);
  const y = d3.scaleBand<string>().domain(filtered.map((d, i) => `${i}_${d.label}`)).range([0, ih]).padding(0.15);

  // Y axis (label-uri)
  g.append("g")
    .call(d3.axisLeft(y).tickFormat((id) => {
      const label = filtered[parseInt(String(id).split("_")[0])].label;
      return label.length > 26 ? label.slice(0, 25) + "…" : label;
    }))
    .selectAll("text")
    .attr("fill", "var(--text, #e8eaf0)")
    .style("font-size", "12px");
  g.selectAll(".domain, .tick line").attr("stroke", "var(--border, #2a3045)").attr("stroke-opacity", 0.4);

  const tooltip = d3.select(container)
    .append("div")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "var(--surface, #1e2330)")
    .style("border", "1px solid var(--border, #2a3045)")
    .style("border-radius", "6px")
    .style("padding", "6px 10px")
    .style("font-size", "12px")
    .style("color", "var(--text, #e8eaf0)")
    .style("opacity", 0)
    .style("transition", "opacity 0.12s");

  const total = filtered.reduce((s, d) => s + d.value, 0);

  g.selectAll("rect")
    .data(filtered)
    .join("rect")
    .attr("x", 0)
    .attr("y", (_d, i) => y(`${i}_${filtered[i].label}`) || 0)
    .attr("height", y.bandwidth())
    .attr("width", 0)
    .attr("fill", (d) => d.color)
    .attr("rx", 3)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill-opacity", 0.85);
      const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
      const rect = container.getBoundingClientRect();
      tooltip
        .style("opacity", 1)
        .style("left", (event.clientX - rect.left + 14) + "px")
        .style("top", (event.clientY - rect.top - 10) + "px")
        .html(`<strong style="display:block;color:${d.color}">${d.label}</strong>${fmtMoney(d.value)} lei (${pct}%)`);
    })
    .on("mousemove", function (event) {
      const rect = container.getBoundingClientRect();
      tooltip
        .style("left", (event.clientX - rect.left + 14) + "px")
        .style("top", (event.clientY - rect.top - 10) + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill-opacity", 1);
      tooltip.style("opacity", 0);
    })
    .transition()
    .duration(700)
    .attr("width", (d) => x(d.value));

  // Etichete de valoare la capătul barei
  g.selectAll("text.bar-value")
    .data(filtered)
    .join("text")
    .attr("class", "bar-value")
    .attr("x", (d) => x(d.value) + 6)
    .attr("y", (_d, i) => (y(`${i}_${filtered[i].label}`) || 0) + y.bandwidth() / 2 + 4)
    .attr("fill", "var(--text-muted, #8b90a0)")
    .style("font-size", "11px")
    .style("font-weight", 500)
    .style("opacity", 0)
    .text((d) => fmtMoney(d.value))
    .transition()
    .delay(700)
    .duration(300)
    .style("opacity", 1);
}

export function drawGroupedBars(container: HTMLDivElement, items: GroupedBarItem[]) {
  d3.select(container).selectAll("*").remove();
  if (items.length === 0) {
    d3.select(container)
      .append("div")
      .style("padding", "32px 0")
      .style("text-align", "center")
      .style("color", "var(--text-muted, #8b90a0)")
      .style("font-size", "0.85rem")
      .text("Nicio valoare de afișat.");
    return;
  }

  const w = container.clientWidth || 600;
  const barH = 14;
  const groupGap = 18;
  const margin = { top: 30, right: 90, bottom: 12, left: 180 };
  const ih = items.length * (barH * 2 + 4 + groupGap);
  const h = ih + margin.top + margin.bottom;
  const iw = w - margin.left - margin.right;

  d3.select(container).style("position", "relative");

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", "100%")
    .attr("height", h);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const maxVal = d3.max(items, (d) => Math.max(d.produse, d.servicii)) || 1;
  const x = d3.scaleLinear().domain([0, maxVal * 1.05]).range([0, iw]);

  // Y axis labels per group
  const labels = g.append("g");
  items.forEach((d, i) => {
    const yMid = i * (barH * 2 + 4 + groupGap) + barH + 2;
    labels.append("text")
      .attr("x", -10)
      .attr("y", yMid + 4)
      .attr("text-anchor", "end")
      .attr("fill", "var(--text, #e8eaf0)")
      .style("font-size", "12px")
      .text(d.label.length > 24 ? d.label.slice(0, 23) + "…" : d.label);
  });

  // Legend
  const legendG = svg.append("g").attr("transform", `translate(${margin.left},10)`);
  legendG.append("rect").attr("x", 0).attr("y", 0).attr("width", 12).attr("height", 12).attr("fill", PALETTE[0]).attr("rx", 2);
  legendG.append("text").attr("x", 18).attr("y", 10).attr("fill", "var(--text-muted, #8b90a0)").style("font-size", "11px").text("Produse");
  legendG.append("rect").attr("x", 90).attr("y", 0).attr("width", 12).attr("height", 12).attr("fill", PALETTE[1]).attr("rx", 2);
  legendG.append("text").attr("x", 108).attr("y", 10).attr("fill", "var(--text-muted, #8b90a0)").style("font-size", "11px").text("Servicii");

  const tooltip = d3.select(container)
    .append("div")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "var(--surface, #1e2330)")
    .style("border", "1px solid var(--border, #2a3045)")
    .style("border-radius", "6px")
    .style("padding", "6px 10px")
    .style("font-size", "12px")
    .style("color", "var(--text, #e8eaf0)")
    .style("opacity", 0)
    .style("transition", "opacity 0.12s");

  items.forEach((d, i) => {
    const yTop = i * (barH * 2 + 4 + groupGap);
    // Produse
    g.append("rect")
      .attr("x", 0).attr("y", yTop)
      .attr("height", barH)
      .attr("width", 0)
      .attr("fill", PALETTE[0])
      .attr("rx", 2)
      .style("cursor", "pointer")
      .on("mouseover", function (event) {
        const rect = container.getBoundingClientRect();
        tooltip.style("opacity", 1)
          .style("left", (event.clientX - rect.left + 14) + "px")
          .style("top", (event.clientY - rect.top - 10) + "px")
          .html(`<strong style="display:block;color:${PALETTE[0]}">${d.label} · Produse</strong>${fmtMoney(d.produse)} lei${d.produse_count !== undefined ? ` (${d.produse_count} buc)` : ""}`);
      })
      .on("mousemove", function (event) {
        const rect = container.getBoundingClientRect();
        tooltip.style("left", (event.clientX - rect.left + 14) + "px")
          .style("top", (event.clientY - rect.top - 10) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0))
      .transition().duration(700).attr("width", x(d.produse));

    g.append("text")
      .attr("x", x(d.produse) + 6)
      .attr("y", yTop + barH - 2)
      .attr("fill", "var(--text-muted, #8b90a0)")
      .style("font-size", "10px")
      .style("opacity", 0)
      .text(fmtMoney(d.produse))
      .transition().delay(700).duration(300).style("opacity", 1);

    // Servicii
    g.append("rect")
      .attr("x", 0).attr("y", yTop + barH + 4)
      .attr("height", barH)
      .attr("width", 0)
      .attr("fill", PALETTE[1])
      .attr("rx", 2)
      .style("cursor", "pointer")
      .on("mouseover", function (event) {
        const rect = container.getBoundingClientRect();
        tooltip.style("opacity", 1)
          .style("left", (event.clientX - rect.left + 14) + "px")
          .style("top", (event.clientY - rect.top - 10) + "px")
          .html(`<strong style="display:block;color:${PALETTE[1]}">${d.label} · Servicii</strong>${fmtMoney(d.servicii)} lei${d.servicii_count !== undefined ? ` (${d.servicii_count} buc)` : ""}`);
      })
      .on("mousemove", function (event) {
        const rect = container.getBoundingClientRect();
        tooltip.style("left", (event.clientX - rect.left + 14) + "px")
          .style("top", (event.clientY - rect.top - 10) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0))
      .transition().duration(700).attr("width", x(d.servicii));

    g.append("text")
      .attr("x", x(d.servicii) + 6)
      .attr("y", yTop + barH * 2 + 2)
      .attr("fill", "var(--text-muted, #8b90a0)")
      .style("font-size", "10px")
      .style("opacity", 0)
      .text(fmtMoney(d.servicii))
      .transition().delay(700).duration(300).style("opacity", 1);
  });
}

export function drawMonthlyBars(container: HTMLDivElement, items: MonthlyItem[]) {
  d3.select(container).selectAll("*").remove();
  if (items.length === 0) {
    d3.select(container)
      .append("div")
      .style("padding", "32px 0")
      .style("text-align", "center")
      .style("color", "var(--text-muted, #8b90a0)")
      .style("font-size", "0.85rem")
      .text("Nicio valoare de afișat.");
    return;
  }

  // viewBox fix → SVG perfect responsive (width=100%, height auto pe baza aspect ratio)
  const w = 720;
  const h = 320;
  const margin = { top: 40, right: 24, bottom: 60, left: 70 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  d3.select(container).style("position", "relative");

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("width", "100%")
    .style("display", "block")
    .style("height", "auto")
    .style("max-width", "100%");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand<string>().domain(items.map((d) => d.month)).range([0, iw]).padding(0.2);
  const yMax = d3.max(items, (d) => d.total) || 1;
  const y = d3.scaleLinear().domain([0, yMax * 1.2]).range([ih, 0]).nice();

  // Gridlines
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(() => ""))
    .selectAll("line")
    .attr("stroke", "var(--border, #2a3045)")
    .attr("stroke-opacity", 0.4);
  g.selectAll(".domain").remove();

  // X axis
  g.append("g")
    .attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).tickFormat((m) => fmtMonth(m as string)))
    .selectAll("text")
    .attr("fill", "var(--text-muted, #8b90a0)")
    .style("font-size", "11px");

  // Y axis
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((v) => {
      const n = +v;
      if (n >= 1000) return (n / 1000).toFixed(1) + "k";
      return String(n);
    }))
    .selectAll("text")
    .attr("fill", "var(--text-muted, #8b90a0)")
    .style("font-size", "11px");

  const tooltip = d3.select(container)
    .append("div")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "var(--surface, #1e2330)")
    .style("border", "1px solid var(--border, #2a3045)")
    .style("border-radius", "6px")
    .style("padding", "6px 10px")
    .style("font-size", "12px")
    .style("color", "var(--text, #e8eaf0)")
    .style("opacity", 0)
    .style("transition", "opacity 0.12s");

  // Bars
  g.selectAll("rect.bar")
    .data(items)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d.month) || 0)
    .attr("width", x.bandwidth())
    .attr("y", ih)
    .attr("height", 0)
    .attr("fill", "var(--accent, #5b7cfa)")
    .attr("rx", 4)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill-opacity", 0.85);
      const rect = container.getBoundingClientRect();
      const deltaHtml = d.delta_pct === null
        ? `<div style="color:var(--text-muted, #8b90a0);font-size:10px">prima lună din interval</div>`
        : `<div style="color:${d.delta_pct >= 0 ? "var(--success, #3ea96a)" : "var(--danger, #ef4444)"};font-size:10px">${d.delta_pct >= 0 ? "↑" : "↓"} ${Math.abs(d.delta_pct).toFixed(1)}% vs luna anterioară</div>`;
      tooltip.style("opacity", 1)
        .style("left", (event.clientX - rect.left + 14) + "px")
        .style("top", (event.clientY - rect.top - 10) + "px")
        .html(`<strong style="display:block;color:var(--accent, #5b7cfa)">${fmtMonth(d.month)}</strong>${fmtMoney(d.total)} lei${deltaHtml}`);
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill-opacity", 1);
      tooltip.style("opacity", 0);
    })
    .transition().duration(700)
    .attr("y", (d) => y(d.total))
    .attr("height", (d) => ih - y(d.total));

  // Delta badge (MoM %) — cel mai sus, deasupra valorii
  g.selectAll("g.delta")
    .data(items)
    .join("g")
    .attr("class", "delta")
    .attr("transform", (d) => `translate(${(x(d.month) || 0) + x.bandwidth() / 2},${y(d.total) - 24})`)
    .each(function (d) {
      const sel = d3.select(this);
      if (d.delta_pct === null) {
        sel.append("text")
          .attr("text-anchor", "middle")
          .attr("fill", "var(--text-muted, #8b90a0)")
          .style("font-size", "10px")
          .style("opacity", 0)
          .text("—")
          .transition().delay(700).duration(300).style("opacity", 1);
      } else {
        const positive = d.delta_pct >= 0;
        const color = positive ? "#3ea96a" : "#ef4444";
        const text = `${positive ? "▲" : "▼"} ${Math.abs(d.delta_pct).toFixed(1)}%`;
        sel.append("text")
          .attr("text-anchor", "middle")
          .attr("fill", color)
          .style("font-size", "10.5px")
          .style("font-weight", 700)
          .style("opacity", 0)
          .text(text)
          .transition().delay(700).duration(300).style("opacity", 1);
      }
    });

  // Valoare absoluta — deasupra barei (intre bara si delta)
  g.selectAll("text.bar-value")
    .data(items)
    .join("text")
    .attr("class", "bar-value")
    .attr("x", (d) => (x(d.month) || 0) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.total) - 8)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--text, #e8eaf0)")
    .style("font-size", "10px")
    .style("font-weight", 600)
    .style("opacity", 0)
    .text((d) => fmtMoney(d.total))
    .transition().delay(700).duration(300).style("opacity", 1);
}

export function drawMonthlyDualBars(
  container: HTMLDivElement,
  items: { month: string; checkins: number; checkouts: number }[],
) {
  d3.select(container).selectAll("*").remove();
  if (items.length === 0) {
    d3.select(container)
      .append("div")
      .style("padding", "32px 0")
      .style("text-align", "center")
      .style("color", "var(--text-muted, #8b90a0)")
      .style("font-size", "0.85rem")
      .text("Nicio valoare de afișat.");
    return;
  }

  const w = container.clientWidth || 600;
  const h = 240;
  const margin = { top: 18, right: 16, bottom: 36, left: 40 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", w)
    .attr("height", h)
    .attr("viewBox", `0 0 ${w} ${h}`);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x0 = d3.scaleBand<string>().domain(items.map((d) => d.month)).range([0, iw]).padding(0.18);
  const x1 = d3
    .scaleBand<string>()
    .domain(["checkins", "checkouts"])
    .range([0, x0.bandwidth()])
    .padding(0.08);
  const maxY = Math.max(1, d3.max(items, (d) => Math.max(d.checkins, d.checkouts)) ?? 1);
  const y = d3.scaleLinear().domain([0, maxY * 1.1]).range([ih, 0]);

  g.append("g")
    .attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x0).tickFormat((m) => fmtMonth(m)))
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "var(--text-muted, #8b90a0)");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("d")))
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "var(--text-muted, #8b90a0)");

  const colorIn = "#3ea96a";
  const colorOut = "#e8441a";

  for (const it of items) {
    const xb = x0(it.month) ?? 0;
    g.append("rect")
      .attr("x", xb + (x1("checkins") ?? 0))
      .attr("y", y(it.checkins))
      .attr("width", x1.bandwidth())
      .attr("height", ih - y(it.checkins))
      .attr("fill", colorIn)
      .attr("rx", 3);
    g.append("text")
      .attr("x", xb + (x1("checkins") ?? 0) + x1.bandwidth() / 2)
      .attr("y", y(it.checkins) - 4)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "var(--text-muted, #8b90a0)")
      .text(it.checkins);

    g.append("rect")
      .attr("x", xb + (x1("checkouts") ?? 0))
      .attr("y", y(it.checkouts))
      .attr("width", x1.bandwidth())
      .attr("height", ih - y(it.checkouts))
      .attr("fill", colorOut)
      .attr("rx", 3);
    g.append("text")
      .attr("x", xb + (x1("checkouts") ?? 0) + x1.bandwidth() / 2)
      .attr("y", y(it.checkouts) - 4)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "var(--text-muted, #8b90a0)")
      .text(it.checkouts);
  }

  // Legendă
  const legend = d3
    .select(container)
    .append("div")
    .style("display", "flex")
    .style("gap", "12px")
    .style("flex-wrap", "wrap")
    .style("margin-top", "8px")
    .style("font-size", "0.8rem");
  legend
    .append("div")
    .html(
      `<span style="display:inline-block;width:10px;height:10px;background:${colorIn};border-radius:2px;margin-right:6px"></span>Intrări`,
    );
  legend
    .append("div")
    .html(
      `<span style="display:inline-block;width:10px;height:10px;background:${colorOut};border-radius:2px;margin-right:6px"></span>Scoateri`,
    );
}

export function drawMonthlySeriesBars(container: HTMLDivElement, items: MonthlySeriesItem[]) {
  d3.select(container).selectAll("*").remove();
  if (items.length === 0 || items.every((it) => it.series.every((s) => s.value === 0))) {
    d3.select(container)
      .append("div")
      .style("padding", "32px 0")
      .style("text-align", "center")
      .style("color", "var(--text-muted, #8b90a0)")
      .style("font-size", "0.85rem")
      .text("Nicio valoare de afișat.");
    return;
  }

  const keys = items[0].series.map((s) => s.key);
  const labelsByKey = new Map(items[0].series.map((s) => [s.key, s.label]));
  const colorsByKey = new Map(items[0].series.map((s) => [s.key, s.color]));

  const w = container.clientWidth || 600;
  const isNarrow = w < 480;
  // Rotim etichetele X dacă sunt multe luni sau e ecran îngust — altfel
  // se suprapun.
  const rotateX = isNarrow || items.length > 4;
  const h = rotateX ? 260 : 240;
  const margin = {
    top: 18,
    right: isNarrow ? 8 : 16,
    bottom: rotateX ? 56 : 36,
    left: 36,
  };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append("svg")
    .attr("width", w)
    .attr("height", h)
    .attr("viewBox", `0 0 ${w} ${h}`);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x0 = d3.scaleBand<string>().domain(items.map((d) => d.month)).range([0, iw]).padding(0.18);
  const x1 = d3.scaleBand<string>().domain(keys).range([0, x0.bandwidth()]).padding(0.08);

  const maxY = Math.max(
    1,
    d3.max(items, (d) => d3.max(d.series, (s) => s.value)) ?? 1,
  );
  const y = d3.scaleLinear().domain([0, maxY * 1.1]).range([ih, 0]);

  const xAxis = g.append("g")
    .attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x0).tickFormat((m) => fmtMonth(m)));
  xAxis.selectAll("text")
    .style("font-size", isNarrow ? "9px" : "10px")
    .style("fill", "var(--text-muted, #8b90a0)")
    .attr("transform", rotateX ? "rotate(-30) translate(-6, 0)" : null)
    .style("text-anchor", rotateX ? "end" : "middle");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("d")))
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "var(--text-muted, #8b90a0)");

  for (const it of items) {
    const xb = x0(it.month) ?? 0;
    for (const s of it.series) {
      const xs = xb + (x1(s.key) ?? 0);
      g.append("rect")
        .attr("x", xs)
        .attr("y", y(s.value))
        .attr("width", x1.bandwidth())
        .attr("height", ih - y(s.value))
        .attr("fill", s.color)
        .attr("rx", 3);
      if (s.value > 0) {
        g.append("text")
          .attr("x", xs + x1.bandwidth() / 2)
          .attr("y", y(s.value) - 4)
          .attr("text-anchor", "middle")
          .style("font-size", "10px")
          .style("fill", "var(--text-muted, #8b90a0)")
          .text(s.value);
      }
    }
  }

  const legend = d3.select(container)
    .append("div")
    .style("display", "flex")
    .style("gap", "12px")
    .style("flex-wrap", "wrap")
    .style("margin-top", "8px")
    .style("font-size", "0.8rem");
  for (const k of keys) {
    legend.append("div").html(
      `<span style="display:inline-block;width:10px;height:10px;background:${colorsByKey.get(k)};border-radius:2px;margin-right:6px"></span>${labelsByKey.get(k)}`,
    );
  }
}

export function drawHeatmap(container: HTMLDivElement, cells: ProgramariHeatmapCell[]) {
  d3.select(container).selectAll("*").remove();
  if (cells.length === 0) {
    d3.select(container)
      .append("div")
      .style("padding", "32px 0")
      .style("text-align", "center")
      .style("color", "var(--text-muted,#8b90a0)")
      .style("font-size", "0.85rem")
      .text("Nicio programare în perioada selectată.");
    return;
  }

  const maxV = d3.max(cells, (c) => c.count) ?? 1;
  const cellMap = new Map<string, number>();
  for (const c of cells) cellMap.set(`${c.day_of_week}-${c.hour}`, c.count);

  const observedMinHour = d3.min(cells, (c) => c.hour) ?? 7;
  const observedMaxHour = d3.max(cells, (c) => c.hour) ?? 20;
  const minHour = Math.min(7, observedMinHour);
  const maxHour = Math.max(20, observedMaxHour);
  const hours: number[] = [];
  for (let h = minHour; h <= maxHour; h++) hours.push(h);

  const width = container.clientWidth || 720;
  const isNarrow = width < 480;
  const margin = {
    top: 24,
    right: 8,
    bottom: 16,
    left: isNarrow ? 36 : 64,
  };
  const cellW = Math.max(isNarrow ? 22 : 18, Math.floor((width - margin.left - margin.right) / hours.length));
  const cellH = isNarrow ? 26 : 28;
  const innerW = cellW * hours.length;
  const height = margin.top + margin.bottom + cellH * 7;

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${margin.left + innerW + margin.right} ${height}`)
    .attr("preserveAspectRatio", "xMinYMin meet")
    .style("width", "100%");

  const color = d3.scaleSequential(d3.interpolateBlues).domain([0, maxV]);

  svg.append("g")
    .selectAll("text")
    .data(hours)
    .enter()
    .append("text")
    .attr("x", (_h, i) => margin.left + i * cellW + cellW / 2)
    .attr("y", margin.top - 8)
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("fill", "var(--text-muted,#8b90a0)")
    .text((h) => `${h}`);

  // DOW Postgres: 0=Duminică, 1=Luni, ..., 6=Sâmbătă. Afișăm Luni → Duminică.
  const dowOrder = [1, 2, 3, 4, 5, 6, 0];
  // Pe ecrane înguste folosim doar prima literă a zilei ca să încapă în
  // margin.left redusă.
  const dowLabel = (d: number) => isNarrow ? RO_DOW_SHORT[d].charAt(0) : RO_DOW_SHORT[d];
  svg.append("g")
    .selectAll("text")
    .data(dowOrder)
    .enter()
    .append("text")
    .attr("x", margin.left - 6)
    .attr("y", (_d, i) => margin.top + i * cellH + cellH / 2 + 4)
    .attr("text-anchor", "end")
    .attr("font-size", isNarrow ? 10 : 11)
    .attr("fill", "var(--text-muted,#8b90a0)")
    .text((d) => dowLabel(d));

  const g = svg.append("g");
  for (let row = 0; row < dowOrder.length; row++) {
    const dow = dowOrder[row];
    for (let col = 0; col < hours.length; col++) {
      const hour = hours[col];
      const v = cellMap.get(`${dow}-${hour}`) ?? 0;
      const x = margin.left + col * cellW;
      const y = margin.top + row * cellH;
      g.append("rect")
        .attr("x", x + 1)
        .attr("y", y + 1)
        .attr("width", cellW - 2)
        .attr("height", cellH - 2)
        .attr("rx", 3)
        .attr("fill", v === 0 ? "rgba(255,255,255,0.04)" : color(v))
        .append("title")
        .text(`${RO_DOW[dow]} ora ${hour}:00 — ${v} programări`);
      if (v > 0) {
        g.append("text")
          .attr("x", x + cellW / 2)
          .attr("y", y + cellH / 2 + 4)
          .attr("text-anchor", "middle")
          .attr("font-size", 10)
          .attr("font-weight", 600)
          .attr("fill", v > maxV * 0.55 ? "#fff" : "var(--text,#dbe0ea)")
          .style("pointer-events", "none")
          .text(v);
      }
    }
  }
}

// ──── YEAR-OVER-YEAR CHARTS ──────────────────────────────────────────────────

export interface YoYBucket {
  label: string;     // ex: "Ian", "Q1", "Pipera"
  value_a: number;   // anul curent / referința
  value_b: number;   // anul comparator
  delta_pct: number | null;
}

/**
 * Bar chart grupat YoY: per bucket (lună, trimestru, locație) afișează două bare
 * (anul A vs anul B) și deasupra delta procentuală. Valorile sunt formatate ca
 * sume monetare.
 */
export function drawYoYBars(
  container: HTMLDivElement,
  items: YoYBucket[],
  yearA: number,
  yearB: number,
  unit: "lei" | "buc" = "lei",
) {
  d3.select(container).selectAll("*").remove();
  if (items.length === 0 || items.every((it) => it.value_a === 0 && it.value_b === 0)) {
    d3.select(container)
      .append("div")
      .style("padding", "32px 0")
      .style("text-align", "center")
      .style("color", "var(--text-muted, #8b90a0)")
      .style("font-size", "0.85rem")
      .text("Nicio valoare de afișat.");
    return;
  }

  const colorA = PALETTE[0];
  const colorB = "#8b90a0";

  const w = container.clientWidth || 720;
  const isNarrow = w < 480;
  const rotateX = isNarrow || items.length > 6;
  const h = rotateX ? 320 : 290;
  const margin = {
    top: 36,
    right: isNarrow ? 10 : 20,
    bottom: rotateX ? 70 : 40,
    left: 60,
  };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  d3.select(container).style("position", "relative");

  const svg = d3.select(container)
    .append("svg")
    .attr("width", w)
    .attr("height", h)
    .attr("viewBox", `0 0 ${w} ${h}`);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x0 = d3.scaleBand<string>()
    .domain(items.map((d) => d.label))
    .range([0, iw])
    .padding(0.22);
  const x1 = d3.scaleBand<string>()
    .domain(["A", "B"])
    .range([0, x0.bandwidth()])
    .padding(0.08);

  const maxV = Math.max(1, d3.max(items, (d) => Math.max(d.value_a, d.value_b)) ?? 1);
  const y = d3.scaleLinear().domain([0, maxV * 1.18]).range([ih, 0]);

  // X axis
  g.append("g")
    .attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x0))
    .selectAll("text")
    .style("font-size", isNarrow ? "10px" : "11px")
    .style("fill", "var(--text-muted, #8b90a0)")
    .attr("transform", rotateX ? "rotate(-30) translate(-6,0)" : null)
    .style("text-anchor", rotateX ? "end" : "middle");

  // Y axis
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => fmtMoneyInt(Number(d))))
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "var(--text-muted, #8b90a0)");

  // Tooltip
  const tooltip = d3.select(container)
    .append("div")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "var(--surface, #1e2330)")
    .style("border", "1px solid var(--border, #2a3045)")
    .style("border-radius", "6px")
    .style("padding", "6px 10px")
    .style("font-size", "12px")
    .style("color", "var(--text, #e8eaf0)")
    .style("opacity", 0)
    .style("transition", "opacity 0.12s");

  function fmt(v: number): string {
    return unit === "lei" ? `${fmtMoney(v)} lei` : `${Math.round(v)} buc`;
  }

  // Bars + delta label
  for (const it of items) {
    const xb = x0(it.label) ?? 0;

    // Year A bar
    g.append("rect")
      .attr("x", xb + (x1("A") ?? 0))
      .attr("y", y(it.value_a))
      .attr("width", x1.bandwidth())
      .attr("height", ih - y(it.value_a))
      .attr("fill", colorA)
      .attr("rx", 3)
      .style("cursor", "pointer")
      .on("mouseover", function (event) {
        const rect = container.getBoundingClientRect();
        tooltip.style("opacity", 1)
          .style("left", (event.clientX - rect.left + 14) + "px")
          .style("top", (event.clientY - rect.top - 10) + "px")
          .html(`<strong style="display:block;color:${colorA}">${it.label} · ${yearA}</strong>${fmt(it.value_a)}`);
      })
      .on("mousemove", function (event) {
        const rect = container.getBoundingClientRect();
        tooltip.style("left", (event.clientX - rect.left + 14) + "px")
          .style("top", (event.clientY - rect.top - 10) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));

    // Year B bar
    g.append("rect")
      .attr("x", xb + (x1("B") ?? 0))
      .attr("y", y(it.value_b))
      .attr("width", x1.bandwidth())
      .attr("height", ih - y(it.value_b))
      .attr("fill", colorB)
      .attr("rx", 3)
      .style("cursor", "pointer")
      .on("mouseover", function (event) {
        const rect = container.getBoundingClientRect();
        tooltip.style("opacity", 1)
          .style("left", (event.clientX - rect.left + 14) + "px")
          .style("top", (event.clientY - rect.top - 10) + "px")
          .html(`<strong style="display:block;color:${colorB}">${it.label} · ${yearB}</strong>${fmt(it.value_b)}`);
      })
      .on("mousemove", function (event) {
        const rect = container.getBoundingClientRect();
        tooltip.style("left", (event.clientX - rect.left + 14) + "px")
          .style("top", (event.clientY - rect.top - 10) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));

    // Delta % deasupra grupului
    const groupTop = Math.min(y(it.value_a), y(it.value_b));
    if (it.delta_pct !== null) {
      const positive = it.delta_pct >= 0;
      const color = positive ? "#3ea96a" : "#ef4444";
      g.append("text")
        .attr("x", xb + x0.bandwidth() / 2)
        .attr("y", groupTop - 8)
        .attr("text-anchor", "middle")
        .attr("fill", color)
        .style("font-size", "10.5px")
        .style("font-weight", 700)
        .text(`${positive ? "▲" : "▼"} ${Math.abs(it.delta_pct).toFixed(1)}%`);
    } else if (it.value_a > 0) {
      g.append("text")
        .attr("x", xb + x0.bandwidth() / 2)
        .attr("y", groupTop - 8)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--text-muted, #8b90a0)")
        .style("font-size", "10px")
        .text("—");
    }
  }

  // Legend
  const legend = d3.select(container)
    .append("div")
    .style("display", "flex")
    .style("gap", "14px")
    .style("flex-wrap", "wrap")
    .style("margin-top", "8px")
    .style("font-size", "0.8rem");
  legend.append("div").html(
    `<span style="display:inline-block;width:10px;height:10px;background:${colorA};border-radius:2px;margin-right:6px"></span>${yearA}`,
  );
  legend.append("div").html(
    `<span style="display:inline-block;width:10px;height:10px;background:${colorB};border-radius:2px;margin-right:6px"></span>${yearB}`,
  );
}
