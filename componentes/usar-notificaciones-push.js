"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ESPERA_RECEPCION_MS,
  clasificarSoporte,
  claveAplicacionABytes,
  segundosReintento,
  textoEspera,
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
  limite: "Hiciste varios intentos seguidos. Esperá unos minutos y probá de nuevo.",
  error: "No pudimos actualizar los avisos. Probá de nuevo en unos minutos.",
};

export const TEXTOS_PRUEBA = {
  enviando: "Enviando un aviso de prueba a este dispositivo.",
  aceptado:
    "El servicio de notificaciones aceptó el aviso. Esperando que este dispositivo confirme que lo recibió.",
  recibido: "El aviso llegó a este dispositivo.",
  sinConfirmar:
    "El servicio de notificaciones aceptó el aviso, pero este dispositivo todavía no confirmó que lo recibió. Si no aparece en unos minutos, revisá que el sistema permita las notificaciones del navegador.",
  inactiva: "Esta suscripción ya no está activa en Enflora. Volvé a activar los avisos.",
  renovacion:
    "Las claves de los avisos cambiaron y no pudimos renovar la suscripción de este dispositivo. Desactivá los avisos y volvé a activarlos.",
  error: "No pudimos enviar el aviso de prueba.",
  admin: "Prueba administrativa.",
};

export function textoLimite(segundos, accion = "intentarlo") {
  return `Hiciste varios intentos seguidos desde esta conexión. Vas a poder ${accion} de nuevo ${textoEspera(segundos)}.`;
}

function bytesABase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function mismaClave(actual, esperada) {
  if (!actual) return true;
  const bytes = new Uint8Array(actual);
  if (bytes.length !== esperada.length) return false;
  return bytes.every((valor, indice) => valor === esperada[indice]);
}

function claveActual() {
  return claveAplicacionABytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "");
}

function plataformaNombre(plataforma) {
  if (plataforma.esIos) return "ios";
  if (plataforma.esAndroid) return "android";
  if (plataforma.esDesktop) return "escritorio";
  return "desconocida";
}

async function registroExistente() {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration("/")) || null;
}

async function esperaDe(respuesta) {
  const cabecera = segundosReintento(respuesta.headers.get("Retry-After"));
  if (cabecera) return cabecera;
  const datos = await respuesta.json().catch(() => null);
  return Number(datos?.reintentarEn) || null;
}

async function activaEnServidor(endpoint) {
  const respuesta = await fetch("/api/push/estado", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
    cache: "no-store",
  });
  if (!respuesta.ok) return null;
  const datos = await respuesta.json();
  if (typeof datos?.activa !== "boolean") return null;
  return datos.activa;
}

async function guardarEnServidor(suscripcion, origen, plataforma, reemplaza) {
  const llaveP256 = suscripcion.getKey("p256dh");
  const llaveAuth = suscripcion.getKey("auth");
  if (!llaveP256 || !llaveAuth) return { estado: "error" };

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
      plataforma,
      expiraEn: suscripcion.expirationTime ? new Date(suscripcion.expirationTime).toISOString() : null,
      reemplaza: reemplaza || undefined,
    }),
  });
  if (respuesta.status === 429) return { estado: "limite", espera: await esperaDe(respuesta) };
  return { estado: respuesta.ok ? "activado" : "error" };
}

let renovacionEnCurso = null;

function renovarSuscripcion(registro, previa, bytes, origen, plataforma) {
  if (!renovacionEnCurso) {
    renovacionEnCurso = (async () => {
      const anterior = previa?.endpoint || null;
      if (previa) await previa.unsubscribe().catch(() => false);
      const nueva = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      });
      const guardada = await guardarEnServidor(nueva, origen, plataforma, anterior);
      if (guardada.estado !== "activado") await nueva.unsubscribe().catch(() => false);
      return guardada;
    })()
      .catch(() => ({ estado: "error" }))
      .finally(() => {
        renovacionEnCurso = null;
      });
  }
  return renovacionEnCurso;
}

