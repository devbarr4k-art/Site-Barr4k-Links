"use client";

import { useState } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";

// Chip "CÓDIGO: BARR4K" que copia ao tocar
export default function CopyCode({ code, className = "" }: { code: string; className?: string }) {
  const [done, setDone] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // navegador sem permissão de área de transferência: seleciona um campo escondido
      const t = document.createElement("textarea");
      t.value = code;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };

  return (
    <button type="button" onClick={copy} className={`code-chip ${done ? "is-done" : ""} ${className}`} aria-label={`Copiar o código ${code}`}>
      <span className="code-chip-label">{done ? "Copiado!" : "Código"}</span>
      <span className="code-chip-value">{code}</span>
      {done ? <FiCheck className="w-3.5 h-3.5" /> : <FiCopy className="w-3.5 h-3.5" />}
    </button>
  );
}
