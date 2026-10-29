"use client";

import { Plus } from "lucide-react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

function suscribirCliente() {
  return () => {};
}

function esCliente() {
  return true;
}

function esServidor() {
  return false;
}

/**
 * FAB fijo en viewport (portal a body) para no quedar clipado por overflow del chat.
 */
export function FabNuevoChatFlora({ onClick, disabled = false, detrasCapas = false }) {
  const montado = useSyncExternalStore(suscribirCliente, esCliente, esServidor);

  if (!montado) return null;

  return createPortal(
    <button
      type="button"
      className={`flora-chat-app__fab-nuevo${detrasCapas ? " flora-chat-app__fab-nuevo--detras-capas" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label="Nuevo chat"
    >
      <Plus strokeWidth={2.25} aria-hidden="true" />
    </button>,
    document.body,
  );
}
