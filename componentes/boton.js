"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { toque, transicionToque } from "@/lib/animaciones";

const Enlace = motion.create(Link);

function clasesBoton(variante, className) {
  const base = variante ? `boton boton--${variante}` : "boton";
  return className ? `${base} ${className}` : base;
}

export function Boton({ children, className, variante, ...props }) {
  const tieneClaseBoton = typeof className === "string" && className.split(/\s+/).includes("boton");
  const final = tieneClaseBoton ? className : clasesBoton(variante, className);

  return (
    <motion.button className={final} whileTap={toque} transition={transicionToque} {...props}>
      {children}
    </motion.button>
  );
}

export function EnlaceBoton({ href, children, className, variante, ...props }) {
  const tieneClaseBoton = typeof className === "string" && className.split(/\s+/).includes("boton");
  const final = tieneClaseBoton ? className : clasesBoton(variante, className);

  return (
    <Enlace className={final} href={href} whileTap={toque} transition={transicionToque} {...props}>
      {children}
    </Enlace>
  );
}
