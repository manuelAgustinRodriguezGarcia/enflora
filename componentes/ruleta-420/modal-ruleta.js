"use client";

import { useRef } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { motion } from "motion/react";

const panelAbierto = { opacity: 1, scale: 1, y: 0 };
const panelCerrado = { opacity: 0, scale: 0.94, y: 24 };

export function ModalRuleta({ abierto, onCerrar, titulo, descripcion, children, className = "", encabezado = null }) {
  const acciones = useRef(null);

  function cambiar(siguiente, detalles) {
    if (!siguiente) {
      detalles?.preventUnmountOnClose?.();
      onCerrar();
    }
  }

  return (
    <Dialog.Root open={abierto} onOpenChange={cambiar} actionsRef={acciones}>
      <Dialog.Portal>
        <Dialog.Backdrop
          render={
            <motion.div
              className="ruleta-modal__fondo"
              initial={{ opacity: 0 }}
              animate={{ opacity: abierto ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            />
          }
        />
        <Dialog.Viewport className="ruleta-modal__vista">
          <Dialog.Popup
            render={
              <motion.div
                className={`ruleta-modal__panel${className ? ` ${className}` : ""}`}
                initial={panelCerrado}
                animate={abierto ? panelAbierto : panelCerrado}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                onAnimationComplete={() => {
                  if (!abierto) acciones.current?.unmount();
                }}
              />
            }
          >
            {encabezado}
            <Dialog.Title className="ruleta-modal__titulo">{titulo}</Dialog.Title>
            {descripcion ? (
              <Dialog.Description className="ruleta-modal__texto">{descripcion}</Dialog.Description>
            ) : null}
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
