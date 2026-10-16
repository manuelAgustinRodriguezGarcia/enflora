"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { desplazarASeccion } from "@/componentes/landing/desplazar-seccion";
import { navegacionFlotante } from "@/lib/landing";

const UMBRAL_SCROLL = 120;

function desplazarA(id, inmediato) {
  desplazarASeccion(id, { suave: !inmediato });
}

export function NavegacionFlotante() {
  const [visible, setVisible] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [activoId, setActivoId] = useState(navegacionFlotante[0]?.id ?? "");
  const reducido = useReducedMotion();
  const menuId = useId();
  const raizRef = useRef(null);
  const botonMenuRef = useRef(null);
  const visibleRef = useRef(false);
  const navegandoRef = useRef(false);

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
    const medirActivo = () => {
      if (navegandoRef.current) return;

      const scrollY = window.scrollY;
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const ultimo = navegacionFlotante[navegacionFlotante.length - 1];

      if (maxScroll > 0 && maxScroll - scrollY <= 140 && ultimo) {
        setActivoId((actual) => (actual === ultimo.id ? actual : ultimo.id));
        return;
      }

      const marca = 88;
      let mejor = navegacionFlotante[0]?.id ?? "";

      navegacionFlotante.forEach((item) => {
        const nodo = document.getElementById(item.id);
        if (!nodo || !nodo.isConnected) return;
        if (nodo.getBoundingClientRect().top <= marca + 48) {
          mejor = item.id;
        }
      });

      setActivoId((actual) => (actual === mejor ? actual : mejor));
    };

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        medirActivo();
      });
    };

    medirActivo();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
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
    navegandoRef.current = true;
    setActivoId(id);
    setAbierto(false);
    window.requestAnimationFrame(() => {
      desplazarA(id, Boolean(reducido));
      window.setTimeout(() => {
        navegandoRef.current = false;
      }, 700);
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
              {navegacionFlotante.map((item) => {
                const activo = item.id === activoId;
                return (
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
                      className={`nav-flotante__opcion${activo ? " nav-flotante__opcion--activa" : ""}${item.acento ? " nav-flotante__opcion--acento" : ""}`}
                      aria-current={activo ? "true" : undefined}
                      onClick={() => irA(item.id)}
                    >
                      {item.etiqueta}
                    </button>
                  </motion.li>
                );
              })}
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
          {abierto ? (
            <X size={22} strokeWidth={2.25} aria-hidden="true" />
          ) : (
            <Menu size={22} strokeWidth={2.25} aria-hidden="true" />
          )}
        </motion.button>
      </div>
    </div>
  );
}
