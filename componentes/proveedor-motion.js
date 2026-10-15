"use client";

import { MotionConfig } from "motion/react";
import { useEffect } from "react";
import { transicionRapida } from "@/lib/animaciones";

export function ProveedorMotion({ children }) {
  useEffect(() => {
    const bloquear = (evento) => {
      const nodo = evento.target;
      if (!(nodo instanceof Element)) return;
      if (nodo.closest("img, picture, svg")) {
        evento.preventDefault();
      }
    };
    document.addEventListener("dragstart", bloquear);
    return () => document.removeEventListener("dragstart", bloquear);
  }, []);

  return (
    <MotionConfig reducedMotion="user" transition={transicionRapida}>
      {children}
    </MotionConfig>
  );
}
