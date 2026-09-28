"use client";

import { useActionState } from "react";
import { crearEspacio } from "@/app/espacios/acciones";

export function FormularioEspacio() {
  const [estado, accion, pendiente] = useActionState(crearEspacio, null);

  return (
    <form key={estado?.error || "inicial"} className="formulario" action={accion}>
      <h2>Agregar espacio</h2>
      {estado?.error ? <p className="formulario__error">{estado.error}</p> : null}
      <label className="formulario__campo">
        Nombre
        <input name="nombre" type="text" defaultValue={estado?.nombre || ""} />
      </label>
      <label className="formulario__campo">
        Tipo
        <select name="tipo" defaultValue={estado?.tipo || ""}>
          <option value="">Seleccionar</option>
          <option value="interior">Interior</option>
          <option value="exterior">Exterior</option>
        </select>
      </label>
      <button type="submit" disabled={pendiente}>
        Agregar espacio
      </button>
    </form>
  );
}
