"use client";

import { BookOpen, Plus, Send, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BotonClipAdjuntoFlora,
  EstadoAdjuntoFlora,
  MenuDeslizableAdjuntoFlora,
  PreviewsAdjuntoFlora,
  liberarAdjuntosFlora,
  payloadImagenesParaApi,
} from "@/componentes/flora/barra-adjunto-imagen-flora";
import { FLORA_CHAT_MAX_IMAGENES, normalizarPreguntaConImagen } from "@/lib/flora-imagen-chat";
import { chatFloraTieneContenidoPerdible } from "@/lib/flora-chat-conversacion-pendiente";
import {
  chatFloraPersistibleCompleto,
  chatFloraPersistibleParaAutoguardado,
  firmaMensajesChat,
} from "@/lib/flora-firma-mensajes-chat";
import {
  crearColaPersistenciaChat,
  persistirChatFloraEnApi,
} from "@/lib/flora-guardar-chat-cliente";
import {
  requiereAdvertenciaBeforeUnloadFlora,
  requiereModalSalidaChatFlora,
  tieneCambiosPendientesSync,
} from "@/lib/flora-estado-persistencia-chat";
import { sugerirTituloChat, mensajesClienteParaPersistencia } from "@/lib/flora-chats-guardados";
import {
  debeRecuperarChatGuardado,
  mensajeErrorRecuperacionChat,
  resultadoRecuperacionChatDesdeApi,
} from "@/lib/flora-recuperacion-chat";
import { MENSAJE_BIENVENIDA_FLORA } from "@/lib/flora-chat-etiquetas";
import { BotonGuardarChat } from "@/componentes/flora/boton-guardar-chat";
import { ErrorRecuperacionChatFlora } from "@/componentes/flora/error-recuperacion-chat-flora";
import {
  EsqueletoDockRecuperacionChatFlora,
  EsqueletoRecuperacionChatFlora,
} from "@/componentes/flora/esqueleto-recuperacion-chat-flora";
import { FabNuevoChatFlora } from "@/componentes/flora/fab-nuevo-chat-flora";
import { EsperaFlora } from "@/componentes/flora/espera-flora";
import { PERSONALIDAD_FLORA_DEFAULT } from "@/lib/flora-personalidad";
import { AdjuntoMensajeChat } from "@/componentes/flora/imagen-mensaje-flora";
import { MensajeFloraMarkdown } from "@/componentes/flora/mensaje-flora-markdown";
import { PieRespuestaFlora } from "@/componentes/flora/pie-respuesta-flora";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { useGuardSalidaFloraChat } from "@/componentes/flora/proveedor-guard-salida-flora";

const MAX_HISTORIAL_ENVIO = 8;
const UMBRAL_SCROLL_INFERIOR = 96;

