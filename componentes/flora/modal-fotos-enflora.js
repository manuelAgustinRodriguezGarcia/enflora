"use client";

import { ImageOff, LoaderCircle, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Selector } from "@/componentes/selector";
import { SelectorFecha } from "@/componentes/selector-fecha";
import { formatearFecha } from "@/lib/etapas";
import { mensajeGaleriaVacia } from "@/lib/flora-galeria-fotos";
import { diaArgentina } from "@/lib/historial-registros";

const DURACION_MODAL_FOTOS_MS = 320;

function parametrosConsulta(filtros, cursor, unidadesInicial) {
  const params = new URLSearchParams();
  params.set("unidades", unidadesInicial ? "1" : "0");
  if (filtros.busqueda) params.set("busqueda", filtros.busqueda);
  if (filtros.unidadId) params.set("unidad_id", filtros.unidadId);
  if (filtros.fechaDesde) params.set("fecha_desde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.set("fecha_hasta", filtros.fechaHasta);
  if (cursor?.fecha_evento) params.set("cursor_fecha", cursor.fecha_evento);
  if (cursor?.id) params.set("cursor_id", cursor.id);
  return params;
}

const FILTROS_VACIOS = {
  busqueda: "",
  unidadId: "",
  fechaDesde: "",
  fechaHasta: "",
};

function suscribirCliente() {
  return () => {};
}

export function ModalFotosEnflora({ abierto, onCerrar, onElegir }) {
  const [fotos, setFotos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [busquedaDebounced, setBusquedaDebounced] = useState("");
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState("");
  const [hayMas, setHayMas] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [estadoVacio, setEstadoVacio] = useState({
    sinCoincidencias: false,
    sinFotosEnCuenta: false,
  });
  const portalListo = useSyncExternalStore(suscribirCliente, () => true, () => false);
  const [montado, setMontado] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const sentinelRef = useRef(null);
  const cuerpoRef = useRef(null);
  const peticionRef = useRef(0);
  const unidadesRef = useRef([]);

  useEffect(() => {
    unidadesRef.current = unidades;
  }, [unidades]);

  useEffect(() => {
    if (abierto) {
      let marcoSalida;
      const marco = requestAnimationFrame(() => {
        setMontado(true);
        marcoSalida = requestAnimationFrame(() => setPanelVisible(true));
      });
      return () => {
        cancelAnimationFrame(marco);
        if (marcoSalida) cancelAnimationFrame(marcoSalida);
      };
    }
    const marco = requestAnimationFrame(() => setPanelVisible(false));
    return () => cancelAnimationFrame(marco);
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
    const timer = window.setTimeout(() => {
      setBusquedaDebounced(filtros.busqueda.trim());
    }, 320);
    return () => window.clearTimeout(timer);
  }, [abierto, filtros.busqueda]);

  const filtrosConsulta = useMemo(
    () => ({
      busqueda: busquedaDebounced,
      unidadId: filtros.unidadId,
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
    }),
    [busquedaDebounced, filtros.unidadId, filtros.fechaDesde, filtros.fechaHasta],
  );

  const cargarPagina = useCallback(
    async ({ cursorSiguiente = null, reemplazar = true, traerUnidades = false } = {}) => {
      const idPeticion = ++peticionRef.current;
      if (reemplazar) {
        setCargando(true);
        setError("");
        setFotos([]);
        setHayMas(false);
        setCursor(null);
      } else setCargandoMas(true);

      try {
        const params = parametrosConsulta(filtrosConsulta, cursorSiguiente, traerUnidades);
        const res = await fetch(`/api/flora/fotos?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (idPeticion !== peticionRef.current) return;

        if (!res.ok || !data.ok) {
          if (reemplazar) {
            setFotos([]);
            setHayMas(false);
            setCursor(null);
          }
          setError(data.error || "No se pudieron cargar tus fotos.");
          return;
        }

        const nuevas = Array.isArray(data.fotos) ? data.fotos : [];
        setFotos((prev) => (reemplazar ? nuevas : [...prev, ...nuevas]));
        setHayMas(Boolean(data.hay_mas));
        setCursor(data.cursor || null);
        setEstadoVacio({
          sinCoincidencias: Boolean(data.sin_coincidencias),
          sinFotosEnCuenta: Boolean(data.sin_fotos_cuenta),
        });
        if (Array.isArray(data.unidades)) {
          setUnidades(data.unidades);
        }
      } catch {
        if (idPeticion !== peticionRef.current) return;
        if (reemplazar) {
          setFotos([]);
          setHayMas(false);
        }
        setError("Falló la conexión al cargar fotos.");
      } finally {
        if (idPeticion === peticionRef.current) {
          setCargando(false);
          setCargandoMas(false);
        }
      }
    },
    [filtrosConsulta],
  );

  useEffect(() => {
    if (!abierto) return;
    queueMicrotask(() => {
      void cargarPagina({
        reemplazar: true,
        traerUnidades: unidadesRef.current.length === 0,
      });
    });
  }, [abierto, filtrosConsulta, cargarPagina]);

  useEffect(() => {
    if (!abierto || !hayMas || cargando || cargandoMas) return;
    const nodo = sentinelRef.current;
    const raiz = cuerpoRef.current;
    if (!nodo || !raiz) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        if (!hayMas || cargando || cargandoMas || !cursor) return;
        cargarPagina({ cursorSiguiente: cursor, reemplazar: false });
      },
      { root: raiz, rootMargin: "120px" },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [abierto, hayMas, cargando, cargandoMas, cursor, cargarPagina]);

  const limpiarFiltros = () => {
    setFiltros(FILTROS_VACIOS);
    setBusquedaDebounced("");
  };

  const hayFiltrosActivos = Boolean(
    filtros.busqueda.trim() ||
      filtros.unidadId ||
      filtros.fechaDesde ||
      filtros.fechaHasta,
  );

  const mensajeVacio = mensajeGaleriaVacia({
    errorCarga: Boolean(error),
    sinCoincidencias: estadoVacio.sinCoincidencias,
    sinFotosEnCuenta: estadoVacio.sinFotosEnCuenta,
  });

  const opcionesUnidades = useMemo(
    () => [
      { valor: "", etiqueta: "Todas las unidades" },
      ...unidades.map((unidad) => ({
        valor: unidad.id,
        etiqueta: unidad.espacio_nombre
          ? `${unidad.nombre} · ${unidad.espacio_nombre}`
          : unidad.nombre,
      })),
    ],
    [unidades],
  );

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
          <div className="flora-modal-fotos__filtros">
            <label className="flora-modal-fotos__busqueda">
              <span className="flora-modal-fotos__sr">Buscar por unidad o planta</span>
              <Search className="flora-modal-fotos__busqueda-icono" strokeWidth={1.75} aria-hidden="true" />
              <input
                type="search"
                value={filtros.busqueda}
                onChange={(evento) => setFiltros((prev) => ({ ...prev, busqueda: evento.target.value }))}
                placeholder="Unidad o planta…"
                autoComplete="off"
              />
            </label>
            <Selector
              id="flora-galeria-unidad"
              etiqueta="Unidad"
              valor={filtros.unidadId}
              onChange={(valor) => setFiltros((prev) => ({ ...prev, unidadId: valor }))}
              opciones={opcionesUnidades}
              disabled={cargando && fotos.length === 0}
            />
            <div className="flora-modal-fotos__fechas">
              <SelectorFecha
                id="flora-galeria-desde"
                etiqueta="Desde"
                valor={filtros.fechaDesde}
                onChange={(valor) => setFiltros((prev) => ({ ...prev, fechaDesde: valor }))}
                sinIcono
              />
              <SelectorFecha
                id="flora-galeria-hasta"
                etiqueta="Hasta"
                valor={filtros.fechaHasta}
                onChange={(valor) => setFiltros((prev) => ({ ...prev, fechaHasta: valor }))}
                sinIcono
              />
            </div>
            {hayFiltrosActivos ? (
              <button type="button" className="flora-modal-fotos__limpiar" onClick={limpiarFiltros}>
                Limpiar filtros
              </button>
            ) : null}
          </div>
          <div className="flora-modal-fotos__cuerpo" ref={cuerpoRef}>
            {cargando ? (
              <div className="flora-modal-fotos__vacio" role="status" aria-live="polite">
                <div className="flora-modal-fotos__vacio-inner">
                  <LoaderCircle
                    className="flora-modal-fotos__vacio-icono flora-modal-fotos__vacio-spinner"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <p>Cargando fotos…</p>
                </div>
              </div>
            ) : null}
            {error ? (
              <p className="flora-modal-fotos__error" role="alert">
                {error}
              </p>
            ) : null}
            {!cargando && !error && fotos.length === 0 ? (
              <div className="flora-modal-fotos__vacio">
                <div className="flora-modal-fotos__vacio-inner">
                  <ImageOff className="flora-modal-fotos__vacio-icono" strokeWidth={1.5} aria-hidden="true" />
                  <p>{mensajeVacio}</p>
                </div>
              </div>
            ) : null}
            {!cargando && fotos.length > 0 ? (
              <ul className="flora-modal-fotos__grilla">
                {fotos.map((foto) => {
                  const dia = diaArgentina(foto.fecha_evento);
                  const unidad = String(foto.unidad_nombre || "").trim();
                  const fechaTexto = dia ? formatearFecha(dia) : "";
                  const etiquetaAccesible = [unidad, fechaTexto].filter(Boolean).join(", ");
                  const mostrarMeta = Boolean(unidad || fechaTexto);
                  return (
                    <li key={foto.id}>
                      <button
                        type="button"
                        className="flora-modal-fotos__item"
                        onClick={() => onElegir(foto)}
                        aria-label={etiquetaAccesible || "Seleccionar foto"}
                      >
                        {foto.url_miniatura ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={foto.url_miniatura} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <span className="flora-modal-fotos__sin-img">Sin vista previa</span>
                        )}
                        {mostrarMeta ? (
                          <span className="flora-modal-fotos__meta">
                            {unidad ? <span className="flora-modal-fotos__meta-unidad">{unidad}</span> : null}
                            {fechaTexto ? <span className="flora-modal-fotos__meta-fecha">{fechaTexto}</span> : null}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
                {hayMas ? (
                  <li className="flora-modal-fotos__sentinel" ref={sentinelRef} aria-hidden="true">
                    {cargandoMas ? (
                      <LoaderCircle className="flora-modal-fotos__giro" strokeWidth={1.5} aria-hidden="true" />
                    ) : null}
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(contenido, document.body);
}
