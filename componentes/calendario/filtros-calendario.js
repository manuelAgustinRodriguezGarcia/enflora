"use client";

import { useRef } from "react";
import { Selector } from "@/componentes/selector";
import { PillPlantas } from "@/componentes/resumen-configuracion";

export function FiltrosCalendario({ filtros, unidades, onUnidad }) {
  const ancla = useRef(null);
  const totalPlantas = unidades.reduce((suma, item) => suma + (item.cantidadPlantas || 0), 0);

  return (
    <div className="calendario__filtros" ref={ancla}>
      <Selector
        id="calendario-unidad"
        etiqueta="Unidad"
        valor={filtros.unidad || "todas"}
        onChange={(valor) => onUnidad(valor && valor !== "todas" ? valor : "")}
        opciones={[
          { valor: "todas", etiqueta: "Todas", cantidadPlantas: totalPlantas },
          ...unidades.map((item) => ({
            valor: item.id,
            etiqueta: item.etiqueta,
            cantidadPlantas: item.cantidadPlantas || 0,
          })),
        ]}
        ancla={ancla}
        alinear="start"
        renderOpcion={(opcion) => (
          <>
            <span className="selector__opcion-texto">{opcion.etiqueta}</span>
            <PillPlantas cantidad={opcion.cantidadPlantas} mostrarCero />
          </>
        )}
      />
    </div>
  );
}
