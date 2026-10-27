"use client";

import {
  agendarTarea,
  guardarRegistro,
  obtenerRegistroCompleto,
  urlFotoOriginal,
} from "@/app/registros/acciones";
import { EditorSeguimiento } from "@/componentes/editor-seguimiento";
import { FormularioRegistroCultivo } from "@/componentes/formulario-registro-cultivo";
import { borrarArchivosSubidos, subirFotoRegistro } from "@/lib/fotos-subida";

export function FormularioCrearRegistro({
  unidades = [],
  seguimientoInicial,
  registrosHoy = [],
  registroInicialId = "",
  usuarioId = "",
}) {
  return (
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
    />
  );
}
