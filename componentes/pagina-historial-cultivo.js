"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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
    iniciar(() => {
      if (!valor) {
        router.push("/registros/historial");
        return;
      }
      router.push(hrefHistorial({ unidadId: valor }));
    });
  }

  return (
    <>
      <SelectorUnidadHistorial
        unidades={unidades}
        valor={unidadSeleccionada}
        onChange={cambiarUnidad}
        pendiente={pendiente}
      />

      {!unidadSeleccionada ? (
        <div className="vacio historial-vista-cultivo__vacio">
          <p>Elegí una unidad de cultivo para ver su historial completo.</p>
        </div>
      ) : null}

      {unidadSeleccionada && datosVista ? (
        <VistaHistorialCultivo
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
