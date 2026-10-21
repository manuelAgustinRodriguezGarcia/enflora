"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Ruleta } from "@/componentes/ruleta-420/ruleta";
import { SECTORES_CATEGORIAS } from "@/lib/ruleta-420/logica";

const ETIQUETAS = {
  div: motion.div,
  li: motion.li,
};

const CURVA = [0.22, 1, 0.36, 1];

export function EntradaExpo({ as = "div", retraso = 0, desplazamiento = 18, className, children }) {
  const Componente = ETIQUETAS[as] ?? motion.div;

  return (
    <Componente
      className={className}
      initial={{ opacity: 0, y: desplazamiento }}
      whileInView={{ opacity: 1, y: 0, transition: { duration: 0.55, ease: CURVA, delay: retraso } }}
      viewport={{ once: true, amount: 0.25 }}
    >
      {children}
    </Componente>
  );
}

export function RuletaVitrina({ etiqueta, className }) {
  const ref = useRef(null);
  const enVista = useInView(ref, { once: true, amount: 0.45 });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={enVista ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.7, ease: CURVA }}
    >
      <Ruleta
        sectores={SECTORES_CATEGORIAS}
        rotacion={enVista ? 420 : 0}
        duracion={2600}
        variante="categorias"
        etiqueta={etiqueta}
      />
    </motion.div>
  );
}
