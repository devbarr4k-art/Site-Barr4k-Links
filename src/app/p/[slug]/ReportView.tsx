"use client";

import { useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiInfo, FiMoreHorizontal } from "react-icons/fi";
import { withBase } from "@/lib/base";
import { convRate, type Report, type ReportRow } from "@/lib/report-types";
import CountText from "./CountText";

// Temas do painel (o padrão é o roxo do site da Barr4k)
const THEMES: Record<Report["theme"], React.CSSProperties> = {
  roxo: { "--bg": "#07060d", "--panel": "#110f1c", "--card": "#181428", "--line": "#262043", "--text": "#f3f1fb", "--muted": "#a39dbb", "--accent": "#8b3dff", "--chart": "#b07cff", "--on-accent": "#ffffff" } as React.CSSProperties,
  grafite: { "--bg": "#111216", "--panel": "#18191e", "--card": "#1f2026", "--line": "#2c2e36", "--text": "#f4f2ec", "--muted": "#8b8f9a", "--accent": "#8b3dff", "--chart": "#8ab4ff", "--on-accent": "#ffffff" } as React.CSSProperties,
  azul: { "--bg": "#050b1c", "--panel": "#0a1430", "--card": "#0f1c40", "--line": "#1c2f66", "--text": "#f3f5fb", "--muted": "#8ea0c8", "--accent": "#4f7bff", "--chart": "#6f96ff", "--on-accent": "#ffffff" } as React.CSSProperties,
  claro: { "--bg": "#f1eff7", "--panel": "#ffffff", "--card": "#f7f6fb", "--line": "#e3e0ee", "--text": "#14111f", "--muted": "#6d6880", "--accent": "#8b3dff", "--chart": "#8b3dff", "--on-accent": "#ffffff" } as React.CSSProperties,
};

const PER_PAGE = 10;
const toDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const longDate = (s: string) => toDate(s).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });

type Group = "day" | "week" | "month";
type Line = ReportRow & { label: string };

