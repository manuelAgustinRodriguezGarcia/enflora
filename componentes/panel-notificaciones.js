"use client";

import { useState } from "react";
import { Boton } from "@/componentes/boton";
import { ModalInstalacionIOS } from "@/componentes/landing/modal-instalacion-ios";
import { publicarMensajeInterno } from "@/componentes/mensaje-interno";
import { TEXTOS_PUSH, useNotificacionesPush } from "@/componentes/usar-notificaciones-push";
import { instruccionPlataforma } from "@/lib/push/reglas";
import { usePWAInstall } from "@/lib/use-pwa-install";

const ETIQUETAS_PERMISO = {
  granted: "Concedido",
  denied: "Bloqueado",
  default: "Sin decidir",
  "no-disponible": "No disponible",
};

const ETIQUETAS_WORKER = {
  activo: "Activo",
  instalando: "Instalando",
  esperando: "Esperando actualización",
  ausente: "Sin registrar",
  "sin-soporte": "Sin soporte",
  desconocido: "Sin confirmar",
};

const ETIQUETAS_SUSCRIPCION = {
  activa: "Activa en este dispositivo",
  ausente: "Sin suscripción",
};

const ETIQUETAS_REGISTRO = {
  vinculada: "Vinculada a esta cuenta",
  "sin-vincular": "Sin vincular a esta cuenta",
  inactiva: "Inactiva",
  desconocido: "Sin confirmar",
};

const ETIQUETAS_ERROR = {
  temporal: "El servicio no respondió. Podés reintentar en unos minutos.",
  configuracion: "Falta la clave pública de avisos.",
  limite: "Hay demasiados intentos seguidos desde esta conexión.",
  "servicio-push": "El navegador rechazó la suscripción. Enflora no llamó al servidor.",
  tiempo: "El navegador no respondió a tiempo. No se creó una suscripción.",
  permiso: "El navegador no permitió crear la suscripción.",
  worker: "El service worker no quedó activo.",
};

const TEXTO_FALLO = {
  "servicio-push":
    "El permiso puede estar concedido y el service worker activo, pero este navegador no ofreció su servicio de notificaciones. La suscripción no se creó y no se guardó nada.",
  tiempo: "El navegador no terminó el registro del dispositivo. No se creó una suscripción ni se envió nada al servidor.",
  worker: "El service worker no quedó activo, así que el navegador no puede crear una suscripción.",
  permiso: "El navegador bloqueó la suscripción. Revisá el permiso de notificaciones del sitio.",
  configuracion: "La clave pública de los avisos no tiene un formato válido, así que no se intentó suscribir.",
};

const ETIQUETA_VAPID = {
  valida: "Formato válido",
  invalida: "Formato inválido",
  ausente: "Ausente",
};

const ETIQUETA_PAR = {
  coincide: "Coincide con la clave de envío",
  difiere: "No coincide con la clave de envío",
  "servidor-invalida": "El servidor no tiene un par válido",
  "sin-confirmar": "Sin confirmar",
};

const ETIQUETA_SERVIDOR = {
  "no-intentado": "No intentado",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  "sin-respuesta": "Sin respuesta",
};

const ETIQUETA_PERSISTENCIA = {
  "no-intentada": "No intentada",
  guardada: "Guardada",
  inactiva: "Inactiva",
  error: "Error",
};

const ETIQUETA_PASO = {
  permiso: "Permiso del navegador",
  worker: "Registro del service worker",
  ready: "Activación del service worker",
  suscripcion: "Creación de la suscripción",
  servidor: "Envío al servidor",
  persistencia: "Persistencia",
};

function nombreNavegador(plataforma) {
  if (plataforma.esSamsung) return "Samsung Internet";
  if (plataforma.esFirefox) return "Firefox";
  if (plataforma.esEdge) return "Edge";
  if (plataforma.esSafari || plataforma.esSafariMac) return "Safari";
  if (plataforma.esChrome) return "Chrome";
  if (plataforma.esIos) return "el navegador de este iPhone o iPad";
  return "este navegador";
}

