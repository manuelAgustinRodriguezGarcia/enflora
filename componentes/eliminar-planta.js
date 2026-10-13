"use client";

import { useActionState, useState } from "react";
import { eliminarPlanta } from "@/app/espacios/[id]/acciones";
import { Boton } from "@/componentes/boton";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";

export function EliminarPlanta({ plantaId, unidadId, espacioId }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(eliminarPlanta, null);

  return (
    <>
      <Boton className="boton boton--destructivo" type="button" onClick={() => setAbierto(true)}>
        Eliminar
      </Boton>
      <ModalConfirmacion
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="¿Eliminar esta planta?"
        textoConfirmar="Eliminar"
        pendiente={pendiente}
        error={estado?.error || ""}
        accion={accion}
      >
        <input type="hidden" name="planta_id" value={plantaId} />
        <input type="hidden" name="unidad_id" value={unidadId} />
        <input type="hidden" name="espacio_id" value={espacioId} />
      </ModalConfirmacion>
    </>
  );
}
