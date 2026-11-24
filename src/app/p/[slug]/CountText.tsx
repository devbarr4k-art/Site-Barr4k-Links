"use client";

import { useEffect, useState } from "react";

/**
 * Separa "$1,234.56" em prefixo ("$"), número (1234.56) e sufixo, lembrando o formato
 * (casas decimais e separadores) pra montar de volta igual enquanto anima.
 */
function parse(value: string) {
  const m = value.match(/^(.*?)(\d[\d.,]*)(.*)$/);
  if (!m) return null;
  const [, pre, raw, suf] = m;
  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");
  let dec = "";
  let thou = "";
  if (lastDot >= 0 && lastComma >= 0) {
    dec = lastDot > lastComma ? "." : ",";
    thou = dec === "." ? "," : ".";
  } else {
    const sep = lastDot >= 0 ? "." : lastComma >= 0 ? "," : "";
    // "1,234" ou "1.234.567" = milhar; "517.34" ou "3,5" = decimal
    if (sep && (raw.split(sep).length > 2 || raw.length - raw.lastIndexOf(sep) - 1 === 3)) thou = sep;
    else dec = sep;
  }
  const decimals = dec ? raw.length - raw.lastIndexOf(dec) - 1 : 0;
  const clean = raw.split(thou || "\u0000").join("").replace(dec || "\u0000", ".");
  const n = parseFloat(clean);
  if (!isFinite(n)) return null;
  return { pre, suf, n, decimals, dec, thou };
}

function format(v: number, p: NonNullable<ReturnType<typeof parse>>) {
  const [int, frac] = v.toFixed(p.decimals).split(".");
  const withThou = p.thou ? int.replace(/\B(?=(\d{3})+(?!\d))/g, p.thou) : int;
  return `${p.pre}${withThou}${frac ? p.dec + frac : ""}${p.suf}`;
}

/** Valor que sobe do zero até o número toda vez que a página abre (F5) */
export default function CountText({ value, duration = 1600 }: { value: string; duration?: number }) {
  const [shown, setShown] = useState(() => {
    const p = parse(value);
    return p ? format(0, p) : value;
  });

  useEffect(() => {
    const p = parse(value);
    if (!p || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(t);
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - k, 4);
      setShown(k < 1 ? format(p.n * e, p) : value);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span>{shown}</span>;
}
