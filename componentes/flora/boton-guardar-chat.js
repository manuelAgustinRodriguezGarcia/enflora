"use client";

import { Check, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  mensajesClienteParaPersistencia,
  sugerirTituloChat,
} from "@/lib/flora-chats-guardados";
import { firmaMensajesChat } from "@/lib/flora-firma-mensajes-chat";
import { ETIQUETA_BOTON_GUARDAR } from "@/lib/flora-chat-etiquetas";

const DURACION_PILL_MS = 3200;

export function BotonGuardarChat({
  mensajes,
  claveSesion,
  chatGuardadoId = null,
  onChatGuardado,
  onGuardadoExitoso,
  persistir,
  deshabilitado = false,
}) {
  const [estado, setEstado] = useState(chatGuardadoId ? "guardado" : "idle");
  const [pill, setPill] = useState(null);
  const [mostrarTitulo, setMostrarTitulo] = useState(false);
  const [titulo, setTitulo] = useState("");
  const idPersistido = chatGuardadoId || null;
  const mensajesPersistibles = useMemo(() => mensajesClienteParaPersistencia(mensajes), [mensajes]);
  const puedeGuardar = mensajesPersistibles.length >= 2;
  const bloqueadoTrasGuardado = Boolean(idPersistido) || estado === "guardado";

  useEffect(() => {
    if (!pill) return undefined;
    const t = window.setTimeout(() => setPill(null), DURACION_PILL_MS);
    return () => window.clearTimeout(t);
  }, [pill]);

  const abrirDialogo = useCallback(() => {
    if (estado === "guardando" || bloqueadoTrasGuardado || deshabilitado || !puedeGuardar) return;
    if (!claveSesion) {
      setPill({ tipo: "error", texto: "No se puede guardar este chat todavía." });
      return;
    }
    setTitulo(sugerirTituloChat(mensajesPersistibles));
    setMostrarTitulo(true);
  }, [bloqueadoTrasGuardado, claveSesion, deshabilitado, estado, mensajesPersistibles, puedeGuardar]);

  const guardar = async () => {
    if (!claveSesion || estado === "guardando" || !puedeGuardar || bloqueadoTrasGuardado || !persistir) {
      return;
    }
    setEstado("guardando");
    setPill(null);

    const tituloFinal = titulo.trim() || sugerirTituloChat(mensajesPersistibles);
    const resultado = await persistir({ titulo: tituloFinal, silencioso: false });

    if (!resultado?.ok) {
      setEstado(idPersistido ? "guardado" : "idle");
      setPill({ tipo: "error", texto: resultado.error || "No se pudo guardar." });
      return;
    }

    setEstado("guardado");
    setMostrarTitulo(false);
    onChatGuardado?.(resultado.id);
    onGuardadoExitoso?.({
      firma: firmaMensajesChat(mensajes),
      titulo: tituloFinal,
    });
    setPill({ tipo: "exito", texto: "Chat guardado correctamente" });
  };

  const iconoBtn =
    estado === "guardando" ? (
      <Loader2 className="flora-guardar-chat__icono flora-guardar-chat__icono--girar" strokeWidth={1.75} />
    ) : bloqueadoTrasGuardado ? (
      <span className="flora-guardar-chat__icono-guardado" aria-hidden="true">
        <Save strokeWidth={1.75} />
        <Check strokeWidth={2.25} />
      </span>
    ) : (
      <Save strokeWidth={1.75} aria-hidden="true" />
    );

  return (
    <>
      <div className="flora-guardar-chat">
        <button
          type="button"
          className={`flora-guardar-chat__btn${bloqueadoTrasGuardado ? " flora-guardar-chat__btn--guardado" : ""}`}
          onClick={abrirDialogo}
          disabled={
            deshabilitado || estado === "guardando" || !puedeGuardar || bloqueadoTrasGuardado
          }
          aria-label={bloqueadoTrasGuardado ? "Chat guardado" : ETIQUETA_BOTON_GUARDAR}
          title={
            bloqueadoTrasGuardado
              ? "Chat guardado"
              : !puedeGuardar
                ? "Necesitás al menos una pregunta y una respuesta de Flora"
                : ETIQUETA_BOTON_GUARDAR
          }
        >
          {iconoBtn}
          {!bloqueadoTrasGuardado ? (
            <span className="flora-guardar-chat__etiqueta">{ETIQUETA_BOTON_GUARDAR}</span>
          ) : null}
        </button>

        {mostrarTitulo ? (
          <div className="flora-guardar-chat__dialogo" role="dialog" aria-label="Título del chat">
            <label className="flora-guardar-chat__etiqueta" htmlFor="flora-titulo-chat">
              Título
            </label>
            <input
              id="flora-titulo-chat"
              className="flora-guardar-chat__input"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={120}
              autoFocus
            />
            <div className="flora-guardar-chat__acciones">
              <button type="button" className="flora-guardar-chat__sec" onClick={() => setMostrarTitulo(false)}>
                Cancelar
              </button>
              <button type="button" className="flora-guardar-chat__pri" onClick={guardar}>
                Confirmar
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {pill ? (
        <div
          className={`flora-chat-app__pill-guardado flora-chat-app__pill-guardado--${pill.tipo}`}
          role="status"
          aria-live="polite"
        >
          {pill.tipo === "exito" ? (
            <span className="flora-chat-app__pill-guardado-icono" aria-hidden="true">
              <Save strokeWidth={1.75} />
              <Check strokeWidth={2.25} />
            </span>
          ) : null}
          <span>{pill.texto}</span>
        </div>
      ) : null}
    </>
  );
}
