"use client";

import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { ETAPAS } from "@/lib/etapas";

export function SelectorEtapa({ valor, onChange, nombre, leyenda = "Etapa" }) {
  return (
    <fieldset className="selector-etapa">
      <legend>{leyenda}</legend>
      <div className="selector-etapa__opciones">
        {ETAPAS.map((etapa) => {
          const activa = valor === etapa.valor;
          return (
            <label
              key={etapa.valor}
              className={`selector-etapa__opcion selector-etapa__opcion--${etapa.valor}${activa ? " selector-etapa__opcion--activa" : ""}`}
            >
              <input
                type="radio"
                name={nombre}
                value={etapa.valor}
                checked={activa}
                onChange={() => onChange(etapa.valor)}
              />
              <IndicadorEtapa etapa={etapa.valor} tamano="compacto" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
