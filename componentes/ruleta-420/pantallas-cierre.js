"use client";

import { motion } from "motion/react";
import { BotonRuleta } from "@/componentes/ruleta-420/boton-ruleta";
import { Confeti } from "@/componentes/ruleta-420/confeti";
import { ImagenRuleta } from "@/componentes/ruleta-420/imagen-ruleta";
import { ACIERTOS_PARA_GANAR } from "@/lib/ruleta-420/configuracion";

const entradaFlora = {
  initial: { opacity: 0, scale: 0.7, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: { type: "spring", stiffness: 260, damping: 16, delay: 0.1 },
};

export function PantallaVictoria({ onContinuar }) {
  return (
    <div className="ruleta-cierre ruleta-cierre--victoria">
      <Confeti />
      <motion.div className="ruleta-cierre__flora" {...entradaFlora}>
        <ImagenRuleta clave="floraFestejando" alt="Flora festejando" icono="trofeo" etiqueta="Flora festejando" tono="festejo" />
      </motion.div>
      <motion.h1
        className="ruleta-titulo"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: [0.85, 1.06, 1] }}
        transition={{ duration: 0.55, delay: 0.2 }}
      >
        ¡SOBREVIVISTE A LA RULETA!
      </motion.h1>
      <p className="ruleta-cierre__texto">¡{ACIERTOS_PARA_GANAR} respuestas correctas! Flora está impresionada.</p>
      <p className="ruleta-cierre__subtitulo">Pero ahora tenés que elegir...</p>
      <div className="ruleta-acciones">
        <BotonRuleta onClick={onContinuar}>A VER</BotonRuleta>
      </div>
    </div>
  );
}

export function PantallaDerrota({ aciertos, onReintentar }) {
  return (
    <div className="ruleta-cierre ruleta-cierre--derrota">
      <motion.div
        className="ruleta-cierre__flora"
        initial={{ opacity: 0, y: -16, rotate: -4 }}
        animate={{ opacity: 1, y: 0, rotate: [-4, 3, -2, 0] }}
        transition={{ duration: 0.7 }}
      >
        <ImagenRuleta clave="floraDerrotada" alt="Flora derrotada" icono="derrota" etiqueta="Flora derrotada" tono="derrota" />
      </motion.div>
      <h1 className="ruleta-titulo">¡TE CORTARON LAS PIERNAS!</h1>
      <p className="ruleta-cierre__texto">El dopping te dejo en offside.</p>
      <div className="ruleta-cierre__resumen">
        <span>Respuestas correctas</span>
        <strong>
          {aciertos}/{ACIERTOS_PARA_GANAR}
        </strong>
      </div>
      <div className="ruleta-acciones">
        <BotonRuleta onClick={onReintentar}>VOLVER A INTENTARLO</BotonRuleta>
      </div>
    </div>
  );
}