function DiagnosticoTecnico({ tecnico }) {
  if (!tecnico) return null;
  const error =
    tecnico.errorNombre || tecnico.errorMensaje
      ? [tecnico.errorNombre, tecnico.errorMensaje].filter(Boolean).join(": ")
      : "Ninguno";
  return (
    <details className="estado-push__tecnico">
      <summary>Diagnóstico técnico</summary>
      <ul>
        <li>
          <span>Contexto seguro</span>
          <strong>{tecnico.contextoSeguro ? "HTTPS o localhost" : "No seguro"}</strong>
        </li>
        <li>
          <span>PushManager</span>
          <strong>{tecnico.pushManager ? "Disponible" : "No disponible"}</strong>
        </li>
        <li>
          <span>Notification.permission</span>
          <strong>{tecnico.permiso}</strong>
        </li>
        <li>
          <span>Service worker</span>
          <strong>{`${tecnico.scope || "sin alcance"} · ${tecnico.worker}`}</strong>
        </li>
        <li>
          <span>PushSubscription</span>
          <strong>{tecnico.suscripcion ? "Presente" : "Ausente"}</strong>
        </li>
        <li>
          <span>Clave pública VAPID</span>
          <strong>{ETIQUETA_VAPID[tecnico.vapid] || "Sin confirmar"}</strong>
        </li>
        <li>
          <span>Par de suscripción y envío</span>
          <strong>{ETIQUETA_PAR[tecnico.vapidEnvio] || "Sin confirmar"}</strong>
        </li>
        <li>
          <span>Registro en el servidor</span>
          <strong>{ETIQUETA_SERVIDOR[tecnico.registroServidor] || "Sin confirmar"}</strong>
        </li>
        <li>
          <span>Persistencia</span>
          <strong>{ETIQUETA_PERSISTENCIA[tecnico.persistencia] || "Sin confirmar"}</strong>
        </li>
        <li>
          <span>Paso interrumpido</span>
          <strong>{ETIQUETA_PASO[tecnico.paso] || "Ninguno"}</strong>
        </li>
        <li>
          <span>Último error</span>
          <strong>{error}</strong>
        </li>
      </ul>
    </details>
  );
}

function Fila({ etiqueta, valor, tono }) {
  return (
    <li className={`estado-push__fila estado-push__fila--${tono}`}>
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
    </li>
  );
}

