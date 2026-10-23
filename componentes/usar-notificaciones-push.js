"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clasificarSoporte,
  claveAplicacionABytes,
  versionIosDesdeAgente,
} from "@/lib/push/reglas";
import { usePWAInstall } from "@/lib/use-pwa-install";

export const TEXTOS_PUSH = {
  cargando: "Estamos revisando este dispositivo.",
  disponible: "Enflora puede avisarte en el celular cuando esté disponible, aunque no tengas la aplicación abierta.",
  activado: "Avisos activados. Te vamos a avisar en este dispositivo.",
  desactivado: "Los avisos están desactivados en este dispositivo.",
  denegado: "El navegador bloqueó los avisos. Habilitalos en la configuración del sitio y volvé a intentar.",
  "no-compatible": "Este navegador no puede recibir notificaciones.",
  "requiere-instalacion":
    "En iPhone, los avisos solo funcionan si Enflora está instalada en la pantalla de inicio. Seguí los pasos y después abrila desde ahí.",
  error: "No pudimos actualizar los avisos. Probá de nuevo en unos minutos.",
};

function bytesABase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function plataformaNombre(plataforma) {
  if (plataforma.esIos) return "ios";
  if (plataforma.esAndroid) return "android";
  if (plataforma.esDesktop) return "escritorio";
  return "desconocida";
}

async function leerSuscripcionActiva() {
  if (!("serviceWorker" in navigator)) return null;
  const registro = await navigator.serviceWorker.getRegistration("/");
  if (!registro) return null;
  return registro.pushManager.getSubscription();
}

export function useNotificacionesPush(origen) {
  const { plataforma, instalada } = usePWAInstall();
  const [estado, setEstado] = useState("cargando");
  const [ocupado, setOcupado] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState("");

  const soporteActual = useCallback(() => {
    if (typeof window === "undefined") return "cargando";
    return clasificarSoporte({
      tieneServiceWorker: "serviceWorker" in navigator,
      tienePush: "PushManager" in window,
      tieneNotificacion: "Notification" in window,
      esIos: plataforma.esIos,
      instalada,
      versionIos: plataforma.esIos ? versionIosDesdeAgente(navigator.userAgent) : null,
      permiso: "Notification" in window ? Notification.permission : "default",
    });
  }, [instalada, plataforma.esIos]);

  const recargar = useCallback(async () => {
    const soporte = soporteActual();
    if (soporte !== "con-permiso") {
      setEstado(soporte);
      return soporte;
    }
    try {
      const suscripcion = await leerSuscripcionActiva();
      const siguiente = suscripcion ? "activado" : "desactivado";
      setEstado(siguiente);
      return siguiente;
    } catch {
      setEstado("error");
      return "error";
    }
  }, [soporteActual]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const activar = useCallback(async () => {
    const soporte = soporteActual();
    if (soporte === "requiere-instalacion" || soporte === "no-compatible" || soporte === "denegado") {
      setEstado(soporte);
      return soporte;
    }

    setOcupado(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        const siguiente = permiso === "denied" ? "denegado" : "disponible";
        setEstado(siguiente);
        return siguiente;
      }

      const bytes = claveAplicacionABytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "");
      if (!bytes) {
        setEstado("error");
        return "error";
      }

      const registro = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const previa = await registro.pushManager.getSubscription();
      const suscripcion =
        previa ||
        (await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        }));
      const llaveP256 = suscripcion.getKey("p256dh");
      const llaveAuth = suscripcion.getKey("auth");
      if (!llaveP256 || !llaveAuth) {
        setEstado("error");
        return "error";
      }

      const respuesta = await fetch("/api/push/suscripcion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: suscripcion.endpoint,
          claves: {
            p256dh: bytesABase64Url(llaveP256),
            auth: bytesABase64Url(llaveAuth),
          },
          origen,
          plataforma: plataformaNombre(plataforma),
          expiraEn: suscripcion.expirationTime
            ? new Date(suscripcion.expirationTime).toISOString()
            : null,
        }),
      });

      if (!respuesta.ok) {
        await suscripcion.unsubscribe();
        setEstado("error");
        return "error";
      }

      setEstado("activado");
      return "activado";
    } catch {
      setEstado("error");
      return "error";
    } finally {
      setOcupado(false);
    }
  }, [origen, plataforma, soporteActual]);

  const desactivar = useCallback(async () => {
    setOcupado(true);
    try {
      const suscripcion = await leerSuscripcionActiva();
      if (suscripcion) {
        const respuesta = await fetch("/api/push/suscripcion", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: suscripcion.endpoint }),
        });
        if (!respuesta.ok) {
          setEstado("error");
          return "error";
        }
        await suscripcion.unsubscribe();
      }
      const soporte = soporteActual();
      const siguiente = soporte === "con-permiso" ? "desactivado" : soporte;
      setResultadoPrueba("");
      setEstado(siguiente);
      return siguiente;
    } catch {
      setEstado("error");
      return "error";
    } finally {
      setOcupado(false);
    }
  }, [soporteActual]);

  const probar = useCallback(async () => {
    setOcupado(true);
    setResultadoPrueba("");
    try {
      const suscripcion = await leerSuscripcionActiva();
      if (!suscripcion) {
        setEstado("desactivado");
        return "desactivado";
      }
      const respuesta = await fetch("/api/push/probar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: suscripcion.endpoint }),
      });
      if (!respuesta.ok) {
        setResultadoPrueba("No pudimos enviar el aviso de prueba.");
        if (respuesta.status === 410 || respuesta.status === 409) setEstado("desactivado");
        return "error";
      }
      setResultadoPrueba("Enviamos un aviso de prueba a este dispositivo.");
      return "enviado";
    } catch {
      setResultadoPrueba("No pudimos enviar el aviso de prueba.");
      return "error";
    } finally {
      setOcupado(false);
    }
  }, []);

  return { estado, ocupado, activar, desactivar, probar, resultadoPrueba };
}
