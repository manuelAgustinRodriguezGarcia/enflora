"use client";

import { guardarRegistro, obtenerRegistroCompleto } from "@/app/registros/acciones";
import { EditorSeguimiento } from "@/componentes/editor-seguimiento";
import { FormularioRegistroCultivo } from "@/componentes/formulario-registro-cultivo";

export function FormularioCrearRegistro({
  unidades = [],
  seguimientoInicial,
  registrosHoy = [],
  registroInicialId = "",
}) {
  return (
    <FormularioRegistroCultivo
      unidades={unidades}
      seguimientoInicial={seguimientoInicial}
      registrosHoy={registrosHoy}
      accionGuardar={guardarRegistro}
      cargarRegistro={obtenerRegistroCompleto}
      EditorSeguimiento={EditorSeguimiento}
      registroInicialId={registroInicialId}
    />
  );
}
