"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { toqueFab, transicionToqueFab } from "@/lib/animaciones";

const FabEnlace = motion.create(Link);

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
export function FabNuevoChatFlora({
  onClick,
  href = "",
  disabled = false,
  detrasCapas = false,
  ariaLabel = "Nuevo chat",
  icono = null,
}) {
  const montado = useSyncExternalStore(suscribirCliente, esCliente, esServidor);

  if (!montado) return null;

  const className = `flora-chat-app__fab-nuevo${detrasCapas ? " flora-chat-app__fab-nuevo--detras-capas" : ""}`;
  const iconoNodo = icono || <Plus strokeWidth={2.25} aria-hidden="true" />;
  const toque = disabled ? undefined : toqueFab;

  if (href) {
    return createPortal(
      <FabEnlace
        href={href}
        className={className}
        aria-label={ariaLabel}
        whileTap={toqueFab}
        transition={transicionToqueFab}
      >
        {iconoNodo}
      </FabEnlace>,
      document.body,
    );
  }

  return createPortal(
    <motion.button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      whileTap={toque}
      transition={transicionToqueFab}
    >
      {iconoNodo}
    </motion.button>,
    document.body,
  );
}
