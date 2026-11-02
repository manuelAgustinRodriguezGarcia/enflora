"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info, Pencil } from "lucide-react";
import { agregarUnidad } from "@/app/espacios/[id]/acciones";
import { crearCultivo } from "@/app/espacios/acciones";
import { Aparecer, TextoCambio } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { ContadorCantidad } from "@/componentes/contador-cantidad";
import { IconoCaja, IconoCajas } from "@/componentes/iconos-ui";
import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { PlantaAccordion } from "@/componentes/planta-accordion";
import { PillPlantas, ResumenConfiguracion } from "@/componentes/resumen-configuracion";
import { Selector } from "@/componentes/selector";
import { SelectorEtapa } from "@/componentes/selector-etapa";
import { SelectorFecha } from "@/componentes/selector-fecha";
import { SelectorMetodo } from "@/componentes/selector-metodo";
import { SelectorGenetica } from "@/componentes/selector-genetica";
import {
  PASOS_VISIBLES,
  abrirUnidad,
  aplicarConfirmacion,
  cambiarCantidadPlantas,
  cambiarCantidadUnidades,
  cambiarEtapaGeneral,
  cambiarFechaEtapaGeneral,
  cambiarGeneral,
  cambiarModo,
  cambiarModoEtapa,
  cambiarNombreEspacio,
  cambiarNombreUnidad,
  cambiarNombreUnidadPorIndice,
  cambiarPlanta,
  cambiarReplicar,
  cambiarReplicarIndice,
  cambiarTipoEspacio,
  cambiarTipoPersonalizado,
  cambiarTipoUnidad,
  cambiarTodasSiguientes,
  cancelarConfirmacion,
  colorPlanta,
  continuar,
  estadoInicial,
  estadoInicialUnidad,
  irAVisible,
  metodosEnUso,
  payloadCultivo,
  resumenUnidad,
  totalPlantas,
  visibleDe,
  volver,
} from "@/lib/asistente-cultivo";
import {
  MAXIMO_UNIDADES,
  etiquetaTipoUnidad,
  preguntaCantidadUnidades,
  textoCantidad,
  TEXTO_AYUDA_CANTIDAD_UNIDADES,
  tiposDeUnidad,
} from "@/lib/unidades";
import { toque, transicionRapida, transicionToque, variantesPaso } from "@/lib/animaciones";

const TIPOS_ESPACIO = [
  { valor: "interior", etiqueta: "Interior" },
  { valor: "exterior", etiqueta: "Exterior" },
];

const MODOS = [
  {
    valor: "misma_genetica",
    etiqueta: "Misma genética",
    descripcion:
      "Todas las plantas tendrán inicialmente la misma genética. Podés modificar plantas individuales después.",
  },
  {
    valor: "mismo_metodo",
    etiqueta: "Mismo método",
    descripcion:
      "Todas las plantas utilizarán inicialmente el mismo método de cultivo. Podés modificar plantas individuales después.",
  },
  {
    valor: "misma_genetica_y_metodo",
    etiqueta: "Misma genética y método",
    descripcion:
      "Todas las plantas tendrán inicialmente la misma genética y utilizarán el mismo método de cultivo. Podés modificar plantas individuales después.",
  },
  {
    valor: "diferente",
    etiqueta: "Diferente genética y método",
    descripcion: "Cada planta podrá tener su propia genética y método de cultivo.",
  },
];

function usaGenetica(modo) {
  return modo === "misma_genetica" || modo === "misma_genetica_y_metodo";
}

function usaMetodo(modo) {
  return modo === "mismo_metodo" || modo === "misma_genetica_y_metodo";
}

function tituloPlanta(planta, indice) {
  const genetica = String(planta.genetica || "").trim();
  const numero = indice + 1;
  if (!genetica) return `Planta ${numero}`;
  return `${genetica} #${numero}`;
}

const variantesPasoCarrusel = {
  entrar: (direccion) => ({ opacity: 0, x: direccion >= 0 ? 28 : -28 }),
  centro: { opacity: 1, x: 0, transition: transicionRapida },
  salir: (direccion) => ({
    opacity: 0,
    x: direccion >= 0 ? -28 : 28,
    transition: { duration: 0.14, ease: transicionRapida.ease },
  }),
};

function PasoAdjunto({ paso, lado, onClick }) {
  const clases = ["asistente__paso-adjunto", `asistente__paso-adjunto--${lado}`].join(" ");
  if (onClick) {
    return (
      <button type="button" className={clases} onClick={onClick}>
        {paso.etiqueta}
      </button>
    );
  }
  return <span className={clases}>{paso.etiqueta}</span>;
}

