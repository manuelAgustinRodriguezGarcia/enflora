"use client";

import { useActionState, useState } from "react";
import { editarEspacio } from "@/app/espacios/acciones";
import { Boton } from "@/componentes/boton";
import { Selector } from "@/componentes/selector";

const TIPOS = [
  { valor: "interior", etiqueta: "Interior" },
  { valor: "exterior", etiqueta: "Exterior" },
];

export function FormularioEspacio({ espacio }) {
  const [estado, accion, pendiente] = useActionState(editarEspacio, null);
  const nombre = estado?.nombre ?? espacio?.nombre ?? "";
  const [tipo, setTipo] = useState(estado?.tipo ?? espacio?.tipo ?? "");

  return (
    <form key={estado?.error || "inicial"} className="formulario" action={accion}>
      {estado?.error ? <p className="formulario__error">{estado.error}</p> : null}
      <input type="hidden" name="espacio_id" value={espacio.id} />
      <input type="hidden" name="tipo" value={tipo} />
      <label className="formulario__campo">
        Nombre
        <input name="nombre" type="text" defaultValue={nombre} />
      </label>
      <Selector
        etiqueta="Tipo"
        valor={tipo || null}
        onChange={setTipo}
        opciones={TIPOS}
        placeholder="Seleccionar"
      />
      <Boton type="submit" disabled={pendiente}>
        Guardar
      </Boton>
    </form>
  );
}
