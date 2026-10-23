"use client";

import { Dialog } from "@base-ui/react/dialog";
import Image from "next/image";
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
              <div className="modal__flora">
                <Image
                  src="/images/flora-casco.png"
                  alt=""
                  width={1024}
                  height={1024}
                  draggable={false}
                  sizes="10rem"
                  priority
                />
              </div>
              <Dialog.Title className="modal__titulo">Estamos trabajando duro</Dialog.Title>
              <Dialog.Description className="modal__texto">
                Estamos trabajando duro para darte la mejor experiencia. Tus cultivos están en
                buenas manos.
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
