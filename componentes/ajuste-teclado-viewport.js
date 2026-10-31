"use client";

import { useEffect } from "react";
import { entradaEditableActiva, evaluarTecladoVirtual } from "@/lib/viewport-teclado";

function focoEditable() {
  const activo = document.activeElement;
  if (!activo || activo === document.body || activo === document.documentElement) return false;
  return entradaEditableActiva(activo);
}

function admiteTecladoVirtual() {
  return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(hover: none)").matches;
}

function aplicarNav(abierto) {
  const nav = document.querySelector(".bottom-nav:not(.demo-nav)");
  if (!nav) return;
  nav.toggleAttribute("inert", abierto);
  if (abierto) nav.setAttribute("aria-hidden", "true");
  else nav.removeAttribute("aria-hidden");
}

/** Marca `data-teclado` y `--enflora-teclado-inferior` según visualViewport. */
export function AjusteTecladoViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const estado = { alturaBase: 0, abierto: false };
    let temporizadorOrientacion = 0;

    const actualizar = () => {
      const vista = window.visualViewport;
      const resultado = evaluarTecladoVirtual(
        {
          alturaBase: estado.alturaBase,
          innerHeight: window.innerHeight,
          visualViewport: vista ? { height: vista.height, offsetTop: vista.offsetTop } : null,
        },
        {
          entradaActiva: focoEditable(),
          abiertoPrevio: estado.abierto,
          admiteTecladoVirtual: admiteTecladoVirtual(),
        },
      );
      estado.alturaBase = resultado.alturaBase;
      estado.abierto = resultado.abierto;
      root.style.setProperty("--enflora-teclado-inferior", `${resultado.offset}px`);
      if (resultado.abierto) root.dataset.teclado = "abierto";
      else delete root.dataset.teclado;
      aplicarNav(resultado.abierto);
    };

    const reiniciar = () => {
      estado.alturaBase = 0;
      estado.abierto = false;
      actualizar();
    };

    const alOrientar = () => {
      window.clearTimeout(temporizadorOrientacion);
      reiniciar();
      temporizadorOrientacion = window.setTimeout(reiniciar, 300);
    };

    const alVisible = () => {
      if (document.visibilityState === "visible") actualizar();
    };

    const alPageShow = (evento) => {
      if (evento.persisted) reiniciar();
      else actualizar();
    };

    actualizar();
    window.visualViewport?.addEventListener("resize", actualizar);
    window.visualViewport?.addEventListener("scroll", actualizar);
    window.addEventListener("resize", actualizar);
    window.addEventListener("orientationchange", alOrientar);
    window.addEventListener("pageshow", alPageShow);
    document.addEventListener("visibilitychange", alVisible);
    document.addEventListener("focusin", actualizar);
    document.addEventListener("focusout", actualizar);

    return () => {
      window.clearTimeout(temporizadorOrientacion);
      window.visualViewport?.removeEventListener("resize", actualizar);
      window.visualViewport?.removeEventListener("scroll", actualizar);
      window.removeEventListener("resize", actualizar);
      window.removeEventListener("orientationchange", alOrientar);
      window.removeEventListener("pageshow", alPageShow);
      document.removeEventListener("visibilitychange", alVisible);
      document.removeEventListener("focusin", actualizar);
      document.removeEventListener("focusout", actualizar);
      root.style.removeProperty("--enflora-teclado-inferior");
      delete root.dataset.teclado;
      aplicarNav(false);
    };
  }, []);

  return null;
}
