"use client";

import { useId } from "react";
import { IconoEtapa } from "@/componentes/icono-etapa";
import { ETAPAS } from "@/lib/etapas";

export function OpcionesEtapa({ valor, onChange, nombre, leyenda = "Nueva etapa" }) {
  const etiquetaId = useId();

  return (
    <div className="opciones-etapa">
      <p className="selector__etiqueta" id={etiquetaId}>
        {leyenda}
      </p>
      <div className="opciones-etapa__lista" role="radiogroup" aria-labelledby={etiquetaId}>
        {ETAPAS.map((etapa) => {
          const activa = valor === etapa.valor;
          return (
            <label
              key={etapa.valor}
              className={`etapa-opcion etapa-opcion--${etapa.valor}${activa ? " etapa-opcion--activa" : ""}`}
            >
              <input
                type="radio"
                name={nombre}
                value={etapa.valor}
                checked={activa}
                onChange={() => onChange(etapa.valor)}
              />
              <IconoEtapa etapa={etapa.valor} />
              <span>{etapa.etiqueta}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
