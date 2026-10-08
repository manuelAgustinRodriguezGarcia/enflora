"use client";

import { useActionState, useState } from "react";
import { eliminarPlanta } from "@/app/espacios/[id]/acciones";

export function EliminarPlanta({ plantaId, unidadId, espacioId }) {
  const [pedirConfirmacion, setPedirConfirmacion] = useState(false);
  const [estado, accion, pendiente] = useActionState(eliminarPlanta, null);

  if (!pedirConfirmacion) {
    return (
      <button
        className="acciones__texto"
        type="button"
        onClick={() => setPedirConfirmacion(true)}
      >
        Eliminar
      </button>
    );
  }

  return (
    <form className="confirmacion" action={accion}>
      {estado?.error ? <p className="formulario__error">{estado.error}</p> : null}
      <p>¿Eliminar esta planta?</p>
      <input type="hidden" name="planta_id" value={plantaId} />
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
