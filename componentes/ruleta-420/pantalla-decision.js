"use client";

import { motion } from "motion/react";
import { BotonRuleta } from "@/componentes/ruleta-420/boton-ruleta";
import { Confeti } from "@/componentes/ruleta-420/confeti";
import { ImagenRuleta } from "@/componentes/ruleta-420/imagen-ruleta";
import { ModalRuleta } from "@/componentes/ruleta-420/modal-ruleta";
import { toque, transicionToque } from "@/lib/animaciones";

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
        <h2 className="ruleta-decision__apuesta">
          Apostá todo
          <br />
          hacelo por la Tota
        </h2>
      </div>

      <div className="ruleta-decision__opciones">
        <motion.button
          type="button"
          className="ruleta-decision__opcion ruleta-decision__opcion--segura"
          onClick={onAsegurar}
          disabled={bloqueada || !seguroDisponible}
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          whileTap={bloqueada || !seguroDisponible ? undefined : toque}
          transition={{
            opacity: { delay: 0.1, duration: 0.35 },
            x: { delay: 0.1, duration: 0.35 },
            scale: transicionToque,
          }}
        >
          <div className="ruleta-decision__dotacion">
            <span className="ruleta-decision__premio">
              <img src="/images/premios/enflora_stickers_web_1280.webp" alt="" width="96" height="96" />
              <span className="ruleta-decision__multiplicador">x2</span>
            </span>
            <span className="ruleta-decision__premio">
              <img src="/images/premios/enflora_filtros_web_1280.webp" alt="" width="96" height="96" />
              <span className="ruleta-decision__multiplicador">x2</span>
            </span>
          </div>
          <h2 className="ruleta-decision__titulo">Fuerte al medio</h2>
          <p className="ruleta-decision__descripcion">Te llevás 2 stickers a elección y 2 filtros.</p>
          {!seguroDisponible ? (
            <p className="ruleta-decision__aviso">Ahora no hay stock para el premio seguro.</p>
          ) : null}
        </motion.button>

        <span className="ruleta-decision__separador" aria-hidden="true">
          O
        </span>

        <motion.button
          type="button"
          className="ruleta-decision__opcion ruleta-decision__opcion--riesgo"
          onClick={onArriesgar}
          disabled={bloqueada}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          whileTap={bloqueada ? undefined : toque}
          transition={{
            opacity: { delay: 0.18, duration: 0.35 },
            x: { delay: 0.18, duration: 0.35 },
            scale: transicionToque,
          }}
        >
          <ImagenRuleta
            clave="floraBienvenida"
            alt=""
            icono="bienvenida"
            className="ruleta-decision__flora"
          />
          <h2 className="ruleta-decision__titulo">Por la Tota todo</h2>
          <p className="ruleta-decision__descripcion">
            Jugá por un picador, un tuquero o por menos stickers.
          </p>
        </motion.button>
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
