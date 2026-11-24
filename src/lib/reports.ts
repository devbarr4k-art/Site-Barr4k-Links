import { del, list, put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { blobReady } from "@/lib/config";
import { CURRENCIES, DEFAULT_METRICS, REPORT_THEMES, SLUG_RE, type Report, type ReportMetric, type ReportRow } from "@/lib/report-types";

// Cada painel = reports/<link>.json no Vercel Blob (mesmo esquema do site/config.json).
// No PC sem o token, fica numa pasta temporária só pra testar.
const blobPath = (slug: string) => `reports/${slug}.json`;
const LOCAL_DIR = path.join(os.tmpdir(), "barr4k-links", "reports");

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(1e12, v)) : 0);
const okPhoto = (v: string) => v === "" || v.startsWith("/") || /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(v);

/** Limpa o que veio do painel; null se o link for inválido */
export function cleanReport(raw: unknown): Report | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const slug = str(r.slug, 40).toLowerCase();
  if (!SLUG_RE.test(slug)) return null;
  const metrics: ReportMetric[] = Array.isArray(r.metrics)
    ? r.metrics.slice(0, 16).map((m) => {
        const o = (m ?? {}) as Record<string, unknown>;
        return { label: str(o.label, 40), value: str(o.value, 24), delta: str(o.delta, 12) };
      })
    : DEFAULT_METRICS;
  const rows: ReportRow[] = Array.isArray(r.rows)
    ? r.rows
        .map((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          return { date: str(o.date, 10), clicks: num(o.clicks), signups: num(o.signups), ftd: num(o.ftd), deposits: num(o.deposits), flagged: Math.min(100, num(o.flagged)) };
        })
        .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-1000)
    : [];
  const photo = str(r.userPhoto, 400);
  return {
    slug,
    panelName: str(r.panelName, 40) || "Barr4k",
    userName: str(r.userName, 40),
    userPhoto: okPhoto(photo) ? photo : "",
    theme: REPORT_THEMES.some((t) => t.key === r.theme) ? (r.theme as Report["theme"]) : "roxo",
    currency: CURRENCIES.includes(r.currency as Report["currency"]) ? (r.currency as Report["currency"]) : "$",
    metrics,
    rows,
    updatedAt: str(r.updatedAt, 40) || new Date().toISOString(),
  };
}

function publicBase() {
  const id = (process.env.BLOB_STORE_ID ?? "").replace(/^store_/, "") || (process.env.BLOB_READ_WRITE_TOKEN ?? "").split("_")[3];
  return `https://${(id ?? "").toLowerCase()}.public.blob.vercel-storage.com`;
}

/** Lê o painel mais recente (o ?v= fura o cache de 60 s da CDN) */
export async function getReport(slug: string): Promise<Report | null> {
  if (!SLUG_RE.test(slug)) return null;
  let raw: unknown = null;
  if (blobReady()) {
    const res = await fetch(`${publicBase()}/${blobPath(slug)}?v=${Date.now()}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return null;
    raw = await res.json().catch(() => null);
  } else if (!process.env.VERCEL) {
    raw = await fs.readFile(path.join(LOCAL_DIR, `${slug}.json`), "utf8").then(JSON.parse).catch(() => null);
  }
  return raw ? cleanReport(raw) : null;
}

async function slugs(): Promise<string[]> {
  if (blobReady()) {
    const { blobs } = await list({ prefix: "reports/", limit: 1000 });
    return blobs.map((b) => b.pathname.replace(/^reports\//, "").replace(/\.json$/, ""));
  }
  if (process.env.VERCEL) return [];
  const files = await fs.readdir(LOCAL_DIR).catch(() => [] as string[]);
  return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
}

/** Todos os painéis, do mais recente pro mais antigo */
export async function listReports(): Promise<Report[]> {
  const all = await Promise.all((await slugs()).map(getReport));
  return all.filter((r): r is Report => !!r).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export const reportExists = async (slug: string) => (await slugs()).includes(slug);

export async function saveReport(r: Report) {
  const json = JSON.stringify(r);
  if (blobReady()) {
    await put(blobPath(r.slug), json, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 });
    return;
  }
  if (process.env.VERCEL) throw new Error("Vercel Blob não está ligado ao projeto (falta BLOB_READ_WRITE_TOKEN).");
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, `${r.slug}.json`), json, "utf8");
}

export async function deleteReport(slug: string) {
  if (!SLUG_RE.test(slug)) return;
  if (blobReady()) {
    const { blobs } = await list({ prefix: blobPath(slug), limit: 1 });
    const b = blobs.find((x) => x.pathname === blobPath(slug));
    if (b) await del(b.url);
    return;
  }
  await fs.rm(path.join(LOCAL_DIR, `${slug}.json`), { force: true });
}
