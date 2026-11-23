"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Rolagem suave e leve (Lenis), igual à do site da BB Agency: a roda do mouse desliza
 * em vez de pular. No celular o toque continua nativo. Quem pede menos movimento no sistema fica sem.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.1 });
    return () => lenis.destroy();
  }, []);
  return null;
}
