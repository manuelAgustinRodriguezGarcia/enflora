"use client";

import { useActionState, useState } from "react";
import { editarUnidad } from "@/app/espacios/[id]/acciones";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { Selector } from "@/componentes/selector";
import { tiposDeUnidad } from "@/lib/unidades";

export function FormularioUnidad({ unidad, espacioId, tipoEspacio }) {
  const [estado, accion, pendiente] = useActionState(editarUnidad, null);
  const nombre = estado?.nombre ?? unidad.nombre ?? "";
  const [tipo, setTipo] = useState(estado?.tipo ?? unidad.tipo ?? "");
  const [tipoPersonalizado, setTipoPersonalizado] = useState(
    estado?.tipoPersonalizado ?? unidad.tipo_personalizado ?? ""
  );
  const tipos = tiposDeUnidad(tipoEspacio).map((opcion) => ({
    valor: opcion.valor,
    etiqueta: opcion.etiqueta,
  }));

  return (
    <form key={estado?.error || "inicial"} className="formulario" action={accion}>
      {estado?.error ? <p className="formulario__error">{estado.error}</p> : null}
      <input type="hidden" name="unidad_id" value={unidad.id} />
      <input type="hidden" name="espacio_id" value={espacioId} />
      <input type="hidden" name="tipo" value={tipo} />
      <label className="formulario__campo">
        Nombre
        <input name="nombre" type="text" defaultValue={nombre} />
      </label>
      <Selector
        etiqueta="Tipo"
        valor={tipo || null}
        onChange={setTipo}
        opciones={tipos}
        placeholder="Seleccionar"
      />
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
