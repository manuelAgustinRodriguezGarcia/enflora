"use client";

import { useActionState, useState } from "react";
import { eliminarEspacio } from "@/app/cultivos/acciones";
import { Boton } from "@/componentes/boton";
import { IconoBasura } from "@/componentes/iconos-ui";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";

export function EliminarEspacio({
  espacioId,
  presentacion = "icono",
  alAbrirModal,
  abierto: abiertoExterno,
  onCerrar,
}) {
  const [abiertoInterno, setAbiertoInterno] = useState(false);
  const [estado, accion, pendiente] = useActionState(eliminarEspacio, null);
  const controlado = abiertoExterno !== undefined;
  const abierto = controlado ? abiertoExterno : abiertoInterno;

  function cerrar() {
    if (controlado) onCerrar?.();
    else setAbiertoInterno(false);
  }

  function abrirModal() {
    alAbrirModal?.();
    if (!controlado) setAbiertoInterno(true);
  }

  const disparador =
    presentacion === "oculto" ? null : presentacion === "menu" ? (
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
        onCerrar={cerrar}
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
