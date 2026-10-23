"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { motion } from "motion/react";
import { ControlNotificaciones } from "@/componentes/control-notificaciones";
import { IconoNavegacion } from "@/componentes/icono-navegacion";
import { transicionRapida, transicionVista } from "@/lib/animaciones";
import { esRutaApp } from "@/lib/navegacion";

const panelAbierto = { opacity: 1, scale: 1, y: 0 };
const panelCerrado = { opacity: 0, scale: 0.98, y: 8 };

export function BotonNotificaciones({ oculto = false }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);

  if (oculto || !esRutaApp(ruta)) return null;

  function cambiar(siguiente) {
    setAbierto(Boolean(siguiente));
  }

  return (
    <Dialog.Root open={abierto} onOpenChange={cambiar}>
      <Dialog.Trigger className="encabezado__notificaciones" aria-label="Notificaciones">
        <IconoNavegacion clave="notificaciones" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop
          render={
            <motion.div
              className="modal__fondo"
              initial={{ opacity: 0 }}
              animate={{ opacity: abierto ? 1 : 0 }}
              transition={transicionRapida}
            />
          }
        />
        <Dialog.Viewport className="modal__vista">
          <Dialog.Popup
            render={
              <motion.div
                className="modal__panel"
                initial={panelCerrado}
                animate={abierto ? panelAbierto : panelCerrado}
                transition={transicionVista}
              />
            }
          >
            <Dialog.Title className="modal__titulo">Notificaciones</Dialog.Title>
            <Dialog.Description className="modal__texto">
              Los avisos llegan al sistema del dispositivo, aunque Enflora no esté abierta.
            </Dialog.Description>
            <ControlNotificaciones />
            <div className="modal__acciones">
              <Dialog.Close className="encabezado__cerrar-aviso">Cerrar</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
