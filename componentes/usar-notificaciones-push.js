"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ultimoFalloRegistroWorker } from "@/lib/push/fallo-registro";
import {
  ESPERA_RECEPCION_MS,
  clasificarFalloSuscripcion,
  clasificarSoporte,
  claveAplicacionABytes,
  formatoClavePublicaVapid,
  huellaClavePublica,
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
    "En iPhone o iPad, los avisos solo funcionan si Enflora está instalada en la pantalla de inicio. Seguí los pasos y después abrila desde ahí.",
  limite: "Hiciste varios intentos seguidos. Esperá unos minutos y probá de nuevo.",
  error: "No pudimos actualizar los avisos. Probá de nuevo en unos minutos.",
  configuracion: "Falta la configuración de avisos en el servidor. Desde acá no se pueden activar.",
  pendiente: "Estamos registrando este dispositivo.",
  "sin-vincular": "Este dispositivo permite avisos, pero no está vinculado a tu cuenta.",
};

export const TEXTOS_PRUEBA = {
  enviando: "Enviando un aviso de prueba a este dispositivo.",
  aceptado:
    "El servicio de notificaciones aceptó el aviso. Esperando que este dispositivo confirme que lo recibió.",
  recibido:
    "Este dispositivo recibió el aviso. Si Enflora está abierta, se muestra adentro. Si está en segundo plano o cerrada, aparece en el sistema. Que el servidor lo haya aceptado no alcanza: esta confirmación sale del dispositivo.",
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

async function estadoEnServidor(endpoint) {
  const respuesta = await fetch("/api/push/estado", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
    cache: "no-store",
  });
  if (!respuesta.ok) return null;
  const datos = await respuesta.json();
  if (typeof datos?.activa !== "boolean") return null;
  return {
    activa: datos.activa,
    vinculada: datos.vinculada === true,
    sesion: datos.sesion === true,
  };
}

async function estadoWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return "sin-soporte";
  const registro = await navigator.serviceWorker.getRegistration("/");
  if (!registro) return "ausente";
  if (registro.active) return "activo";
  if (registro.installing) return "instalando";
  if (registro.waiting) return "esperando";
  return "ausente";
}

function conTiempo(promesa, ms, paso) {
  return new Promise((resolver, rechazar) => {
    const reloj = setTimeout(() => {
      const error = new Error("La operación no respondió a tiempo.");
      error.name = "TimeoutError";
      error.paso = paso;
      rechazar(error);
    }, ms);
    promesa.then(
      (valor) => {
        clearTimeout(reloj);
        resolver(valor);
      },
      (error) => {
        clearTimeout(reloj);
        rechazar(error);
      },
    );
  });
}

function ambitoDe(registro) {
  if (!registro?.scope) return null;
  try {
    return new URL(registro.scope).pathname;
  } catch {
    return null;
  }
}

async function compararVapid() {
  const local = await huellaClavePublica(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "");
  const respuesta = await fetch("/api/push/vapid", { cache: "no-store" });
  if (!respuesta.ok) return "sin-confirmar";
  const datos = await respuesta.json().catch(() => null);
  if (!datos?.par) return "servidor-invalida";
  if (!local || typeof datos.huella !== "string" || datos.huella !== local) return "difiere";
  return "coincide";
}

async function prepararRegistro() {
  let registro;
  try {
    registro = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (error) {
    error.paso = "worker";
    throw error;
  }

  const limite = Date.now() + 2000;
  while (!registro.active && !registro.installing && !registro.waiting && Date.now() < limite) {
    await new Promise((resolver) => {
      setTimeout(resolver, 50);
    });
  }

  if (registro.active) return registro;
  if (registro.waiting) registro.waiting.postMessage({ tipo: "enflora-activar" });

  const worker = registro.installing || registro.waiting;
  if (!worker) {
    const error = new Error("El service worker no llegó a activarse.");
    error.name = "InvalidStateError";
    error.paso = "ready";
    throw error;
  }

  await conTiempo(
    new Promise((resolver, rechazar) => {
      const resolverSiActivo = () => {
        if (registro.active) resolver();
      };
      resolverSiActivo();
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && !registro.active) worker.postMessage({ tipo: "enflora-activar" });
        if (worker.state === "activated" || registro.active) resolver();
        else if (worker.state === "redundant" && registro.active) resolver();
        else if (worker.state === "redundant" && !registro.active) {
          const error = new Error("El service worker quedó inactivo.");
          error.name = "InvalidStateError";
          error.paso = "ready";
          rechazar(error);
        }
      });
    }),
    15000,
    "ready",
  );

  if (!registro.active) {
    const error = new Error("El service worker no llegó a activarse.");
    error.name = "InvalidStateError";
    error.paso = "ready";
    throw error;
  }
  return registro;
}

