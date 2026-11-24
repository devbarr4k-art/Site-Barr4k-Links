"use client";

import { useCallback, useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import { FiArrowDown, FiArrowLeft, FiArrowUp, FiChevronLeft, FiChevronRight, FiEdit2, FiExternalLink, FiPlus, FiTrash2, FiUpload, FiZap } from "react-icons/fi";
import { BASE, withBase } from "@/lib/base";
import { compose, composeDelta, convRate, CURRENCIES, emptyReport, METRIC_KINDS, rawOf, REPORT_THEMES, SLUG_RE, toSlug, type MetricKind, type Report, type ReportMetric, type ReportRow } from "@/lib/report-types";

const PER_PAGE = 10;
const api = `${BASE}/api/admin/reports`;

async function uploadFile(file: File): Promise<string> {
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+/, "") || "foto";
  const blob = await upload(`uploads/${safe}`, file, { access: "public", handleUploadUrl: `${BASE}/api/admin/upload` });
  return blob.url;
}

const fmtDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Paginação simples (‹ 1 2 3 ›) usada nas duas listas */
function Pager({ page, pages, onPage, total, label }: { page: number; pages: number; onPage: (p: number) => void; total: number; label: string }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5 text-sm" aria-label="Páginas">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page === 0} className="p-2 text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-25" aria-label="Página anterior">
        <FiChevronLeft />
      </button>
      {Array.from({ length: pages }, (_, p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPage(p)}
          className={`h-8 min-w-8 rounded-lg px-2 font-bold ${p === page ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"}`}
        >
          {p + 1}
        </button>
      ))}
      <button type="button" onClick={() => onPage(page + 1)} disabled={page === pages - 1} className="p-2 text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-25" aria-label="Próxima página">
        <FiChevronRight />
      </button>
      <span className="ml-2 text-xs text-[var(--muted)]">
        {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, total)} de {total} {label}
      </span>
    </nav>
  );
}

