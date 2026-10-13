"use client";

import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { Selector } from "@/componentes/selector";
import { ETAPAS } from "@/lib/etapas";

export function SelectorEtapa({ valor, onChange, nombre, leyenda = "Etapa", id }) {
  const opciones = ETAPAS.map((etapa) => ({
    valor: etapa.valor,
    etiqueta: etapa.etiqueta,
  }));

  return (
    <Selector
      className="selector-etapa"
      etiqueta={leyenda}
      id={id}
      nombre={nombre}
      valor={valor || null}
      onChange={onChange}
      opciones={opciones}
      placeholder="Seleccionar etapa"
      renderValor={(opcion) =>
        opcion ? <IndicadorEtapa etapa={opcion.valor} tamano="compacto" /> : null
      }
      renderOpcion={(opcion) => <IndicadorEtapa etapa={opcion.valor} tamano="compacto" />}
    />
  );
}
