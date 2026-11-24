"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiBarChart2, FiBriefcase, FiChevronLeft, FiChevronRight, FiHome, FiInfo, FiLink, FiMoreHorizontal, FiUser, FiUsers } from "react-icons/fi";
import { withBase } from "@/lib/base";
import { convRate, type Report, type ReportRow } from "@/lib/report-types";
import CountText from "./CountText";

// Temas: mesmo layout (cinza-escuro, cards retos), muda só a paleta. "grafite" é o mais neutro.
const THEMES: Record<Report["theme"], React.CSSProperties> = {
  grafite: { "--bg": "#111215", "--col": "#18191d", "--panel": "#1c1d22", "--card": "#212329", "--line": "#2c2e35", "--text": "#f2f2f4", "--muted": "#8d9099", "--accent": "#6d4cf0", "--chart": "#8ab4ff", "--on-accent": "#ffffff" } as React.CSSProperties,
  roxo: { "--bg": "#0f0d15", "--col": "#16141d", "--panel": "#1b1824", "--card": "#211d2c", "--line": "#2e2a3c", "--text": "#f3f1fb", "--muted": "#9b95b3", "--accent": "#8b3dff", "--chart": "#b07cff", "--on-accent": "#ffffff" } as React.CSSProperties,
  azul: { "--bg": "#0a0f1c", "--col": "#0f1626", "--panel": "#131b2e", "--card": "#182237", "--line": "#243250", "--text": "#f1f4fb", "--muted": "#8a98b8", "--accent": "#4f7bff", "--chart": "#7fa4ff", "--on-accent": "#ffffff" } as React.CSSProperties,
  claro: { "--bg": "#eceef2", "--col": "#f5f6f8", "--panel": "#ffffff", "--card": "#f7f8fa", "--line": "#e1e4ea", "--text": "#16181d", "--muted": "#6b7280", "--accent": "#6d4cf0", "--chart": "#4f7bff", "--on-accent": "#ffffff" } as React.CSSProperties,
};

const NAV = [
  { label: "Painel", Icon: FiHome },
  { label: "Central de Dados", Icon: FiBarChart2 },
  { label: "Meus jogadores", Icon: FiUser },
  { label: "Meus afiliados", Icon: FiUsers },
  { label: "Minha campanha", Icon: FiLink },
  { label: "Pagamentos", Icon: FiBriefcase },
  { label: "Mais", Icon: FiMoreHorizontal },
];

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

