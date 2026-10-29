"use client";

import { AlertTriangle, Save, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { esNavegacionSalidaChatFlora } from "@/lib/flora-chat-conversacion-pendiente";
import { requiereAdvertenciaBeforeUnloadFlora } from "@/lib/flora-estado-persistencia-chat";

const MARCA_GUARDIA_FLORA = "enfloraFloraGuardiaSalida";

const GuardSalidaFloraContext = createContext(null);

function guardiaFloraActiva(estado = window.history.state) {
  return Boolean(estado?.[MARCA_GUARDIA_FLORA]) && window.location.pathname === "/flora";
}

function activarGuardiaFlora() {
  if (typeof window === "undefined" || guardiaFloraActiva()) return;
  const actual = window.history.state;
  const base = actual && typeof actual === "object" ? actual : {};
  window.history.pushState({ ...base, __NA: true, [MARCA_GUARDIA_FLORA]: true }, "", window.location.href);
}

export function ProveedorGuardSalidaFlora({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const handlersRef = useRef(null);
  const saliendoRef = useRef(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [destinoHref, setDestinoHref] = useState("");
  const [salidaPorRetroceso, setSalidaPorRetroceso] = useState(false);
  const [pendienteModal, setPendienteModal] = useState(false);
  const [errorModal, setErrorModal] = useState("");
  const [advertenciaActiva, setAdvertenciaActiva] = useState(false);

  const registrarPoliticaSalida = useCallback((handlers) => {
    handlersRef.current = handlers;
    setAdvertenciaActiva(Boolean(handlers?.requiereAdvertenciaBeforeUnload));
  }, []);

  const registrarConversacionPendiente = useCallback((pendiente) => {
    if (!pendiente) {
      if (!handlersRef.current) setAdvertenciaActiva(false);
      return;
    }
    setAdvertenciaActiva(Boolean(handlersRef.current?.requiereAdvertenciaBeforeUnload));
  }, []);

  const completarNavegacion = useCallback(
    (href, porRetroceso) => {
      const destino = href;
      setModalAbierto(false);
      setDestinoHref("");
      setSalidaPorRetroceso(false);
      setErrorModal("");
      setPendienteModal(false);
      saliendoRef.current = true;
      if (porRetroceso) {
        router.back();
        return;
      }
      if (destino) router.push(destino);
    },
    [router],
  );

  const prepararSalida = useCallback(async (href, { porRetroceso = false } = {}) => {
    const h = handlersRef.current;
    if (pathname !== "/flora" || !h) {
      if (href) router.push(href);
      else if (porRetroceso) router.back();
      return;
    }

    if (h.chatGuardadoId) {
      if (h.tieneCambiosPendientes?.()) {
        const sync = await h.sincronizarSilencioso?.();
        if (!sync?.ok) {
          h.onFalloPersistencia?.(sync?.error || "No pudimos guardar los últimos mensajes.");
          return;
        }
      }
      completarNavegacion(href, porRetroceso);
      return;
    }

    if (!h.chatFloraTieneContenido?.()) {
      completarNavegacion(href, porRetroceso);
      return;
    }

    if (!h.requiereModalSalida?.()) {
      completarNavegacion(href, porRetroceso);
      return;
    }

    setErrorModal("");
    setDestinoHref(href || "");
    setSalidaPorRetroceso(porRetroceso);
    setModalAbierto(true);
  }, [completarNavegacion, pathname, router]);

  useEffect(() => {
    if (pathname !== "/flora") return undefined;

    function onClickCapture(evento) {
      const anchor = evento.target.closest("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!esNavegacionSalidaChatFlora(pathname, href)) return;

      evento.preventDefault();
      evento.stopPropagation();
      void prepararSalida(href);
    }

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [pathname, prepararSalida]);

  useEffect(() => {
    if (pathname !== "/flora") return undefined;
    if (!advertenciaActiva) return undefined;

    activarGuardiaFlora();

    function onPopState(evento) {
      if (saliendoRef.current || evento.state?.[MARCA_GUARDIA_FLORA]) return;
      evento.stopImmediatePropagation?.();
      activarGuardiaFlora();
      void prepararSalida("", { porRetroceso: true });
    }

    window.addEventListener("popstate", onPopState, true);
    return () => window.removeEventListener("popstate", onPopState, true);
  }, [pathname, advertenciaActiva, prepararSalida]);

  useEffect(() => {
    if (pathname !== "/flora" || !advertenciaActiva) return undefined;

    function onBeforeUnload(evento) {
      evento.preventDefault();
      evento.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pathname, advertenciaActiva]);

  const salirSinGuardar = useCallback(() => {
    completarNavegacion(destinoHref, salidaPorRetroceso);
  }, [completarNavegacion, destinoHref, salidaPorRetroceso]);

  const guardarYSalir = useCallback(async () => {
    const h = handlersRef.current;
    if (!h?.guardarDesdeSalida) {
      setErrorModal("No se puede guardar este chat ahora.");
      return;
    }
    setPendienteModal(true);
    setErrorModal("");
    const resultado = await h.guardarDesdeSalida();
    if (!resultado?.ok) {
      setPendienteModal(false);
      setErrorModal(resultado?.error || "No se pudo guardar.");
      return;
    }
    completarNavegacion(destinoHref, salidaPorRetroceso);
  }, [completarNavegacion, destinoHref, salidaPorRetroceso]);

  const valor = useMemo(
    () => ({ registrarPoliticaSalida, registrarConversacionPendiente }),
    [registrarPoliticaSalida, registrarConversacionPendiente],
  );

  return (
    <GuardSalidaFloraContext.Provider value={valor}>
      {children}
      <ModalConfirmacion
        abierto={modalAbierto}
        onCerrar={() => {
          if (pendienteModal) return;
          setModalAbierto(false);
          setDestinoHref("");
          setSalidaPorRetroceso(false);
          setErrorModal("");
        }}
        titulo="¿Querés salir del chat?"
        descripcion="Si salís de este chat, perdés esta conversación. Para no perderla, guardala antes de irte."
        textoCancelar="Quedarme"
        textoConfirmarSecundario="Salir sin guardar"
        varianteConfirmarSecundario="secundario"
        iconoConfirmarSecundario={<X strokeWidth={1.75} aria-hidden="true" />}
        onConfirmarSecundario={salirSinGuardar}
        textoConfirmar="Guardar chat"
        iconoConfirmar={<Save strokeWidth={1.75} aria-hidden="true" />}
        onConfirmar={() => {
          void guardarYSalir();
        }}
        pendiente={pendienteModal}
        error={errorModal}
        icono={<AlertTriangle strokeWidth={1.75} aria-hidden="true" />}
        varianteIcono="advertencia"
      />
    </GuardSalidaFloraContext.Provider>
  );
}

export function useGuardSalidaFloraChat() {
  const ctx = useContext(GuardSalidaFloraContext);
  return (
    ctx ?? {
      registrarPoliticaSalida: () => {},
      registrarConversacionPendiente: () => {},
    }
  );
}

export { requiereAdvertenciaBeforeUnloadFlora };
