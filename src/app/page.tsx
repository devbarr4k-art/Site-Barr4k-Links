import { FiArrowRight, FiArrowUpRight } from "react-icons/fi";
import { MdVerified } from "react-icons/md";
import { getConfig } from "@/lib/config";
import { ICONS } from "@/lib/icons";
import HeroVideo from "./HeroVideo";
import CopyCode from "./CopyCode";

const TwitchIcon = ICONS.twitch;
const external =(url: string) => (url.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});
// Sem link salvo: mostra o item, mas sem levar a lugar nenhum
const linkProps = (url: string) => (url ? { href: url, ...external(url) } : { role: "presentation" as const, "aria-disabled": true });

// Cor clara (amarelo, verde-limão...) pede texto escuro
const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.68;
};

export default async function Home() {
  const { profile, socials, links, partners, highlights } = await getConfig();
  const hasCover = !!(profile.heroVideo || profile.heroPoster);

  return (
    <main className="relative min-h-svh overflow-x-clip">
      <div className="page-bg" />

      {/* Capa: a arte do Barr4k com o carro, em loop, se desfazendo no fundo */}
      <header className={`cover ${hasCover ? "" : "is-empty"}`}>
        {profile.heroVideo ? (
          <HeroVideo desktop={profile.heroVideo} mobile={profile.heroVideoMobile} poster={profile.heroPoster} />
        ) : profile.heroPoster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.heroPoster} alt="" className="cover-media" />
        ) : null}
        <div className="cover-fade" />
      </header>

      <div className="relative z-10 mx-auto w-full max-w-[440px] px-4 pb-10 -mt-24 sm:-mt-28 flex flex-col items-center">
        {/* Perfil */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={profile.avatar} alt={profile.name} width={112} height={112} className="avatar animate-rise" />

        <h1 className="name mt-4 flex items-center gap-2 animate-rise" style={{ animationDelay: "60ms" }}>
          {profile.name}
          {profile.verified && <MdVerified className="verified" aria-label="Verificado" />}
        </h1>
        {profile.handle && <p className="mt-1 text-sm font-semibold text-[var(--accent-2)]">{profile.handle}</p>}
        {profile.bio && <p className="mt-3 max-w-xs text-center text-[15px] leading-relaxed text-[var(--muted)]">{profile.bio}</p>}

        {socials.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            {socials.map((s, i) => {
              const Icon = ICONS[s.icon];
              return (
                <a key={i} aria-label={s.label} title={s.label} {...linkProps(s.url)} className="social-btn">
                  <Icon className="w-[18px] h-[18px]" />
                </a>
              );
            })}
          </div>
        )}

        {/* Botões */}
        <ul className="mt-7 w-full flex flex-col gap-3">
          {links.map((l, i) => {
            const Icon = l.icon ? ICONS[l.icon] : null;
            return (
              <li key={i} className="animate-rise" style={{ animationDelay: `${120 + i * 50}ms` }}>
                <div
                  className={`link-card group ${l.highlight ? "is-highlight" : ""} ${l.highlight && l.color ? "has-color" : ""}`}
                  style={l.highlight && l.color ? ({ "--hl": l.color, color: isLight(l.color) ? "#141018" : "#fff" } as React.CSSProperties) : undefined}
                >
                  {/* o link cobre o cartão todo; o botão de copiar fica por cima dele */}
                  <a {...linkProps(l.url)} className="absolute inset-0 z-0 rounded-[inherit]" aria-label={l.label} />
                  {l.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.image} alt="" className="link-logo" />
                  ) : Icon && (
                    <span className="link-icon">
                      <Icon className="w-6 h-6" />
                    </span>
                  )}
                  <span className="flex-1 min-w-0 text-left pointer-events-none">
                    <span className="block truncate font-bold">{l.label}</span>
                    {l.sub && <span className={`block text-[13px] leading-snug opacity-75 ${l.code ? "line-clamp-2" : "truncate"}`}>{l.sub}</span>}
                  </span>
                  {l.code ? (
                    <CopyCode code={l.code} className="relative z-10" />
                  ) : (
                    <FiArrowUpRight className="w-5 h-5 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Parceiros: as artes inteiras, com o código embaixo */}
        {partners.length > 0 && (
          <section className="mt-12 w-full">
            <h2 className="section-title">Parceiros</h2>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {partners.map((p, i) => (
                <div key={i} className="partner">
                  <a {...linkProps(p.url)} className="block" aria-label={p.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image} alt={p.name} loading="lazy" className="w-full aspect-[2/3] object-cover" />
                  </a>
                  {p.code && <CopyCode code={p.code} className="partner-code" />}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Por que acompanhar */}
        {highlights.length > 0 && (
          <section className="mt-14 w-full">
            <h2 className="section-title">Por que colar na live</h2>
            {/* 1º cartão largo com a arte ao fundo e selo "ao vivo"; os outros lado a lado */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {highlights.map((h, i) => {
                const Icon = h.icon ? ICONS[h.icon] : null;
                const main = i === 0;
                // último sozinho na linha também ocupa as duas colunas
                const wide = main || (i === highlights.length - 1 && (highlights.length - 1) % 2 === 1);
                return (
                  <div
                    key={i}
                    className={`feat animate-rise ${main ? "feat-main" : ""} ${wide ? "col-span-2" : ""}`}
                    style={{ animationDelay: `${i * 80}ms`, ...(main && profile.heroPoster ? { ["--feat-art" as string]: `url("${profile.heroPoster}")` } : {}) }}
                  >
                    {main ? <span className="live-pill"><span className="live-dot" />Ao vivo</span> : <span className="feat-num" aria-hidden>0{i + 1}</span>}
                    {Icon && (
                      <span className="feat-icon">
                        <Icon className="w-5 h-5" />
                      </span>
                    )}
                    {h.title && <p className="feat-title">{h.title}</p>}
                    {h.text && <p className="feat-text">{h.text}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Chamada final */}
        {profile.ctaLabel && profile.ctaUrl && (
          <section className="mt-12 w-full text-center">
            {profile.ctaTitle && <p className="cta-title">{profile.ctaTitle}</p>}
            <a {...linkProps(profile.ctaUrl)} className="cta-btn mt-5">
              {profile.ctaUrl.includes("twitch.tv") && <TwitchIcon className="w-5 h-5" />}
              {profile.ctaLabel}
              <FiArrowRight className="w-5 h-5" />
            </a>
          </section>
        )}
      </div>

      <footer className="relative z-10 border-t border-[var(--border)] px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
          <span className="name !text-base">{profile.name}</span>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">© {new Date().getFullYear()} · Todos os direitos reservados</p>
        {profile.footerNote && <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-[var(--muted)]/80">{profile.footerNote}</p>}
      </footer>
    </main>
  );
}
