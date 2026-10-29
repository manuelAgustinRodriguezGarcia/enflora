"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cargarMasDiasHistorial } from "@/app/registros/acciones";
import { HistorialCabecera } from "@/componentes/demo/historial-cabecera";
import { HistorialCrecimiento } from "@/componentes/demo/historial-crecimiento";
import { HistorialEtapas } from "@/componentes/demo/historial-etapas";
import { HistorialMetricas } from "@/componentes/demo/historial-metricas";
import { HistorialResumen } from "@/componentes/demo/historial-resumen";
import { HistorialTimelineApp } from "@/componentes/historial-timeline-app";
import { Boton, EnlaceBoton } from "@/componentes/boton";
import { Selector } from "@/componentes/selector";
import { SelectorFecha } from "@/componentes/selector-fecha";
import { formatearFecha } from "@/lib/etapas";
import { construirHistorialVista } from "@/lib/historial-vista-cultivo";
import { compararEventos, CONTENIDOS_HISTORIAL, hrefHistorial } from "@/lib/historial-registros";

const ETIQUETAS_CONTENIDO = {
  acciones: "Acciones",
  parametros: "Parámetros",
  observaciones: "Observaciones",
};

function resumenFiltros(filtros, plantasUnidad, geneticas) {
  if (!filtros?.unidadId) return "Elegí una unidad";
  const partes = [];
  if (filtros.plantaId) {
    partes.push(plantasUnidad.find((item) => item.id === filtros.plantaId)?.nombre || "Planta");
  }
  if (filtros.genetica) {
    partes.push(geneticas.find((item) => item.clave === filtros.genetica)?.etiqueta || filtros.genetica);
  }
  if (filtros.desde || filtros.hasta) {
    const desde = filtros.desde ? formatearFecha(filtros.desde) : "…";
    const hasta = filtros.hasta ? formatearFecha(filtros.hasta) : "…";
    partes.push(`${desde} – ${hasta}`);
  }
  if (filtros.sinContenido) partes.push("Sin tipo de contenido");
  else if (filtros.contenidos?.length && filtros.contenidos.length < CONTENIDOS_HISTORIAL.length) {
    partes.push(filtros.contenidos.map((item) => ETIQUETAS_CONTENIDO[item] || item).join(", "));
  }
  return partes.length ? partes.join(" · ") : "Todos los registros";
}

function unirRegistros(base, extras, ocultos) {
  const mapa = new Map();
  for (const item of [...base, ...extras]) {
    if (!item?.id || ocultos.has(item.id)) continue;
    mapa.set(item.id, item);
  }
  return [...mapa.values()].sort(compararEventos);
}

