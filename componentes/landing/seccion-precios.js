"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { FaqPrecios } from "@/componentes/landing/faq-precios";
import { ModalCotizacion } from "@/componentes/landing/modal-cotizacion";
import { ModalEquivalencia } from "@/componentes/landing/modal-equivalencia";
import { ModalContacto } from "@/componentes/landing/modal-contacto";
import { TarjetaPlan } from "@/componentes/landing/tarjeta-plan";
import { formatearArs, formatearFechaCotizacion } from "@/lib/cotizacion";
import { planesEnflora } from "@/lib/planes";
import { TextoConMarca } from "@/componentes/marca-enflora";

export function SeccionPrecios({ cotizacion = null }) {
  const [modalEquivalencia, setModalEquivalencia] = useState(false);
  const [modalCotizacion, setModalCotizacion] = useState(false);
  const [modalContacto, setModalContacto] = useState(false);
  const [contactoMontado, setContactoMontado] = useState(false);

  function abrirContacto() {
    setContactoMontado(true);
    setModalContacto(true);
  }
  const fecha = formatearFechaCotizacion(cotizacion?.fecha);
  const valor = cotizacion?.valor;
  const valorTexto = Number.isFinite(valor) ? formatearArs(valor) : null;

  const leyenda = valorTexto
    ? `${planesEnflora.leyendaArs}${fecha ? ` Actualizada el ${fecha}.` : ""} Dólar oficial de referencia: ${valorTexto}.`
    : "Mostramos los precios en dólares. La referencia en pesos se actualizará cuando la cotización esté disponible.";

  return (
    <section className="precios" id="precios" data-logo="dark">
      <div className="precios__contenedor">
        <header className="precios__encabezado">
          <p className="precios__eyebrow">
            <TextoConMarca texto={planesEnflora.eyebrow} />
          </p>
          <h2>{planesEnflora.titulo}</h2>
        </header>

        <div className="precios__grid">
          {planesEnflora.items.map((plan) => (
            <TarjetaPlan
              key={plan.id}
              plan={plan}
              cotizacion={cotizacion}
              hrefRegistro={planesEnflora.hrefRegistro}
              onAbrirEquivalencia={() => setModalEquivalencia(true)}
              onPrelanzamiento={abrirContacto}
            />
          ))}
        </div>

        <div className="precios__leyenda">
          <button
            type="button"
            className="precios__leyenda-boton"
            onClick={() => setModalCotizacion(true)}
          >
            <Info size={18} strokeWidth={1.9} aria-hidden="true" />
            Cotización de dólar.
          </button>
        </div>

        <FaqPrecios cotizacion={cotizacion} />
      </div>

      <ModalEquivalencia
        abierto={modalEquivalencia}
        onCerrar={() => setModalEquivalencia(false)}
        hrefRegistro={planesEnflora.hrefRegistro}
      />

      <ModalCotizacion
        abierto={modalCotizacion}
        onCerrar={() => setModalCotizacion(false)}
        titulo="Qué cotización de dólar?"
        texto={leyenda}
      />

      {contactoMontado ? <ModalContacto abierto={modalContacto} onCerrar={() => setModalContacto(false)} /> : null}
    </section>
  );
}
