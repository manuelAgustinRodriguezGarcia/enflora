"use client";

import { motion } from "motion/react";
import { BotonRuleta } from "@/componentes/ruleta-420/boton-ruleta";
import { ImagenRuleta } from "@/componentes/ruleta-420/imagen-ruleta";
import { ModalRuleta } from "@/componentes/ruleta-420/modal-ruleta";
import { Ruleta } from "@/componentes/ruleta-420/ruleta";
import { SECTORES_CATEGORIAS } from "@/lib/ruleta-420/logica";

const REGLAS = [
  "Girá la ruleta para descubrir tu categoría.",
  "Respondé correctamente las preguntas.",
  "Tenés 2 vidas; cada error te cuesta una.",
  "Conseguí 3 aciertos para ganar.",
  "Elegí una tuquera asegurada o arriesgá todo por un picador.",
];

export function PantallaBienvenida({ reglasAbiertas, onJugar, onAbrirReglas, onCerrarReglas }) {
  return (
    <div className="ruleta-bienvenida">
      <div className="ruleta-bienvenida__textos">
        <span className="ruleta-chip ruleta-chip--rosa">Expo Cannabis · ENFLORA</span>
        <h1 className="ruleta-titulo ruleta-titulo--grande">
          LA RULETA <span className="ruleta-titulo__acento">420</span> DE FLORA
        </h1>
        <p className="ruleta-bienvenida__subtitulo">3 categorías. 2 vidas. 1 oportunidad de ganar.</p>
      </div>

      <div className="ruleta-bienvenida__escena">
        <Ruleta sectores={SECTORES_CATEGORIAS} decorativa etiqueta="Ruleta de categorías decorativa" />
        <motion.div
          className="ruleta-bienvenida__flora"
          initial={{ opacity: 0, x: 24, rotate: 8 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.2 }}
        >
          <ImagenRuleta clave="floraBienvenida" alt="Flora te da la bienvenida" icono="bienvenida" etiqueta="Flora" />
        </motion.div>
      </div>

      <p className="ruleta-bienvenida__descripcion">
        Demostrá cuánto sabés del mundo 420 y llevate un premio de ENFLORA.
      </p>

      <div className="ruleta-acciones">
        <BotonRuleta onClick={onJugar}>¡QUIERO JUGAR!</BotonRuleta>
        <BotonRuleta variante="secundario" onClick={onAbrirReglas}>
          ¿CÓMO SE JUEGA?
        </BotonRuleta>
      </div>

      <ModalRuleta abierto={reglasAbiertas} onCerrar={onCerrarReglas} titulo="¿CÓMO SE JUEGA?">
        <ol className="ruleta-reglas">
          {REGLAS.map((regla, indice) => (
            <motion.li
              key={regla}
              className="ruleta-reglas__item"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 + indice * 0.06 }}
            >
              <span className="ruleta-reglas__numero">{indice + 1}</span>
              <span>{regla}</span>
            </motion.li>
          ))}
        </ol>
        <BotonRuleta onClick={onJugar}>¡ENTENDIDO, VAMOS!</BotonRuleta>
      </ModalRuleta>
    </div>
  );
}
