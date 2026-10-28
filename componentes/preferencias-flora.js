"use client";

import { useCallback, useState } from "react";
import { PERSONALIDADES_FLORA, rutaImagenPersonalidadFlora } from "@/lib/flora-personalidad";

function ImagenPersonalidadFlora({ id, nombre }) {
  const [cargada, setCargada] = useState(false);
  const [fallo, setFallo] = useState(false);
  const mostrarPlaceholder = !cargada || fallo;

  return (
    <span
      className={`perfil-flora__card-imagen${mostrarPlaceholder ? " perfil-flora__card-imagen--placeholder" : ""}`}
    >
      {!fallo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={rutaImagenPersonalidadFlora(id)}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setCargada(true)}
          onError={() => {
            setFallo(true);
            setCargada(false);
          }}
        />
      ) : null}
      {mostrarPlaceholder ? (
        <span className="perfil-flora__card-imagen-vacio" aria-hidden="true">
          {nombre.charAt(0)}
        </span>
      ) : null}
    </span>
  );
}

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
        Elegí cómo querés que Flora te responda. Aplica a partir de la próxima respuesta.
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
                <span className="perfil-flora__card-fila">
                  <ImagenPersonalidadFlora id={opcion.id} nombre={opcion.nombre} />
                  <span className="perfil-flora__card-texto">
                    <span className="perfil-flora__card-nombre">{opcion.nombre}</span>
                    <span className="perfil-flora__card-desc">{opcion.descripcion}</span>
                  </span>
                </span>
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
