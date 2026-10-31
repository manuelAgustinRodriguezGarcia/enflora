"use client";

import { useActionState, useState } from "react";
import { eliminarEspacio } from "@/app/espacios/acciones";
import { Boton } from "@/componentes/boton";
import { IconoBasura } from "@/componentes/iconos-ui";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";

export function EliminarEspacio({ espacioId, presentacion = "icono", alAbrirModal }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(eliminarEspacio, null);

  function abrirModal() {
    alAbrirModal?.();
    setAbierto(true);
  }

  const disparador =
    presentacion === "menu" ? (
      <button
        type="button"
        className="tarjeta-acciones-menu__opcion tarjeta-acciones-menu__opcion--destructivo"
        role="menuitem"
        onClick={abrirModal}
      >
        <IconoBasura />
        Eliminar
      </button>
    ) : (
      <Boton
        className="boton boton--destructivo boton--icono"
        type="button"
        aria-label="Eliminar espacio"
        onClick={abrirModal}
      >
        <IconoBasura />
      </Boton>
    );

  return (
    <>
      {disparador}
      <ModalConfirmacion
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="¿Eliminar este espacio?"
        descripcion="Las unidades y las plantas de este espacio también se eliminan."
        textoConfirmar="Eliminar"
        pendiente={pendiente}
        error={estado?.error || ""}
        accion={accion}
        icono={<IconoBasura />}
        varianteConfirmar="destructivo"
      >
        <input type="hidden" name="espacio_id" value={espacioId} />
      </ModalConfirmacion>
    </>
  );
}
