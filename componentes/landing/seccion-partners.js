"use client";

import Link from "next/link";
import { useReducedMotion, motion } from "motion/react";
import { textosPartners } from "@/lib/partners";
import { TextoConMarca } from "@/componentes/marca-enflora";
import { transicionRapida } from "@/lib/animaciones";

export function SeccionPartners() {
  const reducido = useReducedMotion();

  return (
    <section className="partners" id="partners" data-logo="light">
      <div className="partners__contenedor">
        <div className="partners__intro">
          <div className="partners__intro-texto">
            <p className="partners__eyebrow">{textosPartners.eyebrow}</p>
            <h2 className="partners__titulo">{textosPartners.titulo}</h2>
            <p className="partners__descripcion">
              <TextoConMarca texto={textosPartners.descripcion} />
            </p>
            <motion.div
              whileHover={reducido ? undefined : { scale: 1.02 }}
              whileTap={reducido ? undefined : { scale: 0.98 }}
              transition={transicionRapida}
            >
              <Link
                className="landing__accion landing__accion--acento partners__cta"
                href="/partners-info"
              >
                {textosPartners.ctaPrincipal}
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
