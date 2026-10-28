"use client";

import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

export function BotonGuardarSolucion({
  pregunta,
  respuesta,
  metaGuardado,
  deshabilitado = false,
}) {
  const [estado, setEstado] = useState("idle");
  const [mensaje, setMensaje] = useState("");
  const [mostrarTitulo, setMostrarTitulo] = useState(false);
  const [titulo, setTitulo] = useState("");

  const abrirDialogo = useCallback(() => {
    if (estado === "guardado" || estado === "guardando" || deshabilitado) return;
    if (!metaGuardado?.token) {
      setMensaje("No se puede guardar este mensaje (falta procedencia del servidor).");
      return;
    }
    setTitulo(metaGuardado.tituloSugerido || "");
    setMostrarTitulo(true);
    setMensaje("");
  }, [deshabilitado, estado, metaGuardado]);

  const guardar = async () => {
    if (!metaGuardado?.token || estado === "guardando") return;
    setEstado("guardando");
    setMensaje("");

    try {
      const res = await fetch("/api/flora/soluciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pregunta,
          respuesta,
          titulo: titulo.trim() || metaGuardado.tituloSugerido,
          tokenProcedencia: metaGuardado.token,
          fechaRespuesta: metaGuardado.fechaRespuesta,
          referencias: metaGuardado.referencias,
          unidadCultivoId: metaGuardado.unidadCultivoId,
          plantaId: metaGuardado.plantaId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setEstado("idle");
        setMensaje(data.error || "No se pudo guardar.");
        return;
      }
      setEstado("guardado");
      setMostrarTitulo(false);
      setMensaje(data.mensaje || "Guardado.");
    } catch {
      setEstado("idle");
      setMensaje("Falló la conexión.");
    }
  };

  const Icono = estado === "guardado" ? BookmarkCheck : Bookmark;

  return (
    <div className="flora-guardar-solucion">
      <button
        type="button"
        className="flora-guardar-solucion__btn"
        onClick={abrirDialogo}
        disabled={deshabilitado || estado === "guardando" || estado === "guardado"}
        aria-label={estado === "guardado" ? "Solución guardada" : "Guardar solución"}
      >
        {estado === "guardando" ? (
          <Loader2 className="flora-guardar-solucion__icono flora-guardar-solucion__icono--girar" strokeWidth={1.75} />
        ) : (
          <Icono strokeWidth={1.75} aria-hidden="true" />
        )}
        <span>{estado === "guardado" ? "Guardada" : "Guardar solución"}</span>
      </button>

      {mensaje ? (
        <p className="flora-guardar-solucion__mensaje" role="status">
          {mensaje}
        </p>
      ) : null}

      {mostrarTitulo ? (
        <div className="flora-guardar-solucion__dialogo" role="dialog" aria-label="Título de la solución">
          <label className="flora-guardar-solucion__etiqueta" htmlFor="flora-titulo-solucion">
            Título
          </label>
          <input
            id="flora-titulo-solucion"
            className="flora-guardar-solucion__input"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={120}
            autoFocus
          />
          <div className="flora-guardar-solucion__acciones">
            <button type="button" className="flora-guardar-solucion__sec" onClick={() => setMostrarTitulo(false)}>
              Cancelar
            </button>
            <button type="button" className="flora-guardar-solucion__pri" onClick={guardar}>
              Confirmar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
