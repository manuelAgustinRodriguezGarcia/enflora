"use client";

import { useActionState, useState } from "react";
import { editarPlanta } from "@/app/espacios/[id]/acciones";
import { Boton } from "@/componentes/boton";
import { Selector } from "@/componentes/selector";
import { SelectorFecha } from "@/componentes/selector-fecha";
import { SelectorMetodo } from "@/componentes/selector-metodo";
import { estadoTrasMetodo, muestraSustrato } from "@/lib/metodos";

const ESTADOS = [
  { valor: "activa", etiqueta: "Activa" },
  { valor: "finalizada", etiqueta: "Finalizada" },
];

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
  const [fechaInicio, setFechaInicio] = useState(resultado?.fechaInicio ?? planta.fecha_inicio ?? "");
  const [estadoPlanta, setEstadoPlanta] = useState(resultado?.estadoPlanta ?? planta.estado ?? "activa");
  const [unidadId, setUnidadId] = useState(resultado?.unidadId ?? planta.unidad_cultivo_id ?? "");

  const opcionesUnidad = unidades.map((unidad) => ({
    valor: unidad.id,
    etiqueta: `${unidad.espacioNombre} — ${unidad.nombre}`,
  }));

  return (
    <form key={resultado?.error || "inicial"} className="formulario" action={accion}>
      {resultado?.error ? <p className="formulario__error">{resultado.error}</p> : null}
      <input type="hidden" name="planta_id" value={planta.id} />
      <input type="hidden" name="unidad_anterior_id" value={planta.unidad_cultivo_id} />
      <input type="hidden" name="metodo" value={metodoGuardado} />
      <input type="hidden" name="metodo_incompleto" value={metodoIncompleto ? "si" : "no"} />
      <input type="hidden" name="sustrato" value={sustratoVisible ? sustrato : ""} />
      <input type="hidden" name="fecha_inicio" value={fechaInicio} />
      <input type="hidden" name="estado" value={estadoPlanta} />
      <input type="hidden" name="unidad_id" value={unidadId} />
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
      <SelectorFecha
        etiqueta="Fecha de inicio"
        valor={fechaInicio}
        onChange={setFechaInicio}
      />
      <Selector
        etiqueta="Estado"
        valor={estadoPlanta || null}
        onChange={setEstadoPlanta}
        opciones={ESTADOS}
        placeholder="Seleccionar"
      />
      <Selector
        etiqueta="Unidad"
        valor={unidadId || null}
        onChange={setUnidadId}
        opciones={opcionesUnidad}
        placeholder="Seleccionar"
      />
      <Boton type="submit" disabled={pendiente}>
        Guardar
      </Boton>
    </form>
  );
}
