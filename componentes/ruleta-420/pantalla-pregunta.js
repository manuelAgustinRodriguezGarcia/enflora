"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { BotonRuleta } from "@/componentes/ruleta-420/boton-ruleta";
import { ImagenRuleta } from "@/componentes/ruleta-420/imagen-ruleta";
import { LOGO_ENFLORA } from "@/lib/ruleta-420/configuracion";

const LETRAS = ["A", "B", "C", "D"];

function claseOpcion(indice, pregunta, respuesta, conRespuesta, acerto) {
  const clases = ["ruleta-opcion"];
  if (!conRespuesta) return clases.join(" ");
  if (indice === pregunta.correctAnswer) {
    clases.push("ruleta-opcion--correcta");
    if (pregunta.isSpecial && acerto) clases.push("ruleta-opcion--enflora");
  } else if (indice === respuesta) {
    clases.push("ruleta-opcion--incorrecta");
  } else {
    clases.push("ruleta-opcion--atenuada");
  }
  return clases.join(" ");
}

export function PantallaPregunta({ pregunta, categoria, fase, respuesta, acerto, terminada, onResponder, onSiguiente }) {
  const conRespuesta = fase === "answer-feedback";
  const especialAcertada = conRespuesta && acerto && pregunta.isSpecial;

  let animacionTarjeta = { scale: 1, x: 0 };
  if (conRespuesta && acerto) animacionTarjeta = { scale: [1, 1.025, 1], x: 0 };
  if (conRespuesta && !acerto) animacionTarjeta = { scale: 1, x: [0, -10, 10, -7, 7, -3, 0] };

  return (
    <div className="ruleta-pregunta">
      <motion.article
        className={`ruleta-tarjeta${especialAcertada ? " ruleta-tarjeta--enflora" : ""}`}
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, ...animacionTarjeta }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <span
          className="ruleta-tarjeta__categoria"
          style={{ background: categoria.color, color: categoria.colorTexto }}
        >
          {categoria.nombre}
        </span>

        <h2 className="ruleta-tarjeta__pregunta">{pregunta.question}</h2>

        {pregunta.image ? (
          <div className="ruleta-tarjeta__marco">
            <ImagenRuleta
              clave={pregunta.image}
              alt="Imagen ampliada para la pregunta"
              icono="tricomas"
              etiqueta="Imagen ampliada · Mirá de cerca"
              className="ruleta-tarjeta__imagen"
              tono="macro"
            />
            <AnimatePresence>
              {especialAcertada ? (
                <motion.div
                  key="especial"
                  className="ruleta-devolucion__especial"
                  initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 14 }}
                >
                  <img src={LOGO_ENFLORA} alt="ENFLORA" width={1000} height={300} decoding="async" />
                  <strong className="ruleta-devolucion__titulo ruleta-devolucion__titulo--enflora">
                    ¡ESA ES MI ESPECIALIDAD!
                  </strong>
                </motion.div>
              ) : conRespuesta ? (
                <motion.strong
                  className={`ruleta-devolucion__titulo ruleta-devolucion__titulo--${acerto ? "bien" : "mal"}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  {acerto ? "¡BIEN AHÍ!" : "¡UUUH, CASI!"}
                </motion.strong>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}

        <div className="ruleta-opciones" role="group" aria-label="Opciones de respuesta">
          {pregunta.options.map((opcion, indice) => (
            <motion.button
              key={opcion}
              type="button"
              className={claseOpcion(indice, pregunta, respuesta, conRespuesta, acerto)}
              disabled={conRespuesta}
              aria-pressed={respuesta === indice}
              onClick={() => onResponder(indice)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + indice * 0.06, duration: 0.3 }}
              whileTap={conRespuesta ? undefined : { scale: 0.97 }}
            >
              <span className="ruleta-opcion__letra">{LETRAS[indice]}</span>
              <span className="ruleta-opcion__texto">{opcion}</span>
              {conRespuesta && indice === pregunta.correctAnswer ? (
                <Check className="ruleta-opcion__marca" aria-label="Respuesta correcta" />
              ) : null}
              {conRespuesta && indice === respuesta && !acerto ? (
                <X className="ruleta-opcion__marca" aria-label="Tu respuesta" />
              ) : null}
            </motion.button>
          ))}
        </div>

        <AnimatePresence>
          {conRespuesta ? (
            <motion.div
              key="devolucion"
              className="ruleta-devolucion"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.3 }}
              aria-live="assertive"
            >
              {especialAcertada && !pregunta.image ? (
                <motion.div
                  className="ruleta-devolucion__especial"
                  initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 14 }}
                >
                  <img src={LOGO_ENFLORA} alt="ENFLORA" width={1000} height={300} decoding="async" />
                  <strong className="ruleta-devolucion__titulo ruleta-devolucion__titulo--enflora">
                    ¡ESA ES MI ESPECIALIDAD!
                  </strong>
                </motion.div>
              ) : pregunta.image ? null : (
                <motion.strong
                  className={`ruleta-devolucion__titulo ruleta-devolucion__titulo--${acerto ? "bien" : "mal"}`}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 16 }}
                >
                  {acerto ? "¡BIEN AHÍ!" : "¡UUUH, CASI!"}
                </motion.strong>
              )}
              {pregunta.explanation ? <p className="ruleta-devolucion__explicacion">{pregunta.explanation}</p> : null}
              <motion.div
                className="ruleta-acciones"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.25 }}
              >
                <BotonRuleta onClick={onSiguiente}>{terminada ? "VER RESULTADO" : "SIGUIENTE RONDA"}</BotonRuleta>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.article>
    </div>
  );
}
