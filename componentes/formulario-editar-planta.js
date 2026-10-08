"use client";

import { useActionState, useState } from "react";
import { editarPlanta } from "@/app/espacios/[id]/acciones";
import { SelectorMetodo } from "@/componentes/selector-metodo";
import { ETAPAS } from "@/lib/etapas";
import { estadoTrasMetodo, muestraSustrato } from "@/lib/metodos";

export function FormularioEditarPlanta({ planta, unidades, metodosPersonalizados = [] }) {
  const [resultado, accion, pendiente] = useActionState(editarPlanta, null);
  const nombre = resultado?.nombre ?? planta.nombre ?? "";
  const genetica = resultado?.genetica ?? planta.genetica ?? "";
  const metodoInicial = resultado?.metodo ?? planta.metodo ?? "";
  const sustratoInicial = resultado?.sustrato ?? planta.sustrato ?? "";
  const [metodo, setMetodo] = useState(metodoInicial);
  const [metodoNombre, setMetodoNombre] = useState("");
  const [usaSustrato, setUsaSustrato] = useState(sustratoInicial ? "si" : "");
  const [sustrato, setSustrato] = useState(sustratoInicial);
  const metodoGuardado = metodo === "otro" ? metodoNombre.trim() : metodo;
  const metodoIncompleto = metodo === "otro" && !metodoNombre.trim();
  const sustratoVisible = muestraSustrato(metodo, usaSustrato);
  const etapa = resultado?.etapa ?? planta.etapa ?? "";
  const fechaInicio = resultado?.fechaInicio ?? planta.fecha_inicio ?? "";
  const estadoPlanta = resultado?.estadoPlanta ?? planta.estado ?? "activa";
  const unidadId = resultado?.unidadId ?? planta.unidad_cultivo_id ?? "";

  return (
    <form key={resultado?.error || "inicial"} className="formulario" action={accion}>
      {resultado?.error ? <p className="formulario__error">{resultado.error}</p> : null}
      <input type="hidden" name="planta_id" value={planta.id} />
      <input type="hidden" name="unidad_anterior_id" value={planta.unidad_cultivo_id} />
      <input type="hidden" name="metodo" value={metodoGuardado} />
      <input type="hidden" name="metodo_incompleto" value={metodoIncompleto ? "si" : "no"} />
      <input type="hidden" name="sustrato" value={sustratoVisible ? sustrato : ""} />
      <label className="formulario__campo">
        Nombre
        <input name="nombre" type="text" defaultValue={nombre} />
      </label>
      <label className="formulario__campo">
        Genética
        <input name="genetica" type="text" defaultValue={genetica || ""} />
      </label>
      <SelectorMetodo
        metodosPersonalizados={metodosPersonalizados}
        valor={metodo}
        nombreOtro={metodoNombre}
        sustrato={sustrato}
        usaSustrato={usaSustrato}
        onChange={(valor) => {
          const next = estadoTrasMetodo({ metodo, metodoNombre, usaSustrato, sustrato }, valor);
          setMetodo(next.metodo);
          setMetodoNombre(next.metodo === "otro" ? metodoNombre : "");
          setUsaSustrato(next.usaSustrato || "");
          setSustrato(next.sustrato || "");
        }}
        onChangeNombre={setMetodoNombre}
        onChangeSustrato={setSustrato}
        onChangeUsaSustrato={(valor) => {
          setUsaSustrato(valor);
          if (valor !== "si") setSustrato("");
        }}
      />
      <label className="formulario__campo">
        Etapa
        <select name="etapa" defaultValue={etapa || ""}>
          <option value="">Seleccionar</option>
          {ETAPAS.map((item) => (
            <option key={item.valor} value={item.valor}>
              {item.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="formulario__campo">
        Fecha de inicio
        <input name="fecha_inicio" type="date" defaultValue={fechaInicio || ""} />
      </label>
      <label className="formulario__campo">
        Estado
        <select name="estado" defaultValue={estadoPlanta}>
          <option value="">Seleccionar</option>
          <option value="activa">Activa</option>
          <option value="finalizada">Finalizada</option>
        </select>
      </label>
      <label className="formulario__campo">
        Unidad
        <select name="unidad_id" defaultValue={unidadId}>
          <option value="">Seleccionar</option>
          {unidades.map((unidad) => (
            <option key={unidad.id} value={unidad.id}>
              {unidad.espacioNombre} — {unidad.nombre}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pendiente}>
        Guardar
      </button>
    </form>
  );
}
