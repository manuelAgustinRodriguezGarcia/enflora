"use client";

import { useState } from "react";
import {
  agendarTarea,
  guardarRegistro,
  obtenerRegistroCompleto,
  urlFotoOriginal,
} from "@/app/registros/acciones";
import { EditorSeguimiento } from "@/componentes/editor-seguimiento";
import { FormularioRegistroCultivo } from "@/componentes/formulario-registro-cultivo";
import { ModalReporteProblema } from "@/componentes/problemas/modal-reporte-problema";
import { borrarArchivosSubidos, subirFotoRegistro } from "@/lib/fotos-subida";

export function FormularioCrearRegistro({
  unidades = [],
  seguimientoInicial,
  registrosHoy = [],
  registroInicialId = "",
  usuarioId = "",
  catalogoMezclas = null,
  unidadInicialId = "",
  plantaIdsIniciales = [],
  accionInicial = "",
}) {
  const [reporte, setReporte] = useState(() =>
    accionInicial === "problema"
      ? { unidadId: unidadInicialId, plantaIds: plantaIdsIniciales }
      : null,
  );

  return (
    <>
      <FormularioRegistroCultivo
        usuarioId={usuarioId}
        subirFoto={subirFotoRegistro}
        borrarArchivos={borrarArchivosSubidos}
        obtenerUrlFoto={urlFotoOriginal}
        unidades={unidades}
        seguimientoInicial={seguimientoInicial}
        registrosHoy={registrosHoy}
        accionGuardar={guardarRegistro}
        cargarRegistro={obtenerRegistroCompleto}
        EditorSeguimiento={EditorSeguimiento}
        registroInicialId={registroInicialId}
        agendarTarea={agendarTarea}
        catalogoMezclas={catalogoMezclas}
        seleccionInicial={unidadInicialId ? { unidadId: unidadInicialId } : null}
        plantaIdsIniciales={plantaIdsIniciales}
        accionInicial={accionInicial}
        onReportarProblema={setReporte}
      />
      <ModalReporteProblema
        abierto={Boolean(reporte)}
        onCerrar={() => setReporte(null)}
        origen="registro"
        unidadId={reporte?.unidadId || ""}
        plantaIds={reporte?.plantaIds || []}
        unidades={unidades}
        usuarioId={usuarioId}
      />
    </>
  );
}
