// Painéis de resultado: editados em /trader/admin/paineis, abertos em /trader/p/<link>

export const REPORT_THEMES = [
  { key: "grafite", label: "Grafite" },
  { key: "roxo", label: "Roxo Barr4k" },
  { key: "azul", label: "Azul" },
  { key: "claro", label: "Claro" },
] as const;
export type ReportTheme = (typeof REPORT_THEMES)[number]["key"];

export const CURRENCIES = ["$", "R$", "€"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Card do resumo: valor em texto livre (ex.: "$517.34", "3.27x", "0.0%"); variação opcional (ex.: "-33%") */
export type ReportMetric = { label: string; value: string; delta: string };

/** Uma linha por dia da tabela "Análise de desempenho" */
export type ReportRow = { date: string; clicks: number; signups: number; ftd: number; deposits: number; flagged: number };

export type Report = {
  slug: string;
  panelName: string;
  userName: string;
  userPhoto: string;
  theme: ReportTheme;
  currency: Currency;
  metrics: ReportMetric[];
  rows: ReportRow[];
  updatedAt: string;
};

/** Link do painel: letras minúsculas, números e hífen */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export const toSlug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export const DEFAULT_METRICS: ReportMetric[] = [
  { label: "Cliques", value: "0", delta: "" },
  { label: "Inscrições", value: "0", delta: "" },
  { label: "FTD #", value: "0", delta: "" },
  { label: "Quantidade de depósitos", value: "$0.00", delta: "" },
  { label: "Taxa de conversão", value: "0.0%", delta: "" },
  { label: "Clique para se inscrever", value: "0.0%", delta: "" },
  { label: "Apostando", value: "0.00x", delta: "" },
  { label: "Sinalizado", value: "0", delta: "" },
  { label: "% sinalizado", value: "0.0%", delta: "" },
];

export function emptyReport(slug = ""): Report {
  return {
    slug,
    panelName: "Barr4k",
    userName: "",
    userPhoto: "",
    theme: "grafite",
    currency: "$",
    metrics: DEFAULT_METRICS.map((m) => ({ ...m })),
    rows: [],
    updatedAt: new Date().toISOString(),
  };
}

/** Taxa de conversão de uma linha = FTD / cliques */
export const convRate = (r: Pick<ReportRow, "clicks" | "ftd">) => (r.clicks ? (r.ftd / r.clicks) * 100 : 0);
