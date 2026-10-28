"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { transicionRapida } from "@/lib/animaciones";

const ESPERA_APERTURA_MS = 190;

function esRaizDeScroll(nodo) {
  return (
    nodo === document.scrollingElement ||
    nodo === document.documentElement ||
    nodo === document.body
  );
}

function puedeDesplazar(nodo) {
  const overflow = getComputedStyle(nodo).overflowY;
  if (overflow !== "auto" && overflow !== "scroll" && overflow !== "overlay") return false;
  return nodo.scrollHeight > nodo.clientHeight + 1;
}

function contenedorDesplazable(nodo) {
  let actual = nodo.parentElement;
  while (actual && !esRaizDeScroll(actual)) {
    if (puedeDesplazar(actual)) return actual;
    actual = actual.parentElement;
  }
  const raiz = document.scrollingElement;
  if (raiz && raiz.scrollHeight > raiz.clientHeight + 1) return raiz;
  return null;
}

function limiteVisible(contenedor) {
  if (esRaizDeScroll(contenedor)) {
    const crudo = getComputedStyle(document.documentElement)
      .getPropertyValue("--space-bottom-nav")
      .trim();
    const base = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const nav = crudo.endsWith("rem") ? Number.parseFloat(crudo) * base : Number.parseFloat(crudo) || 0;
    return { top: 0, bottom: window.innerHeight - nav, height: window.innerHeight - nav };
  }
  const rect = contenedor.getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom, height: rect.height };
}

function desplazarSiHaceFalta(nodo, reducido) {
  const contenedor = contenedorDesplazable(nodo);
  if (!contenedor) return;

  const margen = 12;
  const limite = limiteVisible(contenedor);
  const caja = nodo.getBoundingClientRect();
  const altoVisible = limite.height - margen * 2;
  let delta = 0;

  if (caja.height > altoVisible) {
    delta = caja.top - limite.top - margen;
  } else if (caja.bottom > limite.bottom - margen) {
    delta = caja.bottom - limite.bottom + margen;
  } else if (caja.top < limite.top + margen) {
    delta = caja.top - limite.top - margen;
  }

  if (Math.abs(delta) < 8) return;
  contenedor.scrollBy({ top: delta, behavior: reducido ? "auto" : "smooth" });
}

export function Aparecer({ visible, children, espacio, desplazar = true }) {
  const reducido = useReducedMotion();
  const panel = useRef(null);
  /** true tras el primer render con visible=false (apertura por interacción del usuario). */
  const huboOculto = useRef(!visible);
  const conEspacio = Boolean(espacio);

  useEffect(() => {
    if (!visible) {
      huboOculto.current = true;
      return undefined;
    }
    if (!huboOculto.current || !desplazar) return undefined;

    const timer = window.setTimeout(() => {
      if (panel.current) desplazarSiHaceFalta(panel.current, reducido);
    }, reducido ? 0 : ESPERA_APERTURA_MS);
    return () => window.clearTimeout(timer);
  }, [visible, desplazar, reducido]);
  const cerrado = reducido
    ? { opacity: 0, ...(conEspacio ? { marginTop: 0 } : {}) }
    : { opacity: 0, height: 0, y: 4, ...(conEspacio ? { marginTop: 0 } : {}) };
  const abierto = reducido
    ? { opacity: 1, ...(conEspacio ? { marginTop: espacio } : {}) }
    : { opacity: 1, height: "auto", y: 0, ...(conEspacio ? { marginTop: espacio } : {}) };

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          key="aparecer"
          ref={panel}
          className={conEspacio ? "aparecer aparecer--espacio" : "aparecer"}
          initial={cerrado}
          animate={abierto}
          exit={cerrado}
          transition={transicionRapida}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function TextoCambio({ children }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={String(children)}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={transicionRapida}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}
