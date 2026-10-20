"use client";

import { Dialog } from "@base-ui/react/dialog";
import { motion } from "motion/react";
import { salirAlInicio } from "@/app/acciones/sesion";
import { Boton } from "@/componentes/boton";
import { transicionRapida, transicionVista } from "@/lib/animaciones";

const panel = { opacity: 1, scale: 1, y: 0 };

export function ModalAccesoPrelanzamiento({ abierto }) {
  function cambiar(siguiente, detalles) {
    if (!siguiente) {
      detalles?.cancel();
    }
  }

  return (
    <Dialog.Root
      open={abierto}
      onOpenChange={cambiar}
      disablePointerDismissal
      modal
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          render={
            <motion.div
              className="modal__fondo modal__fondo--bloqueo"
              initial={{ opacity: 0 }}
              animate={{ opacity: abierto ? 1 : 0 }}
              transition={transicionRapida}
            />
          }
        />
        <Dialog.Viewport className="modal__vista modal__vista--bloqueo">
          <Dialog.Popup
            render={
              <motion.div
                className="modal__panel"
                initial={panel}
                animate={panel}
                transition={transicionVista}
              />
            }
          >
            <form action={salirAlInicio}>
              <Dialog.Title className="modal__titulo">Volver a inicio</Dialog.Title>
              <Dialog.Description className="modal__texto">
                Todavía no podés entrar a la app.
              </Dialog.Description>
              <div className="modal__acciones">
                <Boton type="submit">Volver a inicio</Boton>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
