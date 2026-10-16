"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BeneficiosFuncionalidad } from "@/componentes/landing/beneficios-funcionalidad";
import { VistaPreviaFuncionalidad } from "@/componentes/landing/vista-previa-funcionalidad";

export function PanelFuncionalidad({ funcionalidad }) {
  const reducido = useReducedMotion();
  const transicion = reducido
    ? { duration: 0 }
    : { duration: 0.3, ease: [0.22, 1, 0.36, 1] };

  return (
    <div className="producto-panel">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={funcionalidad.id}
          className="producto-panel__bloque"
          initial={reducido ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducido ? undefined : { opacity: 0, y: -8 }}
          transition={transicion}
        >
          <article className="producto-panel__principal">
            <div className="producto-panel__texto">
              <div className="producto-panel__meta">
                <span className="producto-panel__etiqueta">{funcionalidad.etiqueta}</span>
                <span
                  className="producto-panel__estado"
                  data-estado={funcionalidad.disponibilidad}
                >
                  {funcionalidad.disponibilidad === "disponible" ? "Disponible" : "Próximamente"}
                </span>
              </div>
              <h3 className="producto-panel__titulo">{funcionalidad.titulo}</h3>
              <p className="producto-panel__descripcion">{funcionalidad.descripcion}</p>
              {funcionalidad.demo ? (
                <p className="producto-panel__demo">
                  Vista conceptual · el parentesco no es secuenciación genética de laboratorio.
                </p>
              ) : null}
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
}
