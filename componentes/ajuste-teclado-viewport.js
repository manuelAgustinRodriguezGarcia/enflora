"use client";

import { useEffect } from "react";
import { calcularOffsetTecladoInferior, entradaEditableActiva } from "@/lib/viewport-teclado";

/** Sincroniza `--enflora-teclado-inferior` con el teclado virtual (visualViewport). */
export function AjusteTecladoViewport() {
  useEffect(() => {
    const root = document.documentElement;

    const actualizar = () => {
      const activo = document.activeElement;
      const ignorarRaiz =
        activo === document.body || activo === document.documentElement || activo === document;
      const teclado = calcularOffsetTecladoInferior(
        {
          innerHeight: window.innerHeight,
          visualViewport: window.visualViewport,
        },
        { entradaActiva: !ignorarRaiz && entradaEditableActiva(activo) },
      );
      root.style.setProperty("--enflora-teclado-inferior", `${teclado}px`);
    };

    actualizar();
    window.visualViewport?.addEventListener("resize", actualizar);
    window.visualViewport?.addEventListener("scroll", actualizar);
    window.addEventListener("resize", actualizar);
    window.addEventListener("orientationchange", actualizar);
    document.addEventListener("focusin", actualizar);
    document.addEventListener("focusout", actualizar);

    return () => {
      window.visualViewport?.removeEventListener("resize", actualizar);
      window.visualViewport?.removeEventListener("scroll", actualizar);
      window.removeEventListener("resize", actualizar);
      window.removeEventListener("orientationchange", actualizar);
      document.removeEventListener("focusin", actualizar);
      document.removeEventListener("focusout", actualizar);
      root.style.removeProperty("--enflora-teclado-inferior");
    };
  }, []);

  return null;
}
