"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import SpotlightCard from "@/componentes/landing/spotlight-card";

function IconoInstagram({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle
        cx="12"
        cy="12"
        r="4.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function PerfilSocialFlora({ instagram }) {
  const reducido = useReducedMotion();

  return (
    <motion.div
      className="flora-ig"
      initial={reducido ? false : { opacity: 0, y: 18 }}
      whileInView={reducido ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.4, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <SpotlightCard
        className="flora-ig__card"
        theme="dark"
        spotlightColor="#A4C85B"
        intensity={0.1}
        spotlightSize={280}
        softness={0.75}
        borderGlow={0.4}
        proximity={60}
        smoothing={0.35}
        ambient
        flare={false}
        grain={0}
        style={{
          "--spotlight-card-surface": "#0B3D2A",
          "--spotlight-card-border": "rgba(164, 200, 91, 0.28)",
          "--spotlight-card-shadow":
            "0 20px 40px -28px rgba(11, 61, 42, 0.55)",
        }}
      >
        <a
          className="flora-ig__contenido"
          href={instagram.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="flora-ig__avatar">
            <Image
              src={instagram.avatar.src}
              alt={instagram.avatar.alt}
              width={112}
              height={112}
            />
          </div>
          <div className="flora-ig__texto">
            <p className="flora-ig__usuario">{instagram.usuario}</p>
            <span className="flora-ig__cta-texto flora-ig__cta-texto--movil">
              {instagram.cta}
            </span>
            <span className="flora-ig__cta-texto flora-ig__cta-texto--escritorio">
              {instagram.ctaEscritorio.join(" ")}
            </span>
          </div>
          <span className="flora-ig__cta-boton">
            <IconoInstagram size={28} />
          </span>
        </a>
      </SpotlightCard>
    </motion.div>
  );
}
