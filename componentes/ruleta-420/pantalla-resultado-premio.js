"use client";

import { motion } from "motion/react";
import { BotonRuleta } from "@/componentes/ruleta-420/boton-ruleta";
import { ComprobantePremio } from "@/componentes/ruleta-420/comprobante-premio";
import { Confeti } from "@/componentes/ruleta-420/confeti";
import { ImagenRuleta } from "@/componentes/ruleta-420/imagen-ruleta";
import { RESULTADOS_PREMIO } from "@/lib/ruleta-420/configuracion";

export function PantallaResultadoPremio({ premioId, modoPremio, onVolver }) {
  const resultado = modoPremio === "asegurado" ? RESULTADOS_PREMIO.asegurado : RESULTADOS_PREMIO[premioId];
  const gano = premioId !== "nada";

  return (
    <div className={`ruleta-cierre ruleta-cierre--${resultado.tono}`}>
      {gano ? <Confeti /> : null}
      <motion.div
        className="ruleta-cierre__flora"
        initial={{ opacity: 0, scale: 0.4, rotate: gano ? -20 : 0 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 14 }}
      >
        <ImagenRuleta
          clave={resultado.imagen}
          alt={resultado.descripcion}
          icono={resultado.icono}
          etiqueta={gano ? "Tu premio" : "Flora"}
          tono={resultado.tono}
        />
      </motion.div>
      <motion.h1
        className="ruleta-titulo"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.35 }}
      >
        {resultado.titulo}
      </motion.h1>
      <motion.p
        className="ruleta-cierre__destacado"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        {resultado.descripcion}
      </motion.p>
      <p className="ruleta-cierre__texto">{resultado.secundario}</p>
      <ComprobantePremio premioId={premioId} />
      <div className="ruleta-acciones">
        <BotonRuleta variante="secundario" onClick={onVolver}>
          VOLVER AL INICIO
        </BotonRuleta>
      </div>
    </div>
  );
}