function PasosAsistente({ pasos, indiceActual, ordenVisible, confirmacion, onIrAPaso, sentido }) {
  const pasoAnterior = indiceActual > 0 ? pasos[indiceActual - 1] : null;
  const pasoActual = pasos[indiceActual];
  const pasoSiguiente = indiceActual < pasos.length - 1 ? pasos[indiceActual + 1] : null;
  const puedeIrAnterior =
    pasoAnterior && indiceActual - 1 <= ordenVisible && !confirmacion;

  if (!pasoActual) return null;

  return (
    <nav className="asistente__pasos" aria-label="Progreso del asistente">
      <div className="asistente__pasos-col asistente__pasos-col--prev">
        {pasoAnterior ? (
          <PasoAdjunto
            paso={pasoAnterior}
            lado="prev"
            onClick={puedeIrAnterior ? () => onIrAPaso(pasoAnterior.id) : undefined}
          />
        ) : null}
      </div>
      <div className="asistente__pasos-col asistente__pasos-col--centro">
        <div className="asistente__paso-carrusel" aria-current="step">
          <AnimatePresence mode="wait" initial={false} custom={sentido}>
            <motion.span
              key={pasoActual.id}
              custom={sentido}
              className="asistente__paso-carrusel__texto"
              variants={variantesPasoCarrusel}
              initial="entrar"
              animate="centro"
              exit="salir"
            >
              {pasoActual.etiqueta}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
      <div className="asistente__pasos-col asistente__pasos-col--sig">
        {pasoSiguiente ? <PasoAdjunto paso={pasoSiguiente} lado="sig" /> : null}
      </div>
    </nav>
  );
}

function detalleEtapa(planta) {
  if (!planta.etapa) return null;
  return <IndicadorEtapa etapa={planta.etapa} tamano="compacto" />;
}

