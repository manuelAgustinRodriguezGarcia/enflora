"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { cargarPaginaGaleria, refrescarMiniaturaGaleria } from "@/app/galeria/acciones";
import { Selector } from "@/componentes/selector";
import {
  VALOR_FILTRO_TODOS,
  anexarFotosGaleria,
  etiquetaFotoGaleria,
  filtrosTrasCambioEspacio,
  hayFiltrosGaleria,
  mensajeGaleriaFlora,
  opcionesEspaciosGaleria,
  opcionesUnidadesGaleria,
} from "@/lib/galeria-flora";

const VisorGaleriaFlora = dynamic(
  () => import("@/componentes/galeria/visor-galeria-flora").then((mod) => mod.VisorGaleriaFlora),
  { ssr: false },
);

const ESQUELETOS = 12;

function Esqueletos({ cantidad = ESQUELETOS }) {
  return Array.from({ length: cantidad }, (_, indice) => (
    <li key={`esqueleto-${indice}`} className="galeria-flora__esqueleto" aria-hidden="true" />
  ));
}

function FotoGaleria({ foto, onAbrir }) {
  const [url, setUrl] = useState(foto.url_miniatura || "");
  const [fallo, setFallo] = useState(false);
  const reintento = useRef(false);

  useEffect(() => {
    if (foto.url_miniatura) return undefined;
    let vigente = true;
    refrescarMiniaturaGaleria(foto.id).then((respuesta) => {
      if (!vigente) return;
      if (respuesta?.url) setUrl(respuesta.url);
      else setFallo(true);
    });
    return () => {
      vigente = false;
    };
  }, [foto.id, foto.url_miniatura]);

  async function alFallar() {
    if (reintento.current) {
      setFallo(true);
      setUrl("");
      return;
    }
    reintento.current = true;
    const respuesta = await refrescarMiniaturaGaleria(foto.id);
    if (respuesta?.url) {
      setUrl(respuesta.url);
      setFallo(false);
      return;
    }
    setFallo(true);
    setUrl("");
  }

  return (
    <button type="button" className="galeria-flora__abrir" onClick={onAbrir} aria-label={etiquetaFotoGaleria(foto)}>
      {url && !fallo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" onError={alFallar} />
      ) : (
        <span className="galeria-flora__ausente">No disponible</span>
      )}
    </button>
  );
}

