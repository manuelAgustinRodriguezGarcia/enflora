"use client";

import { ClipboardList, Heart, Leaf, Sprout } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const iconos = {
  hoja: Leaf,
  planta: Sprout,
  registro: ClipboardList,
  corazon: Heart,
};

const curva = [0.22, 1, 0.36, 1];

export function TarjetaFlotanteHero({ item, indice }) {
  const reducido = useReducedMotion();
  const [flotacion, setFlotacion] = useState(false);
  const [hover, setHover] = useState(false);
  const Icono = iconos[item.icono] || Leaf;
  const rotacion = item.rotacion ?? 0;
  const delay = 0.45 + indice * 0.1;
  const floatY = indice % 2 === 0 ? -3 : 3;
  const floatDuracion = 3.2 + indice * 0.45;
  const ladoIzquierdo = indice % 2 === 0;
  const tiltY = ladoIzquierdo ? 12 : -12;
  const tiltX = indice < 2 ? -4 : 4;
  const deslizX = ladoIzquierdo ? -4 : 4;
  const hoverActivo = hover && !reducido;

  useEffect(() => {
    const consulta = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const actualizar = () => setFlotacion(consulta.matches);
    actualizar();
    consulta.addEventListener("change", actualizar);
    return () => consulta.removeEventListener("change", actualizar);
  }, []);

  return (
    <li
      className={`hero__beneficio hero__beneficio--${indice + 1}`}
      style={{ "--hero-card-rot": `${rotacion}deg` }}
      onPointerEnter={() => {
        if (!reducido) setHover(true);
      }}
      onPointerLeave={() => setHover(false)}
    >
      <motion.div
        className="hero__beneficio-entrada"
        initial={reducido ? false : { opacity: 0, y: 16, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          reducido
            ? { duration: 0 }
            : { duration: 0.42, delay, ease: curva }
        }
      >
        <motion.div
          className={`hero__beneficio-card${hoverActivo ? " hero__beneficio-card--activa" : ""}`}
          style={{ transformPerspective: 900 }}
          animate={
            hoverActivo
              ? {
                  y: -6,
                  x: deslizX,
                  rotateY: tiltY,
                  rotateX: tiltX,
                  scale: 1.03,
                }
              : flotacion
                ? {
                    y: [0, floatY, 0],
                    x: 0,
                    rotateY: 0,
                    rotateX: 0,
                    scale: 1,
                  }
                : {
                    y: 0,
                    x: 0,
                    rotateY: 0,
                    rotateX: 0,
                    scale: 1,
                  }
          }
          transition={
            hoverActivo
              ? { duration: 0.32, ease: curva }
              : flotacion
                ? {
                    y: {
                      duration: floatDuracion,
                      delay: delay + 0.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                    x: { duration: 0.32, ease: curva },
                    rotateY: { duration: 0.32, ease: curva },
                    rotateX: { duration: 0.32, ease: curva },
                    scale: { duration: 0.32, ease: curva },
                  }
                : { duration: 0.32, ease: curva }
          }
        >
          <span className={`hero__beneficio-icono hero__beneficio-icono--${item.icono}`}>
            <Icono size={20} strokeWidth={2.1} aria-hidden="true" />
          </span>
          <span className="hero__beneficio-texto">
            <span className="hero__beneficio-titulo">{item.titulo}</span>
            <span className="hero__beneficio-detalle">{item.detalle}</span>
          </span>
        </motion.div>
      </motion.div>
    </li>
  );
}
