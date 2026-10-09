"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { transicionRapida } from "@/lib/animaciones";

export function Aparecer({ visible, children }) {
  const reducido = useReducedMotion();
  const cerrado = reducido ? { opacity: 0 } : { opacity: 0, height: 0, y: 4 };
  const abierto = reducido ? { opacity: 1 } : { opacity: 1, height: "auto", y: 0 };

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          key="aparecer"
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
