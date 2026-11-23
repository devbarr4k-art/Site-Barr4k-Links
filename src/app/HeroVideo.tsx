"use client";

import { useEffect, useRef, useState } from "react";

// Capa em vídeo no topo. Até 768px usa o vídeo de celular (se tiver um).
// (O Safari do iPhone ignora <source media="...">, por isso a escolha é feita aqui no JS.)
export default function HeroVideo({ desktop, mobile, poster }: { desktop: string; mobile: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const pick = () => setSrc(mq.matches && mobile ? mobile : desktop);
    pick();
    mq.addEventListener("change", pick);
    return () => mq.removeEventListener("change", pick);
  }, [desktop, mobile]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !src) return;
    v.play().catch(() => {});
    // Fora da tela, pausa: decodificar vídeo pesa e deixa a rolagem engasgada no celular
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0 });
    io.observe(v);
    return () => io.disconnect();
  }, [src]);

  return (
    <video
      ref={ref}
      key={src ?? "none"}
      src={src ?? undefined}
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      poster={poster || undefined}
      className="cover-media"
    />
  );
}
