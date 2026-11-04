"use client";

import { useActionState, useState } from "react";
import { salir } from "@/app/acciones/sesion";
import { Boton } from "@/componentes/boton";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { desvincularInstalacionActual } from "@/lib/push/cliente-dispositivo";

export function CerrarSesion({ className = "perfil__salir" }) {
  const [abierto, setAbierto] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [, accion, pendiente] = useActionState(salir, null);

  async function confirmar() {
    if (cerrando || pendiente) return;
    setCerrando(true);
    await desvincularInstalacionActual();
    accion();
  }

  return (
    <>
      <div className={className}>
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
        pendiente={pendiente || cerrando}
        onConfirmar={confirmar}
        varianteConfirmar="destructivo"
      />
    </>
  );
}
