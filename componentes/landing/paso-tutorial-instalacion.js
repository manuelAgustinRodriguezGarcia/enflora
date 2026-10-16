"use client";

import { motion, useReducedMotion } from "motion/react";
import { variantesPaso } from "@/lib/animaciones";

export function PasoTutorialInstalacion({
  paso,
  total,
  titulo,
  descripcion,
  nota,
  ilustracion,
  sentido = 1,
}) {
  const reducir = useReducedMotion();

  return (
    <motion.div
      className="instalacion-modal__paso"
      custom={sentido}
      variants={reducir ? undefined : variantesPaso}
      initial={reducir ? false : "entrar"}
      animate={reducir ? undefined : "centro"}
      exit={reducir ? undefined : "salir"}
    >
      <div className="instalacion-modal__ilustracion">{ilustracion}</div>
      <p className="instalacion-modal__progreso" aria-live="polite">
        {paso} / {total}
      </p>
      <h3 className="instalacion-modal__paso-titulo">{titulo}</h3>
      <p className="instalacion-modal__paso-texto">{descripcion}</p>
      {nota ? <p className="instalacion-modal__nota">{nota}</p> : null}
    </motion.div>
  );
}
