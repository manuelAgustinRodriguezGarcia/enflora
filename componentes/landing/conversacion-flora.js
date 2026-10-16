"use client";

import { Ticket } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import TextType from "@/componentes/landing/text-type";

const MENSAJE_INICIAL = "Entrada en mano porfavor!";

const OPCIONES = [
  {
    id: "entrada",
    etiqueta: "Sí, acá está!",
    respuesta: "Pefeeeto caballedo pefeeto!",
  },
  {
    id: "lista",
    etiqueta: "Estoy en la lista querida!",
    respuesta: "Es cierto! Mil disculpas.",
  },
  {
    id: "famoso",
    etiqueta: "Dejame entrar no sabes quién soy?",
    respuesta: "Aguantaaa, a ver la entrada?",
  },
];

const ENTRADA_BURBUJA = {
  initial: { opacity: 0, y: 10, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
};

function BurbujaFlora({ id, texto, animar, onListo, reducido }) {
  const listoRef = useRef(false);
  const [terminado, setTerminado] = useState(() => !animar || Boolean(reducido));

  const alTerminar = useCallback(() => {
    if (listoRef.current) return;
    listoRef.current = true;
    setTerminado(true);
    onListo?.();
  }, [onListo]);

  useEffect(() => {
    if (!animar || !reducido || terminado) return undefined;
    const t = window.setTimeout(alTerminar, 30);
    return () => window.clearTimeout(t);
  }, [animar, reducido, terminado, alTerminar]);

  const escribir = animar && !terminado && !reducido;

  return (
    <motion.div
      className="flora-chat__fila flora-chat__fila--flora"
      layout={false}
      {...(reducido ? { initial: false, animate: { opacity: 1 } } : ENTRADA_BURBUJA)}
    >
      <div className="flora-chat__burbuja flora-chat__burbuja--flora">
        <span className="flora-chat__sr">{texto}</span>
        <span className="flora-chat__medida" aria-hidden="true">
          {texto}
        </span>
        <span className="flora-chat__escrito" aria-hidden="true">
          {escribir ? (
            <TextType
              key={id}
              text={texto}
              as="span"
              typingSpeed={35}
              loop={false}
              typeEffect="fade"
              mistakes={0}
              showCursor
              cursorStyle="bar"
              cursorBlinkDuration={0.5}
              onTypingComplete={alTerminar}
            />
          ) : (
            <span>{texto}</span>
          )}
        </span>
      </div>
    </motion.div>
  );
}

function BurbujaUsuario({ texto, reducido }) {
  return (
    <motion.div
      className="flora-chat__fila flora-chat__fila--usuario"
      layout={false}
      {...(reducido ? { initial: false, animate: { opacity: 1 } } : ENTRADA_BURBUJA)}
    >
      <div className="flora-chat__burbuja flora-chat__burbuja--usuario">{texto}</div>
    </motion.div>
  );
}

export function ConversacionFlora({ onContinuar, className = "" }) {
  const reducido = useReducedMotion();
  const tituloId = useId();
  const listaRef = useRef(null);
  const [fase, setFase] = useState("intro");
  const [mensajes, setMensajes] = useState([
    { id: "flora-intro", rol: "flora", texto: MENSAJE_INICIAL, animar: true },
  ]);
  const [bloqueo, setBloqueo] = useState(false);

  const scrollInterno = useCallback(() => {
    const nodo = listaRef.current;
    if (!nodo) return;
    nodo.scrollTop = nodo.scrollHeight;
  }, []);

  useEffect(() => {
    scrollInterno();
  }, [mensajes, fase, scrollInterno]);

  const alListoIntro = useCallback(() => {
    setFase((actual) => (actual === "intro" ? "choosing" : actual));
  }, []);

  const alListoRespuesta = useCallback(() => {
    setFase((actual) => (actual === "replying" ? "completed" : actual));
    setBloqueo(false);
  }, []);

  const elegir = useCallback(
    (opcion) => {
      if (fase !== "choosing" || bloqueo) return;
      setBloqueo(true);
      setFase("replying");
      setMensajes((previos) => [
        ...previos,
        { id: `usuario-${opcion.id}`, rol: "usuario", texto: opcion.etiqueta },
        {
          id: `flora-${opcion.id}`,
          rol: "flora",
          texto: opcion.respuesta,
          animar: true,
        },
      ]);
    },
    [fase, bloqueo],
  );

  return (
    <section
      className={`flora-chat ${className}`.trim()}
      aria-labelledby={tituloId}
      aria-live="polite"
    >
      <header className="flora-chat__cabecera">
        <Image
          src="/logos/enflora-isotipo-light.svg"
          alt=""
          width={28}
          height={28}
          className="flora-chat__avatar"
          unoptimized
        />
        <div className="flora-chat__identidad">
          <h3 id={tituloId} className="flora-chat__nombre">
            Flora Tricoma
          </h3>
          <p className="flora-chat__rol">Seguridad VIP de ENFLORA</p>
        </div>
      </header>

      <div className="flora-chat__mensajes" ref={listaRef}>
        {mensajes.map((mensaje) =>
          mensaje.rol === "usuario" ? (
            <BurbujaUsuario key={mensaje.id} texto={mensaje.texto} reducido={reducido} />
          ) : (
            <BurbujaFlora
              key={mensaje.id}
              id={mensaje.id}
              texto={mensaje.texto}
              animar={Boolean(mensaje.animar)}
              onListo={mensaje.id === "flora-intro" ? alListoIntro : alListoRespuesta}
              reducido={reducido}
            />
          ),
        )}
      </div>

      <div className="flora-chat__pie">
        <AnimatePresence mode="wait">
          {fase === "choosing" ? (
            <motion.div
              key="opciones"
              className="flora-chat__opciones"
              initial={reducido ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducido ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <p className="flora-chat__opciones-titulo">Elegí tu respuesta</p>
              {OPCIONES.map((opcion, indice) => (
                <motion.button
                  key={opcion.id}
                  type="button"
                  className="flora-chat__opcion"
                  disabled={bloqueo}
                  onClick={() => elegir(opcion)}
                  initial={reducido ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.24,
                    delay: reducido ? 0 : 0.06 + indice * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {opcion.etiqueta}
                </motion.button>
              ))}
            </motion.div>
          ) : null}

          {fase === "completed" ? (
            <motion.div
              key="continuar"
              className="flora-chat__continuar-wrap"
              initial={reducido ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <button type="button" className="flora-chat__continuar" onClick={onContinuar}>
                <Ticket aria-hidden="true" strokeWidth={1.75} />
                Agarrar entrada
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
