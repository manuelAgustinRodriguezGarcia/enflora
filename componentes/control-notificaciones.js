"use client";

import { useState } from "react";
import { Boton } from "@/componentes/boton";
import { ModalInstalacionIOS } from "@/componentes/landing/modal-instalacion-ios";
import { TEXTOS_PUSH, useNotificacionesPush } from "@/componentes/usar-notificaciones-push";
import { usePWAInstall } from "@/lib/use-pwa-install";

export function ControlNotificaciones() {
  const push = useNotificacionesPush("app");
  const { plataforma } = usePWAInstall();
  const [guia, setGuia] = useState(false);
  const activo = push.estado === "activado";
  const puedeAlternar =
    push.estado === "activado" || push.estado === "desactivado" || push.estado === "disponible";

  async function alternar() {
    if (push.ocupado || push.estado === "cargando") return;
    if (activo) await push.desactivar();
    else await push.activar();
  }

  return (
    <>
      <p className="modal__texto" role="status">
        {TEXTOS_PUSH[push.estado] || TEXTOS_PUSH.error}
      </p>
      {puedeAlternar ? (
        <div className="estado-toggle">
          <span className={`estado-toggle__texto${activo ? "" : " estado-toggle__texto--apagado"}`}>
            {activo ? "Activados" : "Desactivados"}
          </span>
          <button
            type="button"
            className={`estado-toggle__boton${activo ? " estado-toggle__boton--activo" : ""}`}
            role="switch"
            aria-checked={activo}
            aria-label={activo ? "Desactivar avisos" : "Activar avisos"}
            disabled={push.ocupado || push.estado === "cargando"}
            onClick={alternar}
          >
            <span className="estado-toggle__pulgar" />
          </button>
        </div>
      ) : null}
      {push.estado === "requiere-instalacion" ? (
        <Boton type="button" onClick={() => setGuia(true)}>
          Ver cómo instalarlo
        </Boton>
      ) : null}
      {push.estado === "error" ? (
        <Boton type="button" onClick={() => push.activar()} disabled={push.ocupado}>
          Reintentar
        </Boton>
      ) : null}
      <ModalInstalacionIOS
        abierto={guia}
        onCerrar={() => setGuia(false)}
        plataforma={plataforma}
        reinicio={0}
      />
    </>
  );
}
