"use client";

import { motion } from "motion/react";
import { BotonRuleta } from "@/componentes/ruleta-420/boton-ruleta";
import { Confeti } from "@/componentes/ruleta-420/confeti";
import { ImagenRuleta } from "@/componentes/ruleta-420/imagen-ruleta";
import { ModalRuleta } from "@/componentes/ruleta-420/modal-ruleta";

export function PantallaDecision({
  fase,
  seguroDisponible,
  onAsegurar,
  onArriesgar,
  onConfirmar,
  onCancelar,
}) {
  const bloqueada = fase !== "prize-decision";

  return (
    <div className="ruleta-decision">
      <Confeti />
      <div className="ruleta-decision__encabezado">
        <h1 className="ruleta-titulo">GANASTE LA RULETA 420!</h1>
        <ImagenRuleta
          clave="floraArriesga"
          alt="Flora lista para arriesgar el premio"
          icono="festejo"
          className="ruleta-decision__hero"
        />
        <h2 className="ruleta-decision__apuesta">Apostá todo, hacelo por la Tota.</h2>
      </div>

      <div className="ruleta-decision__opciones">
        <motion.section
          className="ruleta-decision__opcion ruleta-decision__opcion--segura"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <h2 className="ruleta-decision__titulo">Fuerte al medio</h2>
          <p className="ruleta-decision__lema">Por la Tota todo</p>
          <div className="ruleta-decision__dotacion">
            <div className="ruleta-decision__pieza">
              <img src="/images/premios/enflora_stickers_web_1280.webp" alt="Stickers" width="96" height="96" />
              <span>×2</span>
            </div>
            <div className="ruleta-decision__pieza">
              <img src="/images/premios/enflora_filtros_web_1280.webp" alt="Filtros" width="96" height="96" />
              <span>×2</span>
            </div>
          </div>
          <p className="ruleta-decision__descripcion">Te llevás 2 stickers a elección y 2 filtros.</p>
          <BotonRuleta variante="claro" onClick={onAsegurar} disabled={bloqueada || !seguroDisponible}>
            ME QUEDO CON MI PREMIO
          </BotonRuleta>
          {!seguroDisponible ? (
            <p className="ruleta-decision__aviso">Ahora no hay stock para el premio seguro.</p>
          ) : null}
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
          <h2 className="ruleta-decision__titulo">¡ME LA JUEGO!</h2>
          <p className="ruleta-decision__descripcion">
            Podés ganar un picador, un tuquero, un pack especial de stickers y filtros... o quedarte sin nada.
          </p>
          <BotonRuleta variante="rosa" onClick={onArriesgar} disabled={bloqueada}>
            QUIERO ARRIESGAR
          </BotonRuleta>
        </motion.section>
      </div>

      <ModalRuleta
        abierto={fase === "prize-confirmation"}
        onCerrar={onCancelar}
        titulo="¿ESTÁS SEGURO?"
        descripcion="Si girás esta ruleta, renunciás al premio seguro."
        className="ruleta-modal__panel--alerta"
      >
        <div className="ruleta-acciones">
          <BotonRuleta variante="rosa" onClick={onConfirmar}>
            QUIERO ARRIESGAR
          </BotonRuleta>
          <BotonRuleta variante="secundario" onClick={onAsegurar} disabled={!seguroDisponible}>
            ME QUEDO CON MI PREMIO
          </BotonRuleta>
        </div>
      </ModalRuleta>
    </div>
  );
}
