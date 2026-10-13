"use client";

import { useActionState, useState } from "react";
import { eliminarEspacio } from "@/app/espacios/acciones";
import { Boton } from "@/componentes/boton";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";

export function EliminarEspacio({ espacioId }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(eliminarEspacio, null);

  return (
    <>
      <Boton className="boton boton--destructivo" type="button" onClick={() => setAbierto(true)}>
        Eliminar
      </Boton>
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
