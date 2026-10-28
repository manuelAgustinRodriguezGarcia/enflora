"use client";

import { useCallback, useState } from "react";
import { PERSONALIDADES_FLORA } from "@/lib/flora-personalidad";

export function PreferenciasFlora({ personalidadInicial = "cercana_natural" }) {
  const [seleccion, setSeleccion] = useState(personalidadInicial);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const guardar = useCallback(async (id) => {
    if (guardando || id === seleccion) return;
    setGuardando(true);
    setMensaje("");

    try {
      const res = await fetch("/api/flora/personalidad", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalidad: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setMensaje(data.error || "No se pudo guardar.");
        return;
      }
      setSeleccion(data.personalidad || id);
      setMensaje(data.mensaje || "Preferencia guardada.");
    } catch {
      setMensaje("Falló la conexión.");
    } finally {
      setGuardando(false);
    }
  }, [guardando, seleccion]);

  return (
    <section className="perfil-flora" id="preferencias-flora" aria-labelledby="perfil-flora-titulo">
      <h2 id="perfil-flora-titulo">Preferencias de Flora</h2>
      <p className="perfil-flora__intro">
        Elegí cómo querés que Flora te responda. Aplica desde la próxima respuesta; no cambia soluciones
        ya guardadas.
      </p>

      <div className="perfil-flora__opciones" role="radiogroup" aria-labelledby="perfil-flora-titulo">
        {PERSONALIDADES_FLORA.map((opcion) => {
          const activa = seleccion === opcion.id;
          return (
            <label
              key={opcion.id}
              className={`perfil-flora__card${activa ? " perfil-flora__card--activa" : ""}`}
            >
              <input
                type="radio"
                name="personalidad-flora"
                value={opcion.id}
                checked={activa}
                disabled={guardando}
                onChange={() => guardar(opcion.id)}
              />
              <span className="perfil-flora__card-cuerpo">
                <span className="perfil-flora__card-nombre">{opcion.nombre}</span>
                <span className="perfil-flora__card-desc">{opcion.descripcion}</span>
                <span className="perfil-flora__card-ejemplo" aria-hidden="true">
                  «{opcion.ejemplo}»
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {mensaje ? (
        <p className="perfil-flora__mensaje" role="status">
          {mensaje}
        </p>
      ) : null}
    </section>
  );
}
