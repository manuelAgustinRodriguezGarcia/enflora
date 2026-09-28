"use client";

import { useActionState } from "react";
import { crearPlanta } from "@/app/espacios/[id]/acciones";

export function FormularioPlanta({ espacioId }) {
  const [estado, accion, pendiente] = useActionState(crearPlanta, null);

  return (
    <form key={estado?.error || "inicial"} className="formulario" action={accion}>
      <h2>Agregar planta</h2>
      {estado?.error ? <p className="formulario__error">{estado.error}</p> : null}
      <input type="hidden" name="espacio_id" value={espacioId} />
      <label className="formulario__campo">
        Nombre
        <input name="nombre" type="text" defaultValue={estado?.nombre || ""} />
      </label>
      <label className="formulario__campo">
        Genética
        <input name="genetica" type="text" defaultValue={estado?.genetica || ""} />
      </label>
      <label className="formulario__campo">
        Fecha de inicio
        <input
          name="fecha_inicio"
          type="date"
          defaultValue={estado?.fechaInicio || ""}
        />
      </label>
      <button type="submit" disabled={pendiente}>
        Agregar planta
      </button>
    </form>
  );
}
