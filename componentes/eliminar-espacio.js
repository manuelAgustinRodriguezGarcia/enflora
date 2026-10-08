"use client";

import { useActionState, useState } from "react";
import { eliminarEspacio } from "@/app/espacios/acciones";

export function EliminarEspacio({ espacioId }) {
  const [pedirConfirmacion, setPedirConfirmacion] = useState(false);
  const [estado, accion, pendiente] = useActionState(eliminarEspacio, null);

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
      <p>¿Eliminar este espacio?</p>
      <p>Las unidades y las plantas de este espacio también se eliminan.</p>
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