export function AsistenteEspacio({ metodosPersonalizados = [], espacio = null }) {
  const guardar = espacio ? agregarUnidad : crearCultivo;
  const [estado, setEstado] = useState(() => (espacio ? estadoInicialUnidad(espacio) : estadoInicial()));
  const [sentido, setSentido] = useState(1);
  const [abierta, setAbierta] = useState(0);
  const [infoUnidadesAbierto, setInfoUnidadesAbierto] = useState(false);
  const [resultado, accion, pendiente] = useActionState(guardar, null);

  function aplicar(funcion, ...args) {
    setEstado((actual) => funcion(actual, ...args));
  }
  const unidad = estado.unidades[estado.indice];
  const visible = visibleDe(estado.paso);
  const metodos = metodosEnUso(estado.unidades, metodosPersonalizados);
  const pasos = estado.soloUnidad ? PASOS_VISIBLES.filter((paso) => paso.id !== "espacio") : PASOS_VISIBLES;
  const ordenVisible = pasos.findIndex((paso) => paso.id === visible);
  const puedeVolver = estado.paso !== "espacio" && !(estado.soloUnidad && estado.paso === "tipo_unidad");
  const tipos = tiposDeUnidad(estado.tipo);
  const maximoUnidadesNueva =
    estado.soloUnidad && estado.ocupadas
      ? Math.max(1, MAXIMO_UNIDADES - (estado.ocupadas.total || 0))
      : MAXIMO_UNIDADES;
  const unidadesCantidad =
    estado.paso === "cantidad_unidades"
      ? estado.unidades.slice(0, estado.cantidadUnidades)
      : [];

  function seguir() {
    setSentido(1);
    setEstado((actual) => (actual.confirmacion ? aplicarConfirmacion(actual) : continuar(actual)));
  }

  function retroceder(funcion, ...args) {
    setSentido(-1);
    aplicar(funcion, ...args);
  }

  function alternarPlanta(indice) {
    setAbierta((actual) => (actual === indice ? null : indice));
  }

  const gruposResumen = [];
  if (estado.nombre.trim()) {
    gruposResumen.push({
      id: "espacio",
      titulo: "Espacio",
      presentacion: "espacio",
      nombre: estado.nombre.trim(),
      tipoEspacio: estado.tipo,
    });
  }
  if (estado.unidades.length) {
    const itemsUnidades = estado.unidades.map((item, indice) => {
      const enCantidad =
        estado.paso === "cantidad_plantas" && indice === estado.indice;
      const cantidadPlantas = enCantidad ? estado.cantidadPlantas : item.plantas.length;
      return {
        id: item.numero,
        titulo: item.nombre,
        cantidadPlantas,
        onClick:
          item.estado === "completada" && !estado.confirmacion
            ? () => retroceder(abrirUnidad, indice)
            : undefined,
      };
    });

    const mostrarListaUnidades =
      estado.paso !== "tipo_unidad" &&
      estado.paso !== "cantidad_unidades" &&
      (estado.unidades.length > 1 || itemsUnidades.some((item) => item.onClick));

    if (mostrarListaUnidades) {
      gruposResumen.push({
        id: "unidades",
        titulo: estado.unidades.length === 1 ? "Unidad" : "Unidades",
        items: itemsUnidades,
      });
    }
  }

  return (
    <div className="asistente">
      <PasosAsistente
        pasos={pasos}
        indiceActual={ordenVisible}
        ordenVisible={ordenVisible}
        confirmacion={estado.confirmacion}
        sentido={sentido}
        onIrAPaso={(id) => retroceder(irAVisible, id)}
      />

      {gruposResumen.length ? <ResumenConfiguracion grupos={gruposResumen} /> : null}

      {estado.paso === "cantidad_unidades" ? (
        <button
          type="button"
          className="asistente__info-unidades"
          onClick={() => setInfoUnidadesAbierto(true)}
        >
          <Info size={18} strokeWidth={1.9} aria-hidden="true" />
          ¿Qué es una unidad de cultivo?
        </button>
      ) : null}

      <Aparecer visible={Boolean(estado.error)}>
        <p className="formulario__error">{estado.error}</p>
      </Aparecer>
      <Aparecer visible={Boolean(resultado?.error) && estado.paso === "resumen"}>
        <p className="formulario__error">{resultado?.error}</p>
      </Aparecer>

      <AnimatePresence mode="wait" initial={false} custom={sentido}>
        <motion.div
          key={estado.paso}
          custom={sentido}
          variants={variantesPaso}
          initial="entrar"
          animate="centro"
          exit="salir"
        >
          {estado.paso === "espacio" ? (
            <div className="asistente__campos">
              <label className="formulario__campo">
                Nombre del espacio
                <input
                  type="text"
                  value={estado.nombre}
                  placeholder="Cuartito del fondo"
                  onChange={(evento) => aplicar(cambiarNombreEspacio, evento.target.value)}
                />
              </label>
              <Selector
                etiqueta="Tipo"
                valor={estado.tipo || null}
                onChange={(valor) => aplicar(cambiarTipoEspacio, valor)}
                opciones={TIPOS_ESPACIO}
                placeholder="Seleccionar"
              />
            </div>
          ) : null}

          {estado.paso === "tipo_unidad" ? (
            <>
              <div className="asistente__tipo-unidad">
                <p className="asistente__pregunta">
                  {estado.tipo === "exterior"
                    ? "¿Cómo cultivás en exterior?"
                    : "¿Cómo cultivás en interior?"}
                </p>
                <div className="eleccion">
                  {tipos.map((tipo) => (
                    <motion.button
                      key={tipo.valor}
                      type="button"
                      className={estado.tipoUnidad === tipo.valor ? "eleccion__activa" : undefined}
                      aria-pressed={estado.tipoUnidad === tipo.valor}
                      whileTap={toque}
                      transition={transicionToque}
                      onClick={() => aplicar(cambiarTipoUnidad, tipo.valor)}
                    >
                      {tipo.etiqueta}
                    </motion.button>
                  ))}
                </div>
                <Aparecer visible={estado.tipoUnidad === "otro"}>
                  <label className="formulario__campo">
                    {estado.tipo !== "exterior" ? "Tipo de unidad" : null}
                    <input
                      type="text"
                      value={estado.tipoPersonalizado || ""}
                      placeholder={
                        estado.tipo === "exterior" ? "Nombre de tu método" : undefined
                      }
                      aria-label={
                        estado.tipo === "exterior" ? "Nombre del método" : "Tipo de unidad"
                      }
                      onChange={(evento) => aplicar(cambiarTipoPersonalizado, evento.target.value)}
                    />
                  </label>
                </Aparecer>
              </div>
            </>
          ) : null}

          {estado.paso === "cantidad_unidades" ? (
            <div className="asistente__cantidad-unidades">
              <ContadorCantidad
                valor={estado.cantidadUnidades}
                minimo={1}
                maximo={maximoUnidadesNueva}
                contexto={preguntaCantidadUnidades(estado.tipoUnidad)}
                ariaLabel="Cantidad de unidades"
                icono={estado.cantidadUnidades > 1 ? IconoCajas : IconoCaja}
                onChange={(cantidad) => aplicar(cambiarCantidadUnidades, cantidad)}
              />
              <ListaNombresUnidades
                unidades={unidadesCantidad}
                onCambiarNombre={(indice, nombre) => aplicar(cambiarNombreUnidadPorIndice, indice, nombre)}
              />
            </div>
          ) : null}

          {unidad && estado.paso === "cantidad_plantas" ? (
            <ContadorCantidad
              valor={estado.cantidadPlantas}
              minimo={1}
              maximo={100}
              contexto={`¿Cuántas plantas habrá en ${unidad.nombre.trim() || "esta unidad"}?`}
              ariaLabel="Cantidad de plantas"
              onChange={(cantidad) => aplicar(cambiarCantidadPlantas, cantidad)}
            />
          ) : null}

          {unidad && estado.paso === "configuracion" ? (
            <div className="bloque bloque--plano">
              <div className="asistente__unidad">
                <p className="asistente__actual">{unidad.nombre.trim() || "Unidad"}</p>
                <PillPlantas cantidad={unidad.plantas.length} />
              </div>
              <div className="eleccion eleccion--modos">
                {MODOS.map((modo) => (
                  <motion.button
                    key={modo.valor}
                    type="button"
                    className={unidad.modo === modo.valor ? "eleccion__activa" : undefined}
                    aria-pressed={unidad.modo === modo.valor}
                    whileTap={toque}
                    transition={transicionToque}
                    onClick={() => aplicar(cambiarModo, modo.valor)}
                  >
                    {modo.etiqueta}
                  </motion.button>
                ))}
              </div>
              <p className="eleccion__nota">
                <TextoCambio>{MODOS.find((modo) => modo.valor === unidad.modo)?.descripcion}</TextoCambio>
              </p>
              <Aparecer visible={usaGenetica(unidad.modo)}>
                <SelectorGenetica
                  id={`genetica-general-${unidad.numero}`}
                  nombre={unidad.general.genetica}
                  detalle={unidad.general.geneticaDetalle}
                  onChange={(seleccion) => aplicar(cambiarGeneral, "genetica", seleccion)}
                />
              </Aparecer>
              <Aparecer visible={usaMetodo(unidad.modo)}>
                <SelectorMetodo
                  metodosPersonalizados={metodos}
                  valor={unidad.general.metodo}
                  nombreOtro={unidad.general.metodoNombre}
                  sustrato={unidad.general.sustrato}
                  usaSustrato={unidad.general.usaSustrato}
                  onChange={(valor) => aplicar(cambiarGeneral, "metodo", valor)}
                  onChangeNombre={(valor) => aplicar(cambiarGeneral, "metodoNombre", valor)}
                  onChangeSustrato={(valor) => aplicar(cambiarGeneral, "sustrato", valor)}
                  onChangeUsaSustrato={(valor) => aplicar(cambiarGeneral, "usaSustrato", valor)}
                />
              </Aparecer>
              <div className="asistente__plantas">
                {unidad.plantas.map((planta, indice) => (
                  <PlantaAccordion
                    key={`${unidad.numero}-${indice}`}
                    className="asistente__planta"
                    style={{ borderLeftColor: colorPlanta(planta, unidad.modo) }}
                    titulo={tituloPlanta(planta, indice)}
                    detalle={detalleEtapa(planta)}
                    abierto={abierta === indice}
                    onToggle={() => alternarPlanta(indice)}
                  >
                    <SelectorGenetica
                      id={`genetica-planta-${unidad.numero}-${indice}`}
                      nombre={planta.genetica}
                      detalle={planta.geneticaDetalle}
                      onChange={(seleccion) => aplicar(cambiarPlanta, indice, "genetica", seleccion)}
                    />
                    <SelectorMetodo
                      metodosPersonalizados={metodos}
                      valor={planta.metodo}
                      nombreOtro={planta.metodoNombre}
                      sustrato={planta.sustrato}
                      usaSustrato={planta.usaSustrato}
                      onChange={(valor) => aplicar(cambiarPlanta, indice, "metodo", valor)}
                      onChangeNombre={(valor) =>
                        aplicar(cambiarPlanta, indice, "metodoNombre", valor)
                      }
                      onChangeSustrato={(valor) =>
                        aplicar(cambiarPlanta, indice, "sustrato", valor)
                      }
                      onChangeUsaSustrato={(valor) =>
                        aplicar(cambiarPlanta, indice, "usaSustrato", valor)
                      }
                    />
                  </PlantaAccordion>
                ))}
              </div>
            </div>
          ) : null}

          {unidad && estado.paso === "etapa" ? (
            <div className="bloque">
              <fieldset className="opciones">
                <legend>Etapa inicial</legend>
                <p className="opciones__texto">
                  Todas las plantas empiezan desde la misma etapa o hay diferentes etapas.
                </p>
                <div className="eleccion eleccion--par" role="group" aria-label="Etapa inicial">
                  <button
                    type="button"
                    className={unidad.modoEtapa === "misma" ? "eleccion__activa" : undefined}
                    aria-pressed={unidad.modoEtapa === "misma"}
                    onClick={() => aplicar(cambiarModoEtapa, "misma")}
                  >
                    Misma etapa
                  </button>
                  <button
                    type="button"
                    className={unidad.modoEtapa === "individual" ? "eleccion__activa" : undefined}
                    aria-pressed={unidad.modoEtapa === "individual"}
                    onClick={() => aplicar(cambiarModoEtapa, "individual")}
                  >
                    Etapas diferentes
                  </button>
                </div>
              </fieldset>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={unidad.modoEtapa}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={transicionRapida}
                >
                  {unidad.modoEtapa === "misma" ? (
                    <>
                      <SelectorEtapa
                        nombre={`etapa-unidad-${unidad.numero}`}
                        valor={unidad.etapaGeneral}
                        onChange={(valor) => aplicar(cambiarEtapaGeneral, valor)}
                      />
                      <SelectorFecha
                        etiqueta="Inicio de la etapa"
                        valor={unidad.fechaEtapaGeneral}
                        onChange={(valor) => aplicar(cambiarFechaEtapaGeneral, valor)}
                      />
                    </>
                  ) : (
                    <div className="asistente__plantas">
                      {unidad.plantas.map((planta, indice) => (
                        <PlantaAccordion
                          key={`${unidad.numero}-etapa-${indice}`}
                          titulo={tituloPlanta(planta, indice)}
                          detalle={<IndicadorEtapa etapa={planta.etapa} tamano="compacto" />}
                          abierto={abierta === indice}
                          onToggle={() => alternarPlanta(indice)}
                        >
                          <SelectorEtapa
                            nombre={`etapa-unidad-${unidad.numero}-planta-${indice}`}
                            valor={planta.etapa}
                            onChange={(valor) => aplicar(cambiarPlanta, indice, "etapa", valor)}
                          />
                          <SelectorFecha
                            etiqueta="Inicio de la etapa"
                            valor={planta.fechaInicioEtapa}
                            onChange={(valor) =>
                              aplicar(cambiarPlanta, indice, "fechaInicioEtapa", valor)
                            }
                          />
                        </PlantaAccordion>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          ) : null}

          {unidad && estado.paso === "cierre_unidad" ? (
            <div className="bloque">
              <CierreUnidad unidad={unidad} />
              {estado.indice === 0 && estado.unidades.length > 1 ? (
                <fieldset className="opciones">
                  <legend>Replicar</legend>
                  <label>
                    <input
                      type="checkbox"
                      checked={estado.replicar}
                      onChange={(evento) => aplicar(cambiarReplicar, evento.target.checked)}
                    />
                    Replicar configuración de {unidad.nombre}
                  </label>
                  <Aparecer visible={estado.replicar}>
                    <div>
                      {estado.unidades.slice(1).map((item, desplazamiento) => {
                        const indice = desplazamiento + 1;
                        return (
                          <label key={item.numero}>
                            <input
                              type="checkbox"
                              checked={estado.replicarIndices.includes(indice)}
                              onChange={(evento) =>
                                aplicar(cambiarReplicarIndice, indice, evento.target.checked)
                              }
                            />
                            {item.nombre}
                          </label>
                        );
                      })}
                      <label>
                        <input
                          type="checkbox"
                          checked={
                            estado.unidades.length > 1 &&
                            estado.replicarIndices.length === estado.unidades.length - 1
                          }
                          onChange={(evento) =>
                            aplicar(cambiarTodasSiguientes, evento.target.checked)
                          }
                        />
                        Todas las siguientes
                      </label>
                    </div>
                  </Aparecer>
                </fieldset>
              ) : null}
            </div>
          ) : null}

          {estado.paso === "resumen" ? (
            <form className="bloque asistente__final" action={accion}>
              <ResumenConfiguracion
                titulo={estado.nombre.trim() || "Resumen"}
                grupos={[
                  {
                    id: "tipo",
                    titulo: "Espacio",
                    presentacion: "espacio",
                    nombre: estado.nombre.trim(),
                    tipoEspacio: estado.tipo,
                  },
                  {
                    id: "unidades-final",
                    titulo: estado.unidades.length === 1 ? "Unidad" : "Unidades",
                    items: estado.unidades.map((item) => ({
                      id: item.numero,
                      titulo: item.nombre,
                      cantidadPlantas: item.plantas.length,
                    })),
                  },
                  {
                    id: "total",
                    titulo: "Total",
                    valor: textoCantidad(totalPlantas(estado.unidades)),
                  },
                ]}
              />
              <input type="hidden" name="cultivo" value={JSON.stringify(payloadCultivo(estado))} />
              {estado.soloUnidad ? (
                <input type="hidden" name="espacio_id" value={estado.espacioId} />
              ) : null}
              <Boton className="boton boton--cta" type="submit" disabled={pendiente}>
                {estado.soloUnidad ? "Crear unidad" : "Crear espacio"}
              </Boton>
            </form>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <ModalConfirmacion
        abierto={Boolean(estado.confirmacion)}
        onCerrar={() => aplicar(cancelarConfirmacion)}
        titulo="Confirmar"
        descripcion={estado.confirmacion?.mensaje || ""}
        textoConfirmar="Continuar"
        onConfirmar={seguir}
      />

      <ModalConfirmacion
        abierto={infoUnidadesAbierto}
        onCerrar={() => setInfoUnidadesAbierto(false)}
        titulo="¿Qué son las unidades de cultivo?"
        descripcion={TEXTO_AYUDA_CANTIDAD_UNIDADES}
        textoConfirmar="Entendido"
        mostrarCancelar={false}
        onConfirmar={() => setInfoUnidadesAbierto(false)}
      />

      {estado.paso !== "resumen" ? (
        <div className="asistente__nav">
          {puedeVolver ? (
            <Boton type="button" variante="ghost" onClick={() => retroceder(volver)}>
              Volver
            </Boton>
          ) : (
            <span />
          )}
          <Boton type="button" onClick={seguir}>
            Continuar
          </Boton>
        </div>
      ) : (
        <div className="asistente__nav">
          <Boton type="button" variante="ghost" onClick={() => retroceder(volver)} disabled={pendiente}>
            Volver
          </Boton>
        </div>
      )}
    </div>
  );
}

function ListaNombresUnidades({ unidades, onCambiarNombre }) {
  const [editando, setEditando] = useState(null);

  if (!unidades.length) return null;

  return (
    <ul className="asistente__lista-unidades" aria-label="Nombres de las unidades">
      {unidades.map((unidad, indice) => {
        const activo = editando === indice;
        return (
          <li key={unidad.numero ?? indice} className="asistente__lista-unidades-item">
            {activo ? (
              <input
                type="text"
                className="asistente__lista-unidades-input"
                value={unidad.nombre}
                aria-label={`Nombre de ${unidad.nombre || `unidad ${indice + 1}`}`}
                autoFocus
                onChange={(evento) => onCambiarNombre(indice, evento.target.value)}
                onBlur={() => setEditando(null)}
                onKeyDown={(evento) => {
                  if (evento.key === "Enter") {
                    evento.preventDefault();
                    setEditando(null);
                  }
                  if (evento.key === "Escape") setEditando(null);
                }}
              />
            ) : (
              <span className="asistente__lista-unidades-nombre">{unidad.nombre}</span>
            )}
            <button
              type="button"
              className="asistente__lista-unidades-editar"
              aria-label={`Editar nombre de ${unidad.nombre || `unidad ${indice + 1}`}`}
              onClick={() => setEditando(indice)}
            >
              <Pencil size={16} strokeWidth={1.9} aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CierreUnidad({ unidad }) {
  const resumen = resumenUnidad(unidad);
  return (
    <ResumenConfiguracion
      titulo={unidad.nombre}
      grupos={[
        {
          id: "meta",
          titulo: "Unidad",
          valor: `${etiquetaTipoUnidad(unidad.tipo, unidad.tipoPersonalizado)} · ${textoCantidad(resumen.plantas)}`,
        },
        { id: "genetica", titulo: "Genética", valor: resumen.genetica },
        { id: "metodo", titulo: "Método", valor: resumen.metodo },
        { id: "etapa", titulo: "Etapa", valor: resumen.etapa },
      ]}
    />
  );
}