/** Botão quadradinho "…" do canto dos blocos */
const Dots = () => (
  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--card)] text-[var(--text)]" aria-hidden>
    <FiMoreHorizontal className="h-4 w-4" />
  </span>
);

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

  // gráfico fino do topo: depósitos por dia numa janela de pelo menos 30 dias até o último dia;
  // dia que não está na tabela conta como zero, então cada depósito vira uma "onda" saindo da base
  const series = useMemo(() => {
    if (!rows.length) return [] as { date: string; deposits: number }[];
    const byDay = new Map(rows.map((r) => [r.date, r.deposits]));
    const last = toDate(rows[rows.length - 1].date);
    const first = toDate(rows[0].date);
    const start = new Date(last);
    start.setDate(last.getDate() - 29);
    const from = first < start ? first : start;
    // +1 dia vazio no fim: a onda do último dia desce de volta em vez de ficar cortada na borda
    const end = new Date(last);
    end.setDate(last.getDate() + 1);
    const out: { date: string; deposits: number }[] = [];
    for (const d = new Date(from); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      out.push({ date: key, deposits: byDay.get(key) ?? 0 });
    }
    return out;
  }, [rows]);
  const pts = useMemo(() => {
    if (series.length < 2) return [];
    const max = Math.max(...series.map((r) => r.deposits), 1);
    return series.map((r, i) => [(i / (series.length - 1)) * 1000, 100 - (r.deposits / max) * 92] as [number, number]);
  }, [series]);
  const line = smoothPath(pts);

  function onChartMove(e: React.PointerEvent) {
    const el = chartRef.current;
    if (!el || pts.length < 2) return;
    const r = el.getBoundingClientRect();
    setHover(Math.max(0, Math.min(series.length - 1, Math.round(((e.clientX - r.left) / r.width) * (series.length - 1)))));
  }

  const initials = report.userName.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "B4";

  return (
    <div translate="no" className="notranslate min-h-[100dvh] bg-[var(--bg)] font-sans text-[var(--text)]" style={THEMES[report.theme]}>
      {/* topo: marca à esquerda, usuário à direita */}
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--col)]">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-6 px-4 sm:px-6">
          <span className="shrink-0 truncate font-[family-name:var(--font-title)] text-xl font-black uppercase italic leading-none tracking-tight">{report.panelName}</span>
          {/* menu: ícone fino + texto, item atual em branco e negrito (no celular rola de lado) */}
          <nav aria-label="Menu" className="no-scrollbar -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-[13px]">
            {NAV.map(({ label, Icon }) => {
              const on = label === "Central de Dados";
              return (
                <span
                  key={label}
                  aria-current={on ? "page" : undefined}
                  className={`flex shrink-0 cursor-default items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 transition-colors ${on ? "font-bold text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={on ? 2.4 : 1.8} />
                  {label}
                </span>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center" title={report.userName || undefined}>
            <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--accent)] text-[11px] font-black text-[var(--on-accent)]">
              {initials}
              {report.userPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={withBase(report.userPhoto)} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
            </span>
          </div>
        </div>
      </header>

      {/* coluna central um tom mais clara, como um painel de afiliado */}
      <main className="mx-auto min-h-[calc(100dvh-3.5rem)] max-w-[1320px] border-x border-[var(--line)] bg-[var(--col)] pb-16">
        {/* gráfico fino de ponta a ponta */}
        <div
          ref={chartRef}
          className="relative h-24 touch-none sm:h-28"
          onPointerMove={onChartMove}
          onPointerDown={onChartMove}
          onPointerLeave={() => setHover(null)}
        >
          {pts.length >= 2 ? (
            <>
              <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                <defs>
                  <linearGradient id="rep-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--chart)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path d={`${line} L1000,100 L0,100 Z`} fill="url(#rep-area)" className={`transition-opacity duration-[1600ms] ${drawn ? "opacity-100" : "opacity-0"}`} />
                <path
                  d={line}
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
              {hover !== null && (
                <span
                  className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-[11px] shadow-lg"
                  style={{ left: `clamp(56px, ${(pts[hover][0] / 1000) * 100}%, calc(100% - 56px))` }}
                >
                  <span className="text-[var(--muted)]">{longDate(series[hover].date)}</span> · <b className="tabular-nums">{money(series[hover].deposits)}</b>
                </span>
              )}
            </>
          ) : (
            <span className="absolute inset-x-0 bottom-0 border-b-2 border-[var(--chart)]/60" />
          )}
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--chart)]/80" />
        </div>
        <div className="flex justify-between px-4 pt-2 text-xs text-[var(--muted)] sm:px-8">
          <span>{series.length ? longDate(series[0].date) : ""}</span>
          <span>{series.length ? longDate(series[series.length - 1].date) : ""}</span>
        </div>

        <div className="px-3 sm:px-4">
          {/* resumo */}
          <section className="mt-5 rounded-2xl bg-[var(--panel)] p-3 sm:p-4">
            <div className="flex items-center justify-between px-1 pb-4 pt-1">
              <h2 className="text-lg font-semibold text-[var(--muted)]">Resumo do desempenho</h2>
              <Dots />
            </div>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5">
              {report.metrics.map((m, i) => (
                <div key={i} className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-3 sm:p-3.5">
                  <div className="flex items-start justify-between gap-2 text-xs text-[var(--muted)]">
                    <span>{m.label}</span>
                    {/sinaliz/i.test(m.label) && <FiInfo className="mt-0.5 h-3 w-3 shrink-0" />}
                  </div>
                  <div className="mt-3 border-t border-dashed border-[var(--line)] pt-3 text-xl font-bold tabular-nums">
                    <CountText value={m.value} />
                  </div>
                  <div className={`mt-1 h-4 text-xs font-semibold ${m.delta.trim().startsWith("-") ? "text-red-400" : "text-emerald-400"}`}>{m.delta && !/^[+-]/.test(m.delta) ? `+${m.delta}` : m.delta}</div>
                </div>
              ))}
            </div>
          </section>

          {/* tabela */}
          <section className="mt-6 rounded-2xl bg-[var(--panel)] p-3 sm:p-4">
            <div className="flex items-center justify-between px-1 pt-1">
              <h2 className="text-lg font-semibold text-[var(--muted)]">Análise de desempenho</h2>
              <Dots />
            </div>
            <div className="mt-3 flex justify-end">
              <div className="flex rounded-lg bg-[var(--card)] p-1 text-xs">
                {([
                  ["day", "Dia"],
                  ["week", "Semana"],
                  ["month", "Mês"],
                ] as const).map(([k, t], i) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => (setG(k), setPage(0))}
                    className={`rounded-md px-3 py-1.5 font-semibold transition-colors ${g === k ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-[var(--muted)] hover:text-[var(--text)]"} ${i ? "border-l border-[var(--line)]" : ""}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13px] tabular-nums">
                <thead>
                  <tr className="text-left text-xs font-semibold">
                    {["Data", "Cliques", "Inscrições", "Taxa de conversão", "FTD #", "Quantidade de depósitos", "Sinalizado"].map((h, i) => (
                      <th key={h} className={`px-3 py-3 font-semibold ${i ? "text-right" : ""}`}>
                        <span className="inline-flex items-center gap-2">
                          {h} <FiInfo className="h-3 w-3 text-[var(--muted)]" />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageLines.map((r, i) => (
                    <tr key={r.date} className={i % 2 ? "" : "bg-[var(--card)]"}>
                      <td className="px-3 py-2.5 font-medium first-letter:uppercase">{r.label}</td>
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
                      <td colSpan={7} className="px-3 py-12 text-center text-[var(--muted)]">
                        Sem dados no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <nav className="mt-3 flex flex-wrap items-center justify-center gap-1 text-[13px]" aria-label="Páginas">
                <button type="button" onClick={() => setPage(cur - 1)} disabled={cur === 0} className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] disabled:opacity-25" aria-label="Página anterior">
                  <FiChevronLeft />
                </button>
                {Array.from({ length: pages }, (_, p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`h-8 min-w-8 rounded-md px-2 font-semibold ${p === cur ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--text)]"}`}
                  >
                    {p + 1}
                  </button>
                ))}
                <button type="button" onClick={() => setPage(cur + 1)} disabled={cur === pages - 1} className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] disabled:opacity-25" aria-label="Próxima página">
                  <FiChevronRight />
                </button>
              </nav>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
