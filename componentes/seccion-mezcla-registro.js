"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PackageOpen } from "lucide-react";
import { Selector } from "@/componentes/selector";
import { FilaDosisProducto } from "@/componentes/mezclas/fila-dosis-producto";
import { UNIDADES_VOLUMEN, cantidadAplicada, esUnidadPorLitro, textoMedida } from "@/lib/mezclas/calculo";
import {
  aplicarRecetaEnBorrador,
  componentesDeReceta,
  componentesExtra,
  mezclaAjustada,
  mezclaVacia,
} from "@/lib/mezclas/reglas";

function nombreProducto(productos, id) {
  const producto = productos.find((item) => item.id === id);
  if (!producto) return "Producto";
  const marca = producto.fabricante ? ` · ${producto.fabricante}` : "";
  const archivo = producto.activo ? "" : " · archivado";
  return `${producto.nombre}${marca}${archivo}`;
}

const SIN_MEZCLA = "__sin_mezcla__";

function filaVacia() {
  return { productoId: "", cantidad: "", unidad: "ml/L" };
}

function totalPreparado(componente, borrador) {
  const aplicado = cantidadAplicada({
    cantidad: componente.cantidad,
    unidad: componente.unidad,
    volumenAgua: borrador.volumen,
    unidadVolumen: borrador.unidadVolumen,
  });
  if (!aplicado || !esUnidadPorLitro(componente.unidad) || aplicado.unidad === componente.unidad) return "";
  return textoMedida(aplicado.cantidad, aplicado.unidad);
}

function muestraVolumen(borrador, filas) {
  if (borrador.recetaId) return true;
  if (String(borrador.volumen ?? "").trim() !== "") return true;
  return filas.some(
    (item) => esUnidadPorLitro(item.unidad) && (item.productoId || String(item.cantidad ?? "").trim() !== "")
  );
}

