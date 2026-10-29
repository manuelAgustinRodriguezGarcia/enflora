"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  crearRotadorMensajesEspera,
  frasesEsperaActivas,
  intervaloEsperaFloraMs,
} from "@/lib/flora-mensajes-espera";
import { PERSONALIDAD_FLORA_DEFAULT } from "@/lib/flora-personalidad";

const FADE_MS = 220;

function prefiereMovimientoReducido() {
  if (typeof window === "undefined") return false;
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function crearEstadoEspera(personalidad, conImagen) {
  const rotador = crearRotadorMensajesEspera(frasesEsperaActivas(personalidad, { conImagen }));
  return { rotador, frase: rotador.actual() };
}

export function EsperaFlora({
  personalidad = PERSONALIDAD_FLORA_DEFAULT,
  conImagen = false,
  onContenidoCambio,
}) {
  const { rotador, frase: fraseInicial } = useMemo(
    () => crearEstadoEspera(personalidad, conImagen),
    [personalidad, conImagen],
  );
  const rotadorRef = useRef(null);
  const [frase, setFrase] = useState(fraseInicial);
  const [visible, setVisible] = useState(true);
  const timeoutRef = useRef(null);
  const fadeRef = useRef(null);
  const onContenidoCambioRef = useRef(onContenidoCambio);

  useEffect(() => {
    onContenidoCambioRef.current = onContenidoCambio;
  }, [onContenidoCambio]);

  useEffect(() => {
    rotadorRef.current = rotador;
    onContenidoCambioRef.current?.();

    const limpiarTimers = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (fadeRef.current) {
        clearTimeout(fadeRef.current);
        fadeRef.current = null;
      }
    };

    const programarSiguiente = () => {
      limpiarTimers();
      timeoutRef.current = setTimeout(() => {
        const reducido = prefiereMovimientoReducido();
        const aplicarSiguiente = () => {
          const siguiente = rotadorRef.current?.avanzar?.() ?? "…";
          setFrase(siguiente);
          setVisible(true);
          onContenidoCambioRef.current?.();
          programarSiguiente();
        };

        if (reducido) {
          aplicarSiguiente();
          return;
        }

        setVisible(false);
        fadeRef.current = setTimeout(aplicarSiguiente, FADE_MS);
      }, intervaloEsperaFloraMs());
    };

    programarSiguiente();

    return limpiarTimers;
    // El padre desmonta al terminar cargando y usa `key` por personalidad/imagen.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- un timer por montaje
  }, []);

  return (
    <div
      className="flora-chat-app__burbuja flora-chat-app__burbuja--escribiendo"
      aria-busy="true"
      aria-label="Flora está escribiendo"
    >
      <p
        className={`flora-chat-app__espera-frase${visible ? "" : " flora-chat-app__espera-frase--apagada"}`}
        aria-hidden="true"
      >
        {frase}
      </p>
    </div>
  );
}
