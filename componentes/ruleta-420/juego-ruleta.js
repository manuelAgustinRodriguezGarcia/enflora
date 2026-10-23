"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BotonRuleta } from "@/componentes/ruleta-420/boton-ruleta";
import { Marcador } from "@/componentes/ruleta-420/marcador";
import { ModalPresentacion, leerDiversionRuleta, marcarDiversionRuleta } from "@/componentes/ruleta-420/modal-presentacion";
import { ModalRuleta } from "@/componentes/ruleta-420/modal-ruleta";
import { PantallaBienvenida } from "@/componentes/ruleta-420/pantalla-bienvenida";
import { PantallaDecision } from "@/componentes/ruleta-420/pantalla-decision";
import { PantallaPregunta } from "@/componentes/ruleta-420/pantalla-pregunta";
import { PantallaResultadoPremio } from "@/componentes/ruleta-420/pantalla-resultado-premio";
import { PantallaRuletaCategorias } from "@/componentes/ruleta-420/pantalla-ruleta-categorias";
import { PantallaRuletaPremios } from "@/componentes/ruleta-420/pantalla-ruleta-premios";
import { PantallaDerrota } from "@/componentes/ruleta-420/pantallas-cierre";
import {
  ACIERTOS_PARA_GANAR,
  DURACION_GIRO_MS,
  VIDAS_INICIALES,
  DURACION_GIRO_REDUCIDO_MS,
  PAUSA_RESULTADO_RULETA_MS,
  PREMIO_ASEGURADO,
} from "@/lib/ruleta-420/configuracion";
import {
  FASES_PARTIDA,
  buscarCategoria,
  buscarPregunta,
  crearPartida,
  estadoInicial,
  pantallaDeFase,
  reducirRuleta,
  rotacionHasta,
  SECTORES_CATEGORIAS,
  sectoresDePremios,
} from "@/lib/ruleta-420/logica";

const CLAVE_PARTIDA = "enflora-ruleta-partida";
const CLAVE_PORTADA = "enflora-ruleta-portada";

async function pedirRuleta(accion, extra = {}) {
  const respuesta = await fetch("/api/expo-cannabis/ruleta", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accion, ...extra }),
    cache: "no-store",
  });
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !datos?.ok) {
    throw new Error(datos?.error || "No se pudo continuar la partida.");
  }
  return datos;
}

function estadoDesdePartida(partida) {
  const base = crearPartida(() => 0);
  base.partidaId = partida.id;
  base.vidas = partida.vidas;
  base.aciertos = partida.aciertos;
  base.ronda = partida.ronda;
  base.rondaEspecial = partida.rondaEspecial;
  base.usadas = Array.isArray(partida.usadas) ? partida.usadas : [];
  base.categoriaId = partida.categoriaId || partida.pregunta?.category || null;
  base.pregunta = partida.pregunta || null;
  base.preguntaId = partida.pregunta?.id || null;
  base.premioId = partida.resultado || null;
  base.elegibles = partida.elegibles || null;
  base.sectoresPremio = Array.isArray(partida.elegibles) ? sectoresDePremios() : null;
  base.modoPremio = partida.resultado === PREMIO_ASEGURADO ? "asegurado" : partida.resultado ? "arriesgado" : null;
  if (partida.estado === "resuelta") base.fase = "prize-result";
  else if (partida.estado === "ganada") base.fase = "prize-decision";
  else if (partida.estado === "perdida") base.fase = "defeat";
  else if (partida.pregunta && partida.respondida === false) base.fase = "question";
  else base.fase = "category-wheel";
  return base;
}

