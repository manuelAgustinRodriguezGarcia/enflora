"use client";

import { useActionState } from "react";
import { editarEspacio } from "@/app/espacios/acciones";
import { Boton } from "@/componentes/boton";

export function FormularioEspacio({ espacio }) {
  const [estado, accion, pendiente] = useActionState(editarEspacio, null);
  const nombre = estado?.nombre ?? espacio?.nombre ?? "";
  const tipo = estado?.tipo ?? espacio?.tipo ?? "";

  return (
    <form key={estado?.error || "inicial"} className="formulario" action={accion}>
      {estado?.error ? <p className="formulario__error">{estado.error}</p> : null}
      <input type="hidden" name="espacio_id" value={espacio.id} />
      <label className="formulario__campo">
        Nombre
        <input name="nombre" type="text" defaultValue={nombre} />
      </label>
      <label className="formulario__campo">
        Tipo
        <select name="tipo" defaultValue={tipo}>
          <option value="">Seleccionar</option>
          <option value="interior">Interior</option>
          <option value="exterior">Exterior</option>
        </select>
      </label>
      <Boton type="submit" disabled={pendiente}>
        Guardar
      </Boton>
    </form>
  );
}
