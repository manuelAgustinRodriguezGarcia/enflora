"use client";

import { useActionState, useState } from "react";
import { agregarUnidad } from "@/app/espacios/[id]/acciones";
import { crearCultivo } from "@/app/espacios/acciones";
import { SelectorMetodo } from "@/componentes/selector-metodo";
import { ETAPAS } from "@/lib/etapas";
import {
  PASOS_VISIBLES,
  abrirUnidad,
  aplicarConfirmacion,
  cambiarCantidadPlantas,
  cambiarCantidadUnidades,
  cambiarEtapaGeneral,
  cambiarGeneral,
  cambiarModo,
  cambiarModoEtapa,
  cambiarNombreEspacio,
  cambiarNombreUnidad,
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
  estadoVisibleUnidad,
  irAVisible,
  metodosEnUso,
  payloadCultivo,
  resumenUnidad,
  totalPlantas,
  visibleDe,
  volver,
} from "@/lib/asistente-cultivo";
import {
  admiteVarias,
  etiquetaTipoEspacio,
  etiquetaTipoUnidad,
  preguntaCantidadUnidades,
  textoCantidad,
  tiposDeUnidad,
} from "@/lib/unidades";

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

function Contador({ etiqueta, valor, minimo, maximo, onChange }) {
  return (
    <div className="contador">
      <span className="contador__etiqueta">{etiqueta}</span>
      <button type="button" onClick={() => onChange(valor - 1)} disabled={valor <= minimo}>
        -
      </button>
      <span className="contador__valor">{valor}</span>
      <button type="button" onClick={() => onChange(valor + 1)} disabled={valor >= maximo}>
        +
      </button>
    </div>
  );
}

