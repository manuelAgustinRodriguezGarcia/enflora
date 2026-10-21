"use client";

import { motion, useReducedMotion } from "motion/react";

const COLORES = ["#A4C85B", "#F0B4B4", "#0B3D2A", "#FDF1D7", "#C9DE94"];

const PIEZAS = Array.from({ length: 28 }, (_, indice) => ({
  id: indice,
  izquierda: (indice * 37) % 100,
  color: COLORES[indice % COLORES.length],
  demora: (indice % 7) * 0.09,
  duracion: 1.8 + (indice % 5) * 0.28,
  giro: (indice % 2 ? 1 : -1) * (240 + (indice % 4) * 90),
  deriva: ((indice % 5) - 2) * 18,
  redonda: indice % 3 === 0,
}));

export function Confeti() {
  const reducido = useReducedMotion();
  if (reducido) return null;

  return (
    <div className="ruleta-confeti" aria-hidden="true">
      {PIEZAS.map((pieza) => (
        <motion.span
          key={pieza.id}
          className={`ruleta-confeti__pieza${pieza.redonda ? " ruleta-confeti__pieza--redonda" : ""}`}
          style={{ left: `${pieza.izquierda}%`, background: pieza.color }}
          initial={{ y: "-10vh", x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", x: pieza.deriva, rotate: pieza.giro, opacity: [1, 1, 0] }}
          transition={{ duration: pieza.duracion, delay: pieza.demora, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
