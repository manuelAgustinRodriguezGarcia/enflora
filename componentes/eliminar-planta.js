"use client";

import { useActionState, useState } from "react";
import { eliminarPlanta } from "@/app/espacios/[id]/acciones";
import { Boton } from "@/componentes/boton";
import { IconoBasura, IconoEliminarPlanta } from "@/componentes/iconos-ui";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";

export function EliminarPlanta({ plantaId, unidadId, espacioId }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(eliminarPlanta, null);

  return (
    <>
      <Boton
        className="boton boton--destructivo boton--icono"
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Eliminar planta"
      >
        <IconoBasura />
      </Boton>
      <ModalConfirmacion
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="¿Eliminar esta planta?"
        textoConfirmar="Eliminar"
        pendiente={pendiente}
        error={estado?.error || ""}
        accion={accion}
        icono={<IconoEliminarPlanta />}
        varianteIcono="eliminar"
        varianteConfirmar="destructivo"
      >
        <input type="hidden" name="planta_id" value={plantaId} />
        <input type="hidden" name="unidad_id" value={unidadId} />
        <input type="hidden" name="espacio_id" value={espacioId} />
      </ModalConfirmacion>
    </>
  );
}
