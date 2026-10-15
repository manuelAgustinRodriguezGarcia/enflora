"use client";

import { useActionState, useState } from "react";
import { salir } from "@/app/acciones/sesion";
import { Boton } from "@/componentes/boton";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";

export function CerrarSesion() {
  const [abierto, setAbierto] = useState(false);
  const [, accion, pendiente] = useActionState(salir, null);

  return (
    <>
      <div className="perfil__salir">
        <Boton
          type="button"
          className="boton boton--destructivo boton--ancho"
          onClick={() => setAbierto(true)}
        >
          Cerrar sesión
        </Boton>
      </div>
      <ModalConfirmacion
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="¿Cerrar sesión?"
        descripcion="Vas a salir de tu cuenta en este dispositivo."
        textoConfirmar="Cerrar sesión"
        pendiente={pendiente}
        accion={accion}
        varianteConfirmar="destructivo"
      />
    </>
  );
}
