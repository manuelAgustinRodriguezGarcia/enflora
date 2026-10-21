"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { BotonRuleta } from "@/componentes/ruleta-420/boton-ruleta";
import { ComprobantePremio } from "@/componentes/ruleta-420/comprobante-premio";
import { Confeti } from "@/componentes/ruleta-420/confeti";
import { ImagenRuleta } from "@/componentes/ruleta-420/imagen-ruleta";
import { RESULTADOS_PREMIO } from "@/lib/ruleta-420/configuracion";

export function PantallaResultadoPremio({ premioId, onVolver }) {
  const consuelo = premioId === "CONSOLATION";
  const [revelado, setRevelado] = useState(false);
  const resultado = RESULTADOS_PREMIO[premioId];
  if (!resultado) return null;

  if (consuelo && !revelado) {
    return (
      <div className={`ruleta-cierre ruleta-cierre--${resultado.tono}`}>
        <motion.div
          className="ruleta-cierre__flora"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 16 }}
        >
          <ImagenRuleta
            clave={resultado.imagen}
            alt="Flora triste"
            icono={resultado.icono}
            etiqueta="Flora"
            tono={resultado.tono}
          />
        </motion.div>
        <h1 className="ruleta-titulo">{resultado.titulo}</h1>
        <p className="ruleta-cierre__texto">{resultado.descripcion}</p>
        <div className="ruleta-acciones">
          <BotonRuleta variante="secundario" onClick={() => setRevelado(true)}>
            OK
          </BotonRuleta>
        </div>
      </div>
    );
  }

  if (consuelo) {
    return (
      <div className="ruleta-cierre ruleta-cierre--tuquera">
        <Confeti />
        <motion.div
          className="ruleta-cierre__flora"
          initial={{ opacity: 0, scale: 0.4, rotate: -12 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 14 }}
        >
          <ImagenRuleta
            clave="floraFestejando"
            alt="Flora contenta"
            icono="festejo"
            etiqueta="Flora"
            tono="festejo"
          />
        </motion.div>
        <h1 className="ruleta-titulo">¡PERO FLORA NO TE DEJA IR ASÍ!</h1>
        <p className="ruleta-cierre__texto">Te regalo igual un filtro y un sticker que te guste por participar.</p>
        <p className="ruleta-cierre__destacado">1 STICKER + 1 FILTRO</p>
        <ComprobantePremio premioId={premioId} />
        <div className="ruleta-acciones">
          <BotonRuleta onClick={onVolver}>¡GRACIAS, FLORA!</BotonRuleta>
        </div>
      </div>
    );
  }

  return (
    <div className={`ruleta-cierre ruleta-cierre--${resultado.tono}`}>
      <Confeti />
      <motion.div
        className="ruleta-cierre__flora"
        initial={{ opacity: 0, scale: 0.4, rotate: -20 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 14 }}
      >
        <ImagenRuleta
          clave={resultado.imagen}
          alt={resultado.descripcion}
          icono={resultado.icono}
          etiqueta="Tu premio"
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
      {resultado.secundario ? <p className="ruleta-cierre__texto">{resultado.secundario}</p> : null}
      <ComprobantePremio premioId={premioId} />
      <div className="ruleta-acciones">
        <BotonRuleta variante="secundario" onClick={onVolver}>
          VOLVER AL INICIO
        </BotonRuleta>
      </div>
    </div>
  );
}
