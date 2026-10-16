"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import PixelCard from "@/componentes/landing/pixel-card";
import { convertirUsdAArs, formatearArs } from "@/lib/cotizacion";

function CuerpoPlan({ plan, arsTexto, hrefRegistro, onAbrirEquivalencia }) {
  return (
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
    </div>
  );
}

export function TarjetaPlan({ plan, cotizacion, hrefRegistro, onAbrirEquivalencia }) {
  const ars = plan.mostrarArs ? convertirUsdAArs(plan.precioUsd, cotizacion) : null;
  const arsTexto = ars == null ? null : formatearArs(ars);
  const clase = [
    "precios__card",
    `precios__card--${plan.variante}`,
    plan.destacado ? "precios__card--destacada" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cuerpo = (
    <CuerpoPlan
      plan={plan}
      arsTexto={arsTexto}
      hrefRegistro={hrefRegistro}
      onAbrirEquivalencia={onAbrirEquivalencia}
    />
  );

  return (
    <article className={clase}>
      {plan.destacado ? (
        <PixelCard
          variant="plus"
          theme="dark"
          glow={0.55}
          opacity={0.78}
          spotlight={0.45}
          intro
          introDelay={0}
          trigger="always"
          speed={22}
          radius={26}
          glowColor="#A4C85B"
          className="precios__pixel"
        >
          {cuerpo}
        </PixelCard>
      ) : (
        <div className="precios__shell">{cuerpo}</div>
      )}
    </article>
  );
}
