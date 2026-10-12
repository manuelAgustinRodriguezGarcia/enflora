"use client";

import { AnimatePresence, motion } from "motion/react";
import { IconoEtapa } from "@/componentes/icono-etapa";
import { transicionRapida } from "@/lib/animaciones";
import { esEtapa, etiquetaEtapa } from "@/lib/etapas";

export function IndicadorEtapa({ etapa, tamano = "compacto", animar = false }) {
  const conocida = esEtapa(etapa);
  const clase = [
    "indicador-etapa",
    `indicador-etapa--${tamano}`,
    conocida ? `indicador-etapa--${etapa}` : "indicador-etapa--vacia",
  ].join(" ");
  const cuerpo = (
    <>
      {conocida ? <IconoEtapa etapa={etapa} /> : null}
      <span>{conocida ? etiquetaEtapa(etapa) : "Sin etapa"}</span>
    </>
  );

  if (!animar) {
    return <span className={clase}>{cuerpo}</span>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={conocida ? etapa : "vacia"}
        className={clase}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={transicionRapida}
      >
        {cuerpo}
      </motion.span>
    </AnimatePresence>
  );
}