async function enviarPrueba(endpoint) {
  const respuesta = await fetch("/api/push/probar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
    cache: "no-store",
  });
  if (respuesta.status === 429) return { estado: "limite", espera: await esperaDe(respuesta) };
  const datos = await respuesta.json().catch(() => null);
  return {
    estado: respuesta.ok && datos?.estado === "aceptado" ? "aceptado" : "error",
    motivo: typeof datos?.motivo === "string" ? datos.motivo : null,
    envioId: typeof datos?.envioId === "string" ? datos.envioId : null,
    modo: datos?.modo === "admin" ? "admin" : "publico",
  };
}

function escucharRecepciones() {
  const contenedor = "serviceWorker" in navigator ? navigator.serviceWorker : null;
  const recibidas = new Set();
  const esperas = new Map();

  function alRecibir(evento) {
    const datos = evento.data;
    if (!datos || datos.tipo !== "enflora-push-recibido" || typeof datos.prueba !== "string") return;
    recibidas.add(datos.prueba);
    esperas.get(datos.prueba)?.(true);
  }

  contenedor?.addEventListener("message", alRecibir);
  contenedor?.startMessages?.();

  return {
    esperar(id, ms) {
      if (!id || !contenedor) return Promise.resolve(false);
      if (recibidas.has(id)) return Promise.resolve(true);
      return new Promise((resolver) => {
        const reloj = setTimeout(() => terminar(false), ms);
        function terminar(valor) {
          clearTimeout(reloj);
          esperas.delete(id);
          resolver(valor);
        }
        esperas.set(id, terminar);
      });
    },
    cerrar() {
      contenedor?.removeEventListener("message", alRecibir);
      for (const terminar of [...esperas.values()]) terminar(false);
    },
  };
}

function conModo(texto, modo) {
  return modo === "admin" ? `${texto} ${TEXTOS_PRUEBA.admin}` : texto;
}

