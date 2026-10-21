"use client";

import { motion } from "motion/react";
import { BotonRuleta } from "@/componentes/ruleta-420/boton-ruleta";
import { ImagenRuleta } from "@/componentes/ruleta-420/imagen-ruleta";
import { ModalRuleta } from "@/componentes/ruleta-420/modal-ruleta";

export function PantallaDecision({ fase, onAsegurar, onArriesgar, onConfirmar, onCancelar }) {
  const bloqueada = fase !== "prize-decision";

  return (
    <div className="ruleta-decision">
      <div className="ruleta-decision__encabezado">
        <h1 className="ruleta-titulo">¿TE PLANTÁS O TE LA JUGÁS?</h1>
        <p className="ruleta-decision__texto">
          Flora tiene una tuquera asegurada para vos. Podés llevártela ahora mismo o arriesgar todo para intentar
          ganar un picador.
        </p>
      </div>

      <div className="ruleta-decision__opciones">
        <motion.section
          className="ruleta-decision__opcion ruleta-decision__opcion--segura"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <ImagenRuleta clave="tuquera" alt="Tuquera" icono="tuquera" etiqueta="Tuquera" tono="tuquera" />
          <h2 className="ruleta-decision__titulo">TUQUERA ASEGURADA</h2>
          <p className="ruleta-decision__descripcion">Ya ganaste. No necesitás tentar a la suerte.</p>
          <BotonRuleta variante="claro" onClick={onAsegurar} disabled={bloqueada}>
            ¡ME QUEDO CON LA TUQUERA!
          </BotonRuleta>
        </motion.section>

        <span className="ruleta-decision__separador" aria-hidden="true">
          O
        </span>

        <motion.section
          className="ruleta-decision__opcion ruleta-decision__opcion--riesgo"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.18, duration: 0.35 }}
        >
          <ImagenRuleta clave="picador" alt="Picador" icono="picador" etiqueta="Picador" tono="picador" />
          <h2 className="ruleta-decision__titulo">¿Y SI TE LLEVÁS UN PICADOR?</h2>
          <p className="ruleta-decision__descripcion">Podés ganar un picador, una tuquera o quedarte sin nada.</p>
          <BotonRuleta variante="rosa" onClick={onArriesgar} disabled={bloqueada}>
            ¡ME LA JUEGO!
          </BotonRuleta>
        </motion.section>
      </div>

      <ModalRuleta
        abierto={fase === "prize-confirmation"}
        onCerrar={onCancelar}
        titulo="¿ESTÁS SEGURO?"
        descripcion="Si girás esta ruleta, renunciás a tu premio asegurado."
        className="ruleta-modal__panel--alerta"
      >
        <div className="ruleta-acciones">
          <BotonRuleta variante="rosa" onClick={onConfirmar}>
            SÍ, QUIERO ARRIESGAR
          </BotonRuleta>
          <BotonRuleta variante="secundario" onClick={onAsegurar}>
            MEJOR MI TUQUERA
          </BotonRuleta>
        </div>
      </ModalRuleta>
    </div>
  );
}
