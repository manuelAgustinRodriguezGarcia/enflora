"use client";

import { motion, useReducedMotion } from "motion/react";

export function PresentacionFlora({ titulo, tituloDestacado, descripcion }) {
  const reducido = useReducedMotion();

  return (
    <motion.div
      className="flora-presentacion"
      initial={reducido ? false : { opacity: 0, y: 16 }}
      whileInView={reducido ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <h2 className="flora-presentacion__titulo" id="flora-titulo">
        {titulo}{" "}
        <span className="flora-presentacion__destacado">{tituloDestacado}</span>
        .
      </h2>
      <p className="flora-presentacion__descripcion">{descripcion}</p>
    </motion.div>
  );
}
