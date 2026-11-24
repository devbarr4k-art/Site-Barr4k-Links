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

/** Tipo do card: decide o símbolo fixo do valor (não dá pra apagar no admin) */
export const METRIC_KINDS = [
  { key: "num", label: "Número", sample: "123" },
  { key: "money", label: "Dinheiro", sample: "$" },
  { key: "pct", label: "Porcentagem", sample: "%" },
  { key: "mult", label: "Multiplicador", sample: "x" },
] as const;
export type MetricKind = (typeof METRIC_KINDS)[number]["key"];

/** Card do resumo: value já formatado (ex.: "$517.34", "3.27x", "0.0%"); variação opcional (ex.: "-33%") */
export type ReportMetric = { label: string; value: string; delta: string; kind: MetricKind };

/** Adivinha o tipo de um card antigo (salvo antes de existir o campo) pelo valor e pelo nome */
export function inferKind(label: string, value: string): MetricKind {
  const l = label.toLowerCase();
  if (/%/.test(value) || l.includes("%") || l.includes("taxa") || l.includes("clique para")) return "pct";
  if (/x\s*$/i.test(value) || l.includes("apostando")) return "mult";
  if (/[$€]/.test(value) || l.includes("depós") || l.includes("depos")) return "money";
  return "num";
}

/** Só o número digitado (dígitos, ponto e vírgula), sem símbolo */
export const rawOf = (value: string) => value.replace(/[^\d.,]/g, "");

/** Monta o valor com o símbolo fixo do tipo */
export function compose(kind: MetricKind, raw: string, currency: Currency): string {
  const n = rawOf(raw); // pode ficar vazio enquanto digita no admin; ao salvar vira 0
  if (kind === "money") return currency === "R$" ? `R$ ${n}` : `${currency}${n}`;
  if (kind === "pct") return `${n}%`;
  if (kind === "mult") return `${n}x`;
  return n;
}

/** Uma linha por dia da tabela "Análise de desempenho" */
export type ReportRow = { date: string; clicks: number; signups: number; ftd: number; deposits: number; flagged: number };

export type Report = {
  slug: string;
  panelName: string;
  /** logo do topo (no lugar do nome do painel); vazio = mostra o nome em texto */
  panelLogo: string;
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
  { label: "Cliques", value: "0", delta: "", kind: "num" },
  { label: "Inscrições", value: "0", delta: "", kind: "num" },
  { label: "FTD #", value: "0", delta: "", kind: "num" },
  { label: "Quantidade de depósitos", value: "$0.00", delta: "", kind: "money" },
  { label: "Taxa de conversão", value: "0.0%", delta: "", kind: "pct" },
  { label: "Clique para se inscrever", value: "0.0%", delta: "", kind: "pct" },
  { label: "Apostando", value: "0.00x", delta: "", kind: "mult" },
  { label: "Sinalizado", value: "0", delta: "", kind: "num" },
  { label: "% sinalizado", value: "0.0%", delta: "", kind: "pct" },
];

export function emptyReport(slug = ""): Report {
  return {
    slug,
    panelName: "Barr4k",
    panelLogo: "",
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

/** Variação do card: só sinal e número, com o % fixo (vazio = sem variação) */
export const composeDelta = (raw: string) => {
  const n = raw.replace(/[^\d.,+-]/g, "").replace(/(?!^)[+-]/g, "");
  return /\d/.test(n) ? `${n}%` : "";
};
