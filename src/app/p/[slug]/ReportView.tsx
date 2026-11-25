"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiBarChart2, FiBriefcase, FiChevronDown, FiChevronLeft, FiChevronRight, FiDatabase, FiHome, FiInfo, FiLink, FiMoreHorizontal, FiUser, FiUsers, FiX } from "react-icons/fi";
import { withBase } from "@/lib/base";
import { convRate, type Report, type ReportRow } from "@/lib/report-types";
import CountText from "./CountText";

// Temas: mesmo layout, muda só a paleta. "grafite" = cores medidas do painel antigo.
// --col = coluna (parte de cima), --col2 = fundo mais claro que começa atrás do resumo,
// --panel = blocos (resumo/análise), --card = cards, --line = bordas, --pill/--pill-line = aba ligada
const THEMES: Record<Report["theme"], React.CSSProperties> = {
  grafite: { "--bg": "#13141c", "--nav": "#191b24", "--navline": "#272831", "--col": "#191a22", "--col2": "#1f2128", "--colline": "#2a2b31", "--panel": "#191b24", "--card": "#21232b", "--line": "#2e3037", "--btn": "#2a2b33", "--text": "#ffffff", "--soft": "#9a9ca6", "--muted": "#6b6d7e", "--accent": "#6353e9", "--pill": "#242240", "--pill-line": "#373173", "--pill-text": "#c9c2ff", "--on-accent": "#ffffff" } as React.CSSProperties,
  roxo: { "--bg": "#0f0d15", "--nav": "#16141d", "--navline": "#2a2638", "--col": "#16141d", "--col2": "#1c1926", "--colline": "#2e2a3c", "--panel": "#18151f", "--card": "#211d2c", "--line": "#2e2a3c", "--btn": "#2a2538", "--text": "#ffffff", "--soft": "#a9a3c2", "--muted": "#7d7795", "--accent": "#8b3dff", "--pill": "#2a1f45", "--pill-line": "#4a2f86", "--pill-text": "#d8c4ff", "--on-accent": "#ffffff" } as React.CSSProperties,
  azul: { "--bg": "#0a0f1c", "--nav": "#0f1626", "--navline": "#1f2a44", "--col": "#0f1626", "--col2": "#141d31", "--colline": "#243250", "--panel": "#111a2c", "--card": "#182237", "--line": "#243250", "--btn": "#1f2b45", "--text": "#ffffff", "--soft": "#9eabc8", "--muted": "#6f7d9c", "--accent": "#4f7bff", "--pill": "#17264a", "--pill-line": "#2c4688", "--pill-text": "#bcd0ff", "--on-accent": "#ffffff" } as React.CSSProperties,
  claro: { "--bg": "#eceef2", "--nav": "#ffffff", "--navline": "#e1e4ea", "--col": "#f5f6f8", "--col2": "#eef0f4", "--colline": "#e1e4ea", "--panel": "#ffffff", "--card": "#f7f8fa", "--line": "#e1e4ea", "--btn": "#eceef2", "--text": "#16181d", "--soft": "#4b5160", "--muted": "#6b7280", "--accent": "#6353e9", "--pill": "#ece9ff", "--pill-line": "#c9c1ff", "--pill-text": "#3f2fc7", "--on-accent": "#ffffff" } as React.CSSProperties,
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
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const longDate = (s: string) => toDate(s).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());

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
      const mon = addDays(d, -((d.getDay() + 6) % 7));
      key = isoDay(mon);
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
      const sum = (k: keyof Omit<ReportRow, "date">) => rs.reduce((t, r) => t + (r[k] ?? 0), 0);
      return { date: key, label, clicks: sum("clicks"), signups: sum("signups"), ftd: sum("ftd"), deposits: sum("deposits"), ngr: sum("ngr"), flagged: sum("flagged") / rs.length };
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

/** "Não há dados disponíveis" com o ícone de banco de dados, numa caixa tracejada */
const Empty = ({ className = "" }: { className?: string }) => (
  <div className={`grid place-items-center rounded-xl border border-dashed border-[var(--line)] text-[var(--muted)] ${className}`}>
    <div className="flex flex-col items-center gap-3">
      <FiDatabase className="h-11 w-11" strokeWidth={1.6} />
      <span className="text-[15px]">Não há dados disponíveis</span>
    </div>
  </div>
);

