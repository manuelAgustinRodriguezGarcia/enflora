"use client";

import { useActionState, useState } from "react";
import { editarPlanta } from "@/app/espacios/[id]/acciones";
import { Boton } from "@/componentes/boton";
import { Selector } from "@/componentes/selector";
import { SelectorFecha } from "@/componentes/selector-fecha";
import { SelectorGenetica } from "@/componentes/selector-genetica";
import { SelectorMetodo } from "@/componentes/selector-metodo";
import { camposGenetica } from "@/lib/geneticas/reglas";
import { fechaHoy, fechaInicioPlanta } from "@/lib/etapas";
import { estadoTrasMetodo, muestraSustrato } from "@/lib/metodos";

export function FormularioEditarPlanta({ planta, unidades, metodosPersonalizados = [], detalleGenetica = null }) {
  const [resultado, accion, pendiente] = useActionState(editarPlanta, null);
  const nombre = resultado?.nombre ?? planta.nombre ?? "";
  const [genetica, setGenetica] = useState(() =>
    camposGenetica({
      nombre: resultado?.genetica ?? planta.genetica ?? "",
      id: resultado?.geneticaId || detalleGenetica?.id || "",
      detalle:
        detalleGenetica && (!resultado?.geneticaId || detalleGenetica.id === resultado.geneticaId)
          ? detalleGenetica
          : null,
    })
  );
  const metodoInicial = resultado?.metodo ?? planta.metodo ?? "";
  const sustratoInicial = resultado?.sustrato ?? planta.sustrato ?? "";
  const [metodo, setMetodo] = useState(metodoInicial);
  const [metodoNombre, setMetodoNombre] = useState("");
  const [usaSustrato, setUsaSustrato] = useState(sustratoInicial ? "si" : "");
  const [sustrato, setSustrato] = useState(sustratoInicial);
  const metodoGuardado = metodo === "otro" ? metodoNombre.trim() : metodo;
  const metodoIncompleto = metodo === "otro" && !metodoNombre.trim();
  const sustratoVisible = muestraSustrato(metodo, usaSustrato);
  const [fechaInicio, setFechaInicio] = useState(
    resultado?.fechaInicio ?? (fechaInicioPlanta(planta) || fechaHoy())
  );
  const [estadoPlanta, setEstadoPlanta] = useState(resultado?.estadoPlanta ?? planta.estado ?? "activa");
  const [unidadId, setUnidadId] = useState(resultado?.unidadId ?? planta.unidad_cultivo_id ?? "");
  const activa = estadoPlanta === "activa";

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
      <div className="estado-toggle">
        <span className={`estado-toggle__texto${activa ? "" : " estado-toggle__texto--apagado"}`}>
          {activa ? "Activa" : "Desactivada"}
        </span>
        <button
          type="button"
          className={`estado-toggle__boton${activa ? " estado-toggle__boton--activo" : ""}`}
          role="switch"
          aria-checked={activa}
          aria-label={activa ? "Planta activa" : "Planta desactivada"}
          onClick={() => setEstadoPlanta(activa ? "finalizada" : "activa")}
        >
          <span className="estado-toggle__pulgar" />
        </button>
      </div>
      <div className="formulario__fila">
        <label className="formulario__campo">
          Nombre
          <input name="nombre" type="text" defaultValue={nombre} />
        </label>
        <SelectorFecha
          etiqueta="Fecha de inicio"
          valor={fechaInicio}
          onChange={setFechaInicio}
        />
      </div>
      <Selector
        etiqueta="Unidad"
        valor={unidadId || null}
        onChange={setUnidadId}
        opciones={opcionesUnidad}
        placeholder="Seleccionar"
      />
      <input type="hidden" name="genetica" value={genetica.genetica} />
      <input type="hidden" name="genetica_id" value={genetica.geneticaId} />
      <SelectorGenetica
        id="genetica-editar"
        nombre={genetica.genetica}
        detalle={genetica.geneticaDetalle}
        onChange={(seleccion) => setGenetica(camposGenetica(seleccion))}
      />
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
      <Boton type="submit" disabled={pendiente}>
        Guardar
      </Boton>
    </form>
  );
}
