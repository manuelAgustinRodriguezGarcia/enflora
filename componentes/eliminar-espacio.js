"use client";

import { useActionState, useState } from "react";
import { eliminarEspacio } from "@/app/espacios/acciones";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";

export function EliminarEspacio({ espacioId }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(eliminarEspacio, null);

  return (
    <>
      <button className="acciones__texto" type="button" onClick={() => setAbierto(true)}>
        Eliminar
      </button>
      <ModalConfirmacion
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="¿Eliminar este espacio?"
        descripcion="Las unidades y las plantas de este espacio también se eliminan."
        textoConfirmar="Eliminar"
        pendiente={pendiente}
        error={estado?.error || ""}
        accion={accion}
      >
        <input type="hidden" name="espacio_id" value={espacioId} />
      </ModalConfirmacion>
    </>
  );
}
