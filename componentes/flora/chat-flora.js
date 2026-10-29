"use client";

import { BookOpen, Plus, Send, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BotonClipAdjuntoFlora,
  EstadoAdjuntoFlora,
  MenuDeslizableAdjuntoFlora,
  PreviewsAdjuntoFlora,
  liberarAdjuntosFlora,
  payloadImagenesParaApi,
} from "@/componentes/flora/barra-adjunto-imagen-flora";
import { FLORA_CHAT_MAX_IMAGENES, normalizarPreguntaConImagen } from "@/lib/flora-imagen-chat";
import { conversacionFloraPendiente } from "@/lib/flora-chat-conversacion-pendiente";
import { useGuardSalidaFloraChat } from "@/componentes/flora/proveedor-guard-salida-flora";
import { BotonGuardarChat } from "@/componentes/flora/boton-guardar-chat";
import { FabNuevoChatFlora } from "@/componentes/flora/fab-nuevo-chat-flora";
import { IndicadorFloraEscribiendo } from "@/componentes/flora/indicador-flora-escribiendo";
import { MensajeFloraMarkdown } from "@/componentes/flora/mensaje-flora-markdown";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";

const MENSAJE_BIENVENIDA =
  "Holis, acá Flora. Preguntame lo que necesites sobre tus plantas, registros o cultivo y le encontraremos la respuesta.";

const MAX_HISTORIAL_ENVIO = 8;
const UMBRAL_SCROLL_INFERIOR = 96;

