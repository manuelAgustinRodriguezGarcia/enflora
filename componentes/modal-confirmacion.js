"use client";

import { useRef } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
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
  onConfirmarSecundario = null,
  textoConfirmarSecundario = "",
  varianteConfirmarSecundario = "secundario",
  iconoConfirmarSecundario = null,
  iconoConfirmar = null,
  icono = null,
  varianteIcono = "",
  varianteConfirmar,
  className = "",
  mostrarCancelar = true,
  mostrarCerrar = false,
  accionesEnColumna = false,
  children,
}) {
  const acciones = useRef(null);
  const claseIcono = varianteIcono ? `modal__icono modal__icono--${varianteIcono}` : "modal__icono";
  const clasesPanel = ["modal__panel"];
  if (className) clasesPanel.push(className);
  if (mostrarCerrar) clasesPanel.push("modal__panel--con-cerrar");
  const clasePanel = clasesPanel.join(" ");

  const clasesAcciones = ["modal__acciones"];
  if (accionesEnColumna || (onConfirmarSecundario && !mostrarCancelar)) {
    clasesAcciones.push("modal__acciones--columna");
  } else if (onConfirmarSecundario) {
    clasesAcciones.push("modal__acciones--triple");
  }

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
      <div className={clasesAcciones.join(" ")}>
        {mostrarCancelar ? (
          <Boton type="button" variante="ghost" onClick={() => cambiar(false)} disabled={pendiente}>
            {textoCancelar}
          </Boton>
        ) : null}
        {onConfirmarSecundario ? (
          <Boton
            type="button"
            variante={varianteConfirmarSecundario}
            onClick={onConfirmarSecundario}
            disabled={pendiente}
          >
            {iconoConfirmarSecundario ? (
              <span className="modal__accion-icono" aria-hidden="true">
                {iconoConfirmarSecundario}
              </span>
            ) : null}
            {textoConfirmarSecundario}
          </Boton>
        ) : null}
        {accion ? (
          <Boton type="submit" variante={varianteConfirmar} disabled={pendiente}>
            {iconoConfirmar ? (
              <span className="modal__accion-icono" aria-hidden="true">
                {iconoConfirmar}
              </span>
            ) : null}
            {textoConfirmar}
          </Boton>
        ) : (
          <Boton type="button" variante={varianteConfirmar} onClick={onConfirmar} disabled={pendiente}>
            {iconoConfirmar ? (
              <span className="modal__accion-icono" aria-hidden="true">
                {iconoConfirmar}
              </span>
            ) : null}
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
                className={clasePanel}
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
            {mostrarCerrar ? (
              <button
                type="button"
                className="flora-modal-fotos__cerrar"
                aria-label="Cerrar"
                disabled={pendiente}
                onClick={() => cambiar(false)}
              >
                <X strokeWidth={2} aria-hidden="true" />
              </button>
            ) : null}
            {accion ? <form action={accion}>{cuerpo}</form> : cuerpo}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