export function PanelNotificaciones() {
  const push = useNotificacionesPush("app");
  const { plataforma, instalada } = usePWAInstall();
  const [guia, setGuia] = useState(false);
  const diagnostico = push.diagnostico;
  const activo = push.estado === "activado";
  const puedeActivar =
    push.estado === "activado" ||
    push.estado === "desactivado" ||
    push.estado === "disponible" ||
    push.estado === "sin-vincular";
  const instruccion = instruccionPlataforma({
    soporte: push.estado,
    esIos: plataforma.esIos,
    esFirefox: plataforma.esFirefox,
  });
  const navegadorOk = diagnostico.soporte !== "no-compatible" && diagnostico.soporte !== "cargando";
  const textoEstado = TEXTO_FALLO[diagnostico.error] || TEXTOS_PUSH[push.estado] || TEXTOS_PUSH.error;
  const mostrarTecnico =
    push.estado !== "cargando" &&
    (diagnostico.error ||
      push.estado === "configuracion" ||
      push.estado === "error" ||
      diagnostico.tecnico?.vapidEnvio === "difiere" ||
      diagnostico.tecnico?.vapidEnvio === "servidor-invalida" ||
      (diagnostico.permiso === "granted" && diagnostico.suscripcion !== "activa"));

  async function alternar() {
    if (push.ocupado || push.estado === "cargando" || push.estado === "pendiente") return;
    if (activo) await push.desactivar();
    else await push.activar();
  }

  function probarMensaje() {
    publicarMensajeInterno({
      titulo: "Mensaje interno de prueba",
      mensaje: "Este texto se muestra dentro de Enflora. No es una notificación del sistema ni un envío push.",
      url: "/perfil#notificaciones",
    });
  }

  return (
    <section className="estado-push" id="notificaciones" aria-labelledby="estado-push-titulo">
      <div className="estado-push__cabeza">
        <h2 id="estado-push-titulo">Estado de notificaciones</h2>
        <p>{textoEstado}</p>
      </div>
      <ul className="estado-push__lista">
        <Fila
          etiqueta="Navegador"
          valor={`${nombreNavegador(plataforma)}: ${navegadorOk ? "compatible" : diagnostico.soporte === "cargando" ? "revisando" : "sin soporte"}`}
          tono={navegadorOk ? "ok" : diagnostico.soporte === "cargando" ? "espera" : "no"}
        />
        <Fila
          etiqueta="Permiso"
          valor={ETIQUETAS_PERMISO[diagnostico.permiso] || diagnostico.permiso}
          tono={diagnostico.permiso === "granted" ? "ok" : diagnostico.permiso === "denied" ? "no" : "espera"}
        />
        <Fila
          etiqueta="Service worker"
          valor={ETIQUETAS_WORKER[diagnostico.serviceWorker] || "Sin confirmar"}
          tono={diagnostico.serviceWorker === "activo" ? "ok" : diagnostico.serviceWorker === "sin-soporte" ? "no" : "espera"}
        />
        <Fila
          etiqueta="Suscripción push"
          valor={ETIQUETAS_SUSCRIPCION[diagnostico.suscripcion] || "Sin confirmar"}
          tono={diagnostico.suscripcion === "activa" ? "ok" : "espera"}
        />
        <Fila
          etiqueta="Registro del dispositivo"
          valor={ETIQUETAS_REGISTRO[diagnostico.registro] || "Sin confirmar"}
          tono={diagnostico.registro === "vinculada" ? "ok" : diagnostico.registro === "inactiva" ? "no" : "espera"}
        />
        <Fila
          etiqueta="Aplicación instalada"
          valor={instalada ? "Sí, se está ejecutando como aplicación" : "No, está abierta en el navegador"}
          tono={instalada ? "ok" : "espera"}
        />
        <Fila
          etiqueta="Último error"
          valor={ETIQUETAS_ERROR[diagnostico.error] || "Ninguno"}
          tono={diagnostico.error ? "no" : "ok"}
        />
      </ul>
      {mostrarTecnico ? <DiagnosticoTecnico tecnico={diagnostico.tecnico} /> : null}
      {instruccion ? <p className="estado-push__instruccion">{instruccion}</p> : null}
      {puedeActivar ? (
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
            disabled={push.ocupado || push.estado === "cargando" || push.estado === "pendiente"}
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
      {push.estado === "error" || push.estado === "sin-vincular" ? (
        <Boton type="button" onClick={() => push.activar()} disabled={push.ocupado}>
          Reintentar
        </Boton>
      ) : null}
      <div className="estado-push__pruebas">
        <h3>Pruebas de este dispositivo</h3>
        <p>
          La notificación de prueba sale por el servidor y vuelve a esta instalación. El mensaje interno solo se dibuja
          dentro de Enflora y no usa el sistema de avisos.
        </p>
        <div className="estado-push__acciones">
          <Boton type="button" onClick={() => push.probar()} disabled={push.ocupado || push.estado !== "activado"}>
            Enviar notificación de prueba
          </Boton>
          <Boton type="button" variante="secundario" onClick={probarMensaje}>
            Enviar mensaje de prueba
          </Boton>
        </div>
        {push.resultadoPrueba ? (
          <p className="estado-push__resultado" role="status">
            {push.resultadoPrueba}
          </p>
        ) : null}
      </div>
      <ModalInstalacionIOS abierto={guia} onCerrar={() => setGuia(false)} plataforma={plataforma} reinicio={0} />
    </section>
  );
}
