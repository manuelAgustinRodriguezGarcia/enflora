"use client";

import { useActionState, useRef, useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { salirAlInicio } from "@/app/acciones/sesion";

export function SalirExpo() {
  const reducido = useReducedMotion();
  const acciones = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [, accion, pendiente] = useActionState(salirAlInicio, null);

  function cambiar(siguiente, detalles) {
    if (!siguiente && pendiente) {
      detalles?.cancel();
      return;
    }
    if (!siguiente) {
      detalles?.preventUnmountOnClose?.();
      setAbierto(false);
    }
  }

  return (
    <>
      <a
        className="expo-admin__marca"
        href="/"
        aria-label="Cerrar sesión y volver al inicio"
        aria-haspopup="dialog"
        onClick={(evento) => {
          evento.preventDefault();
          setAbierto(true);
        }}
      >
        <img src="/logos/enflora-logo-apaisado.svg" alt="" width={1000} height={300} decoding="async" />
      </a>

      <AlertDialog.Root open={abierto} onOpenChange={cambiar} actionsRef={acciones}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop
            render={
              <motion.div
                className="expo-admin__fondo"
                initial={{ opacity: 0 }}
                animate={{ opacity: abierto ? 1 : 0 }}
                transition={{ duration: reducido ? 0 : 0.18 }}
              />
            }
          />
          <AlertDialog.Viewport className="expo-admin__vista">
            <AlertDialog.Popup
              render={
                <motion.div
                  className="expo-admin__panel"
                  initial={reducido ? false : { opacity: 0, y: 28 }}
                  animate={abierto ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
                  transition={reducido ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                  onAnimationComplete={() => {
                    if (!abierto) acciones.current?.unmount();
                  }}
                />
              }
            >
              <form className="expo-admin__salir" action={accion}>
                <div className="expo-admin__panel-cabecera">
                  <AlertDialog.Title className="expo-admin__panel-titulo">Salir del panel</AlertDialog.Title>
                  <button
                    type="button"
                    className="expo-admin__cerrar"
                    aria-label="Cerrar"
                    disabled={pendiente}
                    onClick={() => cambiar(false)}
                  >
                    <X size={20} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </div>

                <AlertDialog.Description className="expo-admin__confirmacion">
                  Vas a cerrar tu sesión en este dispositivo y volver a la página de inicio de Enflora.
                </AlertDialog.Description>

                <div className="expo-admin__formulario-acciones">
                  <button
                    type="submit"
                    className="expo-admin__accion expo-admin__accion--corregir"
                    disabled={pendiente}
                    aria-busy={pendiente || undefined}
                  >
                    {pendiente ? "SALIENDO..." : "SÍ, SALIR"}
                  </button>
                  <button
                    type="button"
                    className="expo-admin__accion expo-admin__accion--secundaria"
                    disabled={pendiente}
                    onClick={() => cambiar(false)}
                  >
                    CANCELAR
                  </button>
                </div>
              </form>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
