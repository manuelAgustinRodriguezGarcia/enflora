"use client";

import { IconoEtapa } from "@/componentes/icono-etapa";
import { Selector } from "@/componentes/selector";
import { ETAPAS } from "@/lib/etapas";

function FilaEtapa({ valor, etiqueta }) {
  return (
    <span className={`fila-etapa fila-etapa--${valor}`}>
      <IconoEtapa etapa={valor} />
      <span className="fila-etapa__texto">{etiqueta}</span>
    </span>
  );
}

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
        opcion ? <FilaEtapa valor={opcion.valor} etiqueta={opcion.etiqueta} /> : null
      }
      renderOpcion={(opcion) => <FilaEtapa valor={opcion.valor} etiqueta={opcion.etiqueta} />}
    />
  );
}
