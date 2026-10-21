"use client";

import { motion } from "motion/react";
import { toque, transicionToque } from "@/lib/animaciones";

export function BotonRuleta({ children, variante = "primario", className = "", type = "button", ...props }) {
  return (
    <motion.button
      type={type}
      className={`ruleta-boton ruleta-boton--${variante}${className ? ` ${className}` : ""}`}
      whileTap={props.disabled ? undefined : { ...toque, scale: 0.96 }}
      transition={transicionToque}
      {...props}
    >
      {children}
    </motion.button>
  );
}
