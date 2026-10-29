"use client";

import { AlertTriangle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { esNavegacionSalidaChatFlora } from "@/lib/flora-chat-conversacion-pendiente";

const GuardSalidaFloraContext = createContext(null);

export function ProveedorGuardSalidaFlora({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversacionPendiente, setConversacionPendiente] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [destinoHref, setDestinoHref] = useState("");

  const registrarConversacionPendiente = useCallback((pendiente) => {
    setConversacionPendiente(Boolean(pendiente));
  }, []);

  useEffect(() => {
    if (pathname !== "/flora" || !conversacionPendiente) return;

    function onClickCapture(evento) {
      const anchor = evento.target.closest("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!esNavegacionSalidaChatFlora(pathname, href)) return;

      evento.preventDefault();
      evento.stopPropagation();
      setDestinoHref(href);
      setModalAbierto(true);
    }

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [pathname, conversacionPendiente]);

  useEffect(() => {
    if (pathname !== "/flora" || !conversacionPendiente) return;

    function onBeforeUnload(evento) {
      evento.preventDefault();
      evento.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pathname, conversacionPendiente]);

  const confirmarSalida = useCallback(() => {
    const href = destinoHref;
    setModalAbierto(false);
    setDestinoHref("");
    if (href) router.push(href);
  }, [destinoHref, router]);

  const valor = useMemo(
    () => ({ registrarConversacionPendiente }),
    [registrarConversacionPendiente],
  );

  return (
    <GuardSalidaFloraContext.Provider value={valor}>
      {children}
      <ModalConfirmacion
        abierto={modalAbierto}
        onCerrar={() => {
          setModalAbierto(false);
          setDestinoHref("");
        }}
        titulo="¿Salir del chat?"
        descripcion="Si salís de este chat, perdés esta conversación. Para no perder este chat guardalo antes de irte."
        textoConfirmar="Salir igual"
        textoCancelar="Quedarme"
        onConfirmar={confirmarSalida}
        icono={<AlertTriangle strokeWidth={1.75} aria-hidden="true" />}
        varianteIcono="advertencia"
        varianteConfirmar="secundario"
      />
    </GuardSalidaFloraContext.Provider>
  );
}

export function useGuardSalidaFloraChat() {
  const ctx = useContext(GuardSalidaFloraContext);
  return ctx ?? { registrarConversacionPendiente: () => {} };
}