export default function Reports({ canSave, canUpload }: { canSave: boolean; canUpload: boolean }) {
  const [list, setList] = useState<Report[] | null>(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ report: Report; oldSlug: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState("");

  const load = useCallback(async () => {
    setErr("");
    const r = await fetch(api, { cache: "no-store" }).catch(() => null);
    if (r?.status === 401) return window.location.reload();
    const d = r?.ok ? ((await r.json()) as { reports: Report[] }) : null;
    if (!d) return setErr("Não deu pra carregar os painéis. Tente de novo.");
    setList(d.reports);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function remove(slug: string) {
    const r = await fetch(api, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).catch(() => null);
    setConfirmDel("");
    if (r?.ok) setList((l) => l?.filter((x) => x.slug !== slug) ?? null);
    else setErr("Não deu pra apagar. Tente de novo.");
  }

  if (editing)
    return (
      <ReportEditor
        initial={editing.report}
        oldSlug={editing.oldSlug}
        canSave={canSave}
        canUpload={canUpload}
        taken={(list ?? []).map((r) => r.slug).filter((s) => s !== editing.oldSlug)}
        onBack={() => (setEditing(null), load())}
      />
    );

  const items = list ?? [];
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const cur = Math.min(page, pages - 1);

  return (
    <main translate="no" className="notranslate min-h-svh px-4 py-8 pb-32 flex justify-center">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a href={`${BASE}/admin`} className="btn-ghost" aria-label="Voltar pro painel da página">
              <FiArrowLeft />
            </a>
            <h1 className="text-2xl font-extrabold">Painéis</h1>
          </div>
          <button type="button" onClick={() => setEditing({ report: emptyReport(), oldSlug: "" })} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5">
            <FiPlus /> Novo painel
          </button>
        </header>

        <p className="hint -mt-3">
          Cada painel tem o próprio link (barr4k.com/trader/p/…). Você escolhe o link, o nome, a foto, o tema e os números; quem abrir o link vê os números subindo.
        </p>

        {!canSave && <p className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-200">O Vercel Blob não está ligado a este projeto, então não dá pra salvar.</p>}
        {err && <p className="text-sm text-red-300">{err}</p>}

        {list === null && !err ? (
          <p className="hint">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="panel text-center text-sm text-[var(--muted)]">Nenhum painel ainda. Clique em &ldquo;Novo painel&rdquo;.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.slice(cur * PER_PAGE, (cur + 1) * PER_PAGE).map((r) => (
              <li key={r.slug} className="panel !flex-row items-center gap-3">
                <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--accent)] text-xs font-black">
                  {r.userName.slice(0, 2).toUpperCase() || "B4"}
                  {r.userPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={withBase(r.userPhoto)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {r.panelName}
                    {r.userName && <span className="font-normal text-[var(--muted)]"> · {r.userName}</span>}
                  </p>
                  <a href={`${BASE}/p/${r.slug}`} target="_blank" className="truncate text-xs text-[var(--accent-2)] hover:underline">
                    /trader/p/{r.slug}
                  </a>
                </div>
                {confirmDel === r.slug ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[var(--muted)]">Apagar?</span>
                    <button type="button" onClick={() => remove(r.slug)} className="rounded-lg bg-red-500/80 px-3 py-1.5 font-bold text-white">
                      Sim
                    </button>
                    <button type="button" onClick={() => setConfirmDel("")} className="btn-ghost !py-1.5">
                      Não
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <a href={`${BASE}/p/${r.slug}`} target="_blank" className="btn-ghost" aria-label="Abrir painel">
                      <FiExternalLink />
                    </a>
                    <button type="button" onClick={() => setEditing({ report: r, oldSlug: r.slug })} className="btn-ghost">
                      <FiEdit2 /> Editar
                    </button>
                    <button type="button" onClick={() => setConfirmDel(r.slug)} className="btn-ghost text-red-300" aria-label="Apagar painel">
                      <FiTrash2 />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <Pager page={cur} pages={pages} onPage={setPage} total={items.length} label="painéis" />
      </div>
    </main>
  );
}

/* ───────────── editor de um painel ───────────── */
function ReportEditor({
  initial,
  oldSlug,
  canSave,
  canUpload,
  taken,
  onBack,
}: {
  initial: Report;
  oldSlug: string;
  canSave: boolean;
  canUpload: boolean;
  taken: string[];
  onBack: () => void;
}) {
  const [r, setR] = useState<Report>(initial);
  const [saved, setSaved] = useState(oldSlug); // link já salvo (vira o "oldSlug" do próximo salvar)
  const [slugTouched, setSlugTouched] = useState(!!oldSlug);
  const [status, setStatus] = useState<{ type: "ok" | "err" | "busy"; msg: string } | null>(null);
  const [uploading, setUploading] = useState<"" | "photo" | "logo">("");
  const [rowPage, setRowPage] = useState(() => Math.max(0, Math.ceil(initial.rows.length / PER_PAGE) - 1));

  const set = (patch: Partial<Report>) => setR((c) => ({ ...c, ...patch }));
  const setMetric = (i: number, patch: Partial<ReportMetric>) => set({ metrics: r.metrics.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const moveMetric = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= r.metrics.length) return;
    const l = [...r.metrics];
    [l[i], l[j]] = [l[j], l[i]];
    set({ metrics: l });
  };
  const setRow = (i: number, patch: Partial<ReportRow>) => set({ rows: r.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  const slugOk = SLUG_RE.test(r.slug);
  const slugTaken = taken.includes(r.slug);

  function addDay() {
    const last = r.rows[r.rows.length - 1];
    // dia seguinte ao último (ou hoje, se a tabela estiver vazia)
    const [y, m, dd] = last ? last.date.split("-").map(Number) : [0, 0, 0];
    const d = last ? new Date(y, m - 1, dd + 1) : new Date();
    const rows = [...r.rows, { date: isoDay(d), clicks: 0, signups: 0, ftd: 0, deposits: 0, flagged: 0 }];
    set({ rows });
    setRowPage(Math.ceil(rows.length / PER_PAGE) - 1);
  }

  /** Preenche os cards principais com a soma dos dias */
  function fillFromDays() {
    const t = r.rows.reduce((a, x) => ({ clicks: a.clicks + x.clicks, signups: a.signups + x.signups, ftd: a.ftd + x.ftd, deposits: a.deposits + x.deposits }), { clicks: 0, signups: 0, ftd: 0, deposits: 0 });
    const money = r.currency === "R$" ? `R$ ${t.deposits.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${r.currency}${t.deposits.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const auto: Record<string, string> = {
      cliques: t.clicks.toLocaleString("en-US"),
      inscrições: t.signups.toLocaleString("en-US"),
      "ftd #": t.ftd.toLocaleString("en-US"),
      "quantidade de depósitos": money,
      "taxa de conversão": `${convRate(t).toFixed(1)}%`,
      "clique para se inscrever": `${(t.clicks ? (t.signups / t.clicks) * 100 : 0).toFixed(1)}%`,
    };
    set({ metrics: r.metrics.map((m) => (auto[m.label.trim().toLowerCase()] !== undefined ? { ...m, value: auto[m.label.trim().toLowerCase()] } : m)) });
    setStatus({ type: "ok", msg: "Cards preenchidos com a soma dos dias. Clique em Salvar." });
  }

  async function save() {
    if (!slugOk) return setStatus({ type: "err", msg: "Escolha um link válido (letras minúsculas, números e hífen)." });
    if (slugTaken) return setStatus({ type: "err", msg: "Esse link já é de outro painel." });
    setStatus({ type: "busy", msg: "Salvando..." });
    const res = await fetch(api, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ report: r, oldSlug: saved }) }).catch(() => null);
    if (res?.status === 401) return window.location.reload();
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setStatus({ type: "err", msg: json.error || "Erro ao salvar." });
    setR(json.report);
    setSaved(json.report.slug);
    setStatus({ type: "ok", msg: "Salvo! O link já mostra a versão nova." });
  }

  const rowPages = Math.max(1, Math.ceil(r.rows.length / PER_PAGE));
  const rp = Math.min(rowPage, rowPages - 1);

  return (
    <main translate="no" className="notranslate min-h-svh px-4 py-8 pb-36 flex justify-center">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} className="btn-ghost" aria-label="Voltar pra lista">
              <FiArrowLeft />
            </button>
            <h1 className="text-2xl font-extrabold">{oldSlug ? "Editar painel" : "Novo painel"}</h1>
          </div>
          {saved && (
            <a href={`${BASE}/p/${saved}`} target="_blank" className="btn-ghost">
              <FiExternalLink /> Abrir painel
            </a>
          )}
        </header>

        {/* link e identidade */}
        <section className="panel">
          <h2 className="panel-title">Link e usuário</h2>
          <label className="flex flex-col gap-1.5">
            <span className="hint">Link do painel</span>
            <div className="flex items-center overflow-hidden rounded-[10px] border border-[var(--border)] bg-black/20 focus-within:border-[var(--accent)]">
              <span className="shrink-0 pl-3 text-sm text-[var(--muted)]">barr4k.com/trader/p/</span>
              <input
                className="w-full bg-transparent py-2.5 pr-3 text-sm font-bold outline-none"
                value={r.slug}
                placeholder="nome-do-usuario"
                onChange={(e) => (setSlugTouched(true), set({ slug: toSlug(e.target.value) }))}
              />
            </div>
            {!slugOk && r.slug !== "" && <span className="text-xs text-red-300">Use só letras minúsculas, números e hífen.</span>}
            {slugTaken && <span className="text-xs text-red-300">Esse link já é de outro painel.</span>}
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* logo do topo do painel (sem logo, aparece o nome em texto) */}
            <div className="flex flex-col gap-1.5">
              <span className="hint">Logo do topo (PNG sem fundo fica melhor)</span>
              <div className="flex items-center gap-2">
                <span className="grid h-[46px] min-w-0 flex-1 place-items-center overflow-hidden rounded-[10px] border border-[var(--border)] bg-black/30 px-3">
                  {r.panelLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={withBase(r.panelLogo)} alt="" className="max-h-8 max-w-full object-contain" />
                  ) : (
                    <span className="truncate text-xs text-[var(--muted)]">Sem logo: mostra &ldquo;{r.panelName}&rdquo;</span>
                  )}
                </span>
                <label className={`btn-ghost shrink-0 ${canUpload ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`} title={canUpload ? "" : "Envio só funciona com o Vercel Blob ligado"}>
                  <FiUpload /> {uploading === "logo" ? "Enviando..." : "Logo"}
                  <input
                    type="file"
                    hidden
                    accept="image/png,image/webp,image/jpeg"
                    disabled={!!uploading || !canUpload}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      setUploading("logo");
                      try {
                        set({ panelLogo: await uploadFile(f) });
                      } catch (er) {
                        setStatus({ type: "err", msg: (er as Error).message || "Falha no envio." });
                      }
                      setUploading("");
                    }}
                  />
                </label>
                {r.panelLogo && (
                  <button type="button" onClick={() => set({ panelLogo: "" })} className="btn-ghost shrink-0 text-red-300" aria-label="Remover logo">
                    <FiTrash2 />
                  </button>
                )}
              </div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="hint">Nome do usuário</span>
              <input
                className="field"
                value={r.userName}
                maxLength={40}
                onChange={(e) => set({ userName: e.target.value, ...(slugTouched ? {} : { slug: toSlug(e.target.value) }) })}
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--accent)] text-sm font-black">
              {r.userName.slice(0, 2).toUpperCase() || "B4"}
              {r.userPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={withBase(r.userPhoto)} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
            </span>
            <input className="field" placeholder="Foto do usuário (link) ou envie" value={r.userPhoto} onChange={(e) => set({ userPhoto: e.target.value.trim() })} />
            <label className={`btn-ghost shrink-0 ${canUpload ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`} title={canUpload ? "" : "Envio só funciona com o Vercel Blob ligado"}>
              <FiUpload /> {uploading === "photo" ? "Enviando..." : "Foto"}
              <input
                type="file"
                hidden
                accept="image/*"
                disabled={!!uploading || !canUpload}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setUploading("photo");
                  try {
                    set({ userPhoto: await uploadFile(f) });
                  } catch (er) {
                    setStatus({ type: "err", msg: (er as Error).message || "Falha no envio." });
                  }
                  setUploading("");
                }}
              />
            </label>
          </div>
        </section>

        {/* aparência */}
        <section className="panel">
          <h2 className="panel-title">Aparência</h2>
          <div className="flex flex-wrap gap-2">
            {REPORT_THEMES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => set({ theme: t.key })}
                className={`rounded-xl border px-4 py-2 text-sm font-bold ${r.theme === t.key ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3">
            <span className="hint">Moeda da tabela</span>
            <select
              className="field !w-auto"
              value={r.currency}
              onChange={(e) => {
                const currency = e.target.value as Report["currency"];
                // os cards de dinheiro trocam o símbolo junto
                set({ currency, metrics: r.metrics.map((m) => (m.kind === "money" ? { ...m, value: compose("money", rawOf(m.value), currency) } : m)) });
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/* cards */}
        <section className="panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="panel-title">Cards do resumo</h2>
            <button type="button" onClick={fillFromDays} disabled={!r.rows.length} className="btn-ghost !text-xs disabled:opacity-40" title="Soma os dias da tabela e preenche Cliques, Inscrições, FTD, Depósitos e as taxas">
              <FiZap /> Preencher com a soma dos dias
            </button>
          </div>
          <p className="hint">Escolha o tipo de cada card: o símbolo ($, %, x) fica fixo e você digita só o número. O valor sobe do zero ao abrir o link. A variação é opcional: -33 fica vermelho, 12 fica verde.</p>
          <ul className="flex flex-col gap-2">
            {r.metrics.map((m, i) => (
              <li key={i} className="grid grid-cols-2 items-center gap-2 border-b border-[var(--border)] pb-2 last:border-0 sm:grid-cols-[minmax(0,1.3fr)_8.5rem_minmax(0,1fr)_6rem_auto] sm:border-0 sm:pb-0">
                <input className="field col-span-2 sm:col-span-1" value={m.label} placeholder="Nome do card" maxLength={40} onChange={(e) => setMetric(i, { label: e.target.value })} />
                <select className="field" value={m.kind} title="Tipo do valor" onChange={(e) => setMetric(i, { kind: e.target.value as MetricKind, value: compose(e.target.value as MetricKind, rawOf(m.value), r.currency) })}>
                  {METRIC_KINDS.map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.label}
                    </option>
                  ))}
                </select>
                {/* número com o símbolo fixo do lado (não dá pra apagar) */}
                <label className="field flex !p-0 items-center overflow-hidden focus-within:!border-[var(--accent)]">
                  {m.kind === "money" && <span className="pl-3 font-bold text-[var(--muted)]">{r.currency}</span>}
                  <input
                    className="w-full min-w-0 bg-transparent px-2.5 py-[.6rem] font-bold outline-none"
                    inputMode="decimal"
                    value={rawOf(m.value)}
                    placeholder="0"
                    maxLength={18}
                    onChange={(e) => setMetric(i, { value: compose(m.kind, e.target.value, r.currency) })}
                  />
                  {(m.kind === "pct" || m.kind === "mult") && <span className="pr-3 font-bold text-[var(--muted)]">{m.kind === "pct" ? "%" : "x"}</span>}
                </label>
                <label className="field flex !p-0 items-center overflow-hidden focus-within:!border-[var(--accent)]" title="Variação (opcional)">
                  <input
                    className="w-full min-w-0 bg-transparent px-2.5 py-[.6rem] outline-none"
                    inputMode="decimal"
                    value={m.delta.replace(/%$/, "")}
                    placeholder="±0"
                    maxLength={8}
                    onChange={(e) => setMetric(i, { delta: composeDelta(e.target.value) })}
                  />
                  <span className="pr-3 font-bold text-[var(--muted)]">%</span>
                </label>
                <div className="flex justify-end">
                  <button type="button" onClick={() => moveMetric(i, -1)} disabled={i === 0} className="p-1.5 text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-20" aria-label="Subir">
                    <FiArrowUp />
                  </button>
                  <button type="button" onClick={() => moveMetric(i, 1)} disabled={i === r.metrics.length - 1} className="p-1.5 text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-20" aria-label="Descer">
                    <FiArrowDown />
                  </button>
                  <button type="button" onClick={() => set({ metrics: r.metrics.filter((_, j) => j !== i) })} className="p-1.5 text-red-300" aria-label="Remover card">
                    <FiTrash2 />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {r.metrics.length < 16 && (
            <button type="button" onClick={() => set({ metrics: [...r.metrics, { label: "", value: "0", delta: "", kind: "num" }] })} className="btn-ghost self-start">
              <FiPlus /> Adicionar card
            </button>
          )}
        </section>

        {/* dias */}
        <section className="panel">
          <h2 className="panel-title">Dias (tabela e gráfico)</h2>
          <p className="hint">Uma linha por dia. O gráfico do topo usa os depósitos; Semana e Mês somam os dias. Taxa de conversão = FTD ÷ cliques.</p>
          {r.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--muted)]">
                    {["Data", "Cliques", "Inscrições", "FTD #", `Depósitos (${r.currency})`, "Sinalizado %", ""].map((h) => (
                      <th key={h} className="px-1 pb-2 font-bold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.rows.slice(rp * PER_PAGE, (rp + 1) * PER_PAGE).map((x, k) => {
                    const i = rp * PER_PAGE + k;
                    const numCell = (key: keyof Omit<ReportRow, "date">, step = "1") => (
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          min={0}
                          step={step}
                          className="field !px-2 !py-1.5 tabular-nums"
                          value={x[key]}
                          onChange={(e) => setRow(i, { [key]: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </td>
                    );
                    return (
                      <tr key={i}>
                        <td className="px-1 py-1">
                          <input type="date" className="field !px-2 !py-1.5" value={x.date} onChange={(e) => e.target.value && setRow(i, { date: e.target.value })} title={fmtDate(x.date)} />
                        </td>
                        {numCell("clicks")}
                        {numCell("signups")}
                        {numCell("ftd")}
                        {numCell("deposits", "0.01")}
                        {numCell("flagged", "0.01")}
                        <td className="px-1 py-1">
                          <button type="button" onClick={() => set({ rows: r.rows.filter((_, j) => j !== i) })} className="p-1.5 text-red-300" aria-label="Remover dia">
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={rp} pages={rowPages} onPage={setRowPage} total={r.rows.length} label="dias" />
          <button type="button" onClick={addDay} className="btn-ghost self-start">
            <FiPlus /> Adicionar dia
          </button>
        </section>

        {/* barra de salvar */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <p className={`min-w-0 flex-1 truncate text-sm ${status?.type === "err" ? "text-red-300" : "text-[var(--muted)]"}`}>{status?.msg}</p>
            <button type="button" onClick={save} disabled={!canSave || status?.type === "busy"} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5">
              Salvar
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
