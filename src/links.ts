// Tipos da página e o conteúdo PADRÃO.
// Depois que o banco estiver configurado, quem manda é o painel /admin;
// este arquivo só é usado se o banco estiver vazio ou fora do ar.

export const ICON_NAMES = [
  "twitch", "youtube", "instagram", "x", "tiktok", "discord", "whatsapp", "steam", "kick",
  "telegram", "email", "site", "gift", "shop", "coin", "game", "trophy", "live", "ticket", "shield",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

export type LinkItem = {
  label: string;       // texto do botão
  url: string;         // para onde vai
  icon?: IconName;     // ícone à esquerda (opcional)
  image?: string;      // logo à esquerda no lugar do ícone (opcional, deitada ~4:1 ou quadrada)
  sub?: string;       // linha pequena embaixo do texto (opcional)
  code?: string;       // código/cupom com botão de copiar (opcional)
  highlight?: boolean; // true = botão de destaque (roxo)
};

export type Social = { icon: IconName; url: string; label: string };

// Cards de parceiro: a arte inteira (em pé, ~320x480) com o código embaixo
export type Partner = { name: string; image: string; url: string; code?: string };

// Cartões "por que me seguir" (como no exemplo do Gio Brandi)
export type Highlight = { icon?: IconName; title: string; text: string };

export type Profile = {
  name: string;
  handle: string;
  bio: string;
  avatar: string;
  verified: boolean;  // selo ao lado do nome
  // Capa no topo: vídeo em loop (deitado, 1920x1080) e/ou imagem. Vazio = só o fundo.
  heroVideo: string;
  heroVideoMobile: string; // opcional: vídeo em pé pro celular
  heroPoster: string;      // imagem da capa (aparece enquanto o vídeo carrega)
  ctaTitle: string;        // frase acima do botão final
  ctaLabel: string;        // texto do botão final
  ctaUrl: string;          // link do botão final
  footerNote: string;      // aviso pequeno no rodapé
};

export type PageConfig = {
  profile: Profile;
  socials: Social[];
  links: LinkItem[];
  partners: Partner[];
  highlights: Highlight[];
};

export const defaultConfig: PageConfig = {
  profile: {
    name: "BARR4K",
    handle: "@barr4k",
    bio: "Streamer de CS2 na Twitch. Live todo dia, sorteio de skin e os melhores códigos.",
    avatar: "/avatar-v2.png",
    verified: true,
    heroVideo: "/hero.mp4",
    heroVideoMobile: "",
    heroPoster: "/hero-poster.jpg",
    ctaTitle: "A resenha começa na live.",
    ctaLabel: "Assistir agora",
    ctaUrl: "https://www.twitch.tv/barr4k",
    footerNote: "Conteúdo +18. Jogue com responsabilidade: apostas envolvem risco e não há garantia de ganho.",
  },
  socials: [
    { icon: "twitch", url: "https://www.twitch.tv/barr4k", label: "Twitch" },
    { icon: "youtube", url: "https://www.youtube.com/@barr4k", label: "YouTube" },
    { icon: "instagram", url: "https://www.instagram.com/barr4k", label: "Instagram" },
    { icon: "x", url: "https://x.com/jpbarrak", label: "X" },
    { icon: "steam", url: "https://steamcommunity.com/id/barr4k/", label: "Steam" },
  ],
  links: [
    { label: "Assistir a live", sub: "twitch.tv/barr4k", url: "https://www.twitch.tv/barr4k", icon: "twitch", highlight: true },
    { label: "Sorteios de skins", sub: "Entrada grátis com a Twitch", url: "https://www.barr4k.com/", icon: "gift" },
    { label: "CSGORoll", sub: "10% de bônus + 3 caixas grátis", url: "https://www.csgoroll.com/r/BARRAK", icon: "coin", image: "/logo-csgoroll-w.png", code: "BARRAK" },
    { label: "CSGOBig", sub: "3 caixas grátis + 5% de bônus", url: "https://csgobig.com/#!/r/barr4k", icon: "coin", image: "/logo-csgobig-w.png", code: "BARR4K" },
    { label: "Fallen Store", sub: "Periféricos com desconto", url: "https://www.fallenstore.com.br/", icon: "shop", image: "/logo-fallen-w.png", code: "BARR4K" },
    { label: "YouTube", sub: "Cortes e melhores momentos", url: "https://www.youtube.com/@barr4k", icon: "youtube" },
    { label: "Instagram", sub: "@barr4k", url: "https://www.instagram.com/barr4k", icon: "instagram" },
    { label: "BB Agency", sub: "Minha agência de streamers", url: "https://www.bbagency.net", icon: "site", image: "/logo-bb.png" },
  ],
  // Seção de artes dos parceiros: desligada (pedido do Barr4k). Dá pra adicionar pelo painel.
  partners: [],
  highlights: [
    { icon: "live", title: "Live todo dia", text: "CS2, abertura de caixas e muita resenha na Twitch." },
    { icon: "trophy", title: "Sorteios de skins", text: "Skin de verdade pra quem acompanha. Entrada grátis." },
    { icon: "ticket", title: "Códigos exclusivos", text: "Bônus e caixas grátis nos sites parceiros." },
  ],
};
