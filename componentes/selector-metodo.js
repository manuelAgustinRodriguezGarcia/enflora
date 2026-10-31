"use client";

import { Aparecer } from "@/componentes/aparecer";
import { Selector } from "@/componentes/selector";
import { METODOS_BASE, metodoPreguntaSustrato, muestraSustrato } from "@/lib/metodos";

export function SelectorMetodo({
  metodosPersonalizados,
  valor,
  nombreOtro,
  onChange,
  onChangeNombre,
  sustrato = "",
  usaSustrato = "",
  onChangeSustrato,
  onChangeUsaSustrato,
}) {
  const opcionesBase = [...METODOS_BASE, ...metodosPersonalizados];
  const conocidas = new Set([...opcionesBase, "", "otro"]);
  const extra = valor && !conocidas.has(valor) ? valor : "";
  const pregunta = metodoPreguntaSustrato(valor);
  const visible = muestraSustrato(valor, usaSustrato);
  const opciones = [
    ...opcionesBase.map((metodo) => ({ valor: metodo, etiqueta: metodo })),
    ...(extra ? [{ valor: extra, etiqueta: extra }] : []),
    { valor: "otro", etiqueta: "OTRO" },
  ];

  return (
    <>
      <Selector
        etiqueta="Método"
        valor={valor || null}
        onChange={onChange}
        opciones={opciones}
        placeholder="Seleccionar"
      />
      <Aparecer visible={valor === "otro"}>
        <label className="formulario__campo">
          <input
            type="text"
            value={nombreOtro}
            placeholder="Nombre de tu método"
            aria-label="Nombre del método"
            onChange={(evento) => onChangeNombre(evento.target.value)}
          />
        </label>
      </Aparecer>
      <Aparecer visible={pregunta}>
        <fieldset className="opciones">
          <legend>¿Utiliza sustrato?</legend>
          <label>
            <input
              type="radio"
              checked={usaSustrato === "si"}
              onChange={() => onChangeUsaSustrato("si")}
            />
            Sí
          </label>
          <label>
            <input
              type="radio"
              checked={usaSustrato === "no"}
              onChange={() => onChangeUsaSustrato("no")}
            />
            No
          </label>
        </fieldset>
      </Aparecer>
      <Aparecer visible={visible}>
        <label className="formulario__campo">
          Sustrato
          <input
            type="text"
            value={sustrato}
            onChange={(evento) => onChangeSustrato(evento.target.value)}
          />
        </label>
      </Aparecer>
    </>
  );
}
