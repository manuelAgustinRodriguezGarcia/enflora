"use client";

import { Aparecer } from "@/componentes/aparecer";
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
  const opciones = [...METODOS_BASE, ...metodosPersonalizados];
  const conocidas = new Set([...opciones, "", "otro"]);
  const extra = valor && !conocidas.has(valor) ? valor : "";
  const pregunta = metodoPreguntaSustrato(valor);
  const visible = muestraSustrato(valor, usaSustrato);

  return (
    <>
      <label className="formulario__campo">
        Método
        <select value={valor} onChange={(evento) => onChange(evento.target.value)}>
          <option value="">Seleccionar</option>
          {opciones.map((metodo) => (
            <option key={metodo} value={metodo}>
              {metodo}
            </option>
          ))}
          {extra ? <option value={extra}>{extra}</option> : null}
          <option value="otro">OTRO</option>
        </select>
      </label>
      <Aparecer visible={valor === "otro"}>
        <label className="formulario__campo">
          Nombre del método
          <input
            type="text"
            value={nombreOtro}
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