export function VistaHistorialCultivo({
  filtrosIniciales,
  unidad,
  espacioNombre,
  plantas = [],
  geneticas = [],
  historialBase,
  registrosIniciales = [],
  hayMasDias = false,
  cursorDias = null,
  resumen = null,
  portada = null,
  etapas = [],
  etapasPorPlanta = null,
  mensajeFiltro = "",
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [registrosExtra, setRegistrosExtra] = useState([]);
  const [ocultos, setOcultos] = useState(() => new Set());
  const [hayMas, setHayMas] = useState(hayMasDias);
  const [cursor, setCursor] = useState(cursorDias);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMas, setErrorMas] = useState("");

  const [unidadId, setUnidadId] = useState(filtrosIniciales?.unidadId || "");
  const [plantaId, setPlantaId] = useState(filtrosIniciales?.plantaId || "todas");
  const [genetica, setGenetica] = useState(filtrosIniciales?.genetica || "todas");
  const [desde, setDesde] = useState(filtrosIniciales?.desde || "");
  const [hasta, setHasta] = useState(filtrosIniciales?.hasta || "");
  const [contenidos, setContenidos] = useState(
    () => new Set(filtrosIniciales?.sinContenido ? [] : filtrosIniciales?.contenidos || CONTENIDOS_HISTORIAL)
  );

  const registros = useMemo(
    () => unirRegistros(registrosIniciales, registrosExtra, ocultos),
    [registrosIniciales, registrosExtra, ocultos]
  );

  const historial = useMemo(
    () =>
      construirHistorialVista({
        unidad,
        espacioNombre,
        plantas,
        plantaId: filtrosIniciales?.plantaId,
        etapas,
        etapasPorPlanta,
        registros,
        resumen,
        portada,
        fechaCorte: historialBase?.fechaCorte,
        diaReferenciaUnidad: historialBase?.cultivo?.diaReferenciaUnidad,
      }),
    [
      unidad,
      espacioNombre,
      plantas,
      filtrosIniciales?.plantaId,
      etapas,
      etapasPorPlanta,
      registros,
      resumen,
      portada,
      historialBase?.fechaCorte,
      historialBase?.cultivo?.diaReferenciaUnidad,
    ]
  );

  const plantasUnidad = useMemo(
    () => plantas.filter((planta) => planta.unidad_cultivo_id === unidad.id || planta.unidadId === unidad.id),
    [plantas, unidad.id]
  );

  const onEliminado = useCallback(
    (id) => {
      setOcultos((actual) => {
        const siguiente = new Set(actual);
        siguiente.add(id);
        return siguiente;
      });
      router.refresh();
    },
    [router]
  );

  function aplicarFiltros(evento) {
    evento.preventDefault();
    iniciar(() => {
      router.push(
        hrefHistorial({
          unidadId,
          plantaId: plantaId === "todas" ? null : plantaId,
          genetica: genetica === "todas" ? null : genetica,
          desde: desde || null,
          hasta: hasta || null,
          contenidos: [...contenidos],
          sinContenido: contenidos.size === 0,
        })
      );
    });
  }

  function quitarFiltroPlanta() {
    iniciar(() => {
      router.push(
        hrefHistorial({
          unidadId,
          genetica: genetica === "todas" ? null : genetica,
          desde: desde || null,
          hasta: hasta || null,
          contenidos: [...contenidos],
          sinContenido: contenidos.size === 0,
        })
      );
    });
  }

  function limpiarFiltros() {
    if (!unidadId) return;
    iniciar(() => router.push(hrefHistorial({ unidadId })));
  }

  const hayFiltros = Boolean(
    filtrosIniciales?.plantaId ||
      filtrosIniciales?.genetica ||
      filtrosIniciales?.desde ||
      filtrosIniciales?.hasta ||
      filtrosIniciales?.sinContenido ||
      (filtrosIniciales?.contenidos && filtrosIniciales.contenidos.length < CONTENIDOS_HISTORIAL.length)
  );

  async function cargarMas() {
    if (!cursor || cargandoMas || !filtrosIniciales) return;
    setCargandoMas(true);
    setErrorMas("");
    try {
      const respuesta = await cargarMasDiasHistorial({
        unidadId: filtrosIniciales.unidadId,
        plantaId: filtrosIniciales.plantaId,
        genetica: filtrosIniciales.genetica,
        desde: filtrosIniciales.desde,
        hasta: filtrosIniciales.hasta,
        contenidos: filtrosIniciales.contenidos,
        sinContenido: filtrosIniciales.sinContenido,
        cursorFecha: cursor.fecha,
        cursorId: cursor.id,
      });
      if (respuesta.error) {
        setErrorMas(respuesta.mensaje || "No se pudieron cargar más días.");
        return;
      }
      setRegistrosExtra((lista) => [...lista, ...(respuesta.registros || [])]);
      setHayMas(Boolean(respuesta.hayMas));
      setCursor(respuesta.cursor || null);
    } catch {
      setErrorMas("No se pudieron cargar más días.");
    } finally {
      setCargandoMas(false);
    }
  }

  function alternarContenido(clave) {
    setContenidos((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  if (mensajeFiltro) {
    return <p className="historial__error" role="alert">{mensajeFiltro}</p>;
  }

  return (
    <div className="historial-vista-cultivo demo-historial-vista">
      <details className="historial__panel historial-vista-cultivo__filtros" defaultOpen={hayFiltros}>
        <summary>
          Filtros
          <span>{resumenFiltros(filtrosIniciales, plantasUnidad, geneticas)}</span>
        </summary>
        <form className="historial__formulario" onSubmit={aplicarFiltros}>
          <div className="historial__rejilla">
            <Selector
              id="historial-vista-planta"
              etiqueta="Planta"
              valor={plantaId}
              onChange={(valor) => setPlantaId(valor || "todas")}
              opciones={[
                { valor: "todas", etiqueta: "Toda la unidad" },
                ...plantasUnidad.map((planta) => ({
                  valor: planta.id,
                  etiqueta: planta.nombre || `Planta ${planta.numero || ""}`.trim(),
                })),
              ]}
            />
            <Selector
              id="historial-vista-genetica"
              etiqueta="Genética"
              valor={genetica}
              onChange={(valor) => setGenetica(valor || "todas")}
              opciones={[
                { valor: "todas", etiqueta: "Todas" },
                ...geneticas.map((item) => ({ valor: item.clave, etiqueta: item.etiqueta })),
              ]}
            />
            <SelectorFecha id="historial-vista-desde" etiqueta="Desde" valor={desde} onChange={setDesde} />
            <SelectorFecha id="historial-vista-hasta" etiqueta="Hasta" valor={hasta} onChange={setHasta} />
          </div>
          <div className="historial__contenidos" role="group" aria-label="Tipo de registro">
            {CONTENIDOS_HISTORIAL.map((clave) => (
              <button
                key={clave}
                type="button"
                className={`historial__contenido${contenidos.has(clave) ? " historial__contenido--activo" : ""}`}
                aria-pressed={contenidos.has(clave)}
                onClick={() => alternarContenido(clave)}
              >
                {ETIQUETAS_CONTENIDO[clave]}
              </button>
            ))}
          </div>
          <div className="historial__aplicar">
            <Boton type="submit" variante="secundario" disabled={pendiente}>
              {pendiente ? "Aplicando..." : "Aplicar filtros"}
            </Boton>
            {hayFiltros ? (
              <Boton type="button" variante="ghost" onClick={limpiarFiltros} disabled={pendiente}>
                Limpiar
              </Boton>
            ) : null}
            {filtrosIniciales?.plantaId ? (
              <Boton type="button" variante="ghost" onClick={quitarFiltroPlanta} disabled={pendiente}>
                Ver toda la unidad
              </Boton>
            ) : null}
          </div>
        </form>
      </details>

      {filtrosIniciales?.plantaId ? (
        <p className="historial__aviso">
          Mostrando el historial de una planta. Podés volver al alcance de toda la unidad cuando quieras.
        </p>
      ) : null}

      <HistorialCabecera historial={historial} modoApp />
      <HistorialCrecimiento historial={historial} />
      <HistorialResumen historial={historial} modoApp />
      <HistorialEtapas historial={historial} />
      <HistorialTimelineApp
        historial={historial}
        onEliminado={onEliminado}
        hayMasDias={hayMas}
        cargandoMas={cargandoMas}
        onCargarMasDias={cargarMas}
        errorMas={errorMas}
        onReintentarMas={cargarMas}
      />
      <HistorialMetricas historial={historial} />

      {registros.length === 0 ? (
        <div className="vacio">
          <p>No hay registros para este alcance.</p>
          <EnlaceBoton href="/registros" variante="secundario">Nuevo registro</EnlaceBoton>
        </div>
      ) : null}
    </div>
  );
}

export function SelectorUnidadHistorial({ unidades, valor, onChange, pendiente }) {
  if (!unidades.length) {
    return (
      <div className="vacio">
        <p>Todavía no tenés unidades de cultivo.</p>
        <EnlaceBoton href="/espacios">Crear tu primer cultivo</EnlaceBoton>
      </div>
    );
  }

  return (
    <Selector
      id="historial-unidad-principal"
      etiqueta="Unidad de cultivo"
      valor={valor || ""}
      onChange={onChange}
      opciones={[
        { valor: "", etiqueta: "Seleccioná una unidad" },
        ...unidades.map((unidad) => ({
          valor: unidad.id,
          etiqueta: unidad.espacioNombre ? `${unidad.nombre} · ${unidad.espacioNombre}` : unidad.nombre,
        })),
      ]}
      disabled={pendiente}
    />
  );
}