/** Ícone de filtro do botão "Filtros" (3 riscos que diminuem) */
const FilterLines = () => (
  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
    <path d="M2.5 5h15M5 10h10M7.5 15h5" />
  </svg>
);

type SeriesKey = "clicks" | "ftd" | "ngr";
const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "clicks", label: "Cliques", color: "#93c5fd" },
  { key: "ftd", label: "FTDs", color: "#fca5a5" },
  { key: "ngr", label: "NGR", color: "#fcd34d" },
];

type RangeKind = "default" | "month" | "prev" | "3m" | "6m" | "1y" | "custom";
type Filter = { range: RangeKind; from: string; to: string; brands: string[] };
const RANGE_BTNS: [RangeKind, string][] = [
  ["month", "Current Month"],
  ["prev", "Previous"],
  ["3m", "3 M"],
  ["6m", "6 M"],
  ["1y", "1 Y"],
  ["custom", "Custom"],
];

/** Período escolhido → [início, fim]. Padrão: últimos 30 dias até hoje (ou até o último dia da tabela, se for depois) */
function rangeOf(f: Filter, end: Date): [Date, Date] {
  switch (f.range) {
    case "month":
      return [new Date(end.getFullYear(), end.getMonth(), 1), end];
    case "prev":
      return [new Date(end.getFullYear(), end.getMonth() - 1, 1), new Date(end.getFullYear(), end.getMonth(), 0)];
    case "3m":
      return [addMonths(end, -3), end];
    case "6m":
      return [addMonths(end, -6), end];
    case "1y":
      return [addMonths(end, -12), end];
    case "custom": {
      const a = f.from ? toDate(f.from) : addDays(end, -30);
      const b = f.to ? toDate(f.to) : end;
      return a <= b ? [a, b] : [b, a];
    }
    default:
      return [addDays(end, -30), end];
  }
}