function idMensaje() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nuevaClaveSesionChat() {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function mensajesInicialesChat(continuarSolucionId) {
  if (debeRecuperarChatGuardado(continuarSolucionId)) return [];
  return [{ id: "bienvenida", rol: "flora", texto: MENSAJE_BIENVENIDA_FLORA, animar: false }];
}

export function ChatFlora({
  continuarSolucionId = "",
  personalidadInicial = PERSONALIDAD_FLORA_DEFAULT,
}) {
  const [mensajes, setMensajes] = useState(() => mensajesInicialesChat(continuarSolucionId));
  const [estadoRecuperacion, setEstadoRecuperacion] = useState(() =>
    debeRecuperarChatGuardado(continuarSolucionId) ? "cargando" : null,
  );
  const [errorRecuperacion, setErrorRecuperacion] = useState("");
  const [reintentandoRecuperacion, setReintentandoRecuperacion] = useState(false);
  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [esperaConImagen, setEsperaConImagen] = useState(false);
  const [personalidad, setPersonalidad] = useState(personalidadInicial);
  const [error, setError] = useState("");
  const [bannerContinuar, setBannerContinuar] = useState(null);
  const [modalNuevoChatAbierto, setModalNuevoChatAbierto] = useState(false);
  const [adjuntosImagen, setAdjuntosImagen] = useState([]);
  const [preparandoImagen, setPreparandoImagen] = useState(false);
  const [errorAdjunto, setErrorAdjunto] = useState("");
  const [menuAdjuntoAbierto, setMenuAdjuntoAbierto] = useState(false);
  const [claveSesion, setClaveSesion] = useState(() => nuevaClaveSesionChat());
  const [chatGuardadoId, setChatGuardadoId] = useState(null);
  const [firmaSincronizada, setFirmaSincronizada] = useState("");
  const [tituloBiblioteca, setTituloBiblioteca] = useState("");
  const [guardandoPersistencia, setGuardandoPersistencia] = useState(false);
  const colaPersistencia = useMemo(() => crearColaPersistenciaChat(), []);
  const adjuntoRef = useRef(null);
  const listaRef = useRef(null);
  const envioRef = useRef(false);
  const cercaDelFinalRef = useRef(true);
  const bloquearAutoScrollRef = useRef(false);
  const touchScrollRef = useRef(null);
  const forzarScrollRef = useRef(false);
  const sesionRef = useRef(0);
  const contextoContinuarEnviadoRef = useRef(false);
  const ignorarContinuarRef = useRef(false);
  const mensajesRef = useRef(mensajes);
  const chatGuardadoIdRef = useRef(chatGuardadoId);
  const firmaSincronizadaRef = useRef(firmaSincronizada);
  const cargandoRef = useRef(cargando);
  const montadoRef = useRef(true);
  const recuperacionGenRef = useRef(0);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  useEffect(() => {
    mensajesRef.current = mensajes;
    chatGuardadoIdRef.current = chatGuardadoId;
    firmaSincronizadaRef.current = firmaSincronizada;
    cargandoRef.current = cargando;
  }, [mensajes, chatGuardadoId, firmaSincronizada, cargando]);

  const { registrarPoliticaSalida } = useGuardSalidaFloraChat();

  const persistirConversacion = useCallback(
    async ({ titulo, silencioso = false } = {}) => {
      if (!claveSesion) return { ok: false, error: "No se puede guardar este chat todavía." };
      const mensajesVivos = mensajesRef.current;
      const esActualizacion = Boolean(chatGuardadoIdRef.current);
      const persistible = esActualizacion
        ? chatFloraPersistibleParaAutoguardado(mensajesVivos)
        : chatFloraPersistibleCompleto(mensajesVivos);
      if (!persistible) {
        return esActualizacion
          ? { ok: false, error: "No hay mensajes nuevos para sincronizar." }
          : {
              ok: false,
              error: "Guardá al menos una pregunta y una respuesta de Flora.",
            };
      }

      const tituloUsar =
        (titulo && String(titulo).trim()) ||
        tituloBiblioteca ||
        sugerirTituloChat(mensajesClienteParaPersistencia(mensajesVivos));

      if (!silencioso) setGuardandoPersistencia(true);

      try {
        const { res, turno } = await colaPersistencia.encolar(async () =>
          persistirChatFloraEnApi(
            {
              titulo: tituloUsar,
              claveSesion,
              chatGuardadoId: chatGuardadoIdRef.current,
              mensajes: mensajesRef.current,
            },
            { reintentos: 3 },
          ),
        );

        if (res.ok) {
          const firmaViva = firmaMensajesChat(mensajesRef.current);
          if (turno === colaPersistencia.obtenerGeneracion()) {
            setFirmaSincronizada(firmaViva);
            firmaSincronizadaRef.current = firmaViva;
          }
          setChatGuardadoId(res.id);
          chatGuardadoIdRef.current = res.id;
          if (titulo && String(titulo).trim()) setTituloBiblioteca(String(titulo).trim());
          else if (!tituloBiblioteca) setTituloBiblioteca(tituloUsar);
        } else if (!silencioso) {
          setError(res.error || "No se pudo guardar.");
        }

        return res;
      } finally {
        if (!silencioso) setGuardandoPersistencia(false);
      }
    },
    [claveSesion, colaPersistencia, tituloBiblioteca],
  );

  const recuperandoHistorial = estadoRecuperacion === "cargando";
  const falloRecuperacionHistorial = estadoRecuperacion === "error";
  const inputBloqueado =
    cargando || preparandoImagen || recuperandoHistorial || falloRecuperacionHistorial;

  useEffect(() => {
    const opciones = {
      chatGuardadoId,
      mensajes,
      bannerContinuar,
      entrada,
      adjuntos: adjuntosImagen,
      cargando,
      firmaSincronizada,
    };

    registrarPoliticaSalida({
      chatGuardadoId,
      requiereAdvertenciaBeforeUnload:
        recuperandoHistorial || falloRecuperacionHistorial
          ? false
          : requiereAdvertenciaBeforeUnloadFlora(opciones),
      chatFloraTieneContenido: () => {
        if (recuperandoHistorial || falloRecuperacionHistorial) return false;
        return chatFloraTieneContenidoPerdible({
          mensajes: mensajesRef.current,
          bannerContinuar,
          entrada,
          adjuntos: adjuntosImagen,
          cargando: cargandoRef.current,
        });
      },
      requiereModalSalida: () => {
        if (recuperandoHistorial || falloRecuperacionHistorial) return false;
        return requiereModalSalidaChatFlora({
          chatGuardadoId: chatGuardadoIdRef.current,
          mensajes: mensajesRef.current,
          bannerContinuar,
          entrada,
          adjuntos: adjuntosImagen,
          cargando: cargandoRef.current,
        });
      },
      tieneCambiosPendientes: () =>
        tieneCambiosPendientesSync({
          chatGuardadoId: chatGuardadoIdRef.current,
          mensajes: mensajesRef.current,
          firmaSincronizada: firmaSincronizadaRef.current,
        }),
      sincronizarSilencioso: () => persistirConversacion({ silencioso: true }),
      guardarDesdeSalida: () =>
        persistirConversacion({
          silencioso: false,
          titulo: tituloBiblioteca || sugerirTituloChat(mensajesClienteParaPersistencia(mensajesRef.current)),
        }),
      onFalloPersistencia: (texto) => {
        setError(texto || "No pudimos guardar los últimos mensajes.");
      },
    });

    return () => registrarPoliticaSalida(null);
  }, [
    adjuntosImagen,
    bannerContinuar,
    cargando,
    chatGuardadoId,
    entrada,
    firmaSincronizada,
    mensajes,
    persistirConversacion,
    registrarPoliticaSalida,
    tituloBiblioteca,
    falloRecuperacionHistorial,
    recuperandoHistorial,
  ]);

  useEffect(() => {
    if (recuperandoHistorial || falloRecuperacionHistorial) return undefined;
    if (!chatGuardadoId || guardandoPersistencia) return undefined;
    if (!chatFloraPersistibleParaAutoguardado(mensajes)) return;
    const firma = firmaMensajesChat(mensajes);
    if (firma === firmaSincronizada) return;

    let cancelado = false;
    (async () => {
      const res = await persistirConversacion({ silencioso: true });
      if (cancelado || !montadoRef.current) return;
      if (res.ok) return;
      setError(res.error || "No pudimos sincronizar el chat guardado.");
    })();

    return () => {
      cancelado = true;
    };
  }, [
    chatGuardadoId,
    firmaSincronizada,
    guardandoPersistencia,
    mensajes,
    persistirConversacion,
    recuperandoHistorial,
    falloRecuperacionHistorial,
  ]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch("/api/flora/personalidad");
        const data = await res.json().catch(() => ({}));
        if (cancelado || !res.ok || !data.ok || !data.personalidad) return;
        setPersonalidad(data.personalidad);
      } catch {
        /* preferir valor del servidor en props */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const ejecutarRecuperacionChat = useCallback(async (idContinuar, { esReintento = false } = {}) => {
    if (!debeRecuperarChatGuardado(idContinuar)) return;

    contextoContinuarEnviadoRef.current = false;
    ignorarContinuarRef.current = false;
    setErrorRecuperacion("");
    setEstadoRecuperacion("cargando");
    if (!esReintento) {
      setMensajes([]);
      setBannerContinuar(null);
      setChatGuardadoId(null);
      chatGuardadoIdRef.current = null;
      setFirmaSincronizada("");
      firmaSincronizadaRef.current = "";
      setTituloBiblioteca("");
    }
    if (esReintento) setReintentandoRecuperacion(true);
    const gen = (recuperacionGenRef.current += 1);

    try {
      const res = await fetch(`/api/flora/soluciones/${idContinuar}`);
      const data = await res.json().catch(() => ({}));
      if (!montadoRef.current || gen !== recuperacionGenRef.current) return;

      if (!res.ok || !data.ok) {
        setEstadoRecuperacion("error");
        setErrorRecuperacion(mensajeErrorRecuperacionChat(res, data));
        return;
      }

      const resultado = resultadoRecuperacionChatDesdeApi(data);
      if (!resultado.ok) {
        setEstadoRecuperacion("error");
        setErrorRecuperacion(resultado.error);
        return;
      }

      setMensajes(resultado.mensajes);
      const firma = firmaMensajesChat(resultado.mensajes);
      setFirmaSincronizada(firma);
      firmaSincronizadaRef.current = firma;
      setBannerContinuar(resultado.bannerContinuar);
      setTituloBiblioteca(resultado.tituloBiblioteca || "");

      if (resultado.chatGuardadoId) {
        setChatGuardadoId(resultado.chatGuardadoId);
        chatGuardadoIdRef.current = resultado.chatGuardadoId;
        setClaveSesion(
          resultado.claveSesion ? resultado.claveSesion : nuevaClaveSesionChat(),
        );
      }

      setEstadoRecuperacion(null);
      cercaDelFinalRef.current = true;
      forzarScrollRef.current = true;
    } catch {
      if (!montadoRef.current || gen !== recuperacionGenRef.current) return;
      setEstadoRecuperacion("error");
      setErrorRecuperacion("Falló la conexión. Revisá tu internet e intentá de nuevo.");
    } finally {
      if (montadoRef.current && gen === recuperacionGenRef.current) setReintentandoRecuperacion(false);
    }
  }, []);

  useEffect(() => {
    if (!continuarSolucionId) return undefined;

    const id = continuarSolucionId;
    queueMicrotask(() => {
      void ejecutarRecuperacionChat(id);
    });
    return () => {
      recuperacionGenRef.current += 1;
    };
  }, [continuarSolucionId, ejecutarRecuperacionChat]);

  const desplazarAbajoSiCorresponde = useCallback((forzar = false) => {
    const el = listaRef.current;
    if (!el) return;
    if (!forzar && bloquearAutoScrollRef.current) return;
    if (!forzar && !cercaDelFinalRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const onScrollLista = useCallback(() => {
    const el = listaRef.current;
    if (!el) return;
    const distancia = el.scrollHeight - el.scrollTop - el.clientHeight;
    const cerca = distancia <= UMBRAL_SCROLL_INFERIOR;
    cercaDelFinalRef.current = cerca;
    bloquearAutoScrollRef.current = !cerca;
  }, []);

  const onWheelLista = useCallback((evento) => {
    if (evento.deltaY < 0) {
      bloquearAutoScrollRef.current = true;
      cercaDelFinalRef.current = false;
    }
  }, []);

  const onTouchStartLista = useCallback((evento) => {
    const y = evento.touches[0]?.clientY;
    touchScrollRef.current = typeof y === "number" ? y : null;
  }, []);

  const onTouchMoveLista = useCallback((evento) => {
    const y = evento.touches[0]?.clientY;
    const inicio = touchScrollRef.current;
    if (typeof y !== "number" || typeof inicio !== "number") return;
    if (y - inicio > 8) {
      bloquearAutoScrollRef.current = true;
      cercaDelFinalRef.current = false;
    }
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
    setEstadoRecuperacion(null);
    setErrorRecuperacion("");
    setMensajes([{ id: "bienvenida", rol: "flora", texto: MENSAJE_BIENVENIDA_FLORA, animar: false }]);
    setError("");
    setEntrada("");
    limpiarAdjuntos();
    setMenuAdjuntoAbierto(false);
    setBannerContinuar(null);
    setClaveSesion(nuevaClaveSesionChat());
    setChatGuardadoId(null);
    chatGuardadoIdRef.current = null;
    setFirmaSincronizada("");
    firmaSincronizadaRef.current = "";
    setTituloBiblioteca("");
    ignorarContinuarRef.current = true;
    contextoContinuarEnviadoRef.current = false;
    cercaDelFinalRef.current = true;
    bloquearAutoScrollRef.current = false;
    forzarScrollRef.current = true;
  };

  const pedirNuevoChat = () => {
    if (cargando) return;
    if (chatGuardadoId) {
      nuevaConversacion();
      return;
    }
    const hayConversacion = requiereModalSalidaChatFlora({
      mensajes,
      bannerContinuar,
      entrada,
      adjuntos: adjuntosImagen,
      cargando,
      chatGuardadoId,
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
      fotoId: a.fotoId,
      mimeType: a.mimeType,
    }));
    setEntrada("");
    setAdjuntosImagen([]);
    setErrorAdjunto("");
    setEsperaConImagen(hayImagen);
    setCargando(true);
    forzarScrollRef.current = true;
    cercaDelFinalRef.current = true;
    bloquearAutoScrollRef.current = false;

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

      if (sesionActiva !== sesionRef.current || !montadoRef.current) return;

      if (!res.ok || !data.ok) {
        if (!montadoRef.current) return;
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

      const persistidas = Array.isArray(data.meta?.imagenes) ? data.meta.imagenes : [];
      const aLiberar = persistidas.flatMap((guardada, indice) => {
        const original = adjuntosSnapshot[indice];
        if (guardada?.origen === "flora" && guardada.vista && original?.origen === "transitoria") {
          return [original];
        }
        return [];
      });
      setMensajes((prev) =>
        prev.map((m) => {
          if (m.id !== idUsuario) return m;
          const adjuntos = (m.adjuntos || []).map((adj, indice) => {
            const guardada = persistidas[indice];
            if (guardada?.origen === "flora" && guardada.ruta) {
              return {
                origen: "flora",
                ruta: guardada.ruta,
                vista: guardada.vista || adj.vista,
                mimeType: guardada.mimeType,
                etiqueta: adj.etiqueta,
              };
            }
            if (guardada?.origen === "enflora" && guardada.fotoId) {
              return { ...adj, origen: "enflora", fotoId: guardada.fotoId };
            }
            return adj;
          });
          return { ...m, adjuntos };
        }),
      );
      if (aLiberar.length) {
        window.setTimeout(() => liberarAdjuntosFlora(aLiberar), 1500);
      }

      const idFlora = idMensaje();
      if (!montadoRef.current) return;
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
      if (sesionActiva !== sesionRef.current || !montadoRef.current) return;
      setMensajes((prev) => prev.filter((m) => m.id !== idUsuario));
      setEntrada(textoEnviado);
      if (adjuntosSnapshot.length) setAdjuntosImagen(adjuntosSnapshot);
      setError("Falló la conexión. Revisá tu internet e intentá otra vez.");
    } finally {
      if (sesionActiva === sesionRef.current && montadoRef.current) {
        setCargando(false);
        setEsperaConImagen(false);
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

  const mostrarFabNuevoChat = useMemo(
    () => chatFloraPersistibleCompleto(mensajes),
    [mensajes],
  );

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
            onChatGuardado={(id) => {
              setChatGuardadoId(id);
              chatGuardadoIdRef.current = id;
            }}
            onGuardadoExitoso={({ firma, titulo }) => {
              setFirmaSincronizada(firma);
              firmaSincronizadaRef.current = firma;
              if (titulo) setTituloBiblioteca(titulo);
            }}
            persistir={persistirConversacion}
            deshabilitado={cargando || guardandoPersistencia || recuperandoHistorial || falloRecuperacionHistorial}
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

      {mostrarFabNuevoChat && !recuperandoHistorial && !falloRecuperacionHistorial ? (
        <FabNuevoChatFlora
          onClick={pedirNuevoChat}
          disabled={cargando}
          detrasCapas={menuAdjuntoAbierto}
        />
      ) : null}

      <div
        className="flora-chat-app__lista"
        ref={listaRef}
        onScroll={onScrollLista}
        onWheel={onWheelLista}
        onTouchStart={onTouchStartLista}
        onTouchMove={onTouchMoveLista}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {recuperandoHistorial ? (
          <EsqueletoRecuperacionChatFlora />
        ) : falloRecuperacionHistorial ? (
          <ErrorRecuperacionChatFlora
            mensaje={errorRecuperacion}
            reintentando={reintentandoRecuperacion}
            onReintentar={() => {
              if (!continuarSolucionId) return;
              void ejecutarRecuperacionChat(continuarSolucionId, { esReintento: true });
            }}
          />
        ) : (
          mensajes.map((m) => (
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
                  {m.id !== "bienvenida" ? <PieRespuestaFlora texto={m.texto} /> : null}
                </>
              ) : (
                <>
                  {(m.adjuntos?.length ? m.adjuntos : m.adjunto ? [m.adjunto] : []).map((adj, i) => (
                    <AdjuntoMensajeChat key={`${m.id}-adj-${i}`} adjunto={adj} />
                  ))}
                  {m.texto ? <span className="flora-chat-app__texto-usuario">{m.texto}</span> : null}
                </>
              )}
            </div>
          </div>
          ))
        )}
        {cargando && !recuperandoHistorial ? (
          <div className="flora-chat-app__fila flora-chat-app__fila--flora">
            <EsperaFlora
              key={`${personalidad}-${esperaConImagen ? "img" : "txt"}`}
              personalidad={personalidad}
              conImagen={esperaConImagen}
              onContenidoCambio={() => desplazarAbajoSiCorresponde(false)}
            />
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
          {!recuperandoHistorial && !falloRecuperacionHistorial ? (
            <>
          <PreviewsAdjuntoFlora
            adjuntos={adjuntosImagen}
            onQuitar={quitarAdjunto}
            disabled={inputBloqueado}
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
            </>
          ) : null}
        </div>
        {recuperandoHistorial ? (
          <EsqueletoDockRecuperacionChatFlora />
        ) : (
        <form className="flora-chat-app__form" onSubmit={onSubmit}>
          <div className="flora-chat-app__form-fila">
            <label className="flora-chat-app__sr" htmlFor="flora-chat-input">
              Mensaje para Flora
            </label>
            <BotonClipAdjuntoFlora
              abierto={menuAdjuntoAbierto}
              onToggle={() => setMenuAdjuntoAbierto((v) => !v)}
              disabled={inputBloqueado}
              preparando={preparandoImagen}
              lleno={adjuntosImagen.length >= FLORA_CHAT_MAX_IMAGENES}
            />
            <textarea
              id="flora-chat-input"
              className="flora-chat-app__input"
              rows={1}
              placeholder="Preguntale a Flora…"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={inputBloqueado}
              maxLength={2000}
            />
            <button
              type="submit"
              className="flora-chat-app__enviar"
              disabled={inputBloqueado || (!entrada.trim() && !adjuntosImagen.length)}
              aria-label="Enviar mensaje"
            >
              <Send strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
