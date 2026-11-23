import { put } from "@vercel/blob";
import { unstable_cache } from "next/cache";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { defaultConfig, ICON_NAMES, type IconName, type PageConfig } from "@/links";

// Sem banco: o conteúdo inteiro é um JSON no Vercel Blob (site/config.json).
// Precisa do Blob store ligado ao projeto na Vercel (cria a variável BLOB_READ_WRITE_TOKEN sozinho).
// Sem o token (rodando no PC), salva num arquivo na pasta temporária do PC só pra testar o painel.
export const CONFIG_TAG = "page-config";
const BLOB_PATH = "site/config.json";
const LOCAL_FILE = path.join(os.tmpdir(), "barr4k-links", "config.json");

export const blobReady = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
// Na Vercel sem Blob ligado não dá pra salvar; no PC sempre dá (arquivo local)
export const canSave = () => blobReady() || !process.env.VERCEL;

/** https://<loja>.public.blob.vercel-storage.com/site/config.json */
function publicUrl() {
  const id = (process.env.BLOB_STORE_ID ?? "").replace(/^store_/, "") || (process.env.BLOB_READ_WRITE_TOKEN ?? "").split("_")[3];
  return `https://${(id ?? "").toLowerCase()}.public.blob.vercel-storage.com/${BLOB_PATH}`;
}

async function readRaw(): Promise<unknown | null> {
  if (blobReady()) {
    // o link público fica 60 s no cache da CDN; o ?v= força a versão que acabou de ser salva
    const res = await fetch(`${publicUrl()}?v=${Date.now()}`, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`blob ${res.status}`);
    return res.json();
  }
  if (process.env.VERCEL) return null;
  try {
    return JSON.parse(await fs.readFile(LOCAL_FILE, "utf8"));
  } catch {
    return null;
  }
}

// O resultado fica em cache até o admin salvar (o salvar chama revalidateTag),
// então a página não busca o arquivo a cada visita.
export const getConfig = unstable_cache(
  async (): Promise<PageConfig> => {
    try {
      const raw = await readRaw();
      return raw ? sanitizeConfig(raw) : defaultConfig;
    } catch (e) {
      console.error("[config] leitura falhou", e);
      return defaultConfig;
    }
  },
  // Chave inclui o deploy: a cada deploy novo o padrão do código é relido (o salvar do admin usa a tag)
  [CONFIG_TAG, process.env.VERCEL_DEPLOYMENT_ID ?? "local"],
  { tags: [CONFIG_TAG] },
);

export async function saveConfig(config: PageConfig) {
  const json = JSON.stringify(config);
  if (blobReady()) {
    await put(BLOB_PATH, json, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return;
  }
  if (process.env.VERCEL) throw new Error("Vercel Blob não está ligado ao projeto (falta BLOB_READ_WRITE_TOKEN).");
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, json, "utf8");
}

// ---------- validação: só aceita o formato certo e links seguros ----------

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const icon = (v: unknown): IconName | undefined =>
  (ICON_NAMES as readonly string[]).includes(v as string) ? (v as IconName) : undefined;

// Bloqueia javascript: e afins. Aceita http(s), mailto, tel e caminhos do próprio site (/foto.png)
export function safeUrl(v: unknown): string {
  const s = str(v, 1000);
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+/.test(s)) return "https://" + s; // "instagram.com/x" vira https://
  return "";
}

// "@vitinho" ou "vitinho" vira o link do perfil na rede escolhida; e-mail solto vira mailto:
const PROFILE_URL: Partial<Record<IconName, (u: string) => string>> = {
  twitch: (u) => `https://www.twitch.tv/${u}`,
  youtube: (u) => `https://www.youtube.com/@${u}`,
  instagram: (u) => `https://www.instagram.com/${u}`,
  x: (u) => `https://x.com/${u}`,
  tiktok: (u) => `https://www.tiktok.com/@${u}`,
  kick: (u) => `https://kick.com/${u}`,
  telegram: (u) => `https://t.me/${u}`,
};