function SelectorEtapa({ valor, onChange }) {
  return (
    <label className="formulario__campo">
      Etapa
      <select value={valor} onChange={(evento) => onChange(evento.target.value)}>
        <option value="">Seleccionar</option>
        {ETAPAS.map((etapa) => (
          <option key={etapa.valor} value={etapa.valor}>
            {etapa.etiqueta}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AsistenteEspacio({ metodosPersonalizados = [], espacio = null }) {
  const guardar = espacio ? agregarUnidad : crearCultivo;
  const [estado, setEstado] = useState(() => (espacio ? estadoInicialUnidad(espacio) : estadoInicial()));
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
  const tipos = tiposDeUnidad(estado.tipo).filter((tipo) => {
    if (!estado.soloUnidad || !estado.ocupadas) return true;
    if (tipo.valor === "sala" && estado.ocupadas.sala) return false;
    if (tipo.valor === "aire_libre" && estado.ocupadas.aire_libre) return false;
    return true;
  });

  function seguir() {
    setEstado((actual) => (actual.confirmacion ? aplicarConfirmacion(actual) : continuar(actual)));
  }

  return (
    <div className="asistente">
      <ol className="asistente__pasos">
        {pasos.map((paso, indice) => {
          const actual = paso.id === visible;
          const habilitado = indice <= ordenVisible && !estado.confirmacion;
          return (
            <li key={paso.id}>
              {habilitado && !actual ? (
                <button type="button" onClick={() => aplicar(irAVisible, paso.id)}>
                  {indice + 1}. {paso.etiqueta}
                </button>
              ) : (
                <span className={actual ? "asistente__paso-actual" : undefined}>
                  {indice + 1}. {paso.etiqueta}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {estado.nombre.trim() || estado.unidades.length ? (
        <aside className="asistente__resumen">
          {estado.nombre.trim() ? (
            <p>
              <span>ESPACIO:</span> {estado.nombre.trim()}
            </p>
          ) : null}
          {estado.unidades.length ? (
            <>
              <p>UNIDADES:</p>
              <ul>
                {estado.unidades.map((item, indice) => {
                  const marca = estadoVisibleUnidad(estado, indice);
                  const signo = marca === "completada" ? "✓" : marca === "configurando" ? "▾" : "○";
                  const detalle =
                    marca === "completada"
                      ? textoCantidad(item.plantas.length)
                      : marca === "configurando"
                        ? "configurando"
                        : "pendiente";
                  const contenido = (
                    <>
                      <span>
                        {signo} {item.nombre}
                      </span>
                      <span>{detalle}</span>
                    </>
                  );

                  if (item.estado === "completada" && !estado.confirmacion) {
                    return (
                      <li key={item.numero}>
                        <button type="button" onClick={() => aplicar(abrirUnidad, indice)}>
                          {contenido}
                        </button>
                      </li>
                    );
                  }

                  return <li key={item.numero}>{contenido}</li>;
                })}
              </ul>
            </>
          ) : null}
        </aside>
      ) : null}

      {estado.error ? <p className="formulario__error">{estado.error}</p> : null}
      {resultado?.error && estado.paso === "resumen" ? (
        <p className="formulario__error">{resultado.error}</p>
      ) : null}

      {unidad && estado.paso !== "espacio" && estado.paso !== "tipo_unidad" && estado.paso !== "cantidad_unidades" && estado.paso !== "resumen" ? (
        <p className="asistente__actual">CONFIGURANDO: {unidad.nombre.trim().toUpperCase() || "UNIDAD"}</p>
      ) : null}

      {estado.paso === "espacio" ? (
        <div className="bloque">
          <label className="formulario__campo">
            Nombre del espacio
            <input
              type="text"
              value={estado.nombre}
              onChange={(evento) => aplicar(cambiarNombreEspacio, evento.target.value)}
            />
          </label>
          <label className="formulario__campo">
            Tipo
            <select
              value={estado.tipo}
              onChange={(evento) => aplicar(cambiarTipoEspacio, evento.target.value)}
            >
              <option value="">Seleccionar</option>
              <option value="interior">Interior</option>
              <option value="exterior">Exterior</option>
            </select>
          </label>
        </div>
      ) : null}

      {estado.paso === "tipo_unidad" ? (
        <div className="bloque">
          <div className="eleccion">
            {tipos.map((tipo) => (
              <button
                key={tipo.valor}
                type="button"
                className={estado.tipoUnidad === tipo.valor ? "eleccion__activa" : undefined}
                aria-pressed={estado.tipoUnidad === tipo.valor}
                onClick={() => aplicar(cambiarTipoUnidad, tipo.valor)}
              >
                {tipo.etiqueta}
              </button>
            ))}
          </div>
          {estado.tipoUnidad === "otro" ? (
            <label className="formulario__campo">
              Tipo de unidad
              <input
                type="text"
                value={estado.tipoPersonalizado || ""}
                onChange={(evento) => aplicar(cambiarTipoPersonalizado, evento.target.value)}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {estado.paso === "cantidad_unidades" ? (
        <Contador
          etiqueta={preguntaCantidadUnidades(estado.tipoUnidad)}
          valor={estado.cantidadUnidades}
          minimo={1}
          maximo={20}
          onChange={(cantidad) => aplicar(cambiarCantidadUnidades, cantidad)}
        />
      ) : null}

      {unidad && (estado.paso === "cantidad_plantas" || estado.paso === "configuracion" || estado.paso === "etapa" || estado.paso === "cierre_unidad") ? (
        <label className="formulario__campo">
          Nombre
          <input
            type="text"
            value={unidad.nombre}
            onChange={(evento) => aplicar(cambiarNombreUnidad, evento.target.value)}
          />
        </label>
      ) : null}

      {unidad && estado.paso === "cantidad_plantas" ? (
        <Contador
          etiqueta={`¿Cuántas plantas habrá en ${unidad.nombre.trim() || "esta unidad"}?`}
          valor={estado.cantidadPlantas}
          minimo={1}
          maximo={100}
          onChange={(cantidad) => aplicar(cambiarCantidadPlantas, cantidad)}
        />
      ) : null}

      {unidad && estado.paso === "configuracion" ? (
        <div className="bloque">
          <p className="asistente__actual">
            {unidad.nombre} — {textoCantidad(unidad.plantas.length)}
          </p>
          <div className="eleccion eleccion--modos">
            {MODOS.map((modo) => (
              <button
                key={modo.valor}
                type="button"
                className={unidad.modo === modo.valor ? "eleccion__activa" : undefined}
                aria-pressed={unidad.modo === modo.valor}
                onClick={() => aplicar(cambiarModo, modo.valor)}
              >
                {modo.etiqueta}
              </button>
            ))}
          </div>
          <p className="eleccion__nota">
            {MODOS.find((modo) => modo.valor === unidad.modo)?.descripcion}
          </p>
          {usaGenetica(unidad.modo) ? (
            <label className="formulario__campo">
              Genética
              <input
                type="text"
                value={unidad.general.genetica}
                onChange={(evento) => aplicar(cambiarGeneral, "genetica", evento.target.value)}
              />
            </label>
          ) : null}
          {usaMetodo(unidad.modo) ? (
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
          ) : null}
          {unidad.plantas.map((planta, indice) => (
            <div
              className="bloque asistente__planta"
              key={`${unidad.numero}-${indice}`}
              style={{ borderLeftColor: colorPlanta(planta, unidad.modo) }}
            >
              <h3>Planta {indice + 1}</h3>
              <label className="formulario__campo">
                Genética
                <input
                  type="text"
                  value={planta.genetica}
                  onChange={(evento) =>
                    aplicar(cambiarPlanta, indice, "genetica", evento.target.value)
                  }
                />
              </label>
              <SelectorMetodo
                metodosPersonalizados={metodos}
                valor={planta.metodo}
                nombreOtro={planta.metodoNombre}
                sustrato={planta.sustrato}
                usaSustrato={planta.usaSustrato}
                onChange={(valor) => aplicar(cambiarPlanta, indice, "metodo", valor)}
                onChangeNombre={(valor) => aplicar(cambiarPlanta, indice, "metodoNombre", valor)}
                onChangeSustrato={(valor) => aplicar(cambiarPlanta, indice, "sustrato", valor)}
                onChangeUsaSustrato={(valor) => aplicar(cambiarPlanta, indice, "usaSustrato", valor)}
              />
            </div>
          ))}
        </div>
      ) : null}

      {unidad && estado.paso === "etapa" ? (
        <div className="bloque">
          <fieldset className="opciones">
            <legend>Etapa inicial</legend>
            <label>
              <input
                type="radio"
                checked={unidad.modoEtapa === "misma"}
                onChange={() => aplicar(cambiarModoEtapa, "misma")}
              />
              Misma etapa para todas
            </label>
            <label>
              <input
                type="radio"
                checked={unidad.modoEtapa === "individual"}
                onChange={() => aplicar(cambiarModoEtapa, "individual")}
              />
              Personalizar por planta
            </label>
          </fieldset>
          {unidad.modoEtapa === "misma" ? (
            <SelectorEtapa
              valor={unidad.etapaGeneral}
              onChange={(valor) => aplicar(cambiarEtapaGeneral, valor)}
            />
          ) : (
            unidad.plantas.map((planta, indice) => (
              <div className="bloque" key={`${unidad.numero}-etapa-${indice}`}>
                <h3>Planta {indice + 1}</h3>
                <SelectorEtapa
                  valor={planta.etapa}
                  onChange={(valor) => aplicar(cambiarPlanta, indice, "etapa", valor)}
                />
              </div>
            ))
          )}
        </div>
      ) : null}

      {unidad && estado.paso === "cierre_unidad" ? (
        <div className="bloque">
          <CierreUnidad unidad={unidad} />
          {estado.indice === 0 && admiteVarias(unidad.tipo) && estado.unidades.length > 1 ? (
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
              {estado.replicar
                ? estado.unidades.slice(1).map((item, desplazamiento) => {
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
                  })
                : null}
              {estado.replicar ? (
                <label>
                  <input
                    type="checkbox"
                    checked={
                      estado.unidades.length > 1 &&
                      estado.replicarIndices.length === estado.unidades.length - 1
                    }
                    onChange={(evento) => aplicar(cambiarTodasSiguientes, evento.target.checked)}
                  />
                  Todas las siguientes
                </label>
              ) : null}
            </fieldset>
          ) : null}
        </div>
      ) : null}

      {estado.paso === "resumen" ? (
        <form className="bloque" action={accion}>
          <h2>{estado.nombre.trim()}</h2>
          <p>{etiquetaTipoEspacio(estado.tipo)}</p>
          <ul className="lista">
            {estado.unidades.map((item) => (
              <li key={item.numero}>
                <span className="tarjeta__nombre">{item.nombre}</span>
                <span className="tarjeta__meta">{textoCantidad(item.plantas.length)}</span>
              </li>
            ))}
          </ul>
          <p>Total: {textoCantidad(totalPlantas(estado.unidades))}</p>
          <input type="hidden" name="cultivo" value={JSON.stringify(payloadCultivo(estado))} />
          {estado.soloUnidad ? <input type="hidden" name="espacio_id" value={estado.espacioId} /> : null}
          <button type="submit" disabled={pendiente}>
            {estado.soloUnidad ? "Crear unidad" : "Crear espacio"}
          </button>
        </form>
      ) : null}

      {estado.confirmacion ? (
        <div className="confirmacion">
          <p>{estado.confirmacion.mensaje}</p>
          <div className="confirmacion__acciones">
            <button type="button" onClick={seguir}>
              Continuar
            </button>
            <button
              className="acciones__texto"
              type="button"
              onClick={() => aplicar(cancelarConfirmacion)}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : estado.paso !== "resumen" ? (
        <div className="asistente__nav">
          {puedeVolver ? (
            <button type="button" onClick={() => aplicar(volver)}>
              Volver
            </button>
          ) : null}
          <button type="button" onClick={seguir}>
            Continuar
          </button>
        </div>
      ) : (
        <div className="asistente__nav">
          <button type="button" onClick={() => aplicar(volver)} disabled={pendiente}>
            Volver
          </button>
        </div>
      )}
    </div>
  );
}

function CierreUnidad({ unidad }) {
  const resumen = resumenUnidad(unidad);
  return (
    <>
      <h2>{unidad.nombre}</h2>
      <p>{textoCantidad(resumen.plantas)}</p>
      <p>Genética: {resumen.genetica}</p>
      <p>Método: {resumen.metodo}</p>
      <p>Etapa: {resumen.etapa}</p>
      <p>{etiquetaTipoUnidad(unidad.tipo, unidad.tipoPersonalizado)}</p>
    </>
  );
}