function conInclusion(borrador) {
  const tieneProductos = (borrador.componentes || []).length > 0;
  const tieneVolumen = String(borrador.volumen || "").trim() !== "";
  return {
    ...borrador,
    incluir: Boolean(borrador.recetaId) || tieneProductos || tieneVolumen,
  };
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
  const [aviso, setAviso] = useState("");
  const anclaMezcla = useRef(null);
  if (!visible) return null;

  const borrador = mezcla || mezclaVacia();
  const recetasVisibles = recetas.filter((item) => item.activa || item.id === borrador.recetaId);
  const deReceta = componentesDeReceta(borrador);
  const extras = componentesExtra(borrador);
  const idsReceta = new Set(deReceta.map((item) => item.productoId).filter(Boolean));
  const filas = [...deReceta, ...extras];
  const soloVolumen = !borrador.recetaId && filas.length === 0 && String(borrador.volumen || "").trim();
  const verVolumen = muestraVolumen(borrador, filas);
  const dosisDistinta = Boolean(borrador.recetaId) && mezclaAjustada({ ...borrador, componentes: deReceta });

  function publicar(siguiente, mensaje = "") {
    setAviso(mensaje);
    onChange(conInclusion(siguiente));
  }

  function elegirReceta(id) {
    const receta = id ? recetas.find((item) => item.id === id) : null;
    if (id && !receta) return;
    const aplicado = aplicarRecetaEnBorrador(borrador, receta || null);
    publicar(aplicado.borrador, aplicado.aviso);
  }

  function cambiarExtra(indice, parcial) {
    const ocupados = new Set([
      ...idsReceta,
      ...extras.flatMap((item, posicion) => (posicion === indice || !item.productoId ? [] : [item.productoId])),
    ]);
    if (parcial.productoId && ocupados.has(parcial.productoId)) {
      setAviso("Ese producto ya está en la mezcla.");
      return;
    }
    const siguientes = extras.map((item, posicion) => (posicion === indice ? { ...item, ...parcial } : item));
    publicar({ ...borrador, componentes: [...deReceta, ...siguientes] });
  }

  function quitarExtra(indice) {
    const siguientes = extras.filter((_, posicion) => posicion !== indice);
    publicar({ ...borrador, componentes: [...deReceta, ...siguientes] });
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
          <Link className="registro-crear__enlace" href="/mezclas">
            Mezclas
          </Link>
        </span>
      </div>

      {!disponible ? (
        <p className="registro-crear__ayuda">
          El catálogo se habilita al aplicar la base de mezclas. El riego se puede guardar igual, solo con la acción.
        </p>
      ) : (
        <>
          <div className="registro-crear__param registro-crear__param--texto" ref={anclaMezcla}>
            <Selector
              id="registro-mezcla"
              etiqueta="Seleccionar mezcla"
              valor={borrador.recetaId || SIN_MEZCLA}
              onChange={(id) => elegirReceta(!id || id === SIN_MEZCLA ? "" : id)}
              opciones={[
                { valor: SIN_MEZCLA, etiqueta: "Sin mezcla" },
                ...recetasVisibles.map((receta) => ({
                  valor: receta.id,
                  etiqueta: receta.activa ? receta.nombre : `${receta.nombre} · archivada`,
                })),
              ]}
              deshabilitado={deshabilitado}
              ancla={anclaMezcla}
              alinear="start"
            />
          </div>

          {verVolumen ? (
            <div className="registro-crear__param registro-crear__param--texto">
              <span className="registro-crear__param-etiqueta mezclas__volumen-etiqueta">
                Agua preparada
                {soloVolumen ? (
                  <button
                    type="button"
                    className="registro-crear__enlace"
                    onClick={() => publicar(mezclaVacia())}
                    disabled={deshabilitado}
                  >
                    Quitar
                  </button>
                ) : null}
              </span>
              <div className="mezclas__volumen">
                <input
                  inputMode="decimal"
                  aria-label="Agua preparada"
                  value={borrador.volumen}
                  placeholder="Opcional"
                  autoComplete="off"
                  disabled={deshabilitado}
                  onChange={(evento) => publicar({ ...borrador, volumen: evento.target.value })}
                />
                <select
                  aria-label="Unidad de agua"
                  value={borrador.unidadVolumen || "L"}
                  disabled={deshabilitado}
                  onChange={(evento) => publicar({ ...borrador, unidadVolumen: evento.target.value })}
                >
                  {UNIDADES_VOLUMEN.map((unidad) => (
                    <option key={unidad} value={unidad}>
                      {unidad}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {deReceta.length > 0 ? (
            <ul className="mezclas__resumen" aria-label="Productos de la mezcla">
              {deReceta.map((componente) => {
                const total = totalPreparado(componente, borrador);
                return (
                  <li key={componente.productoId || componente.orden}>
                    <span>
                      {nombreProducto(productos, componente.productoId)} —{" "}
                      {textoMedida(componente.cantidad, componente.unidad)}
                    </span>
                    {total ? <span className="mezclas__resumen-total">Total: {total}</span> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {dosisDistinta ? <p className="mezclas__ajustada">Mezcla ajustada</p> : null}

          {extras.length > 0 ? (
            <ul className="mezclas__componentes">
              {extras.map((componente, indice) => (
                <li key={`extra-${componente.productoId || "nuevo"}-${indice}`}>
                  <FilaDosisProducto
                    id={`riego-producto-${indice}`}
                    productos={productos}
                    ocupados={[
                      ...idsReceta,
                      ...extras.flatMap((item, posicion) =>
                        posicion === indice || !item.productoId ? [] : [item.productoId]
                      ),
                    ]}
                    productoId={componente.productoId}
                    cantidad={componente.cantidad}
                    unidad={componente.unidad}
                    volumenAgua={borrador.volumen}
                    unidadVolumen={borrador.unidadVolumen}
                    deshabilitado={deshabilitado}
                    onChange={(parcial) => cambiarExtra(indice, parcial)}
                    onQuitar={() => quitarExtra(indice)}
                  />
                </li>
              ))}
            </ul>
          ) : null}

          {borrador.recetaId && extras.length > 0 ? (
            <p className="registro-crear__ayuda">
              Estos productos se suman a este riego y no cambian la mezcla guardada.
            </p>
          ) : null}
          {aviso ? <p className="formulario__error">{aviso}</p> : null}

          <button
            type="button"
            className="boton boton--secundario mezclas__sumar"
            onClick={() => publicar({ ...borrador, componentes: [...borrador.componentes, filaVacia()] })}
            disabled={deshabilitado}
          >
            <PackageOpen strokeWidth={1.75} aria-hidden="true" />
            Agregar producto
          </button>
        </>
      )}
    </section>
  );
}
