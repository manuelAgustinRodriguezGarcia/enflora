"use client";

import { claveParametroRegistro } from "@/lib/registros";

export function SeccionParametrosRegistro({
  titulo = "Parámetros",
  prioritarias = [],
  secundarias = [],
  valores = {},
  onChange,
  pendiente = false,
  accionCabecera = null,
  deshabilitado = false,
}) {
  const visibles = prioritarias;
  const extras = secundarias;
  const numericos = visibles.filter((item) => item.tipo_valor === "numero");
  const textos = visibles.filter((item) => item.tipo_valor === "texto");

  function renderNumerico(item) {
    const clave = claveParametroRegistro(item);
    const unidad = item.unidad ? ` (${item.unidad})` : "";
    return (
      <label key={clave} className="registro-crear__param">
        <span className="registro-crear__param-etiqueta">
          {item.etiquetaCorta || item.etiqueta}
          {unidad}
        </span>
        <input
          type="text"
          inputMode="decimal"
          className="registro-crear__param-input"
          value={valores[clave] ?? ""}
          onChange={(evento) => onChange(clave, evento.target.value)}
          disabled={pendiente || deshabilitado}
          placeholder="—"
          autoComplete="off"
        />
      </label>
    );
  }

  function renderTexto(item) {
    const clave = claveParametroRegistro(item);
    return (
      <label key={clave} className="registro-crear__param registro-crear__param--texto">
        <span className="registro-crear__param-etiqueta">{item.etiqueta}</span>
        <input
          type="text"
          className="registro-crear__param-input"
          value={valores[clave] ?? ""}
          onChange={(evento) => onChange(clave, evento.target.value)}
          disabled={pendiente || deshabilitado}
          placeholder="—"
          autoComplete="off"
        />
      </label>
    );
  }

  const cabecera = (
    <div className="registro-crear__seccion-cabecera">
      <h2 className="registro-crear__etiqueta">{titulo}</h2>
      {accionCabecera}
    </div>
  );

  if (visibles.length === 0 && extras.length === 0) {
    return (
      <section className="registro-crear__seccion">
        {cabecera}
        <p className="registro-crear__ayuda">
          No hay parámetros disponibles. Podés agregarlos con Editar.
        </p>
      </section>
    );
  }

  return (
    <section className="registro-crear__seccion">
      {cabecera}
      {visibles.length === 0 ? (
        <p className="registro-crear__ayuda">
          Todavía no elegiste parámetros prioritarios. Tocá Editar para configurarlos.
        </p>
      ) : null}
      {numericos.length > 0 ? (
        <div className="registro-crear__params-grid">{numericos.map(renderNumerico)}</div>
      ) : null}
      {textos.length > 0 ? (
        <div className="registro-crear__params-texto">{textos.map(renderTexto)}</div>
      ) : null}
    </section>
  );
}
