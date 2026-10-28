"use client";

import { useEffect } from "react";

/** Sincroniza `--enflora-teclado-inferior` con el teclado virtual (visualViewport). */
export function AjusteTecladoViewport() {
  useEffect(() => {
    const root = document.documentElement;

    const actualizar = () => {
      const vista = window.visualViewport;
      if (!vista) {
        root.style.setProperty("--enflora-teclado-inferior", "0px");
        return;
      }
      const teclado = Math.max(0, window.innerHeight - vista.height - vista.offsetTop);
      root.style.setProperty("--enflora-teclado-inferior", `${teclado}px`);
    };

    actualizar();
    window.visualViewport?.addEventListener("resize", actualizar);
    window.visualViewport?.addEventListener("scroll", actualizar);
    window.addEventListener("resize", actualizar);
    window.addEventListener("orientationchange", actualizar);

    return () => {
      window.visualViewport?.removeEventListener("resize", actualizar);
      window.visualViewport?.removeEventListener("scroll", actualizar);
      window.removeEventListener("resize", actualizar);
      window.removeEventListener("orientationchange", actualizar);
      root.style.removeProperty("--enflora-teclado-inferior");
    };
  }, []);

  return null;
}