function permisoActual() {
  if (typeof window === "undefined" || !("Notification" in window)) return "no-disponible";
  return Notification.permission;
}

let vinculoEnCurso = null;

function asegurarVinculo(suscripcion, origen, plataforma) {
  if (!vinculoEnCurso) {
    vinculoEnCurso = guardarEnServidor(suscripcion, origen, plataforma, null).finally(() => {
      vinculoEnCurso = null;
    });
  }
  return vinculoEnCurso;
}

async function guardarEnServidor(suscripcion, origen, plataforma, reemplaza) {
  const llaveP256 = suscripcion.getKey("p256dh");
  const llaveAuth = suscripcion.getKey("auth");
  if (!llaveP256 || !llaveAuth) {
    return {
      estado: "error",
      registroServidor: "no-intentado",
      persistencia: "error",
      fallo: clasificarFalloSuscripcion(
        Object.assign(new Error("La suscripción no incluye las claves de cifrado."), { name: "InvalidStateError" }),
        "suscripcion",
      ),
    };
  }

  let respuesta;
  try {
    respuesta = await fetch("/api/push/suscripcion", {
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
  } catch (error) {
    return {
      estado: "error",
      registroServidor: "sin-respuesta",
      persistencia: "no-intentada",
      fallo: clasificarFalloSuscripcion(error, "servidor"),
    };
  }

  if (respuesta.status === 429) {
    return {
      estado: "limite",
      espera: await esperaDe(respuesta),
      registroServidor: "rechazado",
      persistencia: "no-intentada",
    };
  }
  if (!respuesta.ok) {
    return { estado: "error", registroServidor: "rechazado", persistencia: "error" };
  }
  return { estado: "activado", registroServidor: "aceptado", persistencia: "guardada" };
}

let renovacionEnCurso = null;

function renovarSuscripcion(registro, previa, bytes, origen, plataforma) {
  if (!renovacionEnCurso) {
    renovacionEnCurso = (async () => {
      const anterior = previa?.endpoint || null;
      if (previa) await previa.unsubscribe().catch(() => false);
      const nueva = await conTiempo(
        registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes.slice(),
        }),
        20000,
        "suscripcion",
      );
      const guardada = await guardarEnServidor(nueva, origen, plataforma, anterior);
      if (guardada.estado !== "activado") await nueva.unsubscribe().catch(() => false);
      return guardada;
    })()
      .catch((error) => ({
        estado: "error",
        registroServidor: "no-intentado",
        persistencia: "no-intentada",
        fallo: clasificarFalloSuscripcion(error, "suscripcion"),
      }))
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
  const [diagnostico, setDiagnostico] = useState({
    soporte: "cargando",
    permiso: "default",
    serviceWorker: "desconocido",
    suscripcion: "ausente",
    registro: "desconocido",
    instalada: false,
    error: null,
    tecnico: null,
  });
  const nombrePlataforma = plataformaNombre(plataforma);
  const vapidEnvioRef = useRef("sin-confirmar");

  const anotar = useCallback(
    (siguiente, extra = {}) => {
      if (extra.vapidEnvio) vapidEnvioRef.current = extra.vapidEnvio;
      const fallo = extra.fallo || null;
      setEstado(siguiente);
      setDiagnostico({
        soporte: siguiente,
        permiso: permisoActual(),
        serviceWorker: extra.sw || "desconocido",
        suscripcion: extra.suscripcion || "ausente",
        registro: extra.registro || "desconocido",
        instalada,
        error: extra.error || null,
        tecnico: {
          contextoSeguro: typeof window !== "undefined" ? window.isSecureContext === true : null,
          pushManager: typeof window !== "undefined" && "PushManager" in window,
          permiso: permisoActual(),
          scope: extra.scope || null,
          worker: extra.sw || "desconocido",
          suscripcion: extra.suscripcion === "activa",
          vapid: formatoClavePublicaVapid(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""),
          vapidEnvio: extra.vapidEnvio || vapidEnvioRef.current,
          registroServidor: extra.registroServidor || "no-intentado",
          persistencia: extra.persistencia || "no-intentada",
          paso: fallo?.paso || null,
          errorNombre: fallo?.nombre || null,
          errorMensaje: fallo?.mensaje || null,
        },
      });
      return siguiente;
    },
    [instalada],
  );

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
      const sw = await estadoWorker().catch(() => "desconocido");
      const vapidEnvio = await compararVapid().catch(() => "sin-confirmar");
      const registro = await registroExistente().catch(() => null);
      const scope = ambitoDe(registro);
      const falloRegistro = !registro && sw !== "activo" ? ultimoFalloRegistroWorker() : null;
      if (!claveActual() && soporte !== "no-compatible" && soporte !== "requiere-instalacion" && soporte !== "denegado") {
        return anotar("configuracion", { sw, scope, vapidEnvio, error: "configuracion" });
      }
      if (soporte !== "con-permiso") {
        return anotar(soporte, { sw, scope, vapidEnvio, fallo: falloRegistro, error: falloRegistro?.codigo || null });
      }
      try {
        const suscripcion = registro ? await registro.pushManager.getSubscription() : null;
        const bytes = claveActual();
        if (suscripcion && bytes && !mismaClave(suscripcion.options?.applicationServerKey, bytes)) {
          const renovada = await renovarSuscripcion(registro, suscripcion, bytes, origen, nombrePlataforma);
          const siguiente = renovada.estado === "activado" ? "activado" : "desactivado";
          return anotar(siguiente, {
            sw,
            scope,
            vapidEnvio,
            suscripcion: siguiente === "activado" ? "activa" : "ausente",
            registro: siguiente === "activado" ? "vinculada" : "desconocido",
            error: renovada.fallo?.codigo || (renovada.estado === "error" ? "temporal" : null),
            fallo: renovada.fallo || null,
            registroServidor: renovada.registroServidor,
            persistencia: renovada.persistencia,
          });
        }
        let siguiente = suscripcion ? "activado" : "desactivado";
        let registroCuenta = "desconocido";
        let error = falloRegistro?.codigo || null;
        let fallo = falloRegistro;
        let registroServidor = "no-intentado";
        let persistencia = "no-intentada";
        if (suscripcion && servidor) {
          const info = await estadoEnServidor(suscripcion.endpoint).catch(() => null);
          if (!info) {
            registroCuenta = "desconocido";
            error = "temporal";
            registroServidor = "sin-respuesta";
          } else if (info.activa === false) {
            siguiente = "desactivado";
            registroCuenta = "inactiva";
            registroServidor = "aceptado";
            persistencia = "inactiva";
            error = null;
            fallo = null;
          } else if (info.sesion && !info.vinculada) {
            const guardada = await asegurarVinculo(suscripcion, origen, nombrePlataforma);
            registroServidor = guardada.registroServidor || "no-intentado";
            persistencia = guardada.persistencia || "no-intentada";
            fallo = guardada.fallo || null;
            if (guardada.estado === "activado") {
              registroCuenta = "vinculada";
              error = null;
            } else {
              siguiente = "sin-vincular";
              registroCuenta = "sin-vincular";
              error = guardada.fallo?.codigo || (guardada.estado === "limite" ? "limite" : "temporal");
            }
          } else {
            registroCuenta = info.vinculada ? "vinculada" : "sin-vincular";
            registroServidor = "aceptado";
            persistencia = "guardada";
            error = null;
            fallo = null;
          }
        }
        return anotar(siguiente, {
          sw,
          scope,
          vapidEnvio,
          suscripcion: suscripcion ? "activa" : "ausente",
          registro: registroCuenta,
          error,
          fallo,
          registroServidor,
          persistencia,
        });
      } catch (errorCapturado) {
        const fallo = clasificarFalloSuscripcion(errorCapturado, "suscripcion");
        return anotar("error", { sw, scope, vapidEnvio, error: fallo.codigo, fallo });
      }
    },
    [anotar, nombrePlataforma, origen, soporteActual],
  );

  useEffect(() => {
    const espera = setTimeout(() => recargar(true), 0);
    return () => clearTimeout(espera);
  }, [recargar]);

  const activar = useCallback(async () => {
    const soporte = soporteActual();
    if (soporte === "requiere-instalacion" || soporte === "no-compatible" || soporte === "denegado") {
      return anotar(soporte, { sw: await estadoWorker().catch(() => "desconocido") });
    }
    if (!claveActual()) return anotar("configuracion", { error: "configuracion" });

    setOcupado(true);
    setEstado("pendiente");
    let paso = "permiso";
    let scope = null;
    try {
      if (Notification.permission !== "granted") {
        const permiso = await conTiempo(Notification.requestPermission(), 15000, "permiso");
        if (permiso !== "granted") {
          const siguiente = permiso === "denied" ? "denegado" : "disponible";
          return anotar(siguiente, { sw: await estadoWorker().catch(() => "desconocido") });
        }
      }

      const bytes = claveActual();
      if (!bytes) return anotar("configuracion", { error: "configuracion" });

      paso = "worker";
      const registro = await prepararRegistro();
      scope = ambitoDe(registro);
      paso = "suscripcion";
      const previa = await registro.pushManager.getSubscription();
      let resultado;
      if (previa) {
        const vigente = mismaClave(previa.options?.applicationServerKey, bytes);
        const info = vigente ? await estadoEnServidor(previa.endpoint).catch(() => null) : null;
        const yaLista = info?.activa === true && (info.vinculada || !info.sesion);
        if (vigente && yaLista) {
          resultado = { estado: "activado", registroServidor: "aceptado", persistencia: "guardada" };
        } else if (vigente) resultado = await guardarEnServidor(previa, origen, nombrePlataforma, null);
        else resultado = await renovarSuscripcion(registro, previa, bytes, origen, nombrePlataforma);
      } else {
        const nueva = await conTiempo(
          registro.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: bytes.slice(),
          }),
          20000,
          "suscripcion",
        );
        paso = "servidor";
        resultado = await guardarEnServidor(nueva, origen, nombrePlataforma, null);
        if (resultado.estado !== "activado") await nueva.unsubscribe().catch(() => false);
      }

      setEspera(resultado.estado === "limite" ? resultado.espera || null : null);
      return anotar(resultado.estado, {
        sw: "activo",
        scope,
        suscripcion: resultado.estado === "activado" ? "activa" : "ausente",
        registro: resultado.estado === "activado" ? "vinculada" : "desconocido",
        error: resultado.fallo?.codigo || (resultado.estado === "error" ? "temporal" : resultado.estado === "limite" ? "limite" : null),
        fallo: resultado.fallo || null,
        registroServidor: resultado.registroServidor,
        persistencia: resultado.persistencia,
      });
    } catch (errorCapturado) {
      const fallo = clasificarFalloSuscripcion(errorCapturado, paso);
      return anotar("error", {
        sw: await estadoWorker().catch(() => "desconocido"),
        scope,
        error: fallo.codigo,
        fallo,
        registroServidor: "no-intentado",
        persistencia: "no-intentada",
      });
    } finally {
      setOcupado(false);
    }
  }, [anotar, nombrePlataforma, origen, soporteActual]);

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
          return anotar("limite", { error: "limite" });
        }
        if (!respuesta.ok) return anotar("error", { error: "temporal" });
        await suscripcion.unsubscribe();
      }
      const soporte = soporteActual();
      const siguiente = soporte === "con-permiso" ? "desactivado" : soporte;
      setPrueba(null);
      return anotar(siguiente, { sw: await estadoWorker().catch(() => "desconocido"), suscripcion: "ausente", registro: "inactiva" });
    } catch {
      return anotar("error", { error: "temporal" });
    } finally {
      setOcupado(false);
    }
  }, [anotar, soporteActual]);

  const probar = useCallback(async () => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      setPrueba({ fase: "error", texto: TEXTOS_PUSH.denegado });
      return "denegado";
    }
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
    diagnostico,
  };
}
