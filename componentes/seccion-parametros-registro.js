"use client";

import { Aparecer } from "@/componentes/aparecer";
import { claveParametroRegistro } from "@/lib/registros";

export function SeccionParametrosRegistro({
  prioritarias = [],
  secundarias = [],
  valores = {},
  onChange,
  mostrarMas,
  onToggleMas,
  pendiente = false,
  accionCabecera = null,
}) {
  const visibles = prioritarias;
  const extras = secundarias;
  const numericos = visibles.filter((item) => item.tipo_valor === "numero");
  const textos = visibles.filter((item) => item.tipo_valor === "texto");
  const extrasNumericos = extras.filter((item) => item.tipo_valor === "numero");
  const extrasTextos = extras.filter((item) => item.tipo_valor === "texto");

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
          disabled={pendiente}
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
          disabled={pendiente}
          placeholder="—"
          autoComplete="off"
        />
      </label>
    );
  }

  const cabecera = (
    <div className="registro-crear__seccion-cabecera">
      <h2 className="registro-crear__etiqueta">Parámetros</h2>
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

      {extras.length > 0 ? (
        <>
          <button
            type="button"
            className="registro-crear__enlace"
            onClick={onToggleMas}
            disabled={pendiente}
          >
            {mostrarMas ? "Ocultar más parámetros" : "Más parámetros"}
          </button>
          <Aparecer visible={mostrarMas}>
            <div className="registro-crear__params-extra">
              {extrasNumericos.length > 0 ? (
                <div className="registro-crear__params-grid">
                  {extrasNumericos.map(renderNumerico)}
                </div>
              ) : null}
              {extrasTextos.length > 0 ? (
                <div className="registro-crear__params-texto">
                  {extrasTextos.map(renderTexto)}
                </div>
              ) : null}
            </div>
          </Aparecer>
        </>
      ) : null}
    </section>
  );
}
