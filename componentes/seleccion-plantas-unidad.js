"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { cambiarEtapaMasiva } from "@/app/espacios/[id]/acciones";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { OpcionesEtapa } from "@/componentes/opciones-etapa";
import { SelectorFecha } from "@/componentes/selector-fecha";
import {
  datosEtapaActual,
  esEtapa,
  etiquetaEtapa,
  fechaHoy,
  fechaInicioPlanta,
  formatearFecha,
} from "@/lib/etapas";
import { transicionVista } from "@/lib/animaciones";
import { agruparPlantasPorGenetica } from "@/lib/registros";

function etiquetaEstado(estado) {
  if (estado === "activa") return "Activa";
  if (estado === "finalizada") return "Finalizada";
  return estado;
}

function textoSeleccion(cantidad) {
  if (cantidad === 1) return "1 planta seleccionada";
  return `${cantidad} plantas seleccionadas`;
}

function ContenidoTarjeta({ planta, datos }) {
  return (
    <>
      <div className="tarjeta__cabecera">
        <span className="tarjeta__nombre">{planta.nombre}</span>
        <span className="tarjeta__estado">
          <IndicadorEtapa etapa={planta.etapa} tamano="compacto" />
        </span>
      </div>
      <div className="tarjeta__metricas">
        <span className="tarjeta__dato">
          <span className="tarjeta__etiqueta">Genética</span>
          <span className="tarjeta__valor">{planta.genetica || "—"}</span>
        </span>
        <span className="tarjeta__dato">
          <span className="tarjeta__etiqueta">Método</span>
          <span className="tarjeta__valor">{planta.metodo || "—"}</span>
        </span>
        <span className="tarjeta__dato">
          <span className="tarjeta__etiqueta">{datos.dia === null ? "Inicio" : "Día"}</span>
          <span className="tarjeta__valor">
            {datos.dia === null ? formatearFecha(fechaInicioPlanta(planta)) : datos.dia}
          </span>
        </span>
        <span className="tarjeta__dato">
          <span className="tarjeta__etiqueta">Estado</span>
          <span className="tarjeta__valor">{etiquetaEstado(planta.estado)}</span>
        </span>
        {planta.sustrato ? (
          <span className="tarjeta__dato">
            <span className="tarjeta__etiqueta">Sustrato</span>
            <span className="tarjeta__valor">{planta.sustrato}</span>
          </span>
        ) : null}
      </div>
    </>
  );
}