export function useNotificacionesPush(origen) {
  const { plataforma, instalada } = usePWAInstall();
  const [estado, setEstado] = useState("cargando");
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(null);
  const [prueba, setPrueba] = useState(null);
  const nombrePlataforma = plataformaNombre(plataforma);

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

  const recargar = useCallback(
    async (servidor = true) => {
      const soporte = soporteActual();
      if (soporte !== "con-permiso") {
        setEstado(soporte);
        return soporte;
      }
      try {
        const registro = await registroExistente();
        const suscripcion = registro ? await registro.pushManager.getSubscription() : null;
        const bytes = claveActual();
        if (suscripcion && bytes && !mismaClave(suscripcion.options?.applicationServerKey, bytes)) {
          const renovada = await renovarSuscripcion(registro, suscripcion, bytes, origen, nombrePlataforma);
          const siguiente = renovada.estado === "activado" ? "activado" : "desactivado";
          setEstado(siguiente);
          return siguiente;
        }
        let siguiente = suscripcion ? "activado" : "desactivado";
        if (suscripcion && servidor) {
          const activa = await activaEnServidor(suscripcion.endpoint).catch(() => null);
          if (activa === false) siguiente = "desactivado";
        }
        setEstado(siguiente);
        return siguiente;
      } catch {
        setEstado("error");
        return "error";
      }
    },
    [nombrePlataforma, origen, soporteActual],
  );

  useEffect(() => {
    const espera = setTimeout(() => recargar(true), 0);
    return () => clearTimeout(espera);
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

      const bytes = claveActual();
      if (!bytes) {
        setEstado("error");
        return "error";
      }

      const registro = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const previa = await registro.pushManager.getSubscription();
      let resultado;
      if (previa) {
        const vigente = mismaClave(previa.options?.applicationServerKey, bytes);
        const activa = vigente ? await activaEnServidor(previa.endpoint).catch(() => null) : false;
        if (vigente && activa === true) resultado = { estado: "activado" };
        else if (vigente && activa === null) {
          resultado = await guardarEnServidor(previa, origen, nombrePlataforma, null);
        } else {
          resultado = await renovarSuscripcion(registro, previa, bytes, origen, nombrePlataforma);
        }
      } else {
        const nueva = await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        });
        resultado = await guardarEnServidor(nueva, origen, nombrePlataforma, null);
        if (resultado.estado !== "activado") await nueva.unsubscribe().catch(() => false);
      }

      setEspera(resultado.estado === "limite" ? resultado.espera || null : null);
      setEstado(resultado.estado);
      return resultado.estado;
    } catch {
      setEstado("error");
      return "error";
    } finally {
      setOcupado(false);
    }
  }, [nombrePlataforma, origen, soporteActual]);

  const desactivar = useCallback(async () => {
    setOcupado(true);
    try {
      const suscripcion = await (await registroExistente())?.pushManager.getSubscription();
      if (suscripcion) {
        const respuesta = await fetch("/api/push/suscripcion", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: suscripcion.endpoint }),
        });
        if (respuesta.status === 429) {
          setEspera(await esperaDe(respuesta));
          setEstado("limite");
          return "limite";
        }
        if (!respuesta.ok) {
          setEstado("error");
          return "error";
        }
        await suscripcion.unsubscribe();
      }
      const soporte = soporteActual();
      const siguiente = soporte === "con-permiso" ? "desactivado" : soporte;
      setPrueba(null);
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
    setPrueba({ fase: "enviando", texto: TEXTOS_PRUEBA.enviando });
    const escucha = escucharRecepciones();
    try {
      const registro = await registroExistente();
      let suscripcion = registro ? await registro.pushManager.getSubscription() : null;
      if (!suscripcion) {
        setPrueba(null);
        setEstado("desactivado");
        return "desactivado";
      }

      const bytes = claveActual();
      const renovar = async () => {
        if (!bytes) return false;
        const renovada = await renovarSuscripcion(registro, suscripcion, bytes, origen, nombrePlataforma);
        if (renovada.estado === "limite") {
          setPrueba({ fase: "limite", texto: textoLimite(renovada.espera, "probar") });
          return false;
        }
        if (renovada.estado !== "activado") {
          setEstado("desactivado");
          setPrueba({ fase: "error", texto: TEXTOS_PRUEBA.renovacion });
          return false;
        }
        suscripcion = await registro.pushManager.getSubscription();
        return Boolean(suscripcion);
      };

      if (bytes && !mismaClave(suscripcion.options?.applicationServerKey, bytes) && !(await renovar())) {
        return "error";
      }

      let envio = await enviarPrueba(suscripcion.endpoint);
      if (envio.motivo === "credenciales" || envio.motivo === "expirada") {
        if (!(await renovar())) return "error";
        envio = await enviarPrueba(suscripcion.endpoint);
      }

      if (envio.estado === "limite") {
        setPrueba({ fase: "limite", texto: textoLimite(envio.espera, "probar") });
        return "limite";
      }
      if (envio.motivo === "inactiva" || envio.motivo === "inexistente") {
        setEstado("desactivado");
        setPrueba({ fase: "error", texto: TEXTOS_PRUEBA.inactiva });
        return "inactiva";
      }
      if (envio.estado !== "aceptado") {
        setPrueba({ fase: "error", texto: TEXTOS_PRUEBA.error });
        return "error";
      }

      setPrueba({ fase: "aceptado", texto: conModo(TEXTOS_PRUEBA.aceptado, envio.modo) });
      const recibido = await escucha.esperar(envio.envioId, ESPERA_RECEPCION_MS);
      setPrueba({
        fase: recibido ? "recibido" : "sin-confirmar",
        texto: conModo(recibido ? TEXTOS_PRUEBA.recibido : TEXTOS_PRUEBA.sinConfirmar, envio.modo),
      });
      return recibido ? "recibido" : "aceptado";
    } catch {
      setPrueba({ fase: "error", texto: TEXTOS_PRUEBA.error });
      return "error";
    } finally {
      escucha.cerrar();
      setOcupado(false);
    }
  }, [nombrePlataforma, origen]);

  return {
    estado,
    ocupado,
    espera,
    activar,
    desactivar,
    probar,
    recargar,
    resultadoPrueba: prueba?.texto || "",
    fasePrueba: prueba?.fase || null,
  };
}
