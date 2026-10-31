"use client";

import { useRef } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { motion } from "motion/react";
import { Boton } from "@/componentes/boton";
import { transicionRapida, transicionVista } from "@/lib/animaciones";
import { ENLACE_FUENTE_COTIZACION } from "@/lib/pagos/cotizacion-comercial";

const panelAbierto = { opacity: 1, scale: 1, y: 0 };
const panelCerrado = { opacity: 0, scale: 0.98, y: 8 };

export function ModalCotizacion({
  abierto,
  onCerrar,
  titulo,
  explicacion = "",
  sinDatos = "",
  valorTexto = null,
  fechaTexto = null,
  etiquetaPill = "Dólar billete vendedor (Banco Nación)",
}) {
  const acciones = useRef(null);
  const hayValor = Boolean(valorTexto);

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
                className="modal__panel precios-modal precios-modal--cotizacion"
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
            <Dialog.Title className="modal__titulo">{titulo}</Dialog.Title>

            <div className="precios-modal__cotizacion-cuerpo">
              {hayValor ? (
                <>
                  <p className="precios-modal__pill" aria-label={etiquetaPill}>
                    {valorTexto}
                  </p>
                  {fechaTexto ? (
                    <p className="precios-modal__actualizada">
                      Actualizada el {fechaTexto}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="modal__texto precios-modal__aviso">{sinDatos}</p>
              )}

              {explicacion ? (
                <Dialog.Description className="modal__texto precios-modal__detalle">
                  {explicacion}
                </Dialog.Description>
              ) : null}

              <p className="precios-modal__fuente">
                Fuente:{" "}
                <Link
                  href={ENLACE_FUENTE_COTIZACION.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {ENLACE_FUENTE_COTIZACION.etiqueta}
                </Link>
              </p>
            </div>

            <div className="modal__acciones">
              <Boton type="button" variante="ghost" onClick={onCerrar}>
                Cerrar
              </Boton>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
