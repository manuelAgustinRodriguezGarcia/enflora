"use client";

import { motion } from "motion/react";

export function SpinnerCarga({ className = "", size = 22, etiqueta = "Cargando" }) {
  return (
    <span className={`spinner-carga ${className}`.trim()} role="status" aria-label={etiqueta}>
      <motion.span
        className="spinner-carga__aro"
        style={{ width: size, height: size }}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </span>
  );
}
