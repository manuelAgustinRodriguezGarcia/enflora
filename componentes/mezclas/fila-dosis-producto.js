"use client";

import { X } from "lucide-react";
import { ComboboxProducto } from "@/componentes/mezclas/combobox-producto";
import { Selector } from "@/componentes/selector";
import { cantidadAplicada, esUnidadPorLitro, textoCantidad, textoMedida, unidadesDosisVisibles } from "@/lib/mezclas/calculo";

function cantidadVisible(cantidad) {
  if (typeof cantidad === "number") return textoCantidad(cantidad);
  return cantidad ?? "";
}

export function FilaDosisProducto({
  productos = [],
  ocupados = [],
  productoId = "",
  cantidad = "",
  unidad = "ml/L",
  onChange,
  onQuitar,
  deshabilitado = false,
  volumenAgua = "",
  unidadVolumen = "L",
  id,
}) {
  const aplicado = cantidadAplicada({
    cantidad: String(cantidad).replace(",", "."),
    unidad,
    volumenAgua,
    unidadVolumen,
  });
  const total =
    aplicado && esUnidadPorLitro(unidad) && aplicado.unidad !== unidad
      ? textoMedida(aplicado.cantidad, aplicado.unidad)
      : "";

  return (
    <div className="mezclas__fila">
      <div className="mezclas__fila-producto">
        <ComboboxProducto
          id={id}
          productos={productos}
          ocupados={ocupados}
          productoId={productoId}
          onChange={(siguiente) => onChange?.({ productoId: siguiente })}
          deshabilitado={deshabilitado}
        />
      </div>
      <div className="mezclas__cantidades">
        <p className="mezclas__cantidades-titulo">Cantidades</p>
        <div className="mezclas__cantidades-campos">
          <input
            className="mezclas__fila-cantidad"
            inputMode="decimal"
            aria-label="Cantidad"
            value={cantidadVisible(cantidad)}
            placeholder="0"
            autoComplete="off"
            disabled={deshabilitado}
            onChange={(evento) => onChange?.({ cantidad: evento.target.value })}
          />
          <Selector
            ariaLabel="Unidad"
            valor={unidad}
            onChange={(siguiente) => onChange?.({ unidad: siguiente })}
            opciones={unidadesDosisVisibles(unidad).map((opcion) => ({ valor: opcion, etiqueta: opcion }))}
            deshabilitado={deshabilitado}
          />
          <button
            type="button"
            className="boton boton--ghost boton--icono"
            aria-label="Quitar producto"
            onClick={onQuitar}
            disabled={deshabilitado}
          >
            <X strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
      {total ? <p className="mezclas__meta mezclas__fila-total">Para este volumen: {total}</p> : null}
    </div>
  );
}
