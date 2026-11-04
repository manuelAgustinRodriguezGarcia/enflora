"use client";

import { useState } from "react";
import { ModalReporteProblema } from "@/componentes/problemas/modal-reporte-problema";

export function BotonReporteProblema({
  className = "",
  children,
  origen = "inicio",
  unidadId = "",
  plantaIds = [],
  unidades = null,
  usuarioId = "",
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setAbierto(true)}>
        {children}
      </button>
      <ModalReporteProblema
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        origen={origen}
        unidadId={unidadId}
        plantaIds={plantaIds}
        unidades={unidades}
        usuarioId={usuarioId}
      />
    </>
  );
}
