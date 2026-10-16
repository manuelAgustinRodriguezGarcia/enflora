"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

export function GaleriaFlora({ galeria }) {
  const reducido = useReducedMotion();

  return (
    <div className="flora-galeria">
      <motion.div
        className="flora-galeria__cabecera"
        initial={reducido ? false : { opacity: 0, y: 14 }}
        whileInView={reducido ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <h3 className="flora-galeria__titulo">{galeria.titulo}</h3>
        <p className="flora-galeria__bajada">{galeria.bajada}</p>
      </motion.div>
      <ul className="flora-galeria__pista">
        {galeria.items.map((item, indice) => (
          <motion.li
            key={item.id}
            className={`flora-galeria__item${item.cutout ? " flora-galeria__item--cutout" : ""}`}
            initial={reducido ? false : { opacity: 0, y: 16 }}
            whileInView={reducido ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{
              duration: 0.4,
              delay: reducido ? 0 : indice * 0.07,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="flora-galeria__marco">
              <Image
                src={item.src}
                alt={item.alt}
                width={item.width}
                height={item.height}
                className="flora-galeria__img"
                sizes="(max-width: 63.99rem) 70vw, 28vw"
              />
            </div>
            <p className="flora-galeria__caption">{item.caption}</p>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
