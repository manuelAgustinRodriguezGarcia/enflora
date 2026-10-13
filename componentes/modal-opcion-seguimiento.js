"use client";

import { useState } from "react";
import { Boton } from "@/componentes/boton";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { Selector } from "@/componentes/selector";
import { TIPOS_VALOR } from "@/lib/seguimiento";

export function ModalOpcionSeguimiento({
  borrador,
  marca,
  pendiente,
  error,
  accion,
  onCerrar,
  onQuitar,
  pendienteQuitar,
  errorQuitar,
}) {
  const [nombre, setNombre] = useState(borrador?.nombre || "");
  const [tipoValor, setTipoValor] = useState(borrador?.tipo_valor || "numero");
  const [unidad, setUnidad] = useState(borrador?.unidad || "");
  const esParametro = borrador?.categoria === "parametro";
  const titulo = borrador?.id
    ? esParametro
      ? "Editar parámetro"
      : "Editar acción"
    : esParametro
      ? "Nuevo parámetro"
      : "Nueva acción";

  return (
    <ModalConfirmacion
      abierto
      onCerrar={onCerrar}
      titulo={titulo}
      textoConfirmar={pendiente ? "Guardando..." : "Guardar"}
      pendiente={pendiente || pendienteQuitar}
      error={error || errorQuitar}
      accion={accion}
    >
      <input type="hidden" name="marca" value={marca} />
      <input type="hidden" name="categoria" value={borrador?.categoria || ""} />
      <input type="hidden" name="tipo_valor" value={tipoValor} />
      {borrador?.id ? <input type="hidden" name="opcion_id" value={borrador.id} /> : null}
      <label className="formulario__campo">
        Nombre
        <input
          name="nombre"
          value={nombre}
          maxLength={60}
          required
          onChange={(evento) => setNombre(evento.target.value)}
        />
      </label>
      {esParametro ? (
        <>
          <Selector
            etiqueta="Tipo de valor"
            valor={tipoValor}
            onChange={setTipoValor}
            opciones={TIPOS_VALOR.map((tipo) => ({
              valor: tipo.valor,
              etiqueta: tipo.etiqueta,
            }))}
          />
          <label className="formulario__campo">
            Unidad
            <input
              name="unidad"
              value={unidad}
              maxLength={16}
              placeholder="°C, %, ppm..."
              onChange={(evento) => setUnidad(evento.target.value)}
            />
          </label>
        </>
      ) : null}
      {borrador?.id ? (
        <Boton
          className="boton boton--destructivo"
          type="button"
          onClick={onQuitar}
          disabled={pendiente || pendienteQuitar}
        >
          {pendienteQuitar ? "Quitando..." : "Quitar"}
        </Boton>
      ) : null}
    </ModalConfirmacion>
  );
}
