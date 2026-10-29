"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { markdownFloraATextoPlano } from "@/lib/flora-chat-markdown";

export function PieRespuestaFlora({ texto }) {
  const [copiado, setCopiado] = useState(false);
  const temporizadorRef = useRef(null);

  useEffect(
    () => () => {
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
    },
    [],
  );

  const copiar = useCallback(async () => {
    const contenido = markdownFloraATextoPlano(texto);
    if (!contenido) return;
    try {
      await navigator.clipboard.writeText(contenido);
      setCopiado(true);
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
      temporizadorRef.current = setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }, [texto]);

  if (!String(texto || "").trim()) return null;

  return (
    <footer className="flora-chat-app__pie-respuesta">
      <button
        type="button"
        className="flora-chat-app__copiar-respuesta"
        onClick={() => {
          void copiar();
        }}
      >
        {copiado ? (
          <Check strokeWidth={2} aria-hidden="true" />
        ) : (
          <Copy strokeWidth={1.75} aria-hidden="true" />
        )}
        {copiado ? "Copiado" : "Copiar respuesta"}
      </button>
    </footer>
  );
}
