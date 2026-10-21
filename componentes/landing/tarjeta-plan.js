"use client";

import { Check, ChevronDown, RefreshCw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { gsap } from "@/componentes/landing/gsap";
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

function PrecioFlip({ usd, ars, mostrarArs, reducido }) {
  const cara = useRef(null);
  const mostrado = useRef(usd);
  const pedido = useRef(usd);
  const token = useRef(null);
  const [texto, setTexto] = useState(usd);
  const objetivo = mostrarArs ? ars : usd;

  useEffect(() => {
    pedido.current = objetivo;
    const nodo = cara.current;
    if (!nodo) return;
    if (mostrado.current === objetivo) return;

    if (reducido) {
      gsap.killTweensOf(nodo);
      gsap.set(nodo, { rotateX: 0 });
      mostrado.current = objetivo;
      setTexto(objetivo);
      return;
    }

    const turno = {};
    token.current = turno;
    gsap.killTweensOf(nodo);
    gsap.to(nodo, {
      rotateX: -90,
      duration: 0.16,
      ease: "power2.in",
      transformOrigin: "center center",
      onComplete() {
        if (token.current !== turno) return;
        const destino = pedido.current;
        mostrado.current = destino;
        setTexto(destino);
        requestAnimationFrame(() => {
          const el = cara.current;
          if (!el || token.current !== turno) return;
          gsap.fromTo(
            el,
            { rotateX: 90 },
            {
              rotateX: 0,
              duration: 0.22,
              ease: "power2.out",
              transformOrigin: "center center",
            },
          );
        });
      },
    });
  }, [objetivo, reducido]);

  return (
    <span className="precios__precio-flip">
      <strong ref={cara} className="precios__precio-cara">
        {texto}
      </strong>
    </span>
  );
}

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
  const [hoverFino, setHoverFino] = useState(false);
  const [sobreTarjeta, setSobreTarjeta] = useState(false);
  const [enPesos, setEnPesos] = useState(false);
  const ars = plan.mostrarArs ? convertirUsdAArs(plan.precioUsd, cotizacion) : null;
  const arsTexto = ars == null ? null : formatearArs(ars);
  const conPesos = Boolean(arsTexto);
  const puedeFlip = conPesos && hoverFino;
  const conBotonFlip = conPesos && !hoverFino;
  const mostrarArs = puedeFlip ? sobreTarjeta : conBotonFlip && enPesos;

  useEffect(() => {
    const consulta = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sincronizar = () => setHoverFino(consulta.matches);
    sincronizar();
    consulta.addEventListener("change", sincronizar);
    return () => consulta.removeEventListener("change", sincronizar);
  }, []);
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
        <div
          className="precios__card-cuerpo"
          onMouseEnter={puedeFlip ? () => setSobreTarjeta(true) : undefined}
          onMouseLeave={
            puedeFlip
              ? (evento) => {
                  const nodo = evento.currentTarget;
                  const destino = evento.relatedTarget;
                  if (destino instanceof Node && nodo.contains(destino)) return;
                  requestAnimationFrame(() => {
                    if (nodo.isConnected && nodo.matches(":hover")) return;
                    setSobreTarjeta(false);
                  });
                }
              : undefined
          }
        >
          {plan.badge ? <span className="precios__badge">{plan.badge}</span> : null}

          <header className={`precios__card-tope${conBotonFlip ? " precios__card-tope--con-flip" : ""}`}>
            <h3>{plan.titulo}</h3>
            {conBotonFlip ? (
              <button
                type="button"
                className={`precios__flip-boton${enPesos ? " precios__flip-boton--girado" : ""}`}
                aria-label={enPesos ? "Ver precio en dólares" : "Ver precio en pesos"}
                aria-pressed={enPesos}
                onClick={() => setEnPesos((valor) => !valor)}
              >
                <RefreshCw size={18} strokeWidth={2.4} aria-hidden="true" />
              </button>
            ) : null}
            <div className="precios__precio">
              {conPesos ? (
                <PrecioFlip
                  usd={plan.precioEtiqueta}
                  ars={arsTexto}
                  mostrarArs={mostrarArs}
                  reducido={reducido}
                />
              ) : (
                <strong>{plan.precioEtiqueta}</strong>
              )}
              {plan.periodicidad ? (
                <span className="precios__periodo">{plan.periodicidad}</span>
              ) : null}
            </div>
            {plan.modalidad ? <p className="precios__modalidad">{plan.modalidad}</p> : null}
            {plan.modalidadExtra ? (
              <p className="precios__modalidad precios__modalidad--extra">{plan.modalidadExtra}</p>
            ) : null}
            {arsTexto ? (
              <p className={`precios__ars${mostrarArs ? " precios__ars--reserva" : ""}`} aria-hidden={mostrarArs || undefined}>
                ≈ {arsTexto}
              </p>
            ) : null}
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