export function SeleccionPlantasUnidad({
  espacioId,
  unidadId,
  plantas,
  inicioPorPlanta = {},
  hoy = fechaHoy(),
}) {
  const router = useRouter();
  const reducido = useReducedMotion();
  const [seleccionando, setSeleccionando] = useState(false);
  const [modo, setModo] = useState("manual");
  const [ids, setIds] = useState(() => new Set());
  const [formAbierto, setFormAbierto] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [fecha, setFecha] = useState(fechaHoy);
  const [resultado, accion, pendiente] = useActionState(cambiarEtapaMasiva, null);

  const gruposGenetica = useMemo(() => agruparPlantasPorGenetica(plantas), [plantas]);
  const cantidad = ids.size;
  const idsLista = useMemo(() => [...ids], [ids]);

  useEffect(() => {
    if (!resultado?.ok) return;
    setSeleccionando(false);
    setModo("manual");
    setIds(new Set());
    setFormAbierto(false);
    setModalAbierto(false);
    setEtapa("");
    setFecha(fechaHoy());
    router.refresh();
  }, [resultado, router]);

  function entrarSeleccion() {
    setSeleccionando(true);
    setModo("manual");
    setIds(new Set());
    setFormAbierto(false);
    setModalAbierto(false);
    setEtapa("");
    setFecha(fechaHoy());
  }

  function salirSeleccion() {
    if (pendiente) return;
    setSeleccionando(false);
    setModo("manual");
    setIds(new Set());
    setFormAbierto(false);
    setModalAbierto(false);
  }

  function aplicarUnidad() {
    setModo("unidad");
    setIds(new Set(plantas.map((planta) => planta.id)));
  }

  function aplicarGenetica() {
    setModo("genetica");
    setIds(new Set());
  }

  function limpiarSeleccion() {
    setModo("manual");
    setIds(new Set());
  }

  function elegirGenetica(clave) {
    const grupo = gruposGenetica.find((item) => item.clave === clave);
    if (!grupo) return;
    setModo("genetica");
    setIds(new Set(grupo.plantas.map((planta) => planta.id)));
  }

  function alternarPlanta(plantaId) {
    setIds((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(plantaId)) siguiente.delete(plantaId);
      else siguiente.add(plantaId);
      return siguiente;
    });
    if (modo === "unidad" || modo === "genetica") setModo("manual");
  }

  function abrirCambioEtapa() {
    if (!cantidad || pendiente) return;
    setFormAbierto((actual) => !actual);
  }

  function pedirConfirmacion(evento) {
    evento.preventDefault();
    if (!etapa || !fecha || !cantidad || pendiente) return;
    setModalAbierto(true);
  }

  const errorForm = resultado?.ok ? "" : resultado?.error || "";

  return (
    <div className={`seleccion-plantas${seleccionando ? " seleccion-plantas--activo" : ""}`}>
      <div className="seleccion-plantas__cabecera">
        <h2>Plantas</h2>
        {plantas.length > 0 ? (
          seleccionando ? (
            <Boton type="button" variante="ghost" onClick={salirSeleccion} disabled={pendiente}>
              Salir
            </Boton>
          ) : (
            <Boton type="button" variante="secundario" onClick={entrarSeleccion}>
              Seleccionar plantas
            </Boton>
          )
        ) : null}
      </div>

      {plantas.length === 0 ? (
        <div className="vacio">
          <p>Todavía no hay plantas en esta unidad.</p>
        </div>
      ) : (
        <>
          <Aparecer visible={seleccionando}>
            <div className="seleccion-plantas__chips" role="group" aria-label="Atajos de selección">
              <button
                type="button"
                className={`seleccion-plantas__chip${modo === "unidad" ? " seleccion-plantas__chip--activo" : ""}`}
                onClick={aplicarUnidad}
                disabled={pendiente}
                aria-pressed={modo === "unidad"}
              >
                Toda la unidad
              </button>
              <button
                type="button"
                className={`seleccion-plantas__chip${modo === "genetica" ? " seleccion-plantas__chip--activo" : ""}`}
                onClick={aplicarGenetica}
                disabled={pendiente}
                aria-pressed={modo === "genetica"}
              >
                Por genética
              </button>
              <button
                type="button"
                className="seleccion-plantas__chip"
                onClick={limpiarSeleccion}
                disabled={pendiente || cantidad === 0}
              >
                Limpiar
              </button>
            </div>

            <Aparecer visible={modo === "genetica" && gruposGenetica.length > 0}>
              <div className="seleccion-plantas__geneticas" role="group" aria-label="Genéticas de la unidad">
                {gruposGenetica.map((grupo) => {
                  const activo =
                    ids.size === grupo.plantas.length &&
                    grupo.plantas.every((planta) => ids.has(planta.id));
                  return (
                    <button
                      key={grupo.clave}
                      type="button"
                      className={`seleccion-plantas__pill${activo ? " seleccion-plantas__pill--activa" : ""}`}
                      onClick={() => elegirGenetica(grupo.clave)}
                      disabled={pendiente}
                      aria-pressed={activo}
                    >
                      <span>{grupo.etiqueta}</span>
                      <span className="seleccion-plantas__pill-cuenta">{grupo.plantas.length}</span>
                    </button>
                  );
                })}
              </div>
            </Aparecer>

            <Aparecer visible={modo === "genetica" && gruposGenetica.length === 0}>
              <p className="seleccion-plantas__ayuda">
                No hay genéticas cargadas en esta unidad. Seleccioná plantas a mano.
              </p>
            </Aparecer>
          </Aparecer>

          <ListaEntrada>
            {plantas.map((planta) => {
              const abierta = inicioPorPlanta[planta.id];
              const datos = datosEtapaActual(planta.etapa, abierta ? [abierta] : [], hoy);
              const claseTarjeta = esEtapa(planta.etapa)
                ? `tarjeta tarjeta--planta tarjeta--${planta.etapa}`
                : "tarjeta tarjeta--planta";
              const seleccionada = ids.has(planta.id);
              const href = `/espacios/${espacioId}/unidades/${unidadId}/plantas/${planta.id}`;

              if (seleccionando) {
                return (
                  <li key={planta.id}>
                    <button
                      type="button"
                      className={`${claseTarjeta} seleccion-plantas__item${seleccionada ? " seleccion-plantas__item--activa" : ""}`}
                      onClick={() => alternarPlanta(planta.id)}
                      disabled={pendiente}
                      aria-pressed={seleccionada}
                    >
                      <span
                        className={`seleccion-plantas__marca${seleccionada ? " seleccion-plantas__marca--on" : ""}`}
                        aria-hidden="true"
                      />
                      <div className="seleccion-plantas__cuerpo">
                        <ContenidoTarjeta planta={planta} datos={datos} />
                      </div>
                    </button>
                  </li>
                );
              }

              return (
                <li key={planta.id}>
                  <Link className={claseTarjeta} href={href}>
                    <ContenidoTarjeta planta={planta} datos={datos} />
                  </Link>
                </li>
              );
            })}
          </ListaEntrada>

        </>
      )}

      {seleccionando ? (
        <div
          className={`seleccion-plantas__barra${formAbierto ? " seleccion-plantas__barra--abierta" : ""}`}
          role="region"
          aria-label="Acciones de selección"
        >
          <AnimatePresence initial={false}>
            {formAbierto ? (
              <motion.div
                key="cambio-etapa"
                className="seleccion-plantas__revelar"
                initial={reducido ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={reducido ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                exit={reducido ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={transicionVista}
              >
                <form className="seleccion-plantas__panel" onSubmit={pedirConfirmacion}>
                  {errorForm && !modalAbierto ? <p className="formulario__error">{errorForm}</p> : null}
                  <p className="seleccion-plantas__resumen">{textoSeleccion(cantidad)}</p>
                  <OpcionesEtapa nombre="etapa_ui" valor={etapa} onChange={setEtapa} />
                  <SelectorFecha
                    etiqueta="Fecha efectiva"
                    nombre="fecha_ui"
                    valor={fecha}
                    onChange={setFecha}
                  />
                  <div className="seleccion-plantas__form-acciones">
                    <Boton type="button" variante="ghost" onClick={() => setFormAbierto(false)} disabled={pendiente}>
                      Cancelar
                    </Boton>
                    <Boton type="submit" disabled={pendiente || !etapa || !fecha || cantidad === 0}>
                      Continuar
                    </Boton>
                  </div>
                </form>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <p className="seleccion-plantas__conteo">{textoSeleccion(cantidad)}</p>
          <div className="seleccion-plantas__barra-acciones">
            <Boton type="button" variante="ghost" onClick={salirSeleccion} disabled={pendiente}>
              Salir
            </Boton>
            <Boton
              type="button"
              onClick={abrirCambioEtapa}
              disabled={pendiente || cantidad === 0}
              aria-expanded={formAbierto}
            >
              Cambiar etapa
            </Boton>
          </div>
        </div>
      ) : null}

      <ModalConfirmacion
        abierto={modalAbierto}
        onCerrar={() => {
          if (!pendiente) setModalAbierto(false);
        }}
        titulo={`Vas a cambiar ${cantidad} ${cantidad === 1 ? "planta" : "plantas"} a ${etiquetaEtapa(etapa)} desde el ${formatearFecha(fecha)}.`}
        textoConfirmar="Confirmar cambio"
        pendiente={pendiente}
        error={errorForm}
        accion={accion}
      >
        <input type="hidden" name="unidad_id" value={unidadId} />
        <input type="hidden" name="espacio_id" value={espacioId} />
        <input type="hidden" name="etapa" value={etapa} />
        <input type="hidden" name="fecha_inicio" value={fecha} />
        {idsLista.map((id) => (
          <input key={id} type="hidden" name="planta_id" value={id} />
        ))}
      </ModalConfirmacion>
    </div>
  );
}
