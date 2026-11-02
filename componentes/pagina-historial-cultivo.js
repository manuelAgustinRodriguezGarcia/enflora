"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RecordarUnidadHistorial } from "@/componentes/recordar-unidad-historial";
import { SelectorUnidadHistorial, VistaHistorialCultivo } from "@/componentes/vista-historial-cultivo";
import { hrefHistorial } from "@/lib/historial-registros";

export function PaginaHistorialCultivo({
  unidades,
  filtros,
  mensajeFiltro = "",
  datosVista = null,
  geneticas = [],
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const unidadSeleccionada = filtros?.unidadId || "";

  function cambiarUnidad(valor) {
    if (!valor) return;
    iniciar(() => {
      router.push(hrefHistorial({ unidadId: valor }));
    });
  }

  return (
    <>
      {unidadSeleccionada ? <RecordarUnidadHistorial unidadId={unidadSeleccionada} /> : null}
      <SelectorUnidadHistorial
        unidades={unidades}
        valor={unidadSeleccionada}
        onChange={cambiarUnidad}
        pendiente={pendiente}
      />

      {unidadSeleccionada && datosVista ? (
        <VistaHistorialCultivo
          key={[
            filtros.unidadId,
            filtros.plantaId || "",
            filtros.genetica || "",
            filtros.desde || "",
            filtros.hasta || "",
            (filtros.contenidos || []).join(","),
            filtros.sinContenido ? "vacio" : "contenido",
          ].join("|")}
          filtrosIniciales={filtros}
          mensajeFiltro={mensajeFiltro}
          geneticas={geneticas}
          {...datosVista}
        />
      ) : null}

      {unidadSeleccionada && !datosVista && mensajeFiltro ? (
        <p className="historial__error" role="alert">{mensajeFiltro}</p>
      ) : null}
    </>
  );
}
