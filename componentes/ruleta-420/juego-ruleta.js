"use client";

import { useEffect, useReducer, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Marcador } from "@/componentes/ruleta-420/marcador";
import { PantallaBienvenida } from "@/componentes/ruleta-420/pantalla-bienvenida";
import { PantallaDecision } from "@/componentes/ruleta-420/pantalla-decision";
import { PantallaPregunta } from "@/componentes/ruleta-420/pantalla-pregunta";
import { PantallaResultadoPremio } from "@/componentes/ruleta-420/pantalla-resultado-premio";
import { PantallaRuletaCategorias } from "@/componentes/ruleta-420/pantalla-ruleta-categorias";
import { PantallaRuletaPremios } from "@/componentes/ruleta-420/pantalla-ruleta-premios";
import { PantallaDerrota, PantallaVictoria } from "@/componentes/ruleta-420/pantallas-cierre";
import {
  ACIERTOS_PARA_GANAR,
  DURACION_GIRO_MS,
  DURACION_GIRO_REDUCIDO_MS,
  LOGO_ENFLORA,
  PAUSA_RESULTADO_RULETA_MS,
} from "@/lib/ruleta-420/configuracion";
import {
  FASES_PARTIDA,
  buscarCategoria,
  buscarPregunta,
  crearPartida,
  estadoInicial,
  pantallaDeFase,
  planificarPremio,
  planificarRonda,
  reducirRuleta,
} from "@/lib/ruleta-420/logica";

export function JuegoRuleta() {
  const [estado, despachar] = useReducer(reducirRuleta, undefined, estadoInicial);
  const reducido = useReducedMotion();
  const duracionGiro = reducido ? DURACION_GIRO_REDUCIDO_MS : DURACION_GIRO_MS;
  const pausa = reducido ? 700 : PAUSA_RESULTADO_RULETA_MS;
  const pantalla = pantallaDeFase(estado.fase);
  const contenedor = useRef(null);

  useEffect(() => {
    const pasos = {
      "spinning-category": ["detener-categoria", duracionGiro],
      "category-result": ["mostrar-pregunta", pausa],
      "spinning-prize": ["detener-premio", duracionGiro],
      "prize-reveal": ["mostrar-resultado", pausa],
    };
    const paso = pasos[estado.fase];
    if (!paso) return undefined;
    const temporizador = window.setTimeout(() => despachar({ type: paso[0] }), paso[1]);
    return () => window.clearTimeout(temporizador);
  }, [estado.fase, duracionGiro, pausa]);

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;
    if (nodo.getBoundingClientRect().top < 0) {
      nodo.scrollIntoView({ block: "start", behavior: reducido ? "auto" : "smooth" });
    }
  }, [pantalla, reducido]);

  const empezar = () => despachar({ type: "empezar", partida: crearPartida() });
  const reiniciar = () => despachar({ type: "reiniciar", partida: crearPartida() });
  const girarCategoria = () => {
    if (estado.fase !== "category-wheel") return;
    despachar({ type: "girar-categoria", plan: planificarRonda(estado) });
  };
  const girarPremio = () => {
    if (estado.fase !== "prize-wheel" || estado.premioId) return;
    despachar({ type: "girar-premio", plan: planificarPremio(estado) });
  };

  let contenido = null;
  switch (pantalla) {
    case "bienvenida":
      contenido = (
        <PantallaBienvenida
          reglasAbiertas={estado.fase === "rules"}
          onJugar={empezar}
          onAbrirReglas={() => despachar({ type: "abrir-reglas" })}
          onCerrarReglas={() => despachar({ type: "cerrar-reglas" })}
        />
      );
      break;
    case "ruleta":
      contenido = (
        <PantallaRuletaCategorias
          fase={estado.fase}
          ronda={estado.ronda}
          categoriaId={estado.categoriaId}
          rotacion={estado.rotacionCategoria}
          duracion={duracionGiro}
          onGirar={girarCategoria}
        />
      );
      break;
    case "pregunta": {
      const pregunta = buscarPregunta(estado.preguntaId);
      const categoria = buscarCategoria(estado.categoriaId);
      contenido =
        pregunta && categoria ? (
          <PantallaPregunta
            pregunta={pregunta}
            categoria={categoria}
            fase={estado.fase}
            respuesta={estado.respuesta}
            acerto={estado.acerto}
            terminada={estado.aciertos >= ACIERTOS_PARA_GANAR || estado.vidas <= 0}
            onResponder={(indice) => despachar({ type: "responder", indice })}
            onSiguiente={() => despachar({ type: "siguiente" })}
          />
        ) : null;
      break;
    }
    case "victory":
      contenido = <PantallaVictoria onContinuar={() => despachar({ type: "ver-premios" })} />;
      break;
    case "defeat":
      contenido = <PantallaDerrota aciertos={estado.aciertos} onReintentar={reiniciar} />;
      break;
    case "decision":
      contenido = (
        <PantallaDecision
          fase={estado.fase}
          onAsegurar={() => despachar({ type: "asegurar" })}
          onArriesgar={() => despachar({ type: "arriesgar" })}
          onConfirmar={() => despachar({ type: "confirmar-riesgo" })}
          onCancelar={() => despachar({ type: "cancelar-riesgo" })}
        />
      );
      break;
    case "ruleta-premios":
      contenido = (
        <PantallaRuletaPremios
          fase={estado.fase}
          premioId={estado.premioId}
          rotacion={estado.rotacionPremio}
          duracion={duracionGiro}
          onGirar={girarPremio}
        />
      );
      break;
    case "prize-result":
      contenido = (
        <PantallaResultadoPremio
          premioId={estado.premioId}
          modoPremio={estado.modoPremio}
          onVolver={() => despachar({ type: "volver-inicio" })}
        />
      );
      break;
    default:
      contenido = null;
  }

  const enPartida = FASES_PARTIDA.has(estado.fase);

  return (
    <div className="ruleta-juego" ref={contenedor}>
      <div className="ruleta-juego__contenedor">
        <header className="ruleta-juego__cabecera">
          <img
            className="ruleta-juego__logo"
            src={LOGO_ENFLORA}
            alt="ENFLORA"
            width={1000}
            height={300}
            decoding="async"
          />
          <AnimatePresence initial={false}>
            {enPartida ? (
              <motion.div
                key="marcador"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Marcador vidas={estado.vidas} aciertos={estado.aciertos} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={pantalla}
            className="ruleta-juego__pantalla"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {contenido}
          </motion.section>
        </AnimatePresence>
      </div>
    </div>
  );
}
