"use client";

import { ImageOff, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatearFecha } from "@/lib/etapas";
import { diaArgentina } from "@/lib/historial-registros";

const MENSAJE_GALERIA_VACIA =
  "Guardá imágenes en tus registros para luego poder mostrárselas a Flora.";

const DURACION_MODAL_FOTOS_MS = 320;

export function ModalFotosEnflora({ abierto, onCerrar, onElegir }) {
  const [fotos, setFotos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [portalListo, setPortalListo] = useState(false);
  const [montado, setMontado] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);

  useEffect(() => {
    setPortalListo(true);
  }, []);

  useEffect(() => {
    if (abierto) {
      setMontado(true);
      const marco = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPanelVisible(true));
      });
      return () => cancelAnimationFrame(marco);
    }
    setPanelVisible(false);
    return undefined;
  }, [abierto]);

  useEffect(() => {
    if (montado && !abierto && !panelVisible) {
      const timer = window.setTimeout(() => setMontado(false), DURACION_MODAL_FOTOS_MS);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [montado, abierto, panelVisible]);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;

    (async () => {
      setCargando(true);
      setError("");
      try {
        const res = await fetch("/api/flora/fotos");
        const data = await res.json().catch(() => ({}));
        if (cancelado) return;
        if (!res.ok || !data.ok) {
          setFotos([]);
          setError(data.error || "No se pudieron cargar tus fotos.");
          return;
        }
        setFotos(Array.isArray(data.fotos) ? data.fotos : []);
      } catch {
        if (!cancelado) {
          setError("Falló la conexión al cargar fotos.");
          setFotos([]);
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [abierto]);

  if (!portalListo || !montado) return null;

  const contenido = (
    <div
      className={`flora-modal-fotos${panelVisible ? " flora-modal-fotos--abierto" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="flora-modal-fotos-titulo"
    >
      <button type="button" className="flora-modal-fotos__fondo" onClick={onCerrar} aria-label="Cerrar" />
      <div className="flora-modal-fotos__contenedor">
        <div className="flora-modal-fotos__panel">
        <header className="flora-modal-fotos__cabecera">
          <h2 id="flora-modal-fotos-titulo">
            Elegir foto de <span className="flora-modal-fotos__marca">Enflora</span>
          </h2>
          <button type="button" className="flora-modal-fotos__cerrar" onClick={onCerrar} aria-label="Cerrar">
            <X strokeWidth={2} aria-hidden="true" />
          </button>
        </header>
        <div className="flora-modal-fotos__cuerpo">
          {cargando ? (
            <p className="flora-modal-fotos__estado" role="status">
              <LoaderCircle className="flora-modal-fotos__giro" strokeWidth={1.75} aria-hidden="true" />
              Cargando fotos…
            </p>
          ) : null}
          {error ? (
            <p className="flora-modal-fotos__error" role="alert">
              {error}
            </p>
          ) : null}
          {!cargando && !error && fotos.length === 0 ? (
            <div className="flora-modal-fotos__vacio">
              <ImageOff className="flora-modal-fotos__vacio-icono" strokeWidth={1.5} aria-hidden="true" />
              <p>{MENSAJE_GALERIA_VACIA}</p>
            </div>
          ) : null}
          {!cargando && fotos.length > 0 ? (
            <ul className="flora-modal-fotos__grilla">
              {fotos.map((foto) => {
                const dia = diaArgentina(foto.fecha_evento);
                const etiqueta = [
                  dia ? formatearFecha(dia) : "",
                  foto.unidad_nombre,
                  foto.planta_etiqueta,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={foto.id}>
                    <button
                      type="button"
                      className="flora-modal-fotos__item"
                      onClick={() => onElegir(foto)}
                      aria-label={etiqueta || "Seleccionar foto"}
                    >
                      {foto.url_miniatura ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={foto.url_miniatura} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span className="flora-modal-fotos__sin-img">Sin vista previa</span>
                      )}
                      {etiqueta ? <span className="flora-modal-fotos__meta">{etiqueta}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        </div>
      </div>
    </div>
  );

  return createPortal(contenido, document.body);
}