function idMensaje() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nuevaClaveSesionChat() {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function ChatFlora({ continuarSolucionId = "" }) {
  const [mensajes, setMensajes] = useState([
    { id: "bienvenida", rol: "flora", texto: MENSAJE_BIENVENIDA, animar: false },
  ]);
  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [bannerContinuar, setBannerContinuar] = useState(null);
  const [modalNuevoChatAbierto, setModalNuevoChatAbierto] = useState(false);
  const [adjuntosImagen, setAdjuntosImagen] = useState([]);
  const [preparandoImagen, setPreparandoImagen] = useState(false);
  const [errorAdjunto, setErrorAdjunto] = useState("");
  const [menuAdjuntoAbierto, setMenuAdjuntoAbierto] = useState(false);
  const [claveSesion, setClaveSesion] = useState(() => nuevaClaveSesionChat());
  const [chatGuardadoId, setChatGuardadoId] = useState(null);
  const [chatMarcadoGuardadoEnSesion, setChatMarcadoGuardadoEnSesion] = useState(false);
  const adjuntoRef = useRef(null);
  const listaRef = useRef(null);
  const envioRef = useRef(false);
  const cercaDelFinalRef = useRef(true);
  const forzarScrollRef = useRef(false);
  const sesionRef = useRef(0);
  const contextoContinuarEnviadoRef = useRef(false);
  const ignorarContinuarRef = useRef(false);
  const { registrarConversacionPendiente } = useGuardSalidaFloraChat();

  useEffect(() => {
    const pendiente = conversacionFloraPendiente({
      mensajes,
      bannerContinuar,
      entrada,
      adjuntos: adjuntosImagen,
      cargando,
    });
    registrarConversacionPendiente(pendiente);
    return () => registrarConversacionPendiente(false);
  }, [
    mensajes,
    bannerContinuar,
    entrada,
    adjuntosImagen,
    cargando,
    registrarConversacionPendiente,
  ]);

  useEffect(() => {
    if (!continuarSolucionId) return;
    contextoContinuarEnviadoRef.current = false;
    ignorarContinuarRef.current = false;
    let cancelado = false;

    (async () => {
      try {
        const res = await fetch(`/api/flora/soluciones/${continuarSolucionId}`);
        const data = await res.json().catch(() => ({}));
        if (cancelado || !res.ok || !data.ok) return;
        setBannerContinuar({
          titulo: data.chat?.titulo || data.solucion?.titulo,
          pregunta: data.chat?.primera_pregunta || data.solucion?.pregunta,
        });
        if (data.chat?.clave_sesion) {
          setClaveSesion(data.chat.clave_sesion);
          setChatGuardadoId(data.chat.id);
          setChatMarcadoGuardadoEnSesion(true);
        }
      } catch {
        /* ignorar */
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [continuarSolucionId]);

  const desplazarAbajoSiCorresponde = useCallback((forzar = false) => {
    const el = listaRef.current;
    if (!el) return;
    if (!forzar && !cercaDelFinalRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const onScrollLista = useCallback(() => {
    const el = listaRef.current;
    if (!el) return;
    const distancia = el.scrollHeight - el.scrollTop - el.clientHeight;
    cercaDelFinalRef.current = distancia <= UMBRAL_SCROLL_INFERIOR;
  }, []);

  useEffect(() => {
    desplazarAbajoSiCorresponde(forzarScrollRef.current);
    forzarScrollRef.current = false;
  }, [mensajes, cargando, desplazarAbajoSiCorresponde]);

  const marcarAnimacionCompleta = useCallback((id) => {
    setMensajes((prev) =>
      prev.map((m) => (m.id === id ? { ...m, animar: false } : m)),
    );
  }, []);

  useEffect(() => {
    adjuntoRef.current = adjuntosImagen;
  }, [adjuntosImagen]);

  useEffect(
    () => () => {
      liberarAdjuntosFlora(adjuntoRef.current);
    },
    [],
  );

  const quitarAdjunto = (id) => {
    setAdjuntosImagen((prev) => {
      const item = prev.find((a) => a.id === id);
      if (item) liberarAdjuntosFlora([item]);
      return prev.filter((a) => a.id !== id);
    });
  };

  const agregarAdjunto = (item) => {
    setAdjuntosImagen((prev) => {
      if (prev.length >= FLORA_CHAT_MAX_IMAGENES) return prev;
      return [...prev, item];
    });
    setErrorAdjunto("");
  };

  const limpiarAdjuntos = () => {
    liberarAdjuntosFlora(adjuntosImagen);
    setAdjuntosImagen([]);
    setErrorAdjunto("");
  };

  const nuevaConversacion = () => {
    if (cargando) return;
    sesionRef.current += 1;
    setMensajes([{ id: "bienvenida", rol: "flora", texto: MENSAJE_BIENVENIDA, animar: false }]);
    setError("");
    setEntrada("");
    limpiarAdjuntos();
    setMenuAdjuntoAbierto(false);
    setBannerContinuar(null);
    setClaveSesion(nuevaClaveSesionChat());
    setChatGuardadoId(null);
    setChatMarcadoGuardadoEnSesion(false);
    ignorarContinuarRef.current = true;
    contextoContinuarEnviadoRef.current = false;
    cercaDelFinalRef.current = true;
    forzarScrollRef.current = true;
  };

  const pedirNuevoChat = () => {
    if (cargando) return;
    if (chatMarcadoGuardadoEnSesion || chatGuardadoId) {
      nuevaConversacion();
      return;
    }
    const hayConversacion = conversacionFloraPendiente({
      mensajes,
      bannerContinuar,
      entrada,
      adjuntos: adjuntosImagen,
      cargando,
    });
    if (!hayConversacion) {
      nuevaConversacion();
      return;
    }
    setModalNuevoChatAbierto(true);
  };

  const aceptarNuevoChat = () => {
    setModalNuevoChatAbierto(false);
    nuevaConversacion();
  };

  const enviar = async () => {
    const texto = entrada.trim();
    const imagenesPayload = payloadImagenesParaApi(adjuntosImagen);
    const hayImagen = Boolean(imagenesPayload?.length);
    if ((!texto && !hayImagen) || cargando || envioRef.current || preparandoImagen) return;

    const sesionActiva = sesionRef.current;
    envioRef.current = true;
    setError("");
    const textoEnviado = texto;
    const adjuntosSnapshot = adjuntosImagen;
    const adjuntosEnviados = adjuntosImagen.map((a) => ({
      vista: a.vista,
      origen: a.origen,
      etiqueta: a.etiqueta,
    }));
    setEntrada("");
    setAdjuntosImagen([]);
    setErrorAdjunto("");
    setCargando(true);
    forzarScrollRef.current = true;
    cercaDelFinalRef.current = true;

    const preguntaGuardada = textoEnviado || normalizarPreguntaConImagen("");
    const idUsuario = idMensaje();
    const ahora = new Date().toISOString();
    setMensajes((prev) => [
      ...prev,
      {
        id: idUsuario,
        rol: "usuario",
        texto: textoEnviado,
        adjuntos: adjuntosEnviados,
        fecha: ahora,
      },
    ]);

    const historial = mensajes
      .filter((m) => m.id !== "bienvenida")
      .slice(-MAX_HISTORIAL_ENVIO)
      .map((m) => ({
        rol: m.rol === "flora" ? "flora" : "usuario",
        texto:
          m.texto ||
          (m.adjuntos?.length || m.adjunto ? normalizarPreguntaConImagen("") : ""),
      }));

    const payload = { mensaje: textoEnviado, historial };
    if (imagenesPayload?.length) payload.imagenes = imagenesPayload;
    if (
      continuarSolucionId &&
      !contextoContinuarEnviadoRef.current &&
      !ignorarContinuarRef.current
    ) {
      payload.contextoSolucionId = continuarSolucionId;
    }

    try {
      const res = await fetch("/api/flora/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (sesionActiva !== sesionRef.current) return;

      if (!res.ok || !data.ok) {
        setMensajes((prev) => prev.filter((m) => m.id !== idUsuario));
        setEntrada(textoEnviado);
        if (adjuntosSnapshot.length) setAdjuntosImagen(adjuntosSnapshot);
        setError(data.error || "No pudimos enviar el mensaje. Probá de nuevo.");
        return;
      }

      if (payload.contextoSolucionId) {
        contextoContinuarEnviadoRef.current = true;
        setBannerContinuar(null);
      }

      for (const item of adjuntosSnapshot) {
        if (item.origen === "transitoria") liberarAdjuntosFlora([item]);
      }

      const idFlora = idMensaje();
      setMensajes((prev) => [
        ...prev,
        {
          id: idFlora,
          rol: "flora",
          texto: String(data.respuesta || "").trim() || "…",
          animar: true,
          preguntaAsociada: preguntaGuardada,
          metaGuardado: data.meta?.guardado || null,
          imagenTransitoriaEnConsulta: data.meta?.imagen?.transitoria || false,
          fecha: new Date().toISOString(),
        },
      ]);
      forzarScrollRef.current = true;
    } catch {
      if (sesionActiva !== sesionRef.current) return;
      setMensajes((prev) => prev.filter((m) => m.id !== idUsuario));
      setEntrada(textoEnviado);
      if (adjuntosSnapshot.length) setAdjuntosImagen(adjuntosSnapshot);
      setError("Falló la conexión. Revisá tu internet e intentá otra vez.");
    } finally {
      if (sesionActiva === sesionRef.current) {
        setCargando(false);
      }
      envioRef.current = false;
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    enviar();
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      enviar();
    }
  };

  return (
    <div className="flora-chat-app">
      <header className="flora-chat-app__cabecera">
        <div className="flora-chat-app__cabecera-fila">
          <div className="flora-chat-app__identidad">
            <Image
              src="/images/flora-landingl-selfie.png"
              alt=""
              width={48}
              height={48}
              className="flora-chat-app__avatar"
            />
            <div>
              <h1 className="flora-chat-app__titulo">Flora</h1>
              <p className="flora-chat-app__subtitulo">En línea</p>
            </div>
          </div>
          <BotonGuardarChat
            key={`${claveSesion}-${chatGuardadoId || "nuevo"}`}
            mensajes={mensajes}
            claveSesion={claveSesion}
            chatGuardadoId={chatGuardadoId}
            onChatGuardado={setChatGuardadoId}
            onChatGuardadoConfirmado={() => setChatMarcadoGuardadoEnSesion(true)}
            deshabilitado={cargando}
          />
        </div>
        <div className="flora-chat-app__cabecera-acciones">
          <Link
            href="/perfil"
            className="flora-chat-app__config"
            onClick={() => {
              try {
                sessionStorage.setItem("enflora-scroll-preferencias-flora", "1");
              } catch {
                /* storage no disponible */
              }
            }}
          >
            <SlidersHorizontal strokeWidth={1.75} aria-hidden="true" />
            <span>Ajustes de Flora</span>
          </Link>
          <Link href="/flora/soluciones" className="flora-chat-app__soluciones">
            <BookOpen strokeWidth={1.75} aria-hidden="true" />
            <span>Chats guardados</span>
          </Link>
        </div>
      </header>

      <ModalConfirmacion
        abierto={modalNuevoChatAbierto}
        onCerrar={() => setModalNuevoChatAbierto(false)}
        titulo="¿Empezar un chat nuevo?"
        descripcion="Se borrará la conversación actual en esta pantalla. Los mensajes anteriores no quedarán visibles acá."
        textoConfirmar="Nuevo chat"
        textoCancelar="Cancelar"
        onConfirmar={aceptarNuevoChat}
        icono={<Plus strokeWidth={1.75} aria-hidden="true" />}
        varianteConfirmar="secundario"
      />

      <FabNuevoChatFlora
        onClick={pedirNuevoChat}
        disabled={cargando}
        detrasCapas={menuAdjuntoAbierto}
      />

      {bannerContinuar ? (
        <p className="flora-chat-app__continuar" role="status">
          Continuando desde: <strong>{bannerContinuar.titulo}</strong>. Escribí tu nueva pregunta abajo.
        </p>
      ) : null}

      <div
        className="flora-chat-app__lista"
        ref={listaRef}
        onScroll={onScrollLista}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={`flora-chat-app__fila flora-chat-app__fila--${m.rol === "flora" ? "flora" : "usuario"}`}
          >
            <div className="flora-chat-app__burbuja">
              {m.rol === "flora" ? (
                <>
                  <MensajeFloraMarkdown
                    texto={m.texto}
                    animar={Boolean(m.animar)}
                    onAnimacionCompleta={() => marcarAnimacionCompleta(m.id)}
                    onProgresoAnimacion={() => desplazarAbajoSiCorresponde(false)}
                  />
                </>
              ) : (
                <>
                  {(m.adjuntos?.length ? m.adjuntos : m.adjunto ? [m.adjunto] : []).map((adj, i) => (
                    <figure key={`${m.id}-adj-${i}`} className="flora-chat-app__adjunto-msg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={adj.vista} alt="" />
                      {adj.etiqueta ? (
                        <figcaption className="flora-chat-app__adjunto-msg-meta">{adj.etiqueta}</figcaption>
                      ) : null}
                    </figure>
                  ))}
                  {m.texto ? <span className="flora-chat-app__texto-usuario">{m.texto}</span> : null}
                </>
              )}
            </div>
          </div>
        ))}
        {cargando ? (
          <div className="flora-chat-app__fila flora-chat-app__fila--flora">
            <IndicadorFloraEscribiendo />
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="flora-chat-app__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flora-chat-app__dock">
        <div className="flora-chat-app__dock-extra">
          <PreviewsAdjuntoFlora
            adjuntos={adjuntosImagen}
            onQuitar={quitarAdjunto}
            disabled={cargando || preparandoImagen}
          />
          <EstadoAdjuntoFlora preparando={preparandoImagen} errorAdjunto={errorAdjunto} />
          <MenuDeslizableAdjuntoFlora
            abierto={menuAdjuntoAbierto}
            onCerrar={() => setMenuAdjuntoAbierto(false)}
            adjuntos={adjuntosImagen}
            onAgregar={agregarAdjunto}
            disabled={cargando}
            preparando={preparandoImagen}
            onPreparandoChange={setPreparandoImagen}
            onErrorAdjunto={setErrorAdjunto}
          />
        </div>
        <form className="flora-chat-app__form" onSubmit={onSubmit}>
          <div className="flora-chat-app__form-fila">
            <label className="flora-chat-app__sr" htmlFor="flora-chat-input">
              Mensaje para Flora
            </label>
            <textarea
              id="flora-chat-input"
              className="flora-chat-app__input"
              rows={1}
              placeholder="Preguntale a Flora…"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={cargando || preparandoImagen}
              maxLength={2000}
            />
            <BotonClipAdjuntoFlora
              abierto={menuAdjuntoAbierto}
              onToggle={() => setMenuAdjuntoAbierto((v) => !v)}
              disabled={cargando}
              preparando={preparandoImagen}
              lleno={adjuntosImagen.length >= FLORA_CHAT_MAX_IMAGENES}
            />
            <button
              type="submit"
              className="flora-chat-app__enviar"
              disabled={cargando || preparandoImagen || (!entrada.trim() && !adjuntosImagen.length)}
              aria-label="Enviar mensaje"
            >
              <Send strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
