"use client";

import { useActionState, useState } from "react";
import { editarUnidad } from "@/app/espacios/[id]/acciones";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { tiposDeUnidad } from "@/lib/unidades";

export function FormularioUnidad({ unidad, espacioId, tipoEspacio }) {
  const [estado, accion, pendiente] = useActionState(editarUnidad, null);
  const nombre = estado?.nombre ?? unidad.nombre ?? "";
  const [tipo, setTipo] = useState(estado?.tipo ?? unidad.tipo ?? "");
  const [tipoPersonalizado, setTipoPersonalizado] = useState(
    estado?.tipoPersonalizado ?? unidad.tipo_personalizado ?? ""
  );
  const tipos = tiposDeUnidad(tipoEspacio);

  return (
    <form key={estado?.error || "inicial"} className="formulario" action={accion}>
      <h2>Editar unidad</h2>
      {estado?.error ? <p className="formulario__error">{estado.error}</p> : null}
      <input type="hidden" name="unidad_id" value={unidad.id} />
      <input type="hidden" name="espacio_id" value={espacioId} />
      <label className="formulario__campo">
        Nombre
        <input name="nombre" type="text" defaultValue={nombre} />
      </label>
      <label className="formulario__campo">
        Tipo
        <select name="tipo" value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
          {tipos.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <Aparecer visible={tipo === "otro"}>
        <label className="formulario__campo">
          Tipo de unidad
          <input
            name="tipo_personalizado"
            type="text"
            value={tipoPersonalizado}
            onChange={(evento) => setTipoPersonalizado(evento.target.value)}
          />
        </label>
      </Aparecer>
      {tipo === "otro" ? null : <input type="hidden" name="tipo_personalizado" value="" />}
      <Boton type="submit" disabled={pendiente}>
        Guardar
      </Boton>
    </form>
  );
}
