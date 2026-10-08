"use client";

import { useActionState, useState } from "react";
import { eliminarUnidad } from "@/app/espacios/[id]/acciones";

export function EliminarUnidad({ unidadId, espacioId }) {
  const [pedirConfirmacion, setPedirConfirmacion] = useState(false);
  const [estado, accion, pendiente] = useActionState(eliminarUnidad, null);

  if (!pedirConfirmacion) {
    return (
      <button className="acciones__texto" type="button" onClick={() => setPedirConfirmacion(true)}>
        Eliminar
      </button>
    );
  }

  return (
    <form className="confirmacion" action={accion}>
      {estado?.error ? <p className="formulario__error">{estado.error}</p> : null}
      <p>¿Eliminar esta unidad?</p>
      <p>Las plantas de esta unidad también se eliminan.</p>
      <input type="hidden" name="unidad_id" value={unidadId} />
      <input type="hidden" name="espacio_id" value={espacioId} />
      <div className="confirmacion__acciones">
        <button type="submit" disabled={pendiente}>
          Eliminar
        </button>
        <button
          className="acciones__texto"
          type="button"
          onClick={() => setPedirConfirmacion(false)}
          disabled={pendiente}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
