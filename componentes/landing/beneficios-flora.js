"use client";

import { ClipboardList, Sparkles, Sprout } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

const ICONOS = {
  clipboard: ClipboardList,
  sparkles: Sparkles,
  sprout: Sprout,
};

export function BeneficiosFlora({ beneficios }) {
  const reducido = useReducedMotion();

  return (
    <div className="flora-beneficios">
      <ul className="flora-beneficios__lista">
        {beneficios.items.map((item, indice) => {
          const Icono = ICONOS[item.icono] ?? Sparkles;
          return (
            <motion.li
              key={item.id}
              className={`flora-beneficios__item flora-beneficios__item--${item.tono}`}
              initial={reducido ? false : { opacity: 0, y: 16 }}
              whileInView={reducido ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{
                duration: 0.4,
                delay: reducido ? 0 : indice * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={
                reducido
                  ? undefined
                  : { y: -4, transition: { duration: 0.2 } }
              }
            >
              <span className="flora-beneficios__icono" aria-hidden="true">
                <Icono size={32} strokeWidth={2} />
              </span>
              <div className="flora-beneficios__cuerpo">
                <h4 className="flora-beneficios__nombre">{item.titulo}</h4>
                <p className="flora-beneficios__texto">{item.descripcion}</p>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
