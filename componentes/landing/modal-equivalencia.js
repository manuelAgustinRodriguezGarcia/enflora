"use client";

import { useRef } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { motion } from "motion/react";
import { Boton } from "@/componentes/boton";
import { equivalenciasPlus } from "@/lib/planes";
import { transicionRapida, transicionVista } from "@/lib/animaciones";

const panelAbierto = { opacity: 1, scale: 1, y: 0 };
const panelCerrado = { opacity: 0, scale: 0.98, y: 8 };

export function ModalEquivalencia({ abierto, onCerrar, hrefRegistro }) {
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
                className="modal__panel precios-modal"
                layout
                initial={panelCerrado}
                animate={abierto ? panelAbierto : panelCerrado}
                transition={{
                  ...transicionVista,
                  layout: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                }}
                onAnimationComplete={() => {
                  if (!abierto) acciones.current?.unmount();
                }}
              />
            }
          >
            <Dialog.Title className="modal__titulo">{equivalenciasPlus.titulo}</Dialog.Title>
            <Dialog.Description className="modal__texto">
              {equivalenciasPlus.subtitulo}
            </Dialog.Description>
            <ul className="precios-modal__lista">
              {equivalenciasPlus.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="precios-modal__nota">{equivalenciasPlus.aclaracion}</p>
            <p className="precios-modal__cierre">{equivalenciasPlus.cierre}</p>
            <div className="modal__acciones">
              <Boton type="button" variante="ghost" onClick={onCerrar}>
                Cerrar
              </Boton>
              <Link
                className="landing__accion landing__accion--acento"
                href={hrefRegistro}
                onClick={onCerrar}
              >
                {equivalenciasPlus.cta}
              </Link>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
