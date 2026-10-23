"use client";

import Image from "next/image";
import { IconoInstagram } from "@/componentes/iconos-ui";
import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { fechaLarga, textoDiaCultivo, textoEstadoCultivo } from "@/lib/demo/historial/historial-demo";
import { formatearFecha } from "@/lib/etapas";

const CREDITO_CULTIVO = {
  usuario: "@astutalaplanta",
  url: "https://www.instagram.com/astutalaplanta/",
};

export function HistorialCabecera({ historial }) {
  const { cultivo, fechaCorte } = historial;
  const plantas =
    cultivo.cantidadPlantas === 1 ? "1 planta" : `${cultivo.cantidadPlantas} plantas`;

  return (
    <header className="historial-cabecera">
      <div className="historial-portada">
        {cultivo.portada ? (
          <Image
            src={cultivo.portada.url}
            alt={`Portada del cultivo ${cultivo.nombre}`}
            width={cultivo.portada.ancho}
            height={cultivo.portada.alto}
            unoptimized
            priority
            className="historial-portada__imagen"
          />
        ) : (
          <div className="historial-portada__vacia" aria-hidden="true" />
        )}
        <div className="historial-portada__velo" aria-hidden="true" />
        <div className="historial-portada__texto">
          <h1 className="historial-portada__titulo">{cultivo.nombre}</h1>
          <a
            className="historial-credito"
            href={CREDITO_CULTIVO.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconoInstagram className="historial-credito__icono" />
            <span>
              Planta de los amigos de <strong>{CREDITO_CULTIVO.usuario}</strong>
            </span>
          </a>
          <div className="historial-portada__chips">
            <span className="historial-chip historial-chip--oscuro">{textoEstadoCultivo(cultivo.estado)}</span>
            <span className="historial-chip historial-chip--oscuro">{textoDiaCultivo(cultivo.diaActual)}</span>
            {cultivo.etapaActual ? <IndicadorEtapa etapa={cultivo.etapaActual} tamano="compacto" /> : null}
          </div>
        </div>
      </div>
      <dl className="tarjeta historial-datos">
        <div className="historial-datos__item">
          <dt>Inicio</dt>
          <dd>{fechaLarga(cultivo.fechaInicio)}</dd>
        </div>
        <div className="historial-datos__item">
          <dt>Plantas</dt>
          <dd>{plantas}</dd>
        </div>
        <div className="historial-datos__item">
          <dt>Genética</dt>
          <dd>{cultivo.genetica || "—"}</dd>
        </div>
        <div className="historial-datos__item">
          <dt>Método</dt>
          <dd>{cultivo.metodo || "—"}</dd>
        </div>
        <div className="historial-datos__item">
          <dt>Etapa actual</dt>
          <dd>{cultivo.etapaActual ? <IndicadorEtapa etapa={cultivo.etapaActual} tamano="compacto" /> : "—"}</dd>
        </div>
        <div className="historial-datos__item">
          <dt>Datos hasta</dt>
          <dd>{formatearFecha(fechaCorte)}</dd>
        </div>
      </dl>
    </header>
  );
}
