"use client";

import { RotateCcw, Send } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { IndicadorFloraEscribiendo } from "@/componentes/flora/indicador-flora-escribiendo";
import { MensajeFloraMarkdown } from "@/componentes/flora/mensaje-flora-markdown";

const MENSAJE_BIENVENIDA =
  "¡Hola! Soy Flora. Preguntame sobre tus plantas, registros o cultivo y voy a buscar en tus datos reales de ENFLORA.";

const MAX_HISTORIAL_ENVIO = 8;
const UMBRAL_SCROLL_INFERIOR = 96;

function idMensaje() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ChatFlora() {
  const [mensajes, setMensajes] = useState([
    { id: "bienvenida", rol: "flora", texto: MENSAJE_BIENVENIDA, animar: false },
  ]);
  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const listaRef = useRef(null);
  const envioRef = useRef(false);
  const cercaDelFinalRef = useRef(true);
  const forzarScrollRef = useRef(false);
  const sesionRef = useRef(0);

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

  const nuevaConversacion = () => {
    if (cargando) return;
    sesionRef.current += 1;
    setMensajes([{ id: "bienvenida", rol: "flora", texto: MENSAJE_BIENVENIDA, animar: false }]);
    setError("");
    setEntrada("");
    cercaDelFinalRef.current = true;
    forzarScrollRef.current = true;
  };

  const enviar = async () => {
    const texto = entrada.trim();
    if (!texto || cargando || envioRef.current) return;

    const sesionActiva = sesionRef.current;
    envioRef.current = true;
    setError("");
    setEntrada("");
    setCargando(true);
    forzarScrollRef.current = true;
    cercaDelFinalRef.current = true;

    const idUsuario = idMensaje();
    setMensajes((prev) => [...prev, { id: idUsuario, rol: "usuario", texto }]);

    const historial = mensajes
      .filter((m) => m.id !== "bienvenida")
      .slice(-MAX_HISTORIAL_ENVIO)
      .map((m) => ({
        rol: m.rol === "flora" ? "flora" : "usuario",
        texto: m.texto,
      }));

    try {
      const res = await fetch("/api/flora/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: texto, historial }),
      });
      const data = await res.json().catch(() => ({}));

      if (sesionActiva !== sesionRef.current) return;

      if (!res.ok || !data.ok) {
        setMensajes((prev) => prev.filter((m) => m.id !== idUsuario));
        setEntrada(texto);
        setError(data.error || "No pudimos enviar el mensaje. Probá de nuevo.");
        return;
      }

      const idFlora = idMensaje();
      setMensajes((prev) => [
        ...prev,
        {
          id: idFlora,
          rol: "flora",
          texto: String(data.respuesta || "").trim() || "…",
          animar: true,
        },
      ]);
      forzarScrollRef.current = true;
    } catch {
      if (sesionActiva !== sesionRef.current) return;
      setMensajes((prev) => prev.filter((m) => m.id !== idUsuario));
      setEntrada(texto);
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
            <p className="flora-chat-app__subtitulo">Asistente de ENFLORA</p>
          </div>
        </div>
        <button
          type="button"
          className="flora-chat-app__nueva"
          onClick={nuevaConversacion}
          disabled={cargando}
          aria-label="Nueva conversación"
        >
          <RotateCcw strokeWidth={1.75} aria-hidden="true" />
          <span>Nueva</span>
        </button>
      </header>

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
                <MensajeFloraMarkdown
                  texto={m.texto}
                  animar={Boolean(m.animar)}
                  onAnimacionCompleta={() => marcarAnimacionCompleta(m.id)}
                  onProgresoAnimacion={() => desplazarAbajoSiCorresponde(false)}
                />
              ) : (
                m.texto
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

      <form className="flora-chat-app__form" onSubmit={onSubmit}>
        <label className="flora-chat-app__sr" htmlFor="flora-chat-input">Mensaje para Flora</label>
        <textarea
          id="flora-chat-input"
          className="flora-chat-app__input"
          rows={1}
          placeholder="Preguntale a Flora…"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={cargando}
          maxLength={2000}
        />
        <button
          type="submit"
          className="flora-chat-app__enviar"
          disabled={cargando || !entrada.trim()}
          aria-label="Enviar mensaje"
        >
          <Send strokeWidth={1.75} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
