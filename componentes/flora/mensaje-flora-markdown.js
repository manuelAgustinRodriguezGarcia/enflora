"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  contarPalabrasMarkdown,
  duracionAnimacionPalabras,
  recortarMarkdownPorPalabras,
} from "@/lib/flora-chat-markdown";

const componentesMarkdown = {
  a: ({ href, children }) => {
    const destino = String(href || "").trim();
    if (!/^https?:\/\//i.test(destino)) {
      return <span>{children}</span>;
    }
    return (
      <a href={destino} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

function MarkdownFlora({ texto }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={componentesMarkdown}>
      {texto}
    </ReactMarkdown>
  );
}

export function MensajeFloraMarkdown({
  texto,
  animar = false,
  onAnimacionCompleta,
  onProgresoAnimacion,
  onSaltarAnimacion,
}) {
  const reducido = useReducedMotion();
  const totalPalabras = contarPalabrasMarkdown(texto);
  const [palabrasVisibles, setPalabrasVisibles] = useState(() =>
    animar && !reducido ? 1 : totalPalabras,
  );
  const [terminado, setTerminado] = useState(() => !animar || reducido);
  const cancelarRef = useRef(null);

  const finalizar = useCallback(() => {
    setPalabrasVisibles(totalPalabras);
    setTerminado(true);
    onAnimacionCompleta?.();
  }, [onAnimacionCompleta, totalPalabras]);

  useEffect(() => {
    cancelarRef.current?.();
    cancelarRef.current = null;

    if (!animar || reducido || totalPalabras === 0) {
      setPalabrasVisibles(totalPalabras);
      setTerminado(true);
      return undefined;
    }

    setPalabrasVisibles(1);
    setTerminado(false);

    const duracion = duracionAnimacionPalabras(totalPalabras, { reducido });
    const inicio = performance.now();
    let frame = 0;

    const tick = (ahora) => {
      const progreso = duracion <= 0 ? 1 : Math.min(1, (ahora - inicio) / duracion);
      const objetivo = Math.max(1, Math.ceil(progreso * totalPalabras));
      setPalabrasVisibles(objetivo);
      onProgresoAnimacion?.();

      if (progreso >= 1) {
        finalizar();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    cancelarRef.current = () => cancelAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frame);
      cancelarRef.current = null;
    };
  }, [animar, reducido, texto, totalPalabras, finalizar, onProgresoAnimacion]);

  const saltar = useCallback(() => {
    if (terminado) return;
    cancelarRef.current?.();
    cancelarRef.current = null;
    finalizar();
    onSaltarAnimacion?.();
  }, [terminado, finalizar, onSaltarAnimacion]);

  const fragmento =
    terminado || palabrasVisibles >= totalPalabras
      ? texto
      : recortarMarkdownPorPalabras(texto, palabrasVisibles);

  return (
    <div
      className={`flora-chat-md${terminado ? "" : " flora-chat-md--animando"}`}
      onClick={terminado ? undefined : saltar}
      onKeyDown={
        terminado
          ? undefined
          : (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                saltar();
              }
            }
      }
      role={terminado ? undefined : "button"}
      tabIndex={terminado ? undefined : 0}
      title={terminado ? undefined : "Tocá para mostrar todo el mensaje"}
      aria-busy={!terminado}
    >
      <span className="flora-chat-app__sr">{texto}</span>
      <div className="flora-chat-md__visible">
        <MarkdownFlora texto={fragmento} />
      </div>
    </div>
  );
}
