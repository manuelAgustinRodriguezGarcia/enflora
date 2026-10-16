"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const plataformaServidor = {
  esIos: false,
  esAndroid: false,
  esDesktop: true,
  esSafari: false,
};

let plataformaCliente = null;

function detectarPlataforma() {
  if (typeof window === "undefined") return plataformaServidor;
  if (plataformaCliente) return plataformaCliente;

  const ua = window.navigator.userAgent || "";
  const esIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const esAndroid = /Android/i.test(ua);
  const esSafari = Boolean(
    esIos && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua),
  );

  plataformaCliente = {
    esIos,
    esAndroid,
    esDesktop: !esIos && !esAndroid,
    esSafari,
  };

  return plataformaCliente;
}

function suscribirPlataforma() {
  return () => {};
}

function esStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function suscribirStandalone(onStoreChange) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onStoreChange);
  window.addEventListener("appinstalled", onStoreChange);
  return () => {
    media.removeEventListener("change", onStoreChange);
    window.removeEventListener("appinstalled", onStoreChange);
  };
}

export function usePWAInstall() {
  const plataforma = useSyncExternalStore(
    suscribirPlataforma,
    detectarPlataforma,
    () => plataformaServidor,
  );
  const instalada = useSyncExternalStore(suscribirStandalone, esStandalone, () => false);
  const [promptEvento, setPromptEvento] = useState(null);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    function alPrompt(evento) {
      evento.preventDefault();
      setPromptEvento(evento);
    }

    function alInstalar() {
      setPromptEvento(null);
      setResultado("aceptada");
    }

    window.addEventListener("beforeinstallprompt", alPrompt);
    window.addEventListener("appinstalled", alInstalar);

    return () => {
      window.removeEventListener("beforeinstallprompt", alPrompt);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  const puedeInstalarNativo = Boolean(promptEvento) && !instalada && !plataforma.esDesktop;

  const solicitarInstalacion = useCallback(async () => {
    if (!promptEvento) {
      return { ok: false, motivo: "sin-prompt" };
    }

    try {
      await promptEvento.prompt();
      const eleccion = await promptEvento.userChoice;
      setPromptEvento(null);
      setResultado(eleccion?.outcome === "accepted" ? "aceptada-dialogo" : "cancelada");
      return { ok: true, outcome: eleccion?.outcome };
    } catch {
      return { ok: false, motivo: "error" };
    }
  }, [promptEvento]);

  return {
    instalada,
    puedeInstalarNativo,
    plataforma,
    resultado,
    solicitarInstalacion,
  };
}
