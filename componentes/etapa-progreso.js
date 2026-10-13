"use client";

import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { IconoChevron } from "@/componentes/iconos-ui";
import { ETAPAS } from "@/lib/etapas";

export function EtapaProgreso({ etapa, dia = null, inicio = "" }) {
  const indice = ETAPAS.findIndex((item) => item.valor === etapa);
  const siguiente = indice >= 0 && indice < ETAPAS.length - 1 ? ETAPAS[indice + 1] : null;
  const esFinal = etapa === "finalizado";

  return (
    <section className="etapa-progreso" aria-labelledby="etapa-progreso-titulo">
      <div className="etapa-progreso__bloque">
        <p className="etapa-progreso__etiqueta" id="etapa-progreso-titulo">
          Etapa actual
        </p>
        <IndicadorEtapa etapa={etapa} tamano="normal" animar />
        {dia === null ? null : <p className="etapa-progreso__dia">Día {dia}</p>}
        {inicio ? <p className="tarjeta__meta">Inicio: {inicio}</p> : null}
      </div>
      {!esFinal && siguiente ? (
        <>
          <div className="etapa-progreso__flecha" aria-hidden="true">
            <IconoChevron />
          </div>
          <div className="etapa-progreso__siguiente">
            <p className="etapa-progreso__etiqueta">Siguiente</p>
            <IndicadorEtapa etapa={siguiente.valor} tamano="compacto" />
          </div>
        </>
      ) : null}
    </section>
  );
}
