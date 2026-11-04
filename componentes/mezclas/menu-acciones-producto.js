"use client";

import { Popover } from "@base-ui/react/popover";
import { Ellipsis } from "lucide-react";
import { useState } from "react";
import { IconoBasura, IconoLapiz } from "@/componentes/iconos-ui";

export function MenuAccionesProducto({ onEditar, onEliminar }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="tarjeta-acciones-menu mezclas__menu">
      <Popover.Root open={abierto} onOpenChange={setAbierto}>
        <Popover.Trigger
          type="button"
          className="tarjeta-acciones-menu__disparador boton boton--secundario boton--icono"
          aria-label="Acciones del producto"
          aria-haspopup="menu"
          aria-expanded={abierto}
        >
          <Ellipsis strokeWidth={1.75} aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            className="tarjeta-acciones-menu__positioner"
            side="bottom"
            align="end"
            sideOffset={8}
          >
            <Popover.Popup className="tarjeta-acciones-menu__popup">
              <ul className="tarjeta-acciones-menu__lista" role="menu">
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="tarjeta-acciones-menu__opcion"
                    onClick={() => {
                      setAbierto(false);
                      onEditar();
                    }}
                  >
                    <IconoLapiz />
                    Editar
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="tarjeta-acciones-menu__opcion tarjeta-acciones-menu__opcion--destructivo"
                    onClick={() => {
                      setAbierto(false);
                      onEliminar();
                    }}
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
    </div>
  );
}
