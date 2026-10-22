"use client";

import { AnimatePresence, motion } from "motion/react";
import { BotonRuleta } from "@/componentes/ruleta-420/boton-ruleta";
import { Ruleta } from "@/componentes/ruleta-420/ruleta";
import { PREMIOS } from "@/lib/ruleta-420/configuracion";
import { SECTORES_PREMIOS } from "@/lib/ruleta-420/logica";

export function PantallaRuletaPremios({ fase, premioId, rotacion, duracion, sectores, onGirar }) {
  const girando = fase === "spinning-prize";
  const detenida = fase === "prize-reveal";
  const visibles = sectores?.length ? sectores : SECTORES_PREMIOS;
  const premio = detenida ? PREMIOS.find((item) => item.id === premioId) : null;

  let mensaje = { clave: "listo", texto: "Picador, tuquero, 3 stickers y 3 filtros, o perdés 1 de cada uno." };
  if (girando) mensaje = { clave: "girando", texto: "¡QUE LA SUERTE TE ACOMPAÑE!" };
  if (premio) mensaje = { clave: "resultado", texto: `¡Salió ${premio.nombre}!` };

  return (
    <div className="ruleta-ronda ruleta-ronda--premios">
      <h1 className="ruleta-titulo">POR LA TOTA TODO</h1>

      <Ruleta
        sectores={visibles}
        variante="premios"
        rotacion={rotacion}
        duracion={duracion}
        girando={girando}
        ganador={detenida ? premioId : null}
        etiqueta={premio ? `La ruleta de premios se detuvo en ${premio.nombre}` : "Ruleta de premios"}
      />

      <div className="ruleta-ronda__mensaje" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={mensaje.clave}
            className={`ruleta-ronda__texto${girando || premio ? " ruleta-ronda__texto--resultado" : ""}`}
            initial={{ opacity: 0, y: 10, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            {mensaje.texto}
          </motion.p>
        </AnimatePresence>
      </div>

      <BotonRuleta variante="rosa" onClick={onGirar} disabled={fase !== "prize-wheel" || Boolean(premioId)}>
        ¡GIRAR!
      </BotonRuleta>
    </div>
  );
}
