"use client";

import { X } from "lucide-react";
import { ComboboxProducto } from "@/componentes/mezclas/combobox-producto";
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
      <select
        className="mezclas__fila-unidad"
        aria-label="Unidad"
        value={unidad}
        disabled={deshabilitado}
        onChange={(evento) => onChange?.({ unidad: evento.target.value })}
      >
        {unidadesDosisVisibles(unidad).map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="boton boton--ghost boton--icono"
        aria-label="Quitar producto"
        onClick={onQuitar}
        disabled={deshabilitado}
      >
        <X strokeWidth={1.75} aria-hidden="true" />
      </button>
      {total ? <p className="mezclas__meta mezclas__fila-total">Para este volumen: {total}</p> : null}
    </div>
  );
}
