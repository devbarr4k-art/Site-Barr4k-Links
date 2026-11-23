"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { FiArrowUp, FiArrowDown, FiTrash2, FiPlus, FiUpload, FiExternalLink, FiLogOut, FiCheck } from "react-icons/fi";
import { BASE } from "@/lib/base";
import { HIGHLIGHT_COLORS, ICON_NAMES, type Highlight, type IconName, type LinkItem, type PageConfig, type Partner, type Social } from "@/links";
import { ICON_LABELS } from "@/lib/icons";

type Kind = "image" | "video";

// Manda o arquivo direto do navegador pro Vercel Blob (a rota só dá a permissão)
async function uploadFile(file: File): Promise<string> {
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+/, "") || "arquivo";
  const blob = await upload(`uploads/${safe}`, file, { access: "public", handleUploadUrl: `${BASE}/api/admin/upload` });
  return blob.url;
}

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

export default function Editor({ initial, canSave, canUpload }: { initial: PageConfig; canSave: boolean; canUpload: boolean }) {
  const [cfg, setCfg] = useState<PageConfig>(initial);
  const [status, setStatus] = useState<{ type: "ok" | "err" | "busy"; msg: string } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const setProfile = (patch: Partial<PageConfig["profile"]>) => setCfg((c) => ({ ...c, profile: { ...c.profile, ...patch } }));
  const setLinks = (links: LinkItem[]) => setCfg((c) => ({ ...c, links }));
  const setSocials = (socials: Social[]) => setCfg((c) => ({ ...c, socials }));
  const setPartners = (partners: Partner[]) => setCfg((c) => ({ ...c, partners }));
  const setHighlights = (highlights: Highlight[]) => setCfg((c) => ({ ...c, highlights }));
  const editLink = (i: number, patch: Partial<LinkItem>) => setLinks(cfg.links.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const editSocial = (i: number, patch: Partial<Social>) => setSocials(cfg.socials.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const editPartner = (i: number, patch: Partial<Partner>) => setPartners(cfg.partners.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const editHighlight = (i: number, patch: Partial<Highlight>) => setHighlights(cfg.highlights.map((h, k) => (k === i ? { ...h, ...patch } : h)));

  // Sobe o arquivo e entrega a URL pra quem pediu
  const pick = (id: string, onUrl: (url: string) => void) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(id);
    try {
      onUrl(await uploadFile(file));
      setStatus({ type: "ok", msg: "Arquivo enviado. Clique em Salvar para publicar." });
    } catch (err) {
      setStatus({ type: "err", msg: (err as Error).message || "Falha no envio." });
    }
    setUploading(null);
  };

  const save = async () => {
    setStatus({ type: "busy", msg: "Salvando..." });
    const res = await fetch(`${BASE}/api/admin/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) return window.location.reload();
    if (!res.ok) return setStatus({ type: "err", msg: json.error || "Erro ao salvar." });
    setCfg(json.config);
    setStatus({ type: "ok", msg: "Salvo! A página já está atualizada." });
  };

  const logout = async () => {
    await fetch(`${BASE}/api/admin/logout`, { method: "POST" });
    window.location.reload();
  };

  const UploadBtn = ({ id, kind, label, onUrl }: { id: string; kind: Kind; label: string; onUrl: (url: string) => void }) => (
    <label className={`btn-ghost shrink-0 ${canUpload ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`} title={canUpload ? "" : "Upload só funciona com o Vercel Blob ligado"}>
      <FiUpload /> {uploading === id ? "Enviando..." : label}
      <input type="file" hidden accept={kind === "image" ? "image/*" : "video/mp4,video/webm"} onChange={pick(id, onUrl)} disabled={!!uploading || !canUpload} />
    </label>
  );

  const IconSelect = ({ value, onChange, allowNone }: { value?: IconName; onChange: (v: IconName | undefined) => void; allowNone?: boolean }) => (
    <select className="field flex-1 sm:flex-none sm:w-40" value={value ?? ""} onChange={(e) => onChange((e.target.value || undefined) as IconName | undefined)}>
      {allowNone && <option value="">Sem ícone</option>}
      {ICON_NAMES.map((n) => <option key={n} value={n}>{ICON_LABELS[n]}</option>)}
    </select>
  );

  return (
    <main className="min-h-svh px-4 py-8 pb-32 flex justify-center">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold">Painel</h1>
          <div className="flex gap-2">
            <a href={BASE} target="_blank" className="btn-ghost"><FiExternalLink /> Ver página</a>
            <button onClick={logout} className="btn-ghost" aria-label="Sair"><FiLogOut /></button>
          </div>
        </header>

        {!canSave && (
          <p className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-200 text-sm p-4">
            O Vercel Blob ainda não está ligado a este projeto. Na Vercel: Storage → Create → Blob → conectar ao projeto, e fazer um novo deploy.
          </p>
        )}
        {canSave && !canUpload && (
          <p className="rounded-xl border border-white/10 bg-white/5 text-gray-300 text-sm p-4">
            Modo local: salvar funciona (num arquivo temporário do PC), mas o envio de imagens/vídeos só funciona na Vercel com o Blob ligado. Dá pra colar o link da imagem no campo.
          </p>
        )}

        {/* Capa */}
        <section className="panel">
          <h2 className="panel-title">Capa do topo</h2>
          <p className="hint">Vídeo em loop, sem som, no topo da página (deitado, 1920x1080; no celular corta as laterais, deixe o importante no centro). A imagem aparece enquanto o vídeo carrega, ou sozinha se não tiver vídeo.</p>
          {cfg.profile.heroVideo ? (
            <video src={cfg.profile.heroVideo} poster={cfg.profile.heroPoster || undefined} muted loop autoPlay playsInline className="w-full aspect-video object-cover rounded-xl border border-white/10" />
          ) : cfg.profile.heroPoster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cfg.profile.heroPoster} alt="" className="w-full aspect-video object-cover rounded-xl border border-white/10" />
          ) : null}
          <div className="flex gap-2">
            <input className="field" placeholder="Vídeo (1920x1080) .mp4" value={cfg.profile.heroVideo} onChange={(e) => setProfile({ heroVideo: e.target.value })} />
            <UploadBtn id="heroVideo" kind="video" label="Vídeo" onUrl={(u) => setProfile({ heroVideo: u })} />
          </div>
          <div className="flex gap-2">
            <input className="field" placeholder="Vídeo em pé pro celular (1080x1920) — opcional" value={cfg.profile.heroVideoMobile} onChange={(e) => setProfile({ heroVideoMobile: e.target.value })} />
            <UploadBtn id="heroVideoMobile" kind="video" label="Celular" onUrl={(u) => setProfile({ heroVideoMobile: u })} />
          </div>
          <div className="flex gap-2">
            <input className="field" placeholder="Imagem da capa" value={cfg.profile.heroPoster} onChange={(e) => setProfile({ heroPoster: e.target.value })} />
            <UploadBtn id="heroPoster" kind="image" label="Imagem" onUrl={(u) => setProfile({ heroPoster: u })} />
          </div>
          {(cfg.profile.heroVideo || cfg.profile.heroPoster) && (
            <button className="text-sm text-red-300 self-start" onClick={() => setProfile({ heroVideo: "", heroVideoMobile: "", heroPoster: "" })}>Remover capa</button>
          )}
        </section>

        {/* Perfil */}
        <section className="panel">
          <h2 className="panel-title">Perfil</h2>
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cfg.profile.avatar} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-[var(--border)] bg-neutral-900 shrink-0" />
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <UploadBtn id="avatar" kind="image" label="Trocar foto" onUrl={(u) => setProfile({ avatar: u })} />
              <input className="field text-xs" placeholder="ou link da imagem" value={cfg.profile.avatar} onChange={(e) => setProfile({ avatar: e.target.value })} />
            </div>
          </div>
          <label className="lbl">Nome<input className="field" value={cfg.profile.name} onChange={(e) => setProfile({ name: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm text-gray-300 select-none">
            <input type="checkbox" className="accent-[var(--accent)] w-4 h-4" checked={cfg.profile.verified} onChange={(e) => setProfile({ verified: e.target.checked })} />
            Selo de verificado ao lado do nome
          </label>
          <label className="lbl">@<input className="field" value={cfg.profile.handle} onChange={(e) => setProfile({ handle: e.target.value })} /></label>
          <label className="lbl">Bio<textarea className="field min-h-20" value={cfg.profile.bio} onChange={(e) => setProfile({ bio: e.target.value })} /></label>
        </section>

        {/* Redes */}
        <section className="panel">
          <h2 className="panel-title">Redes (ícones redondos)</h2>
          {cfg.socials.map((s, i) => (
            <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <IconSelect value={s.icon} onChange={(v) => v && editSocial(i, { icon: v, label: ICON_LABELS[v] })} />
              <input className="field order-last sm:order-none basis-full sm:basis-auto sm:flex-1" placeholder="https://... ou @usuario" value={s.url} onChange={(e) => editSocial(i, { url: e.target.value })} />
              <RowActions onUp={() => setSocials(move(cfg.socials, i, -1))} onDown={() => setSocials(move(cfg.socials, i, 1))} onDelete={() => setSocials(cfg.socials.filter((_, k) => k !== i))} />
            </div>
          ))}
          <button className="btn-ghost self-start" onClick={() => setSocials([...cfg.socials, { icon: "instagram", label: "Instagram", url: "" }])}><FiPlus /> Adicionar rede</button>
        </section>

        {/* Botões */}
        <section className="panel">
          <h2 className="panel-title">Botões</h2>
          {cfg.links.map((l, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-black/40 p-3 flex flex-col gap-2">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <IconSelect allowNone value={l.icon} onChange={(v) => editLink(i, { icon: v })} />
                <input className="field font-bold order-last sm:order-none basis-full sm:basis-auto sm:flex-1" placeholder="Texto do botão" value={l.label} onChange={(e) => editLink(i, { label: e.target.value })} />
                <RowActions onUp={() => setLinks(move(cfg.links, i, -1))} onDown={() => setLinks(move(cfg.links, i, 1))} onDelete={() => setLinks(cfg.links.filter((_, k) => k !== i))} />
              </div>
              <input className="field" placeholder="Link (https://...)" value={l.url} onChange={(e) => editLink(i, { url: e.target.value })} />
              <div className="flex items-center gap-2">
                {l.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.image} alt="" className="h-9 w-16 object-contain rounded-md bg-[#0d0c16] border border-white/10 p-1 shrink-0" />
                )}
                <input className="field text-sm" placeholder="Logo no lugar do ícone: PNG branco, fundo transparente (opcional)" value={l.image ?? ""} onChange={(e) => editLink(i, { image: e.target.value })} />
                <UploadBtn id={`link-${i}`} kind="image" label="Logo" onUrl={(u) => editLink(i, { image: u })} />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input className="field text-sm" placeholder="Texto pequeno embaixo (opcional)" value={l.sub ?? ""} onChange={(e) => editLink(i, { sub: e.target.value })} />
                <input className="field text-sm sm:w-44 uppercase" placeholder="Código/cupom (opcional)" value={l.code ?? ""} onChange={(e) => editLink(i, { code: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300 select-none">
                <input type="checkbox" className="accent-[var(--accent)] w-4 h-4" checked={!!l.highlight} onChange={(e) => editLink(i, { highlight: e.target.checked })} />
                Destaque (botão pulsando)
              </label>
              {l.highlight && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
                  <span>Cor:</span>
                  {HIGHLIGHT_COLORS.map((c) => {
                    const on = (l.color ?? "") === c.value;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        title={c.name}
                        aria-label={c.name}
                        aria-pressed={on}
                        onClick={() => editLink(i, { color: c.value || undefined })}
                        className={`w-7 h-7 rounded-full border-2 transition ${on ? "border-white scale-110" : "border-white/20 hover:border-white/60"}`}
                        style={{ background: c.value || "linear-gradient(135deg, #9a4dff, #5b21d6)" }}
                      />
                    );
                  })}
                  {/* qualquer outra cor */}
                  <label
                    title="Outra cor"
                    className={`relative w-7 h-7 rounded-full border-2 cursor-pointer overflow-hidden ${l.color && !HIGHLIGHT_COLORS.some((c) => c.value === l.color) ? "border-white scale-110" : "border-white/20 hover:border-white/60"}`}
                    style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
                  >
                    <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={l.color || "#8b3dff"} onChange={(e) => editLink(i, { color: e.target.value })} />
                  </label>
                </div>
              )}
            </div>
          ))}
          <button className="btn-ghost self-start" onClick={() => setLinks([...cfg.links, { label: "", url: "" }])}><FiPlus /> Adicionar botão</button>
        </section>

        {/* Parceiros */}
        <section className="panel">
          <h2 className="panel-title">Parceiros (artes com código)</h2>
          <p className="hint">Arte em pé (2:3, ex.: 320x480). Aparecem 3 por linha. Sem arte, o parceiro não aparece.</p>
          {cfg.partners.map((p, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-black/40 p-3 flex gap-3">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="w-16 aspect-[2/3] object-cover rounded-lg border border-white/10 shrink-0" />
              ) : (
                <div className="w-16 aspect-[2/3] rounded-lg border border-dashed border-white/20 shrink-0" />
              )}
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input className="field font-bold" placeholder="Nome" value={p.name} onChange={(e) => editPartner(i, { name: e.target.value })} />
                  <RowActions onUp={() => setPartners(move(cfg.partners, i, -1))} onDown={() => setPartners(move(cfg.partners, i, 1))} onDelete={() => setPartners(cfg.partners.filter((_, k) => k !== i))} />
                </div>
                <input className="field text-sm" placeholder="Link (https://...)" value={p.url} onChange={(e) => editPartner(i, { url: e.target.value })} />
                <div className="flex gap-2">
                  <input className="field text-sm uppercase" placeholder="Código (opcional)" value={p.code ?? ""} onChange={(e) => editPartner(i, { code: e.target.value })} />
                  <UploadBtn id={`partner-${i}`} kind="image" label="Arte" onUrl={(u) => editPartner(i, { image: u })} />
                </div>
                <input className="field text-xs" placeholder="ou link da arte" value={p.image} onChange={(e) => editPartner(i, { image: e.target.value })} />
              </div>
            </div>
          ))}
          <button className="btn-ghost self-start" onClick={() => setPartners([...cfg.partners, { name: "", image: "", url: "" }])}><FiPlus /> Adicionar parceiro</button>
        </section>

        {/* Destaques */}
        <section className="panel">
          <h2 className="panel-title">Cartões de destaque</h2>
          <p className="hint">Os cartões depois dos parceiros (ex.: Live todo dia, Sorteios...).</p>
          {cfg.highlights.map((h, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-black/40 p-3 flex flex-col gap-2">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <IconSelect allowNone value={h.icon} onChange={(v) => editHighlight(i, { icon: v })} />
                <input className="field font-bold order-last sm:order-none basis-full sm:basis-auto sm:flex-1" placeholder="Título" value={h.title} onChange={(e) => editHighlight(i, { title: e.target.value })} />
                <RowActions onUp={() => setHighlights(move(cfg.highlights, i, -1))} onDown={() => setHighlights(move(cfg.highlights, i, 1))} onDelete={() => setHighlights(cfg.highlights.filter((_, k) => k !== i))} />
              </div>
              <input className="field text-sm" placeholder="Texto" value={h.text} onChange={(e) => editHighlight(i, { text: e.target.value })} />
            </div>
          ))}
          <button className="btn-ghost self-start" onClick={() => setHighlights([...cfg.highlights, { title: "", text: "" }])}><FiPlus /> Adicionar cartão</button>
        </section>

        {/* Final */}
        <section className="panel">
          <h2 className="panel-title">Chamada final e rodapé</h2>
          <label className="lbl">Frase<input className="field" value={cfg.profile.ctaTitle} onChange={(e) => setProfile({ ctaTitle: e.target.value })} /></label>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="lbl sm:w-48">Texto do botão<input className="field" value={cfg.profile.ctaLabel} onChange={(e) => setProfile({ ctaLabel: e.target.value })} /></label>
            <label className="lbl flex-1">Link do botão<input className="field" value={cfg.profile.ctaUrl} onChange={(e) => setProfile({ ctaUrl: e.target.value })} /></label>
          </div>
          <p className="hint">Botão vazio = a chamada final some.</p>
          <label className="lbl">Aviso do rodapé<textarea className="field min-h-16" value={cfg.profile.footerNote} onChange={(e) => setProfile({ footerNote: e.target.value })} /></label>
        </section>
      </div>

      {/* Barra de salvar fixa embaixo */}
      <div className="fixed bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-black via-black/90 to-transparent flex justify-center">
        <div className="w-full max-w-2xl flex items-center gap-3">
          <p className={`flex-1 text-sm truncate ${status?.type === "err" ? "text-red-400" : status?.type === "ok" ? "text-green-400" : "text-gray-400"}`}>
            {status?.type === "ok" && <FiCheck className="inline mr-1" />}{status?.msg}
          </p>
          <button onClick={save} disabled={status?.type === "busy" || !!uploading || !canSave} className="btn-primary px-8 py-3">Salvar</button>
        </div>
      </div>
    </main>
  );
}

function RowActions({ onUp, onDown, onDelete }: { onUp: () => void; onDown: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0">
      <button className="icon-btn" onClick={onUp} aria-label="Subir"><FiArrowUp /></button>
      <button className="icon-btn" onClick={onDown} aria-label="Descer"><FiArrowDown /></button>
      <button className="icon-btn hover:!text-red-400" onClick={onDelete} aria-label="Remover"><FiTrash2 /></button>
    </div>
  );
}
