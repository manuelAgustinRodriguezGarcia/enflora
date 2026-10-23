"use client";

import { AnimatePresence, motion } from "motion/react";
import { IconoEtapa } from "@/componentes/icono-etapa";
import { transicionRapida } from "@/lib/animaciones";
import { ETAPAS, estadoEnCiclo } from "@/lib/etapas";
import { TextoConMarca } from "@/componentes/marca-enflora";

function textoEstado(estado) {
  if (estado === "actual") return "Actual";
  if (estado === "registrada") return "Registrada";
  return "Sin registrar";
}

function marcaVisible(estado) {
  if (estado === "actual") return "Actual";
  if (estado === "registrada") return "✓";
  return "\u00a0";
}

export function CicloEtapas({ etapa, historial }) {
  return (
    <ol className="ciclo-etapas" aria-label="Ciclo de etapas">
      {ETAPAS.map((item) => {
        const estado = estadoEnCiclo(item.valor, etapa, historial);
        return (
          <li
            key={item.valor}
            className={`ciclo-etapas__item ciclo-etapas__item--${estado} ciclo-etapas__item--${item.valor}`}
            aria-current={estado === "actual" ? "true" : undefined}
          >
            <span className="ciclo-etapas__cuerpo">
              <IconoEtapa etapa={item.valor} />
              <span className="ciclo-etapas__nombre">
                <TextoConMarca texto={item.etiqueta} />
              </span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={estado}
                  className="ciclo-etapas__estado"
                  aria-hidden={estado === "actual" ? undefined : true}
                  initial={estado === "actual" ? { opacity: 0, y: 4 } : { opacity: 0 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={transicionRapida}
                >
                  {marcaVisible(estado)}
                </motion.span>
              </AnimatePresence>
              {estado === "actual" ? null : (
                <span className="ciclo-etapas__estado ciclo-etapas__estado--oculto">{textoEstado(estado)}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
