"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  estadoExpo,
  msHastaProximoMinuto,
  pillVisible,
  tiempoRestante,
} from "@/lib/expo-cannabis/tiempo";

const ContextoExpo = createContext(null);

export function ProveedorExpo({ inicial, children }) {
  const [ahora, setAhora] = useState(null);

  useEffect(() => {
    let temporizador = 0;

    const programar = () => {
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => {
        setAhora(Date.now());
        programar();
      }, msHastaProximoMinuto(Date.now()));
    };

    const sincronizar = () => {
      if (document.visibilityState !== "visible") return;
      setAhora(Date.now());
      programar();
    };

    temporizador = window.setTimeout(() => {
      setAhora(Date.now());
      programar();
    }, 0);

    document.addEventListener("visibilitychange", sincronizar);
    window.addEventListener("focus", sincronizar);

    return () => {
      window.clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", sincronizar);
      window.removeEventListener("focus", sincronizar);
    };
  }, []);

  const valor = useMemo(() => {
    if (ahora === null) {
      return { estado: inicial.estado, pill: inicial.pill, restante: null, listo: false };
    }
    return {
      estado: estadoExpo(ahora),
      pill: pillVisible(ahora),
      restante: tiempoRestante(ahora),
      listo: true,
    };
  }, [ahora, inicial.estado, inicial.pill]);

  return <ContextoExpo.Provider value={valor}>{children}</ContextoExpo.Provider>;
}

export function useExpo() {
  const valor = useContext(ContextoExpo);
  if (!valor) throw new Error("useExpo debe usarse dentro de ProveedorExpo");
  return valor;
}

export function TextoExpo({ textos }) {
  const { estado } = useExpo();
  return textos[estado] ?? textos.proximo;
}

export function TituloAcentoExpo({ variantes, claseAcento }) {
  const { estado } = useExpo();
  const titulo = variantes[estado] ?? variantes.proximo;
  return (
    <>
      {titulo.antes}
      <span className={claseAcento}>{titulo.acento}</span>
      {titulo.despues}
    </>
  );
}
