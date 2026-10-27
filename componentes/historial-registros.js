"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cargarPaginaHistorial, eliminarRegistro } from "@/app/registros/acciones";
import { Boton, EnlaceBoton } from "@/componentes/boton";
import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { IconoBasura } from "@/componentes/iconos-ui";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { Selector } from "@/componentes/selector";
import { SelectorFecha } from "@/componentes/selector-fecha";
import { formatearFecha } from "@/lib/etapas";
import {
  agruparHistorial,
  compararEventos,
  CONTENIDOS_HISTORIAL,
  diaArgentina,
  etapasVisibles,
  etiquetaAlcanceHistorico,
  etiquetaOrigen,
  horaArgentina,
  hrefHistorial,
  nombreUnidadOriginal,
  textoValorParametro,
} from "@/lib/historial-registros";

const ETIQUETAS_CONTENIDO = {
  acciones: "Acciones",
  parametros: "Parámetros",
  observaciones: "Observaciones",
};

function unirRegistros(base, extras, ocultos) {
  const mapa = new Map();
  for (const item of [...base, ...extras]) {
    if (!item?.id || ocultos.has(item.id)) continue;
    mapa.set(item.id, item);
  }
  return [...mapa.values()].sort(compararEventos);
}

function resumenFiltros(filtros, unidades, plantas, geneticas) {
  if (!filtros) return "Sin filtros";
  const partes = [];
  if (filtros.unidadId) {
    partes.push(unidades.find((item) => item.id === filtros.unidadId)?.nombre || "Unidad");
  }
  if (filtros.plantaId) {
    partes.push(plantas.find((item) => item.id === filtros.plantaId)?.nombre || "Planta");
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

function EliminarRegistroHistorial({ registro, onEliminado }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(eliminarRegistro, null);
  const avisado = useRef(false);

  useEffect(() => {
    if (!estado?.ok || avisado.current) return;
    avisado.current = true;
    onEliminado(registro.id);
  }, [estado, onEliminado, registro.id]);

  return (
    <>
      <Boton
        type="button"
        className="boton boton--destructivo boton--icono"
        aria-label="Eliminar registro"
        onClick={() => setAbierto(true)}
      >
        <IconoBasura />
      </Boton>
      <ModalConfirmacion
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="¿Eliminar este registro?"
        descripcion="Se elimina este registro con sus acciones, parámetros y plantas asociadas. Los demás registros no se modifican."
        textoConfirmar="Eliminar"
        textoCancelar="Cancelar"
        pendiente={pendiente}
        error={estado?.error || ""}
        accion={accion}
        icono={<IconoBasura />}
        varianteIcono="eliminar"
        varianteConfirmar="destructivo"
      >
        <input type="hidden" name="registro_id" value={registro.id} />
        <input type="hidden" name="espacio_id" value={registro.espacio_id || ""} />
        <input type="hidden" name="unidad_id" value={registro.unidad_cultivo_id || ""} />
      </ModalConfirmacion>
    </>
  );
}

function PlantasRegistro({ filas }) {
  const plantas = filas || [];
  if (plantas.length === 0) return <p className="historial__vacio-inline">Sin plantas asociadas.</p>;
  return (
    <ul className="historial__plantas">
      {plantas.map((fila) => (
        <li key={fila.id || `${fila.nombre_planta}-${fila.numero_planta}`}>
          <span>{fila.nombre_planta}</span>
          {fila.numero_planta ? <span> #{fila.numero_planta}</span> : null}
          {fila.genetica_planta ? <span> · {fila.genetica_planta}</span> : null}
          {!fila.planta_id ? <span> · ya no está en el cultivo</span> : null}
        </li>
      ))}
    </ul>
  );
}

function TarjetaRegistro({ registro, unidades, onEliminado }) {
  const hora = horaArgentina(registro.fecha_evento);
  const dia = diaArgentina(registro.fecha_evento);
  const ambiente = registro.aplica_a === "ambiente";
  const acciones = registro.registro_acciones || [];
  const parametros = registro.registro_parametros || [];

  return (
    <article className={`historial__tarjeta${ambiente ? " historial__tarjeta--ambiente" : ""}`}>
      <header className="historial__tarjeta-cabecera">
        <time dateTime={registro.fecha_evento}>{hora || "Sin hora"}</time>
        <span className={`historial__tipo${ambiente ? " historial__tipo--ambiente" : ""}`}>
          {ambiente ? "Ambiente" : "Plantas"}
        </span>
      </header>
      <p className="historial__unidad">{nombreUnidadOriginal(registro, unidades)}</p>
      {acciones.length > 0 ? (
        <ul className="historial__chips" aria-label="Acciones">
          {acciones.map((accion) => (
            <li key={accion.id || `${accion.origen}-${accion.clave_nativa || accion.opcion_id}`}>
              {accion.nombre}
            </li>
          ))}
        </ul>
      ) : null}
      {parametros.length > 0 ? (
        <dl className="historial__parametros">
          {parametros.map((parametro) => (
            <div key={parametro.id || `${parametro.origen}-${parametro.clave_nativa || parametro.opcion_id}`}>
              <dt>{parametro.nombre}</dt>
              <dd>{textoValorParametro(parametro)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {registro.observacion ? <p className="historial__observacion">{registro.observacion}</p> : null}
      {ambiente ? (
        <p className="historial__vacio-inline">Medición de la unidad, sin plantas asociadas.</p>
      ) : (
        <PlantasRegistro filas={registro.registro_plantas} />
      )}
      <details className="historial__detalle">
        <summary>Ver detalle</summary>
        <dl>
          <div>
            <dt>Fecha</dt>
            <dd>{dia ? formatearFecha(dia) : "—"}</dd>
          </div>
          <div>
            <dt>Hora</dt>
            <dd>{hora || "—"}</dd>
          </div>
          <div>
            <dt>Unidad original</dt>
            <dd>{nombreUnidadOriginal(registro, unidades)}</dd>
          </div>
          <div>
            <dt>Alcance</dt>
            <dd>{etiquetaAlcanceHistorico(registro)}</dd>
          </div>
          <div>
            <dt>Aplicación</dt>
            <dd>{ambiente ? "Medición ambiental" : "Registro de plantas"}</dd>
          </div>
        </dl>
        <h3>Plantas afectadas</h3>
        {ambiente ? (
          <p className="historial__vacio-inline">Esta medición no asocia plantas.</p>
        ) : (
          <PlantasRegistro filas={registro.registro_plantas} />
        )}
        <h3>Acciones</h3>
        {acciones.length === 0 ? (
          <p className="historial__vacio-inline">Sin acciones.</p>
        ) : (
          <ul className="historial__lista-detalle">
            {acciones.map((accion) => (
              <li key={`detalle-${accion.id || accion.nombre}`}>
                <span>{accion.nombre}</span>
                <span>{etiquetaOrigen(accion.origen)}</span>
              </li>
            ))}
          </ul>
        )}
        <h3>Parámetros</h3>
        {parametros.length === 0 ? (
          <p className="historial__vacio-inline">Sin parámetros.</p>
        ) : (
          <ul className="historial__lista-detalle">
            {parametros.map((parametro) => (
              <li key={`detalle-${parametro.id || parametro.nombre}`}>
                <span>
                  {parametro.nombre}: {textoValorParametro(parametro)}
                </span>
                <span>{etiquetaOrigen(parametro.origen)}</span>
              </li>
            ))}
          </ul>
        )}
        <h3>Observaciones</h3>
        <p>{registro.observacion || "Sin observaciones."}</p>
      </details>
      <div className="historial__tarjeta-acciones">
        <EnlaceBoton
          href={`/registros?editar=${registro.id}`}
          variante="secundario"
          className="historial__editar"
        >
          Editar
        </EnlaceBoton>
        <EliminarRegistroHistorial registro={registro} onEliminado={onEliminado} />
      </div>
    </article>
  );
}

function TarjetaEtapa({ etapa, fichaPlanta }) {
  const fin = etapa.fecha_fin ? formatearFecha(etapa.fecha_fin) : "actual";
  return (
    <article className="historial__tarjeta historial__tarjeta--etapa">
      <header className="historial__tarjeta-cabecera">
        <span className="historial__tipo historial__tipo--etapa">Etapa</span>
      </header>
      <IndicadorEtapa etapa={etapa.etapa} tamano="compacto" />
      <p className="historial__observacion">
        {formatearFecha(etapa.fecha_inicio)} → {fin}
      </p>
      {fichaPlanta ? (
        <EnlaceBoton href={fichaPlanta.href} variante="ghost">
          Ver ficha de {fichaPlanta.nombre}
        </EnlaceBoton>
      ) : null}
    </article>
  );
}

export function HistorialRegistros({
  filtros,
  registros = [],
  hayMas = false,
  errorCarga = false,
  mensajeFiltro = "",
  unidades = [],
  plantas = [],
  geneticas = [],
  etapas = [],
  errorEtapas = false,
  fichaPlanta = null,
}) {
  const router = useRouter();
  const [pendienteFiltro, iniciarFiltro] = useTransition();
  const [extras, setExtras] = useState([]);
  const [ocultos, setOcultos] = useState(() => new Set());
  const [hayMasLocal, setHayMasLocal] = useState(hayMas);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMas, setErrorMas] = useState("");
  const [unidadId, setUnidadId] = useState(filtros?.unidadId || "todas");
  const [plantaId, setPlantaId] = useState(filtros?.plantaId || "todas");
  const [genetica, setGenetica] = useState(filtros?.genetica || "todas");
  const [desde, setDesde] = useState(filtros?.desde || "");
  const [hasta, setHasta] = useState(filtros?.hasta || "");
  const [contenidos, setContenidos] = useState(
    () => new Set(filtros?.sinContenido ? [] : filtros?.contenidos || CONTENIDOS_HISTORIAL)
  );

  const plantasVisibles =
    unidadId === "todas" ? plantas : plantas.filter((planta) => planta.unidadId === unidadId);
  const visibles = unirRegistros(registros, extras, ocultos);
  const etapasEnLinea = etapasVisibles(etapas, visibles, hayMasLocal);
  const grupos = agruparHistorial(visibles, etapasEnLinea);
  const hayFiltros = Boolean(
    filtros?.unidadId ||
      filtros?.plantaId ||
      filtros?.genetica ||
      filtros?.desde ||
      filtros?.hasta ||
      filtros?.sinContenido ||
      (filtros?.contenidos && filtros.contenidos.length < CONTENIDOS_HISTORIAL.length)
  );

  function aplicar(evento) {
    evento.preventDefault();
    const siguientes = [...contenidos];
    iniciarFiltro(() => {
      router.push(
        hrefHistorial({
          unidadId: unidadId === "todas" ? null : unidadId,
          plantaId: plantaId === "todas" ? null : plantaId,
          genetica: genetica === "todas" ? null : genetica,
          desde: desde || null,
          hasta: hasta || null,
          contenidos: siguientes,
          sinContenido: siguientes.length === 0,
        })
      );
    });
  }

  function limpiar() {
    iniciarFiltro(() => router.push("/registros/historial"));
  }

  function alternarContenido(clave) {
    setContenidos((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  async function cargarMas() {
    const ultimo = visibles[visibles.length - 1];
    if (!ultimo || !filtros || cargandoMas) return;
    setCargandoMas(true);
    setErrorMas("");
    try {
      const respuesta = await cargarPaginaHistorial({
        unidadId: filtros.unidadId,
        plantaId: filtros.plantaId,
        genetica: filtros.genetica,
        desde: filtros.desde,
        hasta: filtros.hasta,
        contenidos: filtros.contenidos,
        sinContenido: filtros.sinContenido,
        cursorFecha: ultimo.fecha_evento,
        cursorId: ultimo.id,
      });
      if (respuesta.error) {
        setErrorMas(respuesta.mensaje || "No se pudo cargar más registros.");
        return;
      }
      setExtras((lista) => [...lista, ...(respuesta.registros || [])]);
      setHayMasLocal(Boolean(respuesta.hayMas));
    } catch {
      setErrorMas("No se pudo cargar más registros.");
    } finally {
      setCargandoMas(false);
    }
  }

  const ocultar = useCallback((id) => {
    setOcultos((actual) => {
      const siguiente = new Set(actual);
      siguiente.add(id);
      return siguiente;
    });
    router.refresh();
  }, [router]);

  return (
    <div className="historial__cuerpo">
      <details className="historial__panel" defaultOpen={hayFiltros}>
        <summary>
          Filtros
          <span>{resumenFiltros(filtros, unidades, plantas, geneticas)}</span>
        </summary>
        <form className="historial__formulario" onSubmit={aplicar}>
          <div className="historial__rejilla">
            <Selector
              id="historial-unidad"
              etiqueta="Unidad"
              valor={unidadId}
              onChange={(valor) => {
                setUnidadId(valor || "todas");
                setPlantaId("todas");
              }}
              opciones={[
                { valor: "todas", etiqueta: "Todas las unidades" },
                ...unidades.map((unidad) => ({
                  valor: unidad.id,
                  etiqueta: unidad.espacioNombre
                    ? `${unidad.nombre} · ${unidad.espacioNombre}`
                    : unidad.nombre,
                })),
              ]}
            />
            <Selector
              id="historial-planta"
              etiqueta="Planta"
              valor={plantaId}
              onChange={(valor) => setPlantaId(valor || "todas")}
              opciones={[
                { valor: "todas", etiqueta: "Todas las plantas" },
                ...plantasVisibles.map((planta) => ({
                  valor: planta.id,
                  etiqueta: planta.nombre || `Planta ${planta.numero || ""}`.trim(),
                })),
              ]}
            />
            <Selector
              id="historial-genetica"
              etiqueta="Genética"
              valor={genetica}
              onChange={(valor) => setGenetica(valor || "todas")}
              opciones={[
                { valor: "todas", etiqueta: "Todas las genéticas" },
                ...geneticas.map((item) => ({ valor: item.clave, etiqueta: item.etiqueta })),
              ]}
            />
            <SelectorFecha id="historial-desde" etiqueta="Desde" valor={desde} onChange={setDesde} />
            <SelectorFecha id="historial-hasta" etiqueta="Hasta" valor={hasta} onChange={setHasta} />
          </div>
          <div className="historial__contenidos" role="group" aria-label="Tipo de contenido">
            {CONTENIDOS_HISTORIAL.map((clave) => {
              const activo = contenidos.has(clave);
              return (
                <button
                  key={clave}
                  type="button"
                  className={`historial__contenido${activo ? " historial__contenido--activo" : ""}`}
                  aria-pressed={activo}
                  onClick={() => alternarContenido(clave)}
                >
                  {ETIQUETAS_CONTENIDO[clave]}
                </button>
              );
            })}
          </div>
          <div className="historial__aplicar">
            <Boton type="submit" variante="secundario" disabled={pendienteFiltro}>
              {pendienteFiltro ? "Aplicando..." : "Aplicar filtros"}
            </Boton>
            {hayFiltros ? (
              <Boton type="button" variante="ghost" onClick={limpiar} disabled={pendienteFiltro}>
                Limpiar
              </Boton>
            ) : null}
          </div>
        </form>
      </details>

      {mensajeFiltro ? (
        <p className="historial__error" role="alert">
          {mensajeFiltro}
        </p>
      ) : null}
      {errorCarga ? (
        <p className="historial__error" role="alert">
          No se pudieron cargar los registros.
        </p>
      ) : null}
      {errorEtapas ? <p className="historial__aviso">No se pudieron cargar los cambios de etapa.</p> : null}
      {fichaPlanta && !mensajeFiltro ? (
        <p className="historial__aviso">
          Los cambios de etapa de {fichaPlanta.nombre} aparecen en esta línea cuando ves todos los
          tipos de contenido. La ficha de la planta conserva el historial de etapas completo.
        </p>
      ) : null}

      {!mensajeFiltro && !errorCarga && grupos.length === 0 ? (
        <div className="vacio">
          <p>
            {hayFiltros
              ? "No hay registros para esta búsqueda."
              : "Todavía no hay registros anteriores para mostrar."}
          </p>
          <EnlaceBoton href="/registros" variante="secundario">
            Nuevo registro
          </EnlaceBoton>
        </div>
      ) : null}

      {grupos.map((grupo) => (
        <section key={grupo.dia} className="historial__dia" aria-labelledby={`dia-${grupo.dia}`}>
          <h2 id={`dia-${grupo.dia}`}>{grupo.etiqueta}</h2>
          <div className="historial__lista">
            {grupo.eventos.map((evento) =>
              evento.tipo === "etapa" ? (
                <TarjetaEtapa key={evento.id} etapa={evento.etapa} fichaPlanta={fichaPlanta} />
              ) : (
                <TarjetaRegistro
                  key={evento.id}
                  registro={evento.registro}
                  unidades={unidades}
                  onEliminado={ocultar}
                />
              )
            )}
          </div>
        </section>
      ))}

      {errorMas ? (
        <p className="historial__error" role="alert">
          {errorMas}
        </p>
      ) : null}
      {!mensajeFiltro && !errorCarga && hayMasLocal && visibles.length > 0 ? (
        <Boton type="button" variante="secundario" onClick={cargarMas} disabled={cargandoMas}>
          {cargandoMas ? "Cargando..." : "Cargar más"}
        </Boton>
      ) : null}
    </div>
  );
}
