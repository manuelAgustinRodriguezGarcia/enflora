"use client";

import { Popover } from "@base-ui/react/popover";
import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EliminarEspacio } from "@/componentes/eliminar-espacio";
import { IconoBasura, IconoLapiz } from "@/componentes/iconos-ui";

export function MenuAccionesTarjetaEspacio({ espacioId, lado = "top" }) {
  const [abierto, setAbierto] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const hrefEditar = `/cultivos/${espacioId}/editar`;

  function pedirEliminar(evento) {
    evento.preventDefault();
    evento.stopPropagation();
    setAbierto(false);
    window.setTimeout(() => setConfirmar(true), 0);
  }

  return (
    <div className="tarjeta-acciones-menu acciones acciones--tarjeta">
      <Popover.Root open={abierto} onOpenChange={setAbierto}>
        <Popover.Trigger
          type="button"
          className="tarjeta-acciones-menu__disparador boton boton--secundario boton--icono"
          aria-label="Acciones del espacio"
          aria-haspopup="menu"
          aria-expanded={abierto}
        >
          <Ellipsis strokeWidth={1.75} aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            className="tarjeta-acciones-menu__positioner"
            side={lado}
            align="end"
            sideOffset={8}
          >
            <Popover.Popup className="tarjeta-acciones-menu__popup">
              <ul className="tarjeta-acciones-menu__lista" role="menu">
                <li role="none">
                  <Link
                    role="menuitem"
                    className="tarjeta-acciones-menu__opcion"
                    href={hrefEditar}
                    onClick={() => setAbierto(false)}
                  >
                    <IconoLapiz />
                    Editar
                  </Link>
                </li>
                <li role="none">
                  <button
                    type="button"
                    className="tarjeta-acciones-menu__opcion tarjeta-acciones-menu__opcion--destructivo"
                    role="menuitem"
                    onClick={pedirEliminar}
                  >
                    <IconoBasura />
                    Eliminar
                  </button>
                </li>
              </ul>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <EliminarEspacio
        espacioId={espacioId}
        presentacion="oculto"
        abierto={confirmar}
        onCerrar={() => setConfirmar(false)}
      />
    </div>
  );
}
