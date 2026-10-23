"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { motion } from "motion/react";
import { Boton } from "@/componentes/boton";
import { ModalInstalacionIOS } from "@/componentes/landing/modal-instalacion-ios";
import { TEXTOS_PUSH, textoLimite, useNotificacionesPush } from "@/componentes/usar-notificaciones-push";
import { transicionRapida, transicionVista } from "@/lib/animaciones";
import { usePWAInstall } from "@/lib/use-pwa-install";

const panelAbierto = { opacity: 1, scale: 1, y: 0 };
const panelCerrado = { opacity: 0, scale: 0.98, y: 8 };

function etiquetaBoton(estado) {
  if (estado === "activado") return "Avisos activados";
  if (estado === "denegado") return "Avisos bloqueados";
  if (estado === "no-compatible") return "Avisos no disponibles";
  return "Avisame cuando Enflora esté disponible";
}

export function AvisoDisponibilidad() {
  const push = useNotificacionesPush("landing");
  const { plataforma } = usePWAInstall();
  const [abierto, setAbierto] = useState(false);
  const [guia, setGuia] = useState(false);
  const texto =
    push.estado === "limite" ? textoLimite(push.espera) : TEXTOS_PUSH[push.estado] || TEXTOS_PUSH.error;

  async function confirmar() {
    if (push.ocupado) return;
    if (push.estado === "requiere-instalacion") {
      setAbierto(false);
      setGuia(true);
      return;
    }
    if (push.estado === "activado") {
      await push.desactivar();
      return;
    }
    await push.activar();
  }

  const mostrarConfirmar =
    push.estado === "disponible" ||
    push.estado === "desactivado" ||
    push.estado === "activado" ||
    push.estado === "requiere-instalacion" ||
    push.estado === "limite" ||
    push.estado === "error";

  return (
    <div className="lanzamiento__aviso">
      <Boton
        type="button"
        className="lanzamiento__boton"
        aria-haspopup="dialog"
        onClick={() => setAbierto(true)}
      >
        {etiquetaBoton(push.estado)}
      </Boton>
      {push.estado === "activado" ? (
        <Boton
          type="button"
          className="lanzamiento__boton lanzamiento__boton--prueba"
          onClick={() => push.probar()}
          disabled={push.ocupado}
        >
          Probar aviso
        </Boton>
      ) : (
        <p className="lanzamiento__estado" role="status">
          {texto}
        </p>
      )}
      {push.resultadoPrueba ? (
        <p
          className="lanzamiento__estado"
          role={push.fasePrueba === "error" || push.fasePrueba === "limite" ? "alert" : "status"}
          data-fase={push.fasePrueba || undefined}
        >
          {push.resultadoPrueba}
        </p>
      ) : null}
      <Dialog.Root open={abierto} onOpenChange={setAbierto}>
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
              <Dialog.Title className="modal__titulo">Avisos de Enflora</Dialog.Title>
              <Dialog.Description className="modal__texto">
                Si querés, Enflora te avisa en el celular cuando ya esté disponible, aunque no tengas
                la aplicación abierta. El aviso llega como una notificación del sistema. Podés
                desactivarlo cuando quieras.
              </Dialog.Description>
              {push.estado === "activado" ? null : (
                <p className="modal__texto" role="status">
                  {texto}
                </p>
              )}
              <div className="modal__acciones">
                {mostrarConfirmar ? (
                  <Boton type="button" onClick={confirmar} disabled={push.ocupado || push.estado === "cargando"}>
                    {push.estado === "activado"
                      ? "Desactivar avisos"
                      : push.estado === "requiere-instalacion"
                        ? "Ver cómo instalarlo"
                        : push.estado === "error" || push.estado === "limite"
                          ? "Reintentar"
                          : "Activar avisos"}
                  </Boton>
                ) : null}
                <Dialog.Close className="encabezado__cerrar-aviso">Cerrar</Dialog.Close>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
      <ModalInstalacionIOS
        abierto={guia}
        onCerrar={() => setGuia(false)}
        plataforma={plataforma}
        reinicio={0}
      />
    </div>
  );
}
