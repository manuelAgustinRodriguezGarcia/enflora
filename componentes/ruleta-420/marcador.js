"use client";

import { motion } from "motion/react";
import { Heart, HeartCrack } from "lucide-react";
import { ACIERTOS_PARA_GANAR, VIDAS_INICIALES } from "@/lib/ruleta-420/configuracion";

const corazones = Array.from({ length: VIDAS_INICIALES }, (_, indice) => indice);
const pasos = Array.from({ length: ACIERTOS_PARA_GANAR }, (_, indice) => indice);

export function Marcador({ vidas, aciertos }) {
  return (
    <div className="ruleta-marcador">
      <div className="ruleta-marcador__vidas" aria-label={`${vidas} de ${VIDAS_INICIALES} vidas`}>
        {corazones.map((indice) => {
          const perdida = indice >= vidas;
          return (
            <motion.span
              key={indice}
              className={`ruleta-marcador__corazon${perdida ? " ruleta-marcador__corazon--perdido" : ""}`}
              initial={false}
              animate={
                perdida
                  ? { scale: [1, 1.45, 0.8, 1], rotate: [0, -16, 12, 0], opacity: 0.45 }
                  : { scale: 1, rotate: 0, opacity: 1 }
              }
              transition={{ duration: 0.6 }}
            >
              {perdida ? <HeartCrack aria-hidden="true" /> : <Heart aria-hidden="true" fill="currentColor" />}
            </motion.span>
          );
        })}
      </div>
      <div className="ruleta-marcador__progreso" aria-label={`${aciertos} de ${ACIERTOS_PARA_GANAR} aciertos`}>
        <div className="ruleta-marcador__pasos" aria-hidden="true">
          {pasos.map((indice) => (
            <motion.span
              key={indice}
              className={`ruleta-marcador__paso${indice < aciertos ? " ruleta-marcador__paso--lleno" : ""}`}
              initial={false}
              animate={indice < aciertos ? { scale: [1, 1.4, 1] } : { scale: 1 }}
              transition={{ duration: 0.4 }}
            />
          ))}
        </div>
        <span className="ruleta-marcador__cuenta">
          {aciertos}/{ACIERTOS_PARA_GANAR}
        </span>
      </div>
    </div>
  );
}
