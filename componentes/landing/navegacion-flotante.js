"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { desplazarASeccion } from "@/componentes/landing/desplazar-seccion";
import { navegacionFlotante } from "@/lib/landing";

const UMBRAL_SCROLL = 120;

function desplazarA(id, inmediato) {
  desplazarASeccion(id, { suave: !inmediato });
}

function IconoMorph({ abierto }) {
  const puntos = [
    { cx: 8, cy: 8 },
    { cx: 16, cy: 8 },
    { cx: 8, cy: 16 },
    { cx: 16, cy: 16 },
  ];

  return (
    <svg className="nav-flotante__morph" viewBox="0 0 24 24" aria-hidden="true">
      {puntos.map((punto, indice) => {
        const esDiagonalA = indice === 0 || indice === 3;
        const esDiagonalB = indice === 1 || indice === 2;
        let destino = punto;
        if (abierto) {
          if (esDiagonalA) destino = { cx: 12, cy: 12 };
          if (esDiagonalB) destino = { cx: 12, cy: 12 };
        }
        return (
          <motion.circle
            key={indice}
            r={abierto ? 1.1 : 2.15}
            fill="currentColor"
            initial={false}
            animate={{
              cx: destino.cx,
              cy: destino.cy,
              opacity: abierto ? 0 : 1,
              scale: abierto ? 0.4 : 1,
            }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
          />
        );
      })}
      <motion.line
        x1="7"
        y1="7"
        x2="17"
        y2="17"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        initial={false}
        animate={{ pathLength: abierto ? 1 : 0, opacity: abierto ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      />
      <motion.line
        x1="17"
        y1="7"
        x2="7"
        y2="17"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        initial={false}
        animate={{ pathLength: abierto ? 1 : 0, opacity: abierto ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30, delay: abierto ? 0.04 : 0 }}
      />
    </svg>
  );
}

export function NavegacionFlotante() {
  const [visible, setVisible] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const reducido = useReducedMotion();
  const menuId = useId();
  const raizRef = useRef(null);
  const botonMenuRef = useRef(null);
  const visibleRef = useRef(false);

  useEffect(() => {
    let raf = 0;

    const actualizar = () => {
      raf = 0;
      const siguiente = window.scrollY > UMBRAL_SCROLL;
      if (siguiente === visibleRef.current) return;
      visibleRef.current = siguiente;
      setVisible(siguiente);
      if (!siguiente) setAbierto(false);
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(actualizar);
    };

    actualizar();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!abierto) return undefined;

    const onKey = (evento) => {
      if (evento.key === "Escape") {
        setAbierto(false);
        botonMenuRef.current?.focus();
      }
    };

    const onPointer = (evento) => {
      if (!raizRef.current?.contains(evento.target)) {
        setAbierto(false);
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [abierto]);

  const irA = (id) => {
    setAbierto(false);
    window.requestAnimationFrame(() => {
      desplazarA(id, Boolean(reducido));
    });
  };

  const transicionEntrada = reducido
    ? { duration: 0.01 }
    : { duration: 0.3, ease: [0.22, 1, 0.36, 1] };

  return (
    <div
      className={`nav-flotante${visible ? " nav-flotante--visible" : ""}`}
      ref={raizRef}
      aria-hidden={!visible}
    >
      <motion.button
        type="button"
        className="nav-flotante__boton nav-flotante__boton--arriba"
        aria-label="Volver arriba"
        tabIndex={visible ? 0 : -1}
        initial={false}
        animate={
          visible
            ? { opacity: 1, y: 0, scale: 1 }
            : { opacity: 0, y: 12, scale: 0.9 }
        }
        transition={transicionEntrada}
        onClick={() => desplazarA("inicio", Boolean(reducido))}
        whileTap={reducido || !visible ? undefined : { scale: 0.94 }}
      >
        <ArrowUp size={22} aria-hidden="true" />
      </motion.button>

      <div className="nav-flotante__menu">
        <AnimatePresence>
          {abierto && visible ? (
            <motion.ul
              className="nav-flotante__opciones"
              id={menuId}
              initial="cerrado"
              animate="abierto"
              exit="cerrado"
              variants={{
                abierto: {
                  transition: { staggerChildren: 0.06, delayChildren: 0.02 },
                },
                cerrado: {
                  transition: { staggerChildren: 0.04, staggerDirection: -1 },
                },
              }}
            >
              {navegacionFlotante.map((item) => (
                <motion.li
                  key={item.id}
                  variants={{
                    cerrado: { opacity: 0, y: 10, scale: 0.92 },
                    abierto: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { type: "spring", stiffness: 420, damping: 26 },
                    },
                  }}
                >
                  <button
                    type="button"
                    className={`nav-flotante__opcion${item.acento ? " nav-flotante__opcion--acento" : ""}`}
                    onClick={() => irA(item.id)}
                  >
                    {item.etiqueta}
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>

        <motion.button
          type="button"
          ref={botonMenuRef}
          className="nav-flotante__boton nav-flotante__boton--menu"
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={abierto}
          aria-controls={menuId}
          tabIndex={visible ? 0 : -1}
          initial={false}
          animate={
            visible
              ? { opacity: 1, y: 0, scale: 1 }
              : { opacity: 0, y: 12, scale: 0.9 }
          }
          transition={transicionEntrada}
          onClick={() => setAbierto((valor) => !valor)}
          whileTap={reducido || !visible ? undefined : { scale: 0.94 }}
        >
          <IconoMorph abierto={abierto} />
        </motion.button>
      </div>
    </div>
  );
}
