"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IconType } from "react-icons";
import {
  FiActivity,
  FiBarChart2,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiDollarSign,
  FiFlag,
  FiMousePointer,
  FiPercent,
  FiTarget,
  FiTrendingUp,
  FiUserPlus,
} from "react-icons/fi";
import { withBase } from "@/lib/base";
import { convRate, type Report, type ReportRow } from "@/lib/report-types";
import CountText from "./CountText";

// Temas do painel (o padrão é o roxo do site da Barr4k)
const THEMES: Record<Report["theme"], React.CSSProperties> = {
  roxo: { "--bg": "#07060d", "--panel": "#100e1b", "--card": "#161226", "--line": "#262043", "--text": "#f3f1fb", "--muted": "#a39dbb", "--accent": "#8b3dff", "--accent-2": "#b07cff", "--chart": "#b07cff", "--on-accent": "#ffffff", "--glow": "rgba(139,61,255,.22)" } as React.CSSProperties,
  grafite: { "--bg": "#0e0f12", "--panel": "#16171b", "--card": "#1c1d22", "--line": "#2a2c33", "--text": "#f4f2ec", "--muted": "#8b8f9a", "--accent": "#8b3dff", "--accent-2": "#b07cff", "--chart": "#8ab4ff", "--on-accent": "#ffffff", "--glow": "rgba(138,180,255,.12)" } as React.CSSProperties,
  azul: { "--bg": "#040918", "--panel": "#08122b", "--card": "#0d1a3b", "--line": "#1a2d63", "--text": "#f3f5fb", "--muted": "#8ea0c8", "--accent": "#4f7bff", "--accent-2": "#86a6ff", "--chart": "#6f96ff", "--on-accent": "#ffffff", "--glow": "rgba(79,123,255,.22)" } as React.CSSProperties,
  claro: { "--bg": "#f3f1f8", "--panel": "#ffffff", "--card": "#faf9fd", "--line": "#e5e1f0", "--text": "#15111f", "--muted": "#6d6880", "--accent": "#8b3dff", "--accent-2": "#7a2cf0", "--chart": "#8b3dff", "--on-accent": "#ffffff", "--glow": "rgba(139,61,255,.14)" } as React.CSSProperties,
};