export function smartUrl(v: unknown, kind?: IconName): string {
  // "mailto:mailto:x" (bug antigo) volta a ser um mailto só
  const s = str(v, 1000).replace(/^(mailto:)+/i, (m) => (m ? "mailto:" : m));
  if (!s) return "";
  if (/^mailto:/i.test(s)) return s;
  if (/^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/.test(s)) return "mailto:" + s; // e-mail solto
  if (kind === "whatsapp" && /^[\d\s()+-]{8,}$/.test(s)) return "https://wa.me/" + s.replace(/\D/g, "");
  const handle = s.match(/^@?([\w.]{2,40})$/);
  if (handle && kind && PROFILE_URL[kind] && !handle[1].includes("..") && !/\.(com|br|net|tv|gg|app)$/i.test(handle[1])) {
    return PROFILE_URL[kind]!(handle[1]);
  }
  const safe = safeUrl(s);
  if (safe) return safe;
  // Qualquer outra coisa é aceita como foi digitada, menos esquemas perigosos (javascript:, data: ...)
  return /^\s*[a-z][\w+.-]*:/i.test(s) ? "" : s;
}

// Confere tudo e devolve a lista do que está errado, em português, pra mostrar no painel.
// Itens totalmente vazios (adicionados e não preenchidos) são só ignorados.
// O painel salva qualquer coisa (pedido do dono). Mantido o formato com "problems" pra o painel continuar compatível.
export function validateConfig(raw: unknown): { config: PageConfig; problems: string[] } {
  return { config: sanitizeConfig(raw), problems: [] };
}

export function sanitizeConfig(raw: unknown): PageConfig {
  const r = (raw ?? {}) as Record<string, any>;
  const p = (r.profile ?? {}) as Record<string, any>;
  const d = defaultConfig.profile;
  // Campo nunca salvo = usa o padrão; string vazia salva = vazio de propósito
  const opt = (v: unknown, def: string, max = 200) => (v === undefined ? def : str(v, max));
  return {
    profile: {
      name: str(p.name, 60) || d.name,
      handle: str(p.handle, 40),
      bio: str(p.bio, 200),
      avatar: safeUrl(p.avatar) || d.avatar,
      verified: p.verified === undefined ? d.verified : !!p.verified,
      heroVideo: safeUrl(p.heroVideo),
      heroVideoMobile: safeUrl(p.heroVideoMobile),
      heroPoster: safeUrl(p.heroPoster),
      ctaTitle: opt(p.ctaTitle, d.ctaTitle, 80),
      ctaLabel: opt(p.ctaLabel, d.ctaLabel, 40),
      ctaUrl: p.ctaUrl === undefined ? d.ctaUrl : smartUrl(p.ctaUrl),
      footerNote: opt(p.footerNote, d.footerNote, 240),
    },
    partners: (Array.isArray(r.partners) ? r.partners : defaultConfig.partners).slice(0, 12).flatMap((x: any) => {
      const image = safeUrl(x?.image);
      if (!image) return [];
      return [{ name: str(x?.name, 40), image, url: smartUrl(x?.url), code: str(x?.code, 30) || undefined }];
    }),
    highlights: (Array.isArray(r.highlights) ? r.highlights : defaultConfig.highlights).slice(0, 6).flatMap((h: any) => {
      const title = str(h?.title, 40);
      const text = str(h?.text, 140);
      return title || text ? [{ icon: icon(h?.icon), title, text }] : [];
    }),
    socials: (Array.isArray(r.socials) ? r.socials : []).slice(0, 12).flatMap((s: any) => {
      const i = icon(s?.icon);
      const url = smartUrl(s?.url, i);
      return i ? [{ icon: i, url, label: str(s?.label, 40) || i }] : [];
    }),
    links: (Array.isArray(r.links) ? r.links : []).slice(0, 30).flatMap((l: any) => {
      const label = str(l?.label, 80);
      const url = smartUrl(l?.url, icon(l?.icon));
      if (!label && !url) return [];
      return [{ label: label || url, url, icon: icon(l?.icon), sub: str(l?.sub, 80) || undefined, image: safeUrl(l?.image) || undefined, code: str(l?.code, 30) || undefined, highlight: !!l?.highlight }];
    }),
  };
}
