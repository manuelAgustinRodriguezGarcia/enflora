"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { forwardRef } from "react";
import { BeneficiosFuncionalidad } from "@/componentes/landing/beneficios-funcionalidad";
import { VistaPreviaFuncionalidad } from "@/componentes/landing/vista-previa-funcionalidad";

export const PanelFuncionalidad = forwardRef(function PanelFuncionalidad(
  { funcionalidad, style },
  ref,
) {
  const reducido = useReducedMotion();
  const transicion = reducido
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] };

  return (
    <div className="producto-panel" ref={ref} style={style}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={funcionalidad.id}
          className="producto-panel__bloque"
          initial={reducido ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducido ? undefined : { opacity: 0 }}
          transition={transicion}
        >
          <article className="producto-panel__principal">
            <div className="producto-panel__texto">
              <div className="producto-panel__meta">
                <span className="producto-panel__etiqueta">{funcionalidad.etiqueta}</span>
              </div>
              <h3 className="producto-panel__titulo">{funcionalidad.titulo}</h3>
              <p className="producto-panel__descripcion">{funcionalidad.descripcion}</p>
            </div>
            <VistaPreviaFuncionalidad
              preview={funcionalidad.preview}
              titulo={funcionalidad.menu}
            />
          </article>
          <BeneficiosFuncionalidad beneficios={funcionalidad.beneficios} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
});
