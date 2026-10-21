"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { FormularioPartners } from "@/componentes/landing/formulario-partners";
import { PLAN_INDEFINIDO, PLANES_PARTNERS, textosPartners } from "@/lib/partners";

function scrollAlFormulario() {
  const destino = document.getElementById("partners-formulario");
  if (!destino) return;
  destino.scrollIntoView({ behavior: "smooth", block: "start" });
  const primerCampo = destino.querySelector('input[name="comercio"]');
  if (primerCampo instanceof HTMLElement) {
    window.setTimeout(() => primerCampo.focus({ preventScroll: true }), 350);
  }
}

function TarjetaPlanPartners({ plan, onElegir }) {
  const clase = [
    "partners__plan",
    plan.destacado ? "partners__plan--destacado" : "",
    plan.proximo ? "partners__plan--proximo" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={clase}>
      <header className="partners__plan-tope">
        <h3>{plan.titulo}</h3>
        {plan.precioEtiqueta ? (
          <div className="partners__plan-precio">
            <strong>{plan.precioEtiqueta}</strong>
            {plan.periodicidad ? <span>{plan.periodicidad}</span> : null}
          </div>
        ) : null}
        <p className="partners__plan-desc">{plan.descripcion}</p>
      </header>
      <ul className="partners__plan-lista">
        {plan.beneficios.map((item) => (
          <li key={item}>
            <Check size={16} strokeWidth={2.5} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {plan.aclaracion ? <p className="partners__plan-aclaracion">{plan.aclaracion}</p> : null}
      <button
        type="button"
        className={`landing__accion ${
          plan.destacado ? "landing__accion--acento" : "landing__accion--linea"
        } partners__plan-cta`}
        onClick={() => onElegir(plan.id)}
      >
        {plan.cta}
      </button>
    </article>
  );
}

export function PaginaPartnersInfo() {
  const [planSeleccionado, setPlanSeleccionado] = useState(PLAN_INDEFINIDO);

  function elegirPlan(planId) {
    setPlanSeleccionado(planId);
    scrollAlFormulario();
  }

  return (
    <section className="partners partners--info" data-logo="dark">
      <div className="partners__contenedor">
        <header className="partners__info-cabecera">
          <p className="partners__eyebrow">{textosPartners.eyebrow}</p>
          <h1 className="partners__titulo">{textosPartners.infoTitulo}</h1>
          <p className="partners__descripcion">{textosPartners.infoDescripcion}</p>
          <Link className="partners__volver" href="/#partners">
            Volver a Partners
          </Link>
        </header>

        <div className="partners__planes" aria-label="Planes publicitarios">
          {PLANES_PARTNERS.map((plan) => (
            <TarjetaPlanPartners key={plan.id} plan={plan} onElegir={elegirPlan} />
          ))}
        </div>

        <div className="partners__form-bloque">
          <header className="partners__form-cabecera">
            <h2 className="partners__form-titulo">{textosPartners.formTitulo}</h2>
            <p className="partners__form-subtitulo">{textosPartners.formSubtitulo}</p>
          </header>
          <FormularioPartners key={planSeleccionado} planInicial={planSeleccionado} />
        </div>
      </div>
    </section>
  );
}
