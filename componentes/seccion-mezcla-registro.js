"use client";

import Link from "next/link";
import { useState } from "react";
import { cantidadAplicada, textoMedida, UNIDADES_COMPONENTE, UNIDADES_VOLUMEN } from "@/lib/mezclas/calculo";
import { borradorDesdeReceta, mezclaAjustada, mezclaVacia } from "@/lib/mezclas/reglas";

function nombreProducto(productos, id) {
  const producto = productos.find((item) => item.id === id);
  if (!producto) return "Producto";
  return producto.fabricante ? `${producto.nombre} · ${producto.fabricante}` : producto.nombre;
}

export function SeccionMezclaRegistro({
  visible,
  deshabilitado = false,
  disponible = false,
  productos = [],
  recetas = [],
  mezcla,
  onChange,
}) {
  const [productoNuevo, setProductoNuevo] = useState("");
  if (!visible) return null;

  const borrador = mezcla || mezclaVacia();
  const recetasVisibles = recetas.filter((item) => item.activa || item.id === borrador.recetaId);
  const productosElegibles = productos.filter(
    (item) => item.activo || borrador.componentes.some((componente) => componente.productoId === item.id)
  );
  const ajustada = borrador.incluir && mezclaAjustada(borrador);

  function elegirReceta(id) {
    if (!id) {
      onChange({ ...borrador, recetaId: "", origen: null, incluir: true });
      return;
    }
    const receta = recetas.find((item) => item.id === id);
    if (!receta) return;
    onChange(borradorDesdeReceta(receta));
  }

  function cambiarComponente(indice, parcial) {
    onChange({
      ...borrador,
      incluir: true,
      componentes: borrador.componentes.map((item, posicion) =>
        posicion === indice ? { ...item, ...parcial } : item
      ),
    });
  }

  function agregarProducto() {
    if (!productoNuevo || borrador.componentes.some((item) => item.productoId === productoNuevo)) return;
    onChange({
      ...borrador,
      incluir: true,
      componentes: [...borrador.componentes, { productoId: productoNuevo, cantidad: "", unidad: "ml/L" }],
    });
    setProductoNuevo("");
  }

  return (
    <section className="registro-crear__seccion registro-crear__mezcla" aria-labelledby="registro-mezcla-titulo">
      <div className="registro-crear__seccion-cabecera">
        <h2 className="registro-crear__etiqueta" id="registro-mezcla-titulo">
          Mezcla
        </h2>
        <span className="mezclas__accesos">
          <Link className="registro-crear__enlace" href="/registros/productos">
            Mis productos
          </Link>
          <Link className="registro-crear__enlace" href="/registros/recetas">
            Mis recetas
          </Link>
        </span>
      </div>

      {!disponible ? (
        <p className="registro-crear__ayuda">
          El catálogo se habilita al aplicar la base de mezclas. El riego se puede guardar igual, solo con la acción.
        </p>
      ) : (
        <>
          <p className="registro-crear__ayuda">
            El volumen es el total de agua de esta aplicación, no un volumen por planta.
          </p>
          {borrador.incluir ? (
            <button
              type="button"
              className="registro-crear__enlace"
              onClick={() => onChange({ ...borrador, incluir: false })}
              disabled={deshabilitado}
            >
              Usar solo la acción, sin volumen
            </button>
          ) : (
            <button
              type="button"
              className="registro-crear__enlace"
              onClick={() => onChange({ ...borrador, incluir: true })}
              disabled={deshabilitado}
            >
              Agregar volumen o receta
            </button>
          )}

          {borrador.incluir ? (
            <div className="mezclas__editor">
              <label className="registro-crear__param registro-crear__param--texto">
                <span className="registro-crear__param-etiqueta">Receta</span>
                <select
                  value={borrador.recetaId}
                  onChange={(evento) => elegirReceta(evento.target.value)}
                  disabled={deshabilitado}
                >
                  <option value="">Sin receta</option>
                  {recetasVisibles.map((receta) => (
                    <option key={receta.id} value={receta.id}>
                      {receta.nombre}
                      {receta.activa ? "" : " · archivada"}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mezclas__volumen">
                <label className="registro-crear__param">
                  <span className="registro-crear__param-etiqueta">Agua preparada</span>
                  <input
                    className="registro-crear__param-input"
                    inputMode="decimal"
                    value={borrador.volumen}
                    onChange={(evento) => onChange({ ...borrador, volumen: evento.target.value, incluir: true })}
                    disabled={deshabilitado}
                    placeholder="0"
                    autoComplete="off"
                  />
                </label>
                <label className="registro-crear__param">
                  <span className="registro-crear__param-etiqueta">Unidad</span>
                  <select
                    value={borrador.unidadVolumen}
                    onChange={(evento) =>
                      onChange({ ...borrador, unidadVolumen: evento.target.value, incluir: true })
                    }
                    disabled={deshabilitado}
                  >
                    {UNIDADES_VOLUMEN.map((unidad) => (
                      <option key={unidad} value={unidad}>
                        {unidad}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <ul className="mezclas__componentes">
                {borrador.componentes.map((componente, indice) => {
                  const aplicado = cantidadAplicada({
                    cantidad: componente.cantidad,
                    unidad: componente.unidad,
                    volumenAgua: borrador.volumen,
                    unidadVolumen: borrador.unidadVolumen,
                  });
                  const total =
                    aplicado && (componente.unidad === "ml/L" || componente.unidad === "g/L")
                      ? textoMedida(aplicado.cantidad, aplicado.unidad)
                      : "";
                  return (
                    <li key={`${componente.productoId}-${indice}`}>
                      <p>{nombreProducto(productos, componente.productoId)}</p>
                      <div className="mezclas__dosis">
                        <input
                          className="registro-crear__param-input"
                          inputMode="decimal"
                          aria-label={`Cantidad de ${nombreProducto(productos, componente.productoId)}`}
                          value={componente.cantidad}
                          onChange={(evento) => cambiarComponente(indice, { cantidad: evento.target.value })}
                          disabled={deshabilitado}
                        />
                        <select
                          aria-label={`Unidad de ${nombreProducto(productos, componente.productoId)}`}
                          value={componente.unidad}
                          onChange={(evento) => cambiarComponente(indice, { unidad: evento.target.value })}
                          disabled={deshabilitado}
                        >
                          {UNIDADES_COMPONENTE.map((unidad) => (
                            <option key={unidad} value={unidad}>
                              {unidad}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="registro-crear__enlace"
                          onClick={() =>
                            onChange({
                              ...borrador,
                              componentes: borrador.componentes.filter((_, posicion) => posicion !== indice),
                            })
                          }
                          disabled={deshabilitado}
                        >
                          Quitar
                        </button>
                      </div>
                      {total ? <p className="registro-crear__ayuda">Total preparado: {total}</p> : null}
                    </li>
                  );
                })}
              </ul>

              <div className="mezclas__agregar">
                <label className="registro-crear__param registro-crear__param--texto">
                  <span className="registro-crear__param-etiqueta">Agregar producto</span>
                  <select
                    value={productoNuevo}
                    onChange={(evento) => setProductoNuevo(evento.target.value)}
                    disabled={deshabilitado || productosElegibles.length === 0}
                  >
                    <option value="">Elegir</option>
                    {productosElegibles.map((producto) => (
                      <option key={producto.id} value={producto.id}>
                        {nombreProducto(productos, producto.id)}
                        {producto.activo ? "" : " · archivado"}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="boton boton--secundario"
                  onClick={agregarProducto}
                  disabled={deshabilitado || !productoNuevo}
                >
                  Agregar
                </button>
              </div>

              {ajustada ? <p className="mezclas__ajustada">Mezcla ajustada</p> : null}
            </div>
          ) : (
            <p className="registro-crear__ayuda">Se guarda el riego o la fertilización, sin productos ni volumen.</p>
          )}
        </>
      )}
    </section>
  );
}
