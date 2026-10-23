"use client";

import { TransicionVista } from "@/componentes/transicion-vista";
import { AccionesDemo } from "@/componentes/demo/acciones-demo";
import { HistorialCabecera } from "@/componentes/demo/historial-cabecera";
import { HistorialCrecimiento } from "@/componentes/demo/historial-crecimiento";
import { HistorialEtapas } from "@/componentes/demo/historial-etapas";
import { HistorialMetricas } from "@/componentes/demo/historial-metricas";
import { HistorialResumen } from "@/componentes/demo/historial-resumen";
import { HistorialTimeline } from "@/componentes/demo/historial-timeline";
import { HISTORIAL_DEMO } from "@/lib/demo/historial/historial-demo";

export function VistaHistorial({ historial = HISTORIAL_DEMO }) {
  return (
    <TransicionVista>
      <section className="demo-historial-vista demo-modulo">
        <HistorialCabecera historial={historial} />
        <HistorialCrecimiento historial={historial} />
        <HistorialResumen historial={historial} />
        <HistorialEtapas historial={historial} />
        <HistorialTimeline historial={historial} />
        <HistorialMetricas historial={historial} />
        <AccionesDemo />
      </section>
    </TransicionVista>
  );
}
