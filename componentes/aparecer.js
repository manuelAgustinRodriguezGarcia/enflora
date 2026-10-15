"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { transicionRapida } from "@/lib/animaciones";

export function Aparecer({ visible, children, espacio }) {
  const reducido = useReducedMotion();
  const conEspacio = Boolean(espacio);
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
