"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { aplicacionWebInstalada } from "@/lib/pwa-entrada";

const plataformaServidor = {
  esIos: false,
  esAndroid: false,
  esDesktop: true,
  esSafari: false,
  esFirefox: false,
  esEdge: false,
  esSamsung: false,
  esChrome: false,
  esSafariMac: false,
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
  const esFirefox = /Firefox|FxiOS/i.test(ua);
  const esEdge = /Edg\//i.test(ua);
  const esSamsung = /SamsungBrowser/i.test(ua);
  const esChrome = /Chrome|CriOS/i.test(ua) && !esEdge && !esSamsung;
  const esSafari = Boolean(
    esIos && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua),
  );
  const esSafariMac = !esIos && !esAndroid && /Safari/i.test(ua) && !esChrome && !esFirefox && !esEdge;

  plataformaCliente = {
    esIos,
    esAndroid,
    esDesktop: !esIos && !esAndroid,
    esSafari,
    esFirefox,
    esEdge,
    esSamsung,
    esChrome,
    esSafariMac,
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
  const [detectada, setDetectada] = useState(false);

  useEffect(() => {
    function alPrompt(evento) {
      evento.preventDefault();
      setPromptEvento(evento);
    }

    function alInstalar() {
      setPromptEvento(null);
      setResultado("aceptada");
      setDetectada(true);
    }

    window.addEventListener("beforeinstallprompt", alPrompt);
    window.addEventListener("appinstalled", alInstalar);

    return () => {
      window.removeEventListener("beforeinstallprompt", alPrompt);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  useEffect(() => {
    if (!("getInstalledRelatedApps" in navigator)) return undefined;
    let cancelado = false;
    navigator
      .getInstalledRelatedApps()
      .then((apps) => {
        if (!cancelado && aplicacionWebInstalada(apps, window.location.origin)) setDetectada(true);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  const yaInstalada = instalada || detectada;
  const hayPrompt = Boolean(promptEvento) && !yaInstalada;
  const puedeInstalarNativo = hayPrompt && !plataforma.esDesktop;

  const solicitarInstalacion = useCallback(async () => {
    if (!promptEvento) {
      return { ok: false, motivo: "sin-prompt" };
    }

    try {
      await promptEvento.prompt();
      const eleccion = await promptEvento.userChoice;
      setPromptEvento(null);
      const aceptada = eleccion?.outcome === "accepted";
      if (aceptada) setDetectada(true);
      setResultado(aceptada ? "aceptada-dialogo" : "cancelada");
      return { ok: true, outcome: eleccion?.outcome };
    } catch {
      return { ok: false, motivo: "error" };
    }
  }, [promptEvento]);

  return {
    instalada,
    yaInstalada,
    hayPrompt,
    puedeInstalarNativo,
    plataforma,
    resultado,
    solicitarInstalacion,
  };
}