/** Junta as linhas por semana (começando na segunda) ou mês */
function group(rows: ReportRow[], g: Group): Line[] {
  if (g === "day") return rows.map((r) => ({ ...r, label: longDate(r.date) }));
  const map = new Map<string, { label: string; rows: ReportRow[] }>();
  for (const r of rows) {
    const d = toDate(r.date);
    let key: string;
    let label: string;
    if (g === "week") {
      const mon = new Date(d);
      mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      key = mon.toISOString().slice(0, 10);
      label = `Semana de ${mon.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
    } else {
      key = r.date.slice(0, 7);
      label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    }
    if (!map.has(key)) map.set(key, { label, rows: [] });
    map.get(key)!.rows.push(r);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { label, rows: rs }]) => {
      const sum = (k: keyof Omit<ReportRow, "date">) => rs.reduce((t, r) => t + r[k], 0);
      return { date: key, label, clicks: sum("clicks"), signups: sum("signups"), ftd: sum("ftd"), deposits: sum("deposits"), flagged: sum("flagged") / rs.length };
    });
}

const clampY = (y: number) => Math.max(2, Math.min(100, y));

/** Linha suave (curva) passando pelos pontos, pro gráfico do topo (sem passar da borda) */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6];
    const c2 = [x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6];
    d += ` C${c1[0]},${clampY(c1[1])} ${c2[0]},${clampY(c2[1])} ${x2},${y2}`;
  }
  return d;
}

export default function ReportView({ report }: { report: Report }) {
  const { rows, currency } = report;
  const [g, setG] = useState<Group>("day");
  const [page, setPage] = useState(0);
  const [drawn, setDrawn] = useState(false);

  // o gráfico "desenha" ao abrir (junto com os números subindo)
  useEffect(() => {
    const t = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const money = (v: number) =>
    currency === "R$"
      ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${currency}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const lines = useMemo(() => group(rows, g), [rows, g]);
  const pages = Math.max(1, Math.ceil(lines.length / PER_PAGE));
  const cur = Math.min(page, pages - 1);
  const pageLines = lines.slice(cur * PER_PAGE, (cur + 1) * PER_PAGE);

  // gráfico: depósitos por dia
  const chart = useMemo(() => {
    if (rows.length < 2) return null;
    const max = Math.max(...rows.map((r) => r.deposits), 1);
    const pts = rows.map((r, i) => [(i / (rows.length - 1)) * 1000, 100 - (r.deposits / max) * 88] as [number, number]);
    const line = smoothPath(pts);
    return { line, area: `${line} L1000,100 L0,100 Z` };
  }, [rows]);

  const initials = report.userName.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "B4";

  return (
    <div translate="no" className="notranslate min-h-[100dvh] bg-[var(--bg)] font-sans text-[var(--text)]" style={THEMES[report.theme]}>
      {/* topo */}
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <span className="truncate font-[family-name:var(--font-title)] text-2xl font-black uppercase italic leading-none tracking-tight">{report.panelName}</span>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            {report.userName && <span className="truncate text-sm font-bold text-[var(--muted)]">{report.userName}</span>}
            <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--accent)] text-xs font-black text-[var(--on-accent)] ring-2 ring-[var(--line)]">
              {initials}
              {report.userPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={withBase(report.userPhoto)} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {/* gráfico */}
        {chart && (
          <section className="-mx-4 border-x-0 border-b border-[var(--line)] bg-[var(--panel)] pt-8 sm:mx-0 sm:border-x">
            <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="block h-28 w-full sm:h-36" aria-hidden>
              <defs>
                <linearGradient id="rep-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--chart)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={chart.area} fill="url(#rep-area)" className={`transition-opacity duration-[1600ms] ${drawn ? "opacity-100" : "opacity-0"}`} />
              <path
                d={chart.line}
                fill="none"
                stroke="var(--chart)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={drawn ? 0 : 1}
                style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(.2,.7,.2,1)" }}
              />
            </svg>
            <div className="flex justify-between px-4 py-2 text-xs text-[var(--muted)]">
              <span>{longDate(rows[0].date)}</span>
              <span>{longDate(rows[rows.length - 1].date)}</span>
            </div>
          </section>
        )}

        {/* resumo */}
        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--muted)]">Resumo do desempenho</h2>
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--card)] text-[var(--muted)]">
              <FiMoreHorizontal className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {report.metrics.map((m, i) => (
              <div key={i} className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2 border-b border-dashed border-[var(--line)] pb-3 text-xs text-[var(--muted)]">
                  <span>{m.label}</span>
                </div>
                <div className="mt-4 text-xl font-black tabular-nums sm:text-2xl">
                  <CountText value={m.value} />
                </div>
                <div className={`mt-1 h-4 text-xs font-bold ${m.delta.trim().startsWith("-") ? "text-red-400" : "text-emerald-400"}`}>{m.delta}</div>
              </div>
            ))}
          </div>
        </section>

        {/* tabela */}
        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[var(--muted)]">Análise de desempenho</h2>
            <div className="flex rounded-lg bg-[var(--card)] p-1 text-xs font-bold">
              {([
                ["day", "Dia"],
                ["week", "Semana"],
                ["month", "Mês"],
              ] as const).map(([k, t]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => (setG(k), setPage(0))}
                  className={`rounded-md px-3 py-1.5 transition-colors ${g === k ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs font-bold text-[var(--muted)]">
                  {["Data", "Cliques", "Inscrições", "Taxa de conversão", "FTD #", "Quantidade de depósitos", "Sinalizado"].map((h, i) => (
                    <th key={h} className={`px-3 py-3 font-bold ${i ? "text-right" : ""}`}>
                      <span className="inline-flex items-center gap-1.5">
                        {h} <FiInfo className="h-3 w-3 opacity-60" />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageLines.map((r, i) => (
                  <tr key={r.date} className={i % 2 ? "" : "bg-[var(--card)]"}>
                    <td className="px-3 py-2.5 font-semibold capitalize">{r.label}</td>
                    <td className="px-3 py-2.5 text-right">{Math.round(r.clicks).toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right">{Math.round(r.signups).toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right">{convRate(r).toFixed(2)}%</td>
                    <td className="px-3 py-2.5 text-right">{Math.round(r.ftd).toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.deposits)}</td>
                    <td className="px-3 py-2.5 text-right">{r.flagged.toFixed(2)}%</td>
                  </tr>
                ))}
                {!lines.length && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-[var(--muted)]">
                      Sem dados no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <nav className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-sm" aria-label="Páginas">
              <button type="button" onClick={() => setPage(cur - 1)} disabled={cur === 0} className="p-2 text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-25" aria-label="Página anterior">
                <FiChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: pages }, (_, p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`h-8 min-w-8 rounded-md px-2 font-bold ${p === cur ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--text)]"}`}
                >
                  {p + 1}
                </button>
              ))}
              <button type="button" onClick={() => setPage(cur + 1)} disabled={cur === pages - 1} className="p-2 text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-25" aria-label="Próxima página">
                <FiChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </section>

        <p className="mt-8 text-center text-xs text-[var(--muted)]">
          <span className="font-bold text-[var(--text)]">{report.panelName}</span> · atualizado em{" "}
          {new Date(report.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </p>
      </main>
    </div>
  );
}
