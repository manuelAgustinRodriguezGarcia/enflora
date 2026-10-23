"use client";

import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { etiquetaEtapaHistorial } from "@/lib/demo/historial/historial-demo";
import { esEtapa, formatearFecha, textoDias } from "@/lib/etapas";

function periodo(etapa) {
  const inicio = formatearFecha(etapa.fechaInicio);
  if (!etapa.fechaFin) return `Desde ${inicio}`;
  return `${inicio} → ${formatearFecha(etapa.fechaFin)}`;
}

function rangoDias(etapa) {
  if (etapa.diaInicio === null) return "";
  if (etapa.diaFin === null) return `Desde el día ${etapa.diaInicio}`;
  return `Días ${etapa.diaInicio} a ${etapa.diaFin}`;
}

export function HistorialEtapas({ historial }) {
  const { etapas } = historial;
  if (!etapas.length) return null;

  return (
    <section className="historial-etapas" aria-labelledby="historial-etapas-titulo">
      <h2 id="historial-etapas-titulo">Etapas del cultivo</h2>
      <ListaEntrada>
        {etapas.map((etapa) => {
          const clase = esEtapa(etapa.etapa)
            ? `tarjeta tarjeta--historial tarjeta--${etapa.etapa}`
            : "tarjeta tarjeta--historial";
          const origen =
            etapa.nombreOrigen && etapa.nombreOrigen !== etiquetaEtapaHistorial(etapa.etapa)
              ? `Registrada como «${etapa.nombreOrigen}»`
              : "";
          return (
            <li className={clase} key={etapa.id}>
              <IndicadorEtapa etapa={etapa.etapa} tamano="compacto" />
              <div className="tarjeta__historial-derecha">
                <span className="tarjeta__dias">
                  {textoDias(etapa.duracion)}
                  {etapa.actual ? " y contando" : ""}
                </span>
                <span className="tarjeta__meta">{periodo(etapa)}</span>
                <span className="tarjeta__meta">{[rangoDias(etapa), origen].filter(Boolean).join(" · ")}</span>
              </div>
            </li>
          );
        })}
      </ListaEntrada>
    </section>
  );
}
