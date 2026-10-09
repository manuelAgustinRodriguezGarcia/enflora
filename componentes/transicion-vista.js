"use client";

import { motion } from "motion/react";
import { entradaVista } from "@/lib/animaciones";

export function TransicionVista({ children }) {
  return (
    <motion.div
      initial={entradaVista.initial}
      animate={entradaVista.animate}
      transition={entradaVista.transition}
    >
      {children}
    </motion.div>
  );
}
