"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { toque, transicionToque } from "@/lib/animaciones";

const Enlace = motion.create(Link);

export function Boton({ children, className, ...props }) {
  return (
    <motion.button className={className} whileTap={toque} transition={transicionToque} {...props}>
      {children}
    </motion.button>
  );
}

export function EnlaceBoton({ href, children, className }) {
  return (
    <Enlace className={className} href={href} whileTap={toque} transition={transicionToque}>
      {children}
    </Enlace>
  );
}
