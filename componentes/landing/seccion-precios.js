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

export function SeccionPrecios({ cotizacion = null }) {
  const [modalEquivalencia, setModalEquivalencia] = useState(false);
  const [modalCotizacion, setModalCotizacion] = useState(false);
  const [modalContacto, setModalContacto] = useState(false);
  const [contactoMontado, setContactoMontado] = useState(false);
  const [equivalenciaMontada, setEquivalenciaMontada] = useState(false);
  const [cotizacionMontada, setCotizacionMontada] = useState(false);

  function abrirEquivalencia() {
    setEquivalenciaMontada(true);
    setModalEquivalencia(true);
  }

  function abrirCotizacion() {
    setCotizacionMontada(true);
    setModalCotizacion(true);
  }

  function abrirContacto() {
    setContactoMontado(true);
    setModalContacto(true);
  }
  const fecha = formatearFechaCotizacion(cotizacion?.fecha);
  const valor = cotizacion?.valor;
  const valorTexto = Number.isFinite(valor) ? formatearArs(valor) : null;
  const copyModal = planesEnflora.modalCotizacion;

  return (
    <section className="precios" id="precios" data-logo="dark">
      <div className="precios__contenedor">
        <header className="precios__encabezado">
          <h2>{planesEnflora.titulo}</h2>
          <p className="precios__encabezado-pago">{planesEnflora.encabezadoPago}</p>
        </header>

        <div className="precios__grid">
          {planesEnflora.items.map((plan) => (
            <TarjetaPlan
              key={plan.id}
              plan={plan}
              cotizacion={cotizacion}
              hrefRegistro={planesEnflora.hrefRegistro}
              onAbrirEquivalencia={abrirEquivalencia}
              onPrelanzamiento={abrirContacto}
            />
          ))}
        </div>

        <div className="precios__leyenda">
          <button
            type="button"
            className="precios__leyenda-boton"
            onClick={abrirCotizacion}
          >
            <Info size={18} strokeWidth={1.9} aria-hidden="true" />
            Cotización de dólar.
          </button>
        </div>

        <FaqPrecios cotizacion={cotizacion} />
      </div>

      {equivalenciaMontada ? (
        <ModalEquivalencia
          abierto={modalEquivalencia}
          onCerrar={() => setModalEquivalencia(false)}
          hrefRegistro={planesEnflora.hrefRegistro}
        />
      ) : null}

      {cotizacionMontada ? (
        <ModalCotizacion
          abierto={modalCotizacion}
          onCerrar={() => setModalCotizacion(false)}
          titulo={copyModal.titulo}
          explicacion={planesEnflora.leyendaArs}
          sinDatos={copyModal.sinDatos}
          valorTexto={valorTexto}
          fechaTexto={fecha}
          etiquetaPill={copyModal.etiquetaPill}
        />
      ) : null}

      {contactoMontado ? <ModalContacto abierto={modalContacto} onCerrar={() => setModalContacto(false)} /> : null}
    </section>
  );
}
