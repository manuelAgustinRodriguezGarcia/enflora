"use client";

import { Check, ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useId, useState } from "react";
import SpotlightCard from "@/componentes/landing/spotlight-card";
import { convertirUsdAArs, formatearArs } from "@/lib/cotizacion";

const SPOTLIGHT = {
  gratis: {
    theme: "light",
    spotlightColor: "#0B3D2A",
    intensity: 0.12,
    spotlightSize: 220,
    softness: 0.8,
    borderGlow: 0.35,
    proximity: 50,
    ambient: false,
    style: {
      "--spotlight-card-surface": "#E2EDCE",
      "--spotlight-card-border": "rgba(11, 61, 42, 0.12)",
      "--spotlight-card-shadow": "0 16px 32px -28px rgba(11, 61, 42, 0.18)",
    },
  },
  plus: {
    theme: "dark",
    spotlightColor: "#A4C85B",
    intensity: 0.22,
    spotlightSize: 300,
    softness: 0.72,
    borderGlow: 0.55,
    proximity: 70,
    ambient: true,
    style: {
      "--spotlight-card-surface": "#0B3D2A",
      "--spotlight-card-border": "rgba(164, 200, 91, 0.32)",
      "--spotlight-card-shadow":
        "0 24px 48px -26px rgba(8, 25, 16, 0.6), 0 0 0 1px rgba(164, 200, 91, 0.2)",
    },
  },
  cultivo: {
    theme: "light",
    spotlightColor: "#0B3D2A",
    intensity: 0.14,
    spotlightSize: 240,
    softness: 0.78,
    borderGlow: 0.4,
    proximity: 55,
    ambient: false,
    style: {
      "--spotlight-card-surface": "#A4C85B",
      "--spotlight-card-border": "rgba(11, 61, 42, 0.14)",
      "--spotlight-card-shadow": "0 16px 32px -28px rgba(11, 61, 42, 0.22)",
    },
  },
};

function AccionesPlan({ plan, hrefRegistro, onAbrirEquivalencia }) {
  return (
    <div className="precios__acciones">
      <Link
        className={`landing__accion ${
          plan.ctaVariante === "principal"
            ? "landing__accion--acento"
            : "landing__accion--linea"
        } precios__cta`}
        href={hrefRegistro}
      >
        {plan.cta}
      </Link>
      {plan.ctaSecundario ? (
        <button type="button" className="precios__link" onClick={onAbrirEquivalencia}>
          {plan.ctaSecundario}
        </button>
      ) : null}
    </div>
  );
}

function ListaBeneficios({ items }) {
  return (
    <ul className="precios__lista">
      {items.map((item) => (
        <li key={item}>
          <Check size={16} strokeWidth={2.5} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DetallesPlan({ plan, beneficios }) {
  return (
    <>
      <ListaBeneficios items={beneficios} />
      {plan.aclaracion ? <p className="precios__aclaracion">{plan.aclaracion}</p> : null}
    </>
  );
}

export function TarjetaPlan({ plan, cotizacion, hrefRegistro, onAbrirEquivalencia }) {
  const reducido = useReducedMotion();
  const panelId = useId();
  const [abierto, setAbierto] = useState(false);
  const ars = plan.mostrarArs ? convertirUsdAArs(plan.precioUsd, cotizacion) : null;
  const arsTexto = ars == null ? null : formatearArs(ars);
  const destacados = plan.beneficios.slice(0, 3);
  const resto = plan.beneficios.slice(3);
  const spotlight = SPOTLIGHT[plan.variante] ?? SPOTLIGHT.gratis;
  const clase = [
    "precios__card",
    `precios__card--${plan.variante}`,
    plan.destacado ? "precios__card--destacada" : "",
    abierto ? "precios__card--abierta" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={clase}>
      <SpotlightCard
        className="precios__shell"
        theme={spotlight.theme}
        spotlightColor={spotlight.spotlightColor}
        intensity={spotlight.intensity}
        spotlightSize={spotlight.spotlightSize}
        softness={spotlight.softness}
        borderGlow={spotlight.borderGlow}
        proximity={spotlight.proximity}
        smoothing={0.35}
        ambient={spotlight.ambient}
        flare={false}
        grain={0}
        style={spotlight.style}
      >
        <div className="precios__card-cuerpo">
          {plan.badge ? <span className="precios__badge">{plan.badge}</span> : null}

          <header className="precios__card-tope">
            <h3>{plan.titulo}</h3>
            <div className="precios__precio">
              <strong>{plan.precioEtiqueta}</strong>
              {plan.periodicidad ? <span>{plan.periodicidad}</span> : null}
            </div>
            {plan.modalidad ? <p className="precios__modalidad">{plan.modalidad}</p> : null}
            {plan.modalidadExtra ? (
              <p className="precios__modalidad precios__modalidad--extra">{plan.modalidadExtra}</p>
            ) : null}
            {arsTexto ? <p className="precios__ars">≈ {arsTexto}</p> : null}
          </header>

          <hr className="precios__divisor" />

          <p className="precios__frase">{plan.frase}</p>

          <div className="precios__detalles precios__detalles--desktop">
            <DetallesPlan plan={plan} beneficios={plan.beneficios} />
            <AccionesPlan
              plan={plan}
              hrefRegistro={hrefRegistro}
              onAbrirEquivalencia={onAbrirEquivalencia}
            />
          </div>

          <div className="precios__mobile">
            <ListaBeneficios items={destacados} />

            <div className="precios__acordeon">
              <button
                type="button"
                className="precios__detalles-toggle"
                aria-expanded={abierto}
                aria-controls={panelId}
                onClick={() => setAbierto((valor) => !valor)}
              >
                <span>{abierto ? "Ver menos" : "Ver todos los beneficios"}</span>
                <ChevronDown
                  className="precios__detalles-chevron"
                  size={18}
                  strokeWidth={2.4}
                  aria-hidden="true"
                />
              </button>

              <motion.div
                id={panelId}
                className="precios__detalles precios__detalles--mobile"
                initial={false}
                animate={
                  abierto
                    ? { height: "auto", opacity: 1 }
                    : { height: 0, opacity: 0 }
                }
                transition={
                  reducido
                    ? { duration: 0.01 }
                    : {
                        height: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
                        opacity: {
                          duration: abierto ? 0.28 : 0.2,
                          ease: "easeOut",
                          delay: abierto ? 0.06 : 0,
                        },
                      }
                }
              >
                <div className="precios__detalles-inner">
                  {resto.length > 0 ? <ListaBeneficios items={resto} /> : null}
                  {plan.aclaracion ? (
                    <p className="precios__aclaracion">{plan.aclaracion}</p>
                  ) : null}
                </div>
              </motion.div>
            </div>

            <AccionesPlan
              plan={plan}
              hrefRegistro={hrefRegistro}
              onAbrirEquivalencia={onAbrirEquivalencia}
            />
          </div>
        </div>
      </SpotlightCard>
    </article>
  );
}