export function JuegoRuleta() {
  const [estado, despachar] = useReducer(reducirRuleta, undefined, estadoInicial);
  const [confirmarReinicio, setConfirmarReinicio] = useState(false);
  const [presentacionAbierta, setPresentacionAbierta] = useState(false);
  const [cicloPresentacion, setCicloPresentacion] = useState(0);
  const modoInicio = useRef("empezar");
  const reducido = useReducedMotion();
  const duracionGiro = reducido ? DURACION_GIRO_REDUCIDO_MS : DURACION_GIRO_MS;
  const pausa = reducido ? 700 : PAUSA_RESULTADO_RULETA_MS;
  const pantalla = pantallaDeFase(estado.fase);
  const contenedor = useRef(null);
  const registroEnCurso = useRef(false);
  const ocupado = useRef(false);
  const ignorarRestauracion = useRef(false);
  const [aviso, setAviso] = useState("");
  const [seguroDisponible, setSeguroDisponible] = useState(true);

  useEffect(() => {
    const pasos = {
      "spinning-category": ["detener-categoria", duracionGiro],
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const desdePortada = params.get("bienvenida") === "1" || window.sessionStorage.getItem(CLAVE_PORTADA) === "1";
    if (params.get("bienvenida") === "1") {
      window.sessionStorage.setItem(CLAVE_PORTADA, "1");
      params.delete("bienvenida");
      const consulta = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${consulta ? `?${consulta}` : ""}`);
    }
    if (desdePortada) {
      window.setTimeout(() => window.sessionStorage.removeItem(CLAVE_PORTADA), 0);
      return undefined;
    }

    const id = window.sessionStorage.getItem(CLAVE_PARTIDA);
    if (!id) return undefined;
    let vigente = true;
    pedirRuleta("estado", { partidaId: id })
      .then((datos) => {
        if (!vigente || ignorarRestauracion.current || !datos.partida) return;
        despachar({ type: "restaurar", estado: estadoDesdePartida(datos.partida) });
      })
      .catch((error) => {
        if (String(error?.message || "").includes("No se encontró")) {
          window.sessionStorage.removeItem(CLAVE_PARTIDA);
        }
      });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (estado.fase !== "prize-decision" || !estado.partidaId) return undefined;
    let vigente = true;
    pedirRuleta("disponibilidad", { partidaId: estado.partidaId })
      .then((datos) => {
        if (vigente) setSeguroDisponible(Boolean(datos.seguro));
      })
      .catch(() => {
        if (vigente) setSeguroDisponible(true);
      });
    return () => {
      vigente = false;
    };
  }, [estado.fase, estado.partidaId]);

  const registrarParticipacion = () => {
    if (registroEnCurso.current) return;
    registroEnCurso.current = true;
    fetch("/api/expo-cannabis/participar", { method: "POST", keepalive: true, cache: "no-store" })
      .catch(() => {})
      .finally(() => {
        registroEnCurso.current = false;
      });
  };

  const comenzarPartida = async (tipo) => {
    if (ocupado.current) return;
    ocupado.current = true;
    ignorarRestauracion.current = true;
    setAviso("");
    try {
      const datos = await pedirRuleta("empezar");
      window.sessionStorage.setItem(CLAVE_PARTIDA, datos.partidaId);
      const partida = crearPartida();
      partida.partidaId = datos.partidaId;
      partida.rondaEspecial = datos.rondaEspecial;
      despachar({ type: tipo, partida });
      registrarParticipacion();
    } catch (error) {
      setAviso(error.message);
    } finally {
      ocupado.current = false;
    }
  };

  const abrirPresentacion = (tipo) => {
    if (ocupado.current) return;
    modoInicio.current = tipo;
    if (estado.fase === "rules") despachar({ type: "cerrar-reglas" });
    setAviso("");
    if (leerDiversionRuleta()) {
      if (tipo === "reiniciar") window.sessionStorage.removeItem(CLAVE_PARTIDA);
      comenzarPartida(tipo);
      return;
    }
    setCicloPresentacion((valor) => valor + 1);
    setPresentacionAbierta(true);
  };

  const empezar = () => abrirPresentacion("empezar");

  const presentacionLista = (_nombre, opciones) => {
    setPresentacionAbierta(false);
    if (opciones?.diversion) marcarDiversionRuleta();
    if (modoInicio.current === "reiniciar") window.sessionStorage.removeItem(CLAVE_PARTIDA);
    comenzarPartida(modoInicio.current);
  };

  const reiniciar = () => abrirPresentacion("reiniciar");

  const volverInicio = () => {
    window.sessionStorage.removeItem(CLAVE_PARTIDA);
    setAviso("");
    despachar({ type: "volver-inicio" });
  };

  const girarCategoria = async () => {
    if (ocupado.current || estado.fase !== "category-wheel" || !estado.partidaId) return;
    ocupado.current = true;
    setAviso("");
    try {
      const plan = await pedirRuleta("planificar", { partidaId: estado.partidaId });
      const rotacion = rotacionHasta(estado.rotacionCategoria, SECTORES_CATEGORIAS, plan.categoriaId);
      despachar({
        type: "girar-categoria",
        plan: { ...plan, rotacion },
      });
    } catch (error) {
      setAviso(error.message);
    } finally {
      ocupado.current = false;
    }
  };

  const responder = async (indice) => {
    if (ocupado.current || estado.fase !== "question" || !estado.partidaId) return;
    ocupado.current = true;
    setAviso("");
    const previa = { aciertos: estado.aciertos, vidas: estado.vidas };
    const local = buscarPregunta(estado.pregunta?.id);
    if (local && Number.isInteger(local.correctAnswer)) {
      const acerto = indice === local.correctAnswer;
      despachar({
        type: "responder",
        indice,
        acerto,
        correcta: local.correctAnswer,
        aciertos: acerto ? previa.aciertos + 1 : previa.aciertos,
        vidas: acerto ? previa.vidas : Math.max(0, previa.vidas - 1),
        explanation: local.explanation || "",
      });
    }
    try {
      const datos = await pedirRuleta("responder", { partidaId: estado.partidaId, indice });
      despachar({
        type: "responder",
        indice,
        acerto: datos.acerto,
        correcta: datos.correcta,
        aciertos: datos.aciertos,
        vidas: datos.vidas,
        explanation: datos.explanation,
      });
    } catch (error) {
      if (local && Number.isInteger(local.correctAnswer)) {
        despachar({ type: "revertir-respuesta", ...previa });
      }
      setAviso(error.message);
    } finally {
      ocupado.current = false;
    }
  };

  const asegurar = async () => {
    if (ocupado.current || !estado.partidaId || !seguroDisponible) return;
    if (estado.fase !== "prize-decision" && estado.fase !== "prize-confirmation") return;
    ocupado.current = true;
    setAviso("");
    try {
      const datos = await pedirRuleta("asegurar", { partidaId: estado.partidaId });
      despachar({ type: "mostrar-premio", premioId: datos.premioId, elegibles: datos.elegibles });
    } catch (error) {
      setAviso(error.message);
    } finally {
      ocupado.current = false;
    }
  };

  const confirmarRiesgo = async () => {
    if (ocupado.current || estado.fase !== "prize-confirmation") return;
    ocupado.current = true;
    setAviso("");
    try {
      const datos = await pedirRuleta("preview", { partidaId: estado.partidaId });
      const sectores = sectoresDePremios();
      const hayPremio = (datos.elegibles || []).some((item) => Number(item.peso) > 0);
      if (!hayPremio) {
        setAviso("No hay premios disponibles para arriesgar.");
        return;
      }
      despachar({ type: "confirmar-riesgo", sectores, elegibles: datos.elegibles });
    } catch (error) {
      setAviso(error.message);
    } finally {
      ocupado.current = false;
    }
  };

  const girarPremio = async () => {
    if (ocupado.current || estado.fase !== "prize-wheel" || estado.premioId || !estado.partidaId) return;
    ocupado.current = true;
    setAviso("");
    try {
      const datos = await pedirRuleta("arriesgar", { partidaId: estado.partidaId });
      const sectores = sectoresDePremios();
      const sector = sectores.find((item) => item.id === datos.premioId);
      if (!sector) {
        despachar({ type: "mostrar-premio", premioId: datos.premioId, elegibles: datos.elegibles });
        return;
      }
      const base = estado.sectoresPremio?.length === sectores.length ? estado.rotacionPremio : -sectores[0].centro;
      despachar({
        type: "girar-premio",
        plan: {
          premioId: datos.premioId,
          rotacion: rotacionHasta(base, sectores, datos.premioId),
          sectores,
          elegibles: datos.elegibles,
        },
      });
    } catch (error) {
      setAviso(error.message);
    } finally {
      ocupado.current = false;
    }
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
          onResponder={() => despachar({ type: "mostrar-pregunta" })}
        />
      );
      break;
    case "pregunta": {
      const categoria = buscarCategoria(estado.categoriaId);
      contenido =
        estado.pregunta && categoria ? (
          <PantallaPregunta
            pregunta={estado.pregunta}
            categoria={categoria}
            fase={estado.fase}
            respuesta={estado.respuesta}
            acerto={estado.acerto}
            terminada={estado.aciertos >= ACIERTOS_PARA_GANAR || estado.vidas <= 0}
            onResponder={responder}
            onSiguiente={() => despachar({ type: "siguiente" })}
          />
        ) : null;
      break;
    }
    case "defeat":
      contenido = <PantallaDerrota aciertos={estado.aciertos} onReintentar={reiniciar} />;
      break;
    case "decision":
      contenido = (
        <PantallaDecision
          fase={estado.fase}
          seguroDisponible={seguroDisponible}
          onAsegurar={asegurar}
          onArriesgar={() => despachar({ type: "arriesgar" })}
          onConfirmar={confirmarRiesgo}
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
          sectores={estado.sectoresPremio}
          onGirar={girarPremio}
        />
      );
      break;
    case "prize-result":
      contenido = <PantallaResultadoPremio premioId={estado.premioId} onVolver={volverInicio} />;
      break;
    default:
      contenido = null;
  }

  const enPartida = FASES_PARTIDA.has(estado.fase);
  const enRuleta = pantalla === "ruleta";
  const huboIntento = estado.ronda > 0 || estado.aciertos > 0 || estado.vidas < VIDAS_INICIALES;

  return (
    <div
      className={`ruleta-juego${pantalla === "decision" ? " ruleta-juego--decision" : ""}${pantalla === "ruleta-premios" ? " ruleta-juego--premios" : ""}`}
      ref={contenedor}
    >
      <div className="ruleta-juego__contenedor">
        <header className="ruleta-juego__cabecera">
          <Link href="/" className="ruleta-juego__marca" aria-label="Ir al inicio">
            <img
              className="ruleta-juego__logo"
              src="/logos/enflora-logo-apaisado-light.svg"
              alt=""
              width={1000}
              height={300}
              decoding="async"
            />
          </Link>
          {enRuleta ? (
            <BotonRuleta
              variante="secundario"
              className="ruleta-juego__reiniciar"
              onClick={() => setConfirmarReinicio(true)}
              disabled={!huboIntento || estado.fase === "spinning-category"}
            >
              Reiniciar
            </BotonRuleta>
          ) : null}
        </header>

        {aviso ? (
          <p className="ruleta-aviso" role="alert">
            {aviso}
          </p>
        ) : null}

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
        <AnimatePresence initial={false}>
          {enPartida ? (
            <motion.div
              key="marcador"
              className="ruleta-juego__marcador"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <Marcador vidas={estado.vidas} aciertos={estado.aciertos} />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <ModalPresentacion
          key={cicloPresentacion}
          abierto={presentacionAbierta}
          onCerrar={() => setPresentacionAbierta(false)}
          onListo={presentacionLista}
        />
        <ModalRuleta
          abierto={confirmarReinicio}
          onCerrar={() => setConfirmarReinicio(false)}
          titulo="¿REINICIAR INTENTO?"
          descripcion="Se pierde el progreso de esta partida y empezás de cero."
          className="ruleta-modal__panel--alerta"
        >
          <div className="ruleta-acciones">
            <BotonRuleta
              onClick={() => {
                setConfirmarReinicio(false);
                reiniciar();
              }}
            >
              SÍ, REINICIAR
            </BotonRuleta>
            <BotonRuleta variante="secundario" onClick={() => setConfirmarReinicio(false)}>
              SEGUIR JUGANDO
            </BotonRuleta>
          </div>
        </ModalRuleta>
      </div>
    </div>
  );
}
