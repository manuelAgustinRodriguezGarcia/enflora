"use client";

import { useActionState, useState } from "react";
import { eliminarUnidad } from "@/app/espacios/[id]/acciones";
import { Boton } from "@/componentes/boton";
import { IconoBasura } from "@/componentes/iconos-ui";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";

export function EliminarUnidad({ unidadId, espacioId }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(eliminarUnidad, null);

  return (
    <>
      <Boton
        className="boton boton--destructivo boton--icono"
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Eliminar unidad"
      >
        <IconoBasura />
      </Boton>
      <ModalConfirmacion
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="¿Eliminar esta unidad?"
        descripcion="Las plantas de esta unidad también se eliminan."
        textoConfirmar="Eliminar"
        pendiente={pendiente}
        error={estado?.error || ""}
        accion={accion}
        icono={<IconoBasura />}
        varianteConfirmar="destructivo"
      >
        <input type="hidden" name="unidad_id" value={unidadId} />
        <input type="hidden" name="espacio_id" value={espacioId} />
      </ModalConfirmacion>
    </>
  );
}
