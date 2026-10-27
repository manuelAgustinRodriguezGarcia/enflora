"use client";

import { motion, useReducedMotion } from "motion/react";
import { Aparecer } from "@/componentes/aparecer";
import { IconoChevron } from "@/componentes/iconos-ui";
import { transicionRapida } from "@/lib/animaciones";

export function PlantaAccordion({
  titulo,
  meta = "",
  detalle = null,
  abierto,
  onToggle,
  children,
  style,
  className = "",
}) {
  const reducido = useReducedMotion();

  return (
    <div className={`planta-accordion${className ? ` ${className}` : ""}`} style={style}>
      <button
        type="button"
        className="planta-accordion__cabecera"
        aria-expanded={abierto}
        onClick={onToggle}
      >
        <span className="planta-accordion__info">
          <span className="planta-accordion__titulo">{titulo}</span>
          {detalle}
          {meta ? <span className="planta-accordion__meta">{meta}</span> : null}
        </span>
        <motion.span
          className="planta-accordion__chevron"
          animate={{ rotate: abierto ? 180 : 0 }}
          transition={reducido ? { duration: 0 } : transicionRapida}
        >
          <IconoChevron />
        </motion.span>
      </button>
      <Aparecer visible={abierto}>
        <div className="planta-accordion__cuerpo">{children}</div>
      </Aparecer>
    </div>
  );
}