export function PanelGaleriaFlora({
  fotosIniciales = [],
  hayMasInicial = false,
  cursorInicial = null,
  espacios = [],
  unidades = [],
  errorInicial = "",
  avisoFiltros = "",
}) {
  const [fotos, setFotos] = useState(fotosIniciales);
  const [hayMas, setHayMas] = useState(hayMasInicial);
  const [cursor, setCursor] = useState(cursorInicial);
  const [filtros, setFiltros] = useState({ espacioId: "", unidadId: "" });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(errorInicial);
  const [indice, setIndice] = useState(-1);
  const solicitud = useRef(0);
  const centinela = useRef(null);
  const disparador = useRef(null);
  const estado = useRef({ filtros, cursor, hayMas, cargando, error });

  useEffect(() => {
    estado.current = { filtros, cursor, hayMas, cargando, error };
  }, [filtros, cursor, hayMas, cargando, error]);

  const aplicarRespuesta = useCallback((respuesta, { anexar }) => {
    if (!respuesta?.ok) {
      setError(respuesta?.error || "No se pudieron cargar las fotos.");
      setCargando(false);
      return false;
    }
    setError("");
    setFotos((previas) => (anexar ? anexarFotosGaleria(previas, respuesta.fotos) : respuesta.fotos || []));
    setHayMas(Boolean(respuesta.hay_mas && respuesta.cursor));
    setCursor(respuesta.cursor || null);
    setCargando(false);
    return true;
  }, []);

  const pedirPagina = useCallback(
    async (siguiente, { anexar, cursorPagina }) => {
      const id = ++solicitud.current;
      estado.current.cargando = true;
      setCargando(true);
      if (!anexar) setError("");
      const respuesta = await cargarPaginaGaleria({
        espacioId: siguiente.espacioId,
        unidadId: siguiente.unidadId,
        cursorFecha: cursorPagina?.fecha_evento || "",
        cursorId: cursorPagina?.id || "",
      });
      if (id !== solicitud.current) return null;

      let final = respuesta;
      let anexarFinal = anexar;
      if (respuesta?.unidad_invalida && siguiente.unidadId) {
        const sinUnidad = { espacioId: siguiente.espacioId, unidadId: "" };
        setFiltros(sinUnidad);
        const idReintento = ++solicitud.current;
        estado.current.cargando = true;
        final = await cargarPaginaGaleria({
          espacioId: sinUnidad.espacioId,
          unidadId: "",
          cursorFecha: "",
          cursorId: "",
        });
        if (idReintento !== solicitud.current) return null;
        anexarFinal = false;
      }

      aplicarRespuesta(final, { anexar: anexarFinal });
      return final;
    },
    [aplicarRespuesta],
  );

  const aplicarFiltros = useCallback(
    (siguiente) => {
      setFiltros(siguiente);
      setIndice(-1);
      setFotos([]);
      setHayMas(false);
      setCursor(null);
      return pedirPagina(siguiente, { anexar: false, cursorPagina: null });
    },
    [pedirPagina],
  );

  const cargarMas = useCallback(() => {
    const actual = estado.current;
    if (!actual.hayMas || actual.cargando || actual.error || !actual.cursor) return;
    return pedirPagina(actual.filtros, { anexar: true, cursorPagina: actual.cursor });
  }, [pedirPagina]);

  useEffect(() => {
    const nodo = centinela.current;
    if (!nodo || !hayMas) return undefined;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) cargarMas();
      },
      { rootMargin: "800px" },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [hayMas, cargarMas, fotos.length]);

  function cambiarEspacio(valor) {
    const espacioId = !valor || valor === VALOR_FILTRO_TODOS ? "" : String(valor);
    aplicarFiltros(filtrosTrasCambioEspacio({ espacioId, unidadId: filtros.unidadId, unidades }));
  }

  function cambiarUnidad(valor) {
    const unidadId = !valor || valor === VALOR_FILTRO_TODOS ? "" : String(valor);
    aplicarFiltros({ espacioId: filtros.espacioId, unidadId });
  }

  const espaciosOpciones = opcionesEspaciosGaleria(espacios);
  const unidadesOpciones = opcionesUnidadesGaleria(unidades, filtros.espacioId);
  const filtrosActivos = hayFiltrosGaleria(filtros);
  const vacio = !cargando && fotos.length === 0;
  const mensaje = mensajeGaleriaFlora({
    error: vacio ? error : "",
    sinFotos: vacio && !filtrosActivos && !error,
    sinCoincidencias: vacio && filtrosActivos && !error,
  });

  return (
    <section className="galeria-flora" aria-busy={cargando || undefined}>
      <header className="galeria-flora__cabecera">
        <h1>Galería de Flora</h1>
        <p>Todas las fotos de tus plantas en un solo lugar.</p>
      </header>

      <div className="galeria-flora__filtros">
        <button
          type="button"
          className={`galeria-flora__todas${filtrosActivos ? "" : " galeria-flora__todas--activa"}`}
          aria-pressed={!filtrosActivos}
          onClick={() => {
            if (filtrosActivos) aplicarFiltros({ espacioId: "", unidadId: "" });
          }}
        >
          Todas las fotos
        </button>
        <div className="galeria-flora__selectores">
          <Selector
            id="galeria-espacio"
            etiqueta="Espacio"
            valor={filtros.espacioId || VALOR_FILTRO_TODOS}
            onChange={cambiarEspacio}
            opciones={[{ valor: VALOR_FILTRO_TODOS, etiqueta: "Todos los espacios" }, ...espaciosOpciones]}
            placeholder="Todos los espacios"
          />
          <Selector
            id="galeria-unidad"
            etiqueta="Unidad"
            valor={filtros.unidadId || VALOR_FILTRO_TODOS}
            onChange={cambiarUnidad}
            opciones={[{ valor: VALOR_FILTRO_TODOS, etiqueta: "Todas las unidades" }, ...unidadesOpciones]}
            placeholder="Todas las unidades"
          />
        </div>
        {avisoFiltros ? <p className="galeria-flora__error">{avisoFiltros}</p> : null}
      </div>

      {mensaje && vacio ? (
        <div className="galeria-flora__vacio">
          {error || filtrosActivos ? null : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/images/app/interior-cultivos.png" alt="" />
          )}
          <h2>{filtrosActivos ? "Nada por aquí" : error ? "No se pudo abrir la galería" : "Todavía no hay fotos"}</h2>
          <p>{mensaje}</p>
          {error ? (
            <button type="button" className="galeria-flora__cta" onClick={() => aplicarFiltros(filtros)}>
              Reintentar
            </button>
          ) : filtrosActivos ? (
            <button type="button" className="galeria-flora__cta" onClick={() => aplicarFiltros({ espacioId: "", unidadId: "" })}>
              Ver todas las fotos
            </button>
          ) : (
            <Link className="galeria-flora__cta" href="/registros">
              Registrar una foto
            </Link>
          )}
        </div>
      ) : null}

      {fotos.length > 0 || (cargando && fotos.length === 0) ? (
        <ul className="galeria-flora__grilla">
          {fotos.map((foto, posicion) => (
            <li key={foto.id}>
              <FotoGaleria
                key={`${foto.id}:${foto.url_miniatura}`}
                foto={foto}
                onAbrir={(evento) => {
                  disparador.current = evento.currentTarget;
                  setIndice(posicion);
                }}
              />
            </li>
          ))}
          {cargando ? <Esqueletos cantidad={fotos.length === 0 ? ESQUELETOS : 6} /> : null}
        </ul>
      ) : null}

      <div ref={centinela} className="galeria-flora__centinela" aria-hidden="true" />

      {error && fotos.length > 0 ? (
        <div className="galeria-flora__error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="galeria-flora__reintento"
            onClick={() => {
              estado.current = { ...estado.current, error: "" };
              setError("");
              cargarMas();
            }}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      <p className="galeria-flora__estado" role="status">
        {cargando ? "Cargando fotos…" : ""}
      </p>

      {indice >= 0 ? (
        <VisorGaleriaFlora
          fotos={fotos}
          indice={indice}
          onCerrar={() => {
            setIndice(-1);
            const nodo = disparador.current;
            window.setTimeout(() => nodo?.focus?.(), 0);
          }}
          onIndice={(siguiente) => setIndice((actual) => (actual === siguiente ? actual : siguiente))}
          onPedirMas={cargarMas}
        />
      ) : null}
    </section>
  );
}
