"use client";

import { useId, useState } from "react";
import { FormularioGenetica } from "@/componentes/formulario-genetica";
import { FiguraGenetica, ModalGenetica } from "@/componentes/modal-genetica";

export function SelectorGenetica({ id, nombre = "", detalle = null, onChange, deshabilitado = false }) {
  const reactId = useId();
  const campoId = id || reactId;
  const [crear, setCrear] = useState(false);
  const [fichaAbierta, setFichaAbierta] = useState(false);

  const confirmada = Boolean(nombre.trim());
  const origen = detalle?.origen === "personalizada"
    ? "Mi genética"
    : detalle?.origen === "strainapi"
      ? "StrainAPI"
      : nombre.trim()
        ? "Solo el nombre"
        : "";

  function publicar(seleccion) {
    onChange({
      nombre: seleccion.nombre || "",
      id: seleccion.id || "",
      detalle: seleccion.detalle || null,
    });
  }

  return (
    <div className="genetica-buscador formulario__campo">
      {confirmada ? (
        <div className="genetica-tarjeta">
          <FiguraGenetica detalle={detalle} nombre={nombre} />
          <div className="genetica-tarjeta__cuerpo">
            <span className="genetica-tarjeta__nombre">{detalle?.nombre || nombre}</span>
            {origen ? <span className="genetica-tarjeta__origen">{origen}</span> : null}
            <button type="button" className="genetica-tarjeta__datos" onClick={() => setFichaAbierta(true)}>
              Datos de la genética
            </button>
          </div>
        </div>
      ) : null}
      <span>Genética</span>
      <button id={campoId} type="button" disabled={deshabilitado} onClick={() => setCrear(true)}>
        Crear genética
      </button>
      <ModalGenetica
        abierto={fichaAbierta}
        detalle={detalle}
        nombre={nombre}
        onCerrar={() => setFichaAbierta(false)}
      />
      <FormularioGenetica
        abierto={crear}
        nombreInicial={nombre}
        onCerrar={() => setCrear(false)}
        onCreada={(detalleCreado) => {
          publicar({
            nombre: detalleCreado.nombre,
            id: detalleCreado.id,
            detalle: detalleCreado,
          });
          setCrear(false);
        }}
      />
    </div>
  );
}
