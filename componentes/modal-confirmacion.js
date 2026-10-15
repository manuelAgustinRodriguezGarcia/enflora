"use client";

import { useRef } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { motion } from "motion/react";
import { Boton } from "@/componentes/boton";
import { transicionRapida, transicionVista } from "@/lib/animaciones";

const panelAbierto = { opacity: 1, scale: 1, y: 0 };
const panelCerrado = { opacity: 0, scale: 0.98, y: 8 };

export function ModalConfirmacion({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  pendiente = false,
  error = "",
  accion,
  onConfirmar,
  icono = null,
  varianteIcono = "",
  varianteConfirmar,
  children,
}) {
  const acciones = useRef(null);
  const claseIcono = varianteIcono ? `modal__icono modal__icono--${varianteIcono}` : "modal__icono";

  function cambiar(siguiente, detalles) {
    if (!siguiente && pendiente) {
      detalles?.cancel();
      return;
    }
    if (!siguiente) {
      detalles?.preventUnmountOnClose?.();
      onCerrar();
    }
  }

  const cuerpo = (
    <>
      {icono ? (
        <div className={claseIcono} aria-hidden="true">
          {icono}
        </div>
      ) : null}
      <Dialog.Title className="modal__titulo">{titulo}</Dialog.Title>
      {descripcion ? <Dialog.Description className="modal__texto">{descripcion}</Dialog.Description> : null}
      {error ? <p className="formulario__error">{error}</p> : null}
      {children}
      <div className="modal__acciones">
        <Boton type="button" variante="ghost" onClick={() => cambiar(false)} disabled={pendiente}>
          {textoCancelar}
        </Boton>
        {accion ? (
          <Boton type="submit" variante={varianteConfirmar} disabled={pendiente}>
            {textoConfirmar}
          </Boton>
        ) : (
          <Boton type="button" variante={varianteConfirmar} onClick={onConfirmar} disabled={pendiente}>
            {textoConfirmar}
          </Boton>
        )}
      </div>
    </>
  );

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
                className="modal__panel"
                initial={panelCerrado}
                animate={abierto ? panelAbierto : panelCerrado}
                transition={transicionVista}
                onAnimationComplete={() => {
                  if (!abierto) acciones.current?.unmount();
                }}
              />
            }
          >
            {accion ? <form action={accion}>{cuerpo}</form> : cuerpo}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
