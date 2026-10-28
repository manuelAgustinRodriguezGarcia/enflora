"use client";

import { Loader2, RotateCcw, Send } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const MENSAJE_BIENVENIDA =
  "¡Hola! Soy Flora. Preguntame sobre tus plantas, registros o cultivo y voy a buscar en tus datos reales de ENFLORA.";

const MAX_HISTORIAL_ENVIO = 8;

function idMensaje() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ChatFlora() {
  const [mensajes, setMensajes] = useState([
    { id: "bienvenida", rol: "flora", texto: MENSAJE_BIENVENIDA },
  ]);
  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const listaRef = useRef(null);
  const envioRef = useRef(false);

  const desplazarAbajo = useCallback(() => {
    const el = listaRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    desplazarAbajo();
  }, [mensajes, cargando, desplazarAbajo]);

  const nuevaConversacion = () => {
    if (cargando) return;
    setMensajes([{ id: "bienvenida", rol: "flora", texto: MENSAJE_BIENVENIDA }]);
    setError("");
    setEntrada("");
  };

  const enviar = async () => {
    const texto = entrada.trim();
    if (!texto || cargando || envioRef.current) return;

    envioRef.current = true;
    setError("");
    setEntrada("");
    setCargando(true);

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

      if (!res.ok || !data.ok) {
        setMensajes((prev) => prev.filter((m) => m.id !== idUsuario));
        setEntrada(texto);
        setError(data.error || "No pudimos enviar el mensaje. Probá de nuevo.");
        return;
      }

      setMensajes((prev) => [
        ...prev,
        { id: idMensaje(), rol: "flora", texto: String(data.respuesta || "").trim() || "…" },
      ]);
    } catch {
      setMensajes((prev) => prev.filter((m) => m.id !== idUsuario));
      setEntrada(texto);
      setError("Falló la conexión. Revisá tu internet e intentá otra vez.");
    } finally {
      setCargando(false);
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

      <div className="flora-chat-app__lista" ref={listaRef} role="log" aria-live="polite" aria-relevant="additions">
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={`flora-chat-app__fila flora-chat-app__fila--${m.rol === "flora" ? "flora" : "usuario"}`}
          >
            <div className="flora-chat-app__burbuja">{m.texto}</div>
          </div>
        ))}
        {cargando ? (
          <div className="flora-chat-app__fila flora-chat-app__fila--flora" aria-busy="true">
            <div className="flora-chat-app__burbuja flora-chat-app__burbuja--pensando">
              <Loader2 className="flora-chat-app__spinner" strokeWidth={1.75} aria-hidden="true" />
              <span>Flora está pensando…</span>
            </div>
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
