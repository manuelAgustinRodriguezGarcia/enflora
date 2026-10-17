"use client";

import { Check, ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useId, useState } from "react";
import { convertirUsdAArs, formatearArs } from "@/lib/cotizacion";

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

function DetallesPlan({ plan }) {
  return (
    <>
      <p className="precios__card-desc">{plan.descripcion}</p>
      <ul className="precios__lista">
        {plan.beneficios.map((item) => (
          <li key={item}>
            <Check size={16} strokeWidth={2.5} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
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
      <div className="precios__shell">
        <div className="precios__card-cuerpo">
          {plan.badge ? <span className="precios__badge">{plan.badge}</span> : null}
          <header className="precios__card-tope">
            <h3>{plan.titulo}</h3>
            <div className="precios__precio">
              <strong>{plan.precioEtiqueta}</strong>
              {plan.periodicidad ? <span>{plan.periodicidad}</span> : null}
            </div>
            {arsTexto ? <p className="precios__ars">≈ {arsTexto}</p> : null}
            <p className="precios__subtitulo">{plan.subtitulo}</p>
          </header>

          <div className="precios__detalles precios__detalles--desktop">
            <DetallesPlan plan={plan} />
            <AccionesPlan
              plan={plan}
              hrefRegistro={hrefRegistro}
              onAbrirEquivalencia={onAbrirEquivalencia}
            />
          </div>

          <div className="precios__acordeon">
            <button
              type="button"
              className="precios__detalles-toggle"
              aria-expanded={abierto}
              aria-controls={panelId}
              onClick={() => setAbierto((valor) => !valor)}
            >
              <span>Detalles de plan</span>
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
                <DetallesPlan plan={plan} />
                <AccionesPlan
                  plan={plan}
                  hrefRegistro={hrefRegistro}
                  onAbrirEquivalencia={onAbrirEquivalencia}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </article>
  );
}