export default function ReportView({ report }: { report: Report }) {
  const { rows, currency } = report;
  const brands = report.brands ?? [];
  const [g, setG] = useState<Group>("day");
  const [page, setPage] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  // abas do gráfico acumulam: cada uma ligada vira uma linha com a sua cor
  const [on, setOn] = useState<SeriesKey[]>(["clicks"]);
  const [openPlayers, setOpenPlayers] = useState(false);
  const [q, setQ] = useState("");
  const emptyFilter: Filter = { range: "default", from: "", to: "", brands: [] };
  const [filter, setFilter] = useState<Filter>(emptyFilter);
  const [draft, setDraft] = useState<Filter>(emptyFilter);
  const [drawer, setDrawer] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // o gráfico "desenha" ao abrir (junto com os números subindo)
  useEffect(() => {
    const t = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Esc fecha a gaveta
  useEffect(() => {
    if (!drawer) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [drawer]);

  const money = (v: number) =>
    currency === "R$"
      ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${currency}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // fim da janela: hoje, ou o último dia da tabela se ele for depois de hoje
  const end = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last = rows.length ? toDate(rows[rows.length - 1].date) : today;
    return last > today ? last : today;
  }, [rows]);
  const [from, to] = useMemo(() => rangeOf(filter, end), [filter, end]);
  const fromKey = isoDay(from);
  const toKey = isoDay(to);
  const inRange = useMemo(() => rows.filter((r) => r.date >= fromKey && r.date <= toKey), [rows, fromKey, toKey]);

  const lines = useMemo(() => group(inRange, g), [inRange, g]);
  const pages = Math.max(1, Math.ceil(lines.length / PER_PAGE));
  const cur = Math.min(page, pages - 1);
  const pageLines = lines.slice(cur * PER_PAGE, (cur + 1) * PER_PAGE);

  // um ponto por dia no período (dia sem linha na tabela = 0)
  const days = useMemo(() => {
    const byDay = new Map(rows.map((r) => [r.date, r]));
    const out: { date: string; row?: ReportRow }[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: isoDay(d), row: byDay.get(isoDay(d)) });
    return out;
  }, [rows, from, to]);
  const paths = useMemo(
    () =>
      SERIES.filter((s) => on.includes(s.key)).map((s) => {
        const vals = days.map((d) => d.row?.[s.key] ?? 0);
        const has = vals.some((v) => v !== 0);
        const max = Math.max(...vals, 1);
        const pts = vals.map((v, i) => [(i / Math.max(1, days.length - 1)) * 1000, 100 - (Math.max(0, v) / max) * 88] as [number, number]);
        return { ...s, has, line: has && pts.length > 1 ? smoothPath(pts) : "" };
      }),
    [days, on]
  );

  const enRange = `${from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  function onChartMove(e: React.PointerEvent) {
    const el = chartRef.current;
    if (!el || !paths.some((p) => p.has) || days.length < 2) return;
    const r = el.getBoundingClientRect();
    setHover(Math.max(0, Math.min(days.length - 1, Math.round(((e.clientX - r.left) / r.width) * (days.length - 1)))));
  }

  const toggle = (k: SeriesKey) => {
    setHover(null);
    setOn((cur) => (cur.includes(k) ? (cur.length > 1 ? cur.filter((x) => x !== k) : cur) : SERIES.map((s) => s.key).filter((x) => x === k || cur.includes(x))));
  };

  const openDrawer = () => {
    setDraft(filter);
    setDrawer(true);
  };
  const apply = () => {
    setFilter(draft);
    setPage(0);
    setHover(null);
    setDrawer(false);
  };

  const initials = report.userName.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "B4";
  const fmt = (k: SeriesKey, v: number) => (k === "ngr" ? money(v) : Math.round(v).toLocaleString("pt-BR"));

  return (
    <div translate="no" className="notranslate min-h-[100dvh] bg-[var(--bg)] pb-10 font-sans text-[var(--text)]" style={THEMES[report.theme]}>
      {/* topo: marca à esquerda, menu, usuário à direita */}
      <header className="sticky top-0 z-20 border-b border-[var(--navline)] bg-[var(--nav)]">
        <div className="mx-auto flex h-[58px] max-w-[1320px] items-center gap-8 px-4 sm:px-6">
          {report.panelLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={withBase(report.panelLogo)} alt={report.panelName} className="h-8 w-auto max-w-[180px] shrink-0 object-contain object-left" />
          ) : (
            <span className="shrink-0 truncate font-[family-name:var(--font-title)] text-[28px] font-black uppercase italic leading-none tracking-tight">{report.panelName}</span>
          )}
          <nav aria-label="Menu" className="no-scrollbar flex min-w-0 flex-1 items-center gap-6 overflow-x-auto text-[15px] sm:text-[16px]">
            {NAV.map(({ label, Icon }) => {
              const cur = label === "Central de Dados";
              return (
                <span
                  key={label}
                  aria-current={cur ? "page" : undefined}
                  className={`flex shrink-0 cursor-default items-center gap-1.5 whitespace-nowrap rounded-md px-1 py-1 transition-colors ${cur ? "font-bold text-[var(--text)]" : "text-[var(--soft)] hover:text-[var(--text)]"}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={cur ? 2.4 : 1.8} />
                  {label}
                </span>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center" title={report.userName || undefined}>
            <span
              className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full text-[11px] font-black ${report.userPhoto ? "ring-1 ring-white/25" : "bg-[var(--accent)] text-[var(--on-accent)]"}`}
            >
              {!report.userPhoto && initials}
              {report.userPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={withBase(report.userPhoto)} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
            </span>
          </div>
        </div>
      </header>

      {/* coluna central: bloco arredondado */}
      <main className="relative mx-auto mt-6 max-w-[1320px] overflow-hidden rounded-2xl border border-[var(--colline)] bg-[var(--col)] shadow-[0_0_40px_rgba(0,0,0,0.45)]">
        {/* Tendência de desempenho */}
        <section className="pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-8">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--muted)]">
              Tendência de desempenho <FiInfo className="h-3.5 w-3.5" />
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted)]">{enRange}</span>
              <button type="button" onClick={openDrawer} className="flex items-center gap-1.5 rounded-xl bg-[var(--btn)] px-2.5 py-1.5 text-sm font-semibold transition-colors hover:brightness-125">
                <FilterLines /> Filtros
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 px-4 sm:px-8">
            <FiBarChart2 className="mr-1 h-4 w-4 text-[var(--muted)]" />
            {SERIES.map(({ key, label }) => {
              const sel = on.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  aria-pressed={sel}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${sel ? "border-[var(--pill-line)] bg-[var(--pill)] text-[var(--pill-text)]" : "border-[var(--btn)] text-[var(--soft)] hover:text-[var(--text)]"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 px-4 text-xs text-[var(--soft)] sm:px-8">
            {paths.map((p) => (
              <span key={p.key} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: p.color }} /> {p.label}
              </span>
            ))}
          </div>

          <div
            ref={chartRef}
            className="relative mt-2 h-[150px] touch-none"
            onPointerMove={onChartMove}
            onPointerDown={onChartMove}
            onPointerLeave={() => setHover(null)}
          >
            <svg
              key={`${fromKey}-${toKey}`}
              viewBox="0 0 1000 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              style={{ clipPath: drawn ? "inset(0 0 0 0)" : "inset(0 100% 0 0)", transition: "clip-path 1.6s cubic-bezier(.2,.7,.2,1)" }}
              aria-hidden
            >
              {paths
                .filter((p) => p.line)
                .map((p) => (
                  <path
                    key={p.key}
                    d={p.line}
                    fill="none"
                    stroke={p.color}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
            </svg>
            {hover !== null && days[hover] && (
              <span
                className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-[11px] shadow-lg"
                style={{ left: `clamp(80px, ${(hover / Math.max(1, days.length - 1)) * 100}%, calc(100% - 80px))` }}
              >
                <span className="text-[var(--muted)]">{longDate(days[hover].date)}</span>
                {paths.map((p) => (
                  <span key={p.key}>
                    {" · "}
                    <b className="tabular-nums" style={{ color: p.color }}>
                      {fmt(p.key, days[hover].row?.[p.key] ?? 0)}
                    </b>
                  </span>
                ))}
              </span>
            )}
            {/* linha de base de ponta a ponta (cor da 1ª série ligada) */}
            <span className="absolute inset-x-0 bottom-0 h-px" style={{ background: paths[0]?.color ?? SERIES[0].color }} />
          </div>
          <div className="flex justify-between px-4 pt-1.5 text-xs text-[var(--muted)] sm:px-8">
            <span>{longDate(fromKey)}</span>
            <span>{longDate(toKey)}</span>
          </div>
        </section>

        {/* daqui pra baixo: fundo mais claro que começa atrás do meio do resumo, como no painel antigo */}
        <div className="relative px-3 pb-8 sm:px-4">
          <div className="absolute inset-x-0 bottom-0 top-20 rounded-t-2xl bg-[var(--col2)]" aria-hidden />

          {/* resumo */}
          <section className="relative mt-3 rounded-2xl bg-[var(--panel)] p-3 shadow-[0_6px_28px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between px-1 pb-4 pt-1">
              <h2 className="text-lg font-semibold text-[var(--muted)]">Resumo do desempenho</h2>
              <Dots />
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
              {report.metrics.map((m, i) => (
                <div key={i} className="min-h-[116px] rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 pb-3 pt-3.5">
                  <div className="flex items-start justify-between gap-2 text-xs text-[var(--soft)]">
                    <span>{m.label}</span>
                    {/sinaliz/i.test(m.label) && <FiInfo className="mt-0.5 h-3 w-3 shrink-0" />}
                  </div>
                  <div className="mt-4 border-t border-dashed border-[var(--line)] pt-2.5 text-xl font-bold tabular-nums">
                    <CountText value={m.value} />
                  </div>
                  {m.delta && (
                    <div className={`mt-0.5 text-xs font-semibold ${m.delta.trim().startsWith("-") ? "text-red-400" : "text-emerald-400"}`}>{!/^[+-]/.test(m.delta) ? `+${m.delta}` : m.delta}</div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* análise (tabela) */}
          <section className="relative mt-4 rounded-2xl bg-[var(--panel)] p-3 sm:p-4">
            <div className="flex items-center justify-between px-1 pt-1">
              <h2 className="text-lg font-semibold text-[var(--muted)]">Análise de desempenho</h2>
              <Dots />
            </div>
            <div className="mt-3 flex justify-end">
              <div className="flex items-center rounded-lg bg-[var(--bg)] p-1 text-xs">
                {([
                  ["day", "Dia"],
                  ["week", "Semana"],
                  ["month", "Mês"],
                ] as const).map(([k, t], i) => (
                  <span key={k} className="flex items-center">
                    {i > 0 && g !== k && ((k === "week" && g !== "day") || (k === "month" && g !== "week")) && <span className="h-3 w-px bg-[var(--line)]" />}
                    <button
                      type="button"
                      onClick={() => (setG(k), setPage(0))}
                      className={`rounded-md px-2.5 py-1.5 font-semibold transition-colors ${g === k ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-[var(--soft)] hover:text-[var(--text)]"}`}
                    >
                      {t}
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {!lines.length ? (
              <Empty className="mt-4 h-[200px]" />
            ) : (
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
                  </tbody>
                </table>
              </div>
            )}

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

          {/* Cliques detalhados do jogador (começa fechado, como no antigo) */}
          <section className="relative mt-4 rounded-2xl bg-[var(--panel)]">
            <button type="button" onClick={() => setOpenPlayers((v) => !v)} className="flex w-full items-center justify-between px-4 py-4 text-left" aria-expanded={openPlayers}>
              <h2 className="text-lg font-semibold text-[var(--muted)]">Cliques detalhados do jogador</h2>
              <FiChevronDown className={`h-5 w-5 text-[var(--muted)] transition-transform ${openPlayers ? "rotate-180" : ""}`} />
            </button>
            {openPlayers && (
              <div className="border-t border-[var(--line)] px-4 pb-4 pt-8 sm:px-8">
                <div className="flex justify-end">
                  <Dots />
                </div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Pesquisar por jogador..."
                  className="mt-1 w-full max-w-[200px] rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
                />
                <Empty className="mt-4 h-[200px]" />
              </div>
            )}
          </section>
        </div>
      </main>

      {/* gaveta de Filtros (lado direito, fundo desfocado) */}
      {drawer && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" aria-label="Fechar" onClick={() => setDrawer(false)} className="absolute inset-0 bg-black/55 backdrop-blur-[3px]" />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-[var(--navline)] bg-[var(--col)] px-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 pt-5">
              <h2 className="text-lg font-bold">Filters</h2>
              <button type="button" onClick={() => setDrawer(false)} className="text-[var(--soft)] hover:text-[var(--text)]" aria-label="Fechar">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Date range</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {RANGE_BTNS.map(([k, t]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, range: d.range === k ? "default" : k }))}
                    className={`h-10 rounded-xl text-sm font-semibold transition-colors ${draft.range === k ? "bg-[var(--accent)] text-[var(--on-accent)]" : "bg-[var(--btn)] hover:brightness-125"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {draft.range === "custom" && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {(["from", "to"] as const).map((k) => (
                    <label key={k} className="flex flex-col gap-1 text-[var(--muted)]">
                      {k === "from" ? "From" : "To"}
                      <input
                        type="date"
                        value={draft[k]}
                        onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                        className="h-10 rounded-xl bg-[var(--btn)] px-3 text-sm text-[var(--text)] outline-none [color-scheme:dark]"
                      />
                    </label>
                  ))}
                </div>
              )}

              {brands.length > 0 && (
                <>
                  <p className="mt-7 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Brands</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {brands.map((b) => {
                      const sel = draft.brands.includes(b);
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, brands: sel ? d.brands.filter((x) => x !== b) : [...d.brands, b] }))}
                          className={`h-9 rounded-xl px-3 text-sm font-semibold transition-colors ${sel ? "bg-[var(--accent)] text-[var(--on-accent)]" : "bg-[var(--btn)] hover:brightness-125"}`}
                        >
                          {b}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2 border-t border-[var(--navline)] px-4 py-4">
              <button type="button" onClick={() => setDraft(emptyFilter)} className="h-11 flex-1 rounded-xl bg-[var(--btn)] font-semibold hover:brightness-125">
                Reset
              </button>
              <button type="button" onClick={apply} className="h-11 flex-1 rounded-xl bg-[var(--pill)] font-semibold text-[var(--pill-text)] hover:brightness-125">
                Apply
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