const PER_PAGE = 10;
const toDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const longDate = (s: string) => toDate(s).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
const shortDate = (s: string) => toDate(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

/** Ícone de cada card, pelo nome que ele deu */
function iconFor(label: string): IconType {
  const l = label.toLowerCase();
  if (l.includes("%") || l.includes("taxa")) return l.includes("inscre") ? FiTrendingUp : FiPercent;
  if (l.includes("clique")) return l.includes("inscre") ? FiTrendingUp : FiMousePointer;
  if (l.includes("inscri") || l.includes("cadastr")) return FiUserPlus;
  if (l.includes("ftd")) return FiTarget;
  if (l.includes("depós") || l.includes("depos") || l.includes("$")) return FiDollarSign;
  if (l.includes("apost")) return FiActivity;
  if (l.includes("sinaliz")) return FiFlag;
  return FiBarChart2;
}

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

/** Linha suave (curva) passando pelos pontos, pro gráfico (sem passar da borda) */
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
  const [hover, setHover] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

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
  const total = useMemo(
    () => rows.reduce((a, r) => ({ clicks: a.clicks + r.clicks, signups: a.signups + r.signups, ftd: a.ftd + r.ftd, deposits: a.deposits + r.deposits, flagged: a.flagged + r.flagged / (rows.length || 1) }), { clicks: 0, signups: 0, ftd: 0, deposits: 0, flagged: 0 }),
    [rows],
  );

  // card em destaque no topo: o de depósitos (ou o primeiro); os outros vão pra grade
  const heroIdx = Math.max(0, report.metrics.findIndex((m) => /dep[oó]s/i.test(m.label)));
  const hero = report.metrics[heroIdx];
  const others = report.metrics.filter((_, i) => i !== heroIdx);

  // gráfico: depósitos por dia
  const pts = useMemo(() => {
    if (rows.length < 2) return [];
    const max = Math.max(...rows.map((r) => r.deposits), 1);
    return rows.map((r, i) => [(i / (rows.length - 1)) * 1000, 100 - (r.deposits / max) * 86] as [number, number]);
  }, [rows]);
  const line = smoothPath(pts);

  function onChartMove(e: React.PointerEvent) {
    const el = chartRef.current;
    if (!el || pts.length < 2) return;
    const r = el.getBoundingClientRect();
    const k = Math.round(((e.clientX - r.left) / r.width) * (rows.length - 1));
    setHover(Math.max(0, Math.min(rows.length - 1, k)));
  }

  const initials = report.userName.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "B4";
  const period = rows.length ? `${shortDate(rows[0].date)} – ${longDate(rows[rows.length - 1].date)}` : "Sem período ainda";
  const updated = new Date(report.updatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const deltaPill = (d: string) =>
    d.trim() ? (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${d.trim().startsWith("-") ? "bg-red-500/12 text-red-400" : "bg-emerald-500/12 text-emerald-400"}`}>{d}</span>
    ) : null;

  return (
    <div translate="no" className="notranslate relative min-h-[100dvh] overflow-hidden bg-[var(--bg)] font-sans text-[var(--text)]" style={THEMES[report.theme]}>
      {/* brilho do fundo + grade bem leve */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px]" style={{ background: "radial-gradient(60% 70% at 70% 0%, var(--glow), transparent 70%), radial-gradient(40% 50% at 0% 20%, var(--glow), transparent 70%)" }} aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-[0.06] [mask-image:linear-gradient(to_bottom,black,transparent)]"
        style={{ backgroundImage: "linear-gradient(var(--text) 1px, transparent 1px), linear-gradient(90deg, var(--text) 1px, transparent 1px)", backgroundSize: "48px 48px" }}
        aria-hidden
      />

      {/* topo */}
      <header className="relative z-20 border-b border-[var(--line)]/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <span className="truncate font-[family-name:var(--font-title)] text-2xl font-black uppercase italic leading-none tracking-tight">{report.panelName}</span>
          <span className="ml-auto hidden items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)]/70 px-3 py-1.5 text-xs text-[var(--muted)] sm:inline-flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Atualizado {updated}
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {/* destaque: usuário + card principal + gráfico */}
        <section className="rep-in mt-6 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)]/85 shadow-[0_30px_80px_-40px_var(--glow)] backdrop-blur">
          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="flex items-center gap-4">
              <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[var(--accent)] text-lg font-black text-[var(--on-accent)] ring-2 ring-[var(--accent)]/40 ring-offset-2 ring-offset-[var(--panel)] sm:h-20 sm:w-20">
                {initials}
                {report.userPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={withBase(report.userPhoto)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-2)]">Painel de desempenho</p>
                <h1 className="mt-1 truncate font-[family-name:var(--font-title)] text-3xl font-black uppercase italic leading-none tracking-tight sm:text-5xl">{report.userName || report.panelName}</h1>
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-[var(--muted)]">
                  <FiCalendar className="h-3.5 w-3.5" /> {period}
                </p>
              </div>
            </div>
            {hero && (
              <div className="lg:text-right">
                <p className="text-sm text-[var(--muted)]">{hero.label}</p>
                <p className="mt-1 text-4xl font-black tabular-nums tracking-tight sm:text-5xl">
                  <CountText value={hero.value} />
                </p>
                <div className="mt-2 lg:flex lg:justify-end">{deltaPill(hero.delta)}</div>
              </div>
            )}
          </div>

          {/* gráfico de depósitos por dia (passe o mouse pra ver cada dia) */}
          <div
            ref={chartRef}
            className="relative h-40 cursor-crosshair touch-none sm:h-52"
            onPointerMove={onChartMove}
            onPointerDown={onChartMove}
            onPointerLeave={() => setHover(null)}
          >
            {pts.length >= 2 ? (
              <>
                <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                  <defs>
                    <linearGradient id="rep-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart)" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="var(--chart)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[25, 50, 75].map((y) => (
                    <line key={y} x1="0" x2="1000" y1={y} y2={y} stroke="var(--line)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
                  ))}
                  <path d={`${line} L1000,100 L0,100 Z`} fill="url(#rep-area)" className={`transition-opacity duration-[1600ms] ${drawn ? "opacity-100" : "opacity-0"}`} />
                  <path
                    d={line}
                    fill="none"
                    stroke="var(--chart)"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                    pathLength={1}
                    strokeDasharray="1"
                    strokeDashoffset={drawn ? 0 : 1}
                    style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(.2,.7,.2,1)", filter: "drop-shadow(0 6px 14px var(--glow))" }}
                  />
                </svg>
                {hover !== null && (
                  <>
                    <span className="pointer-events-none absolute inset-y-0 w-px bg-[var(--chart)]/50" style={{ left: `${(pts[hover][0] / 1000) * 100}%` }} />
                    <span
                      className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--panel)] bg-[var(--chart)]"
                      style={{ left: `${(pts[hover][0] / 1000) * 100}%`, top: `${pts[hover][1]}%` }}
                    />
                    <span
                      className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--line)] bg-[var(--card)] px-2.5 py-1.5 text-xs shadow-lg"
                      style={{ left: `clamp(60px, ${(pts[hover][0] / 1000) * 100}%, calc(100% - 60px))` }}
                    >
                      <span className="block text-[var(--muted)]">{longDate(rows[hover].date)}</span>
                      <span className="font-bold tabular-nums">{money(rows[hover].deposits)}</span>
                    </span>
                  </>
                )}
              </>
            ) : (
              <div className="absolute inset-x-6 top-1/2 border-t-2 border-dashed border-[var(--line)]">
                <span className="absolute left-1/2 top-3 -translate-x-1/2 text-xs text-[var(--muted)]">O gráfico aparece quando houver pelo menos 2 dias</span>
              </div>
            )}
          </div>
          {pts.length >= 2 && (
            <div className="flex justify-between border-t border-[var(--line)] px-5 py-2.5 text-xs text-[var(--muted)] sm:px-7">
              <span>{longDate(rows[0].date)}</span>
              <span className="hidden sm:inline">Depósitos por dia</span>
              <span>{longDate(rows[rows.length - 1].date)}</span>
            </div>
          )}
        </section>

        {/* cards do resumo */}
        {others.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-4 font-[family-name:var(--font-title)] text-xl font-black uppercase italic tracking-tight">Resumo do desempenho</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {others.map((m, i) => {
                const Icon = iconFor(m.label);
                return (
                  <div
                    key={i}
                    className="rep-in group relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)]/60 hover:shadow-[0_18px_40px_-24px_var(--glow)] sm:p-5"
                    style={{ animationDelay: `${120 + i * 60}ms` }}
                  >
                    <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" style={{ background: "var(--glow)" }} />
                    <div className="flex items-center justify-between gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent-2)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      {deltaPill(m.delta)}
                    </div>
                    <p className="mt-4 text-[13px] text-[var(--muted)]">{m.label}</p>
                    <p className="mt-1 truncate text-2xl font-black tabular-nums tracking-tight sm:text-3xl">
                      <CountText value={m.value} />
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* tabela */}
        <section className="rep-in mt-8 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)]" style={{ animationDelay: "300ms" }}>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:px-7">
            <h2 className="font-[family-name:var(--font-title)] text-xl font-black uppercase italic tracking-tight">Análise de desempenho</h2>
            <div className="flex rounded-xl border border-[var(--line)] bg-[var(--card)] p-1 text-xs font-bold">
              {([
                ["day", "Dia"],
                ["week", "Semana"],
                ["month", "Mês"],
              ] as const).map(([k, t]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => (setG(k), setPage(0))}
                  className={`rounded-lg px-3.5 py-1.5 transition-colors ${g === k ? "bg-[var(--accent)] text-[var(--on-accent)] shadow" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm tabular-nums">
              <thead>
                <tr className="border-y border-[var(--line)] bg-[var(--card)] text-left text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  {[
                    ["Data", "Dia, semana ou mês"],
                    ["Cliques", "Cliques no link"],
                    ["Inscrições", "Cadastros feitos"],
                    ["Conversão", "FTD ÷ cliques"],
                    ["FTD #", "Primeiros depósitos"],
                    ["Depósitos", "Soma dos depósitos"],
                    ["Sinalizado", "Média sinalizada"],
                  ].map(([h, tip], i) => (
                    <th key={h} title={tip} className={`px-5 py-3 font-bold sm:px-7 ${i ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageLines.map((r) => (
                  <tr key={r.date} className="border-b border-[var(--line)]/60 transition-colors hover:bg-[var(--accent)]/[0.06]">
                    <td className="px-5 py-3 font-semibold first-letter:uppercase sm:px-7">{r.label}</td>
                    <td className="px-5 py-3 text-right sm:px-7">{Math.round(r.clicks).toLocaleString("pt-BR")}</td>
                    <td className="px-5 py-3 text-right sm:px-7">{Math.round(r.signups).toLocaleString("pt-BR")}</td>
                    <td className="px-5 py-3 text-right text-[var(--muted)] sm:px-7">{convRate(r).toFixed(2)}%</td>
                    <td className="px-5 py-3 text-right sm:px-7">{Math.round(r.ftd).toLocaleString("pt-BR")}</td>
                    <td className="px-5 py-3 text-right font-bold text-[var(--accent-2)] sm:px-7">{money(r.deposits)}</td>
                    <td className="px-5 py-3 text-right text-[var(--muted)] sm:px-7">{r.flagged.toFixed(2)}%</td>
                  </tr>
                ))}
                {!lines.length && (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-[var(--muted)]">
                      <FiBarChart2 className="mx-auto mb-2 h-6 w-6 opacity-50" />
                      Sem dados no período.
                    </td>
                  </tr>
                )}
              </tbody>
              {lines.length > 1 && (
                <tfoot>
                  <tr className="bg-[var(--card)] font-black">
                    <td className="px-5 py-3.5 sm:px-7">Total</td>
                    <td className="px-5 py-3.5 text-right sm:px-7">{Math.round(total.clicks).toLocaleString("pt-BR")}</td>
                    <td className="px-5 py-3.5 text-right sm:px-7">{Math.round(total.signups).toLocaleString("pt-BR")}</td>
                    <td className="px-5 py-3.5 text-right sm:px-7">{convRate(total).toFixed(2)}%</td>
                    <td className="px-5 py-3.5 text-right sm:px-7">{Math.round(total.ftd).toLocaleString("pt-BR")}</td>
                    <td className="px-5 py-3.5 text-right text-[var(--accent-2)] sm:px-7">{money(total.deposits)}</td>
                    <td className="px-5 py-3.5 text-right sm:px-7">{total.flagged.toFixed(2)}%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {pages > 1 && (
            <nav className="flex flex-wrap items-center justify-center gap-1.5 p-4 text-sm" aria-label="Páginas">
              <button type="button" onClick={() => setPage(cur - 1)} disabled={cur === 0} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--text)] disabled:opacity-25" aria-label="Página anterior">
                <FiChevronLeft />
              </button>
              {Array.from({ length: pages }, (_, p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`h-8 min-w-8 rounded-lg px-2 font-bold ${p === cur ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--text)]"}`}
                >
                  {p + 1}
                </button>
              ))}
              <button type="button" onClick={() => setPage(cur + 1)} disabled={cur === pages - 1} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--text)] disabled:opacity-25" aria-label="Próxima página">
                <FiChevronRight />
              </button>
            </nav>
          )}
        </section>

        <p className="mt-10 text-center text-xs text-[var(--muted)]">
          <span className="font-[family-name:var(--font-title)] font-black uppercase italic text-[var(--text)]">{report.panelName}</span> · atualizado em{" "}
          {new Date(report.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </p>
      </main>
    </div>
  );
}
