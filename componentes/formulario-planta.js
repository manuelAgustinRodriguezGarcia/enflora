"use client";

import { useActionState, useState } from "react";
import { crearPlantas } from "@/app/espacios/[id]/acciones";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { SelectorEtapa } from "@/componentes/selector-etapa";
import { SelectorMetodo } from "@/componentes/selector-metodo";
import { fechaHoy } from "@/lib/etapas";
import { estadoTrasMetodo, muestraSustrato } from "@/lib/metodos";

const MAXIMO = 100;

function plantaNueva(fechaInicio) {
  return {
    nombre: "",
    genetica: "",
    metodo: "",
    metodoNombre: "",
    usaSustrato: "",
    sustrato: "",
    etapa: "",
    fechaInicioEtapa: fechaHoy(),
    fechaInicio,
  };
}

function valorDeLaPrimera(plantas, campo) {
  const primera = String(plantas[0]?.[campo] || "");
  if (primera.trim()) return primera;
  const conValor = plantas.find((planta) => String(planta[campo] || "").trim());
  return conValor ? conValor[campo] : "";
}

function usaGenetica(modo) {
  return modo === "misma_genetica" || modo === "misma_genetica_y_metodo";
}

function usaMetodo(modo) {
  return modo === "mismo_metodo" || modo === "misma_genetica_y_metodo";
}

function CamposPlanta({ planta, metodosPersonalizados, mostrarEtapa, nombreEtapa, onChange }) {
  return (
    <>
      <label className="formulario__campo">
        Nombre
        <input
          type="text"
          value={planta.nombre}
          onChange={(evento) => onChange("nombre", evento.target.value)}
        />
      </label>
      <label className="formulario__campo">
        Genética
        <input
          type="text"
          value={planta.genetica}
          onChange={(evento) => onChange("genetica", evento.target.value)}
        />
      </label>
      <SelectorMetodo
        metodosPersonalizados={metodosPersonalizados}
        valor={planta.metodo}
        nombreOtro={planta.metodoNombre}
        sustrato={planta.sustrato}
        usaSustrato={planta.usaSustrato}
        onChange={(valor) => onChange("metodo", valor)}
        onChangeNombre={(valor) => onChange("metodoNombre", valor)}
        onChangeSustrato={(valor) => onChange("sustrato", valor)}
        onChangeUsaSustrato={(valor) => onChange("usaSustrato", valor)}
      />
      <Aparecer visible={mostrarEtapa}>
        <div>
          <SelectorEtapa
            nombre={nombreEtapa}
            valor={planta.etapa}
            onChange={(valor) => onChange("etapa", valor)}
          />
          <label className="formulario__campo">
            Inicio de la etapa
            <input
              type="date"
              value={planta.fechaInicioEtapa}
              onChange={(evento) => onChange("fechaInicioEtapa", evento.target.value)}
            />
          </label>
        </div>
      </Aparecer>
      <label className="formulario__campo">
        Fecha de inicio
        <input
          type="date"
          value={planta.fechaInicio}
          onChange={(evento) => onChange("fechaInicio", evento.target.value)}
        />
      </label>
    </>
  );
}

export function FormularioPlanta({ unidadId, siguienteNumero = 1, metodosPersonalizados = [] }) {
  const [estado, accion, pendiente] = useActionState(crearPlantas, null);
  const [modo, setModo] = useState("diferente");
  const [modoEtapa, setModoEtapa] = useState("misma");
  const [general, setGeneral] = useState({
    genetica: "",
    metodo: "",
    metodoNombre: "",
    usaSustrato: "",
    sustrato: "",
    etapa: "",
    fechaInicioEtapa: fechaHoy(),
  });
  const [plantas, setPlantas] = useState(() => [plantaNueva("")]);
  const varias = plantas.length > 1;

  function cambiarCantidad(nueva) {
    if (nueva < 1 || nueva > MAXIMO) return;

    const etapaCompartida =
      modoEtapa === "misma" ? general.etapa || valorDeLaPrimera(plantas, "etapa") : "";
    if (modoEtapa === "misma" && etapaCompartida !== general.etapa) {
      setGeneral((actual) => ({ ...actual, etapa: etapaCompartida }));
    }

    setPlantas((actuales) => {
      if (nueva <= actuales.length) return actuales.slice(0, nueva);

      const fecha = actuales[0]?.fechaInicio || "";
      const extra = [];
      for (let i = actuales.length; i < nueva; i += 1) {
        extra.push({
          ...plantaNueva(fecha),
          genetica: usaGenetica(modo) ? general.genetica : "",
          metodo: usaMetodo(modo) ? general.metodo : "",
          metodoNombre: usaMetodo(modo) ? general.metodoNombre : "",
          usaSustrato: usaMetodo(modo) ? general.usaSustrato : "",
          sustrato:
            usaMetodo(modo) && muestraSustrato(general.metodo, general.usaSustrato)
              ? general.sustrato
              : "",
          etapa: etapaCompartida,
          fechaInicioEtapa:
            modoEtapa === "misma" ? general.fechaInicioEtapa || fechaHoy() : fechaHoy(),
        });
      }
      return [...actuales, ...extra];
    });
  }

  function aplicarCompartido(campo, valor) {
    setGeneral((actual) => ({ ...actual, [campo]: valor }));
    setPlantas((actuales) =>
      actuales.map((planta) => {
        if (campo === "sustrato" && !muestraSustrato(planta.metodo, planta.usaSustrato)) return planta;
        return { ...planta, [campo]: valor };
      })
    );
  }

  function cambiarModo(nuevo) {
    const genetica = usaGenetica(nuevo) ? valorDeLaPrimera(plantas, "genetica") || general.genetica : null;
    const metodo = usaMetodo(nuevo) ? valorDeLaPrimera(plantas, "metodo") || general.metodo : null;
    const metodoNombre = usaMetodo(nuevo)
      ? valorDeLaPrimera(plantas, "metodoNombre") || general.metodoNombre
      : null;
    const usaSustrato = usaMetodo(nuevo)
      ? valorDeLaPrimera(plantas, "usaSustrato") || general.usaSustrato
      : null;
    const sustrato = usaMetodo(nuevo) ? valorDeLaPrimera(plantas, "sustrato") || general.sustrato : null;

    setModo(nuevo);
    if (genetica !== null || metodo !== null) {
      setGeneral((actual) => ({
        ...actual,
        ...(genetica !== null ? { genetica } : {}),
        ...(metodo !== null
          ? { metodo, metodoNombre: metodoNombre || "", usaSustrato: usaSustrato || "", sustrato: sustrato || "" }
          : {}),
      }));
    }
    setPlantas((actuales) =>
      actuales.map((planta) => ({
        ...planta,
        genetica: genetica === null ? planta.genetica : genetica,
        metodo: metodo === null ? planta.metodo : metodo,
        metodoNombre: metodoNombre === null ? planta.metodoNombre : metodoNombre || "",
        usaSustrato: usaSustrato === null ? planta.usaSustrato : usaSustrato || "",
        sustrato:
          sustrato === null
            ? planta.sustrato
            : muestraSustrato(metodo, usaSustrato) ? sustrato || "" : "",
      }))
    );
  }

  function cambiarMetodo(valor, indice) {
    const todas = indice === undefined;
    setGeneral((actual) => {
      if (!todas) return actual;
      const next = estadoTrasMetodo(actual, valor);
      return next;
    });
    setPlantas((actuales) =>
      actuales.map((planta, i) => {
        if (!todas && i !== indice) return planta;
        const next = estadoTrasMetodo(planta, valor);
        if (todas && muestraSustrato(next.metodo, next.usaSustrato)) {
          return { ...next, sustrato: general.sustrato || "" };
        }
        return next;
      })
    );
  }

  function cambiarUsoSustrato(valor, indice) {
    const todas = indice === undefined;
    setGeneral((actual) => {
      if (!todas) return actual;
      return { ...actual, usaSustrato: valor, sustrato: valor === "si" ? actual.sustrato : "" };
    });
    setPlantas((actuales) =>
      actuales.map((planta, i) => {
        if (!todas && i !== indice) return planta;
        if (todas && planta.metodo !== general.metodo) return planta;
        return {
          ...planta,
          usaSustrato: valor,
          sustrato: valor === "si" ? (todas ? general.sustrato : planta.sustrato) : "",
        };
      })
    );
  }

  function cambiarPlanta(indice, campo, valor) {
    if (campo === "metodo") {
      cambiarMetodo(valor, indice);
      return;
    }
    if (campo === "usaSustrato") {
      cambiarUsoSustrato(valor, indice);
      return;
    }

    setPlantas((actuales) =>
      actuales.map((planta, i) => (i === indice ? { ...planta, [campo]: valor } : planta))
    );
  }

  function cambiarModoEtapa(nuevo) {
    setModoEtapa(nuevo);
    if (nuevo !== "misma") return;
    const etapa = general.etapa || valorDeLaPrimera(plantas, "etapa");
    const fechaInicioEtapa =
      general.fechaInicioEtapa || valorDeLaPrimera(plantas, "fechaInicioEtapa") || fechaHoy();
    setGeneral((actual) => ({ ...actual, etapa, fechaInicioEtapa }));
    setPlantas((actuales) => actuales.map((planta) => ({ ...planta, etapa, fechaInicioEtapa })));
  }

  const carga = plantas.map((planta) => ({
    nombre: planta.nombre,
    genetica: planta.genetica,
    metodo: planta.metodo === "otro" ? planta.metodoNombre.trim() : planta.metodo,
    metodoIncompleto: planta.metodo === "otro" && !planta.metodoNombre.trim(),
    sustrato: muestraSustrato(planta.metodo, planta.usaSustrato) ? planta.sustrato : "",
    etapa: planta.etapa,
    fechaInicioEtapa: planta.fechaInicioEtapa,
    fechaInicio: planta.fechaInicio,
  }));

  return (
    <form className="formulario" action={accion}>
      <h2>Agregar plantas</h2>
      {estado?.error ? <p className="formulario__error">{estado.error}</p> : null}
      <input type="hidden" name="unidad_id" value={unidadId} />
      <input type="hidden" name="plantas" value={JSON.stringify(carga)} />
      <div className="contador">
        <span className="contador__etiqueta">Cantidad de plantas</span>
        <button
          type="button"
          onClick={() => cambiarCantidad(plantas.length - 1)}
          disabled={pendiente || plantas.length <= 1}
        >
          -
        </button>
        <span className="contador__valor">{plantas.length}</span>
        <button
          type="button"
          onClick={() => cambiarCantidad(plantas.length + 1)}
          disabled={pendiente || plantas.length >= MAXIMO}
        >
          +
        </button>
      </div>
      {varias ? (
        <fieldset className="opciones">
          <legend>Configuración general</legend>
          <label>
            <input
              type="radio"
              checked={modo === "diferente"}
              onChange={() => cambiarModo("diferente")}
            />
            Diferente genética y método
          </label>
          <label>
            <input
              type="radio"
              checked={modo === "misma_genetica"}
              onChange={() => cambiarModo("misma_genetica")}
            />
            Misma genética
          </label>
          <label>
            <input
              type="radio"
              checked={modo === "mismo_metodo"}
              onChange={() => cambiarModo("mismo_metodo")}
            />
            Mismo método
          </label>
          <label>
            <input
              type="radio"
              checked={modo === "misma_genetica_y_metodo"}
              onChange={() => cambiarModo("misma_genetica_y_metodo")}
            />
            Misma genética y método
          </label>
          <Aparecer visible={usaGenetica(modo)}>
            <label className="formulario__campo">
              Genética
              <input
                type="text"
                value={general.genetica}
                onChange={(evento) => aplicarCompartido("genetica", evento.target.value)}
              />
            </label>
          </Aparecer>
          <Aparecer visible={usaMetodo(modo)}>
            <SelectorMetodo
              metodosPersonalizados={metodosPersonalizados}
              valor={general.metodo}
              nombreOtro={general.metodoNombre}
              sustrato={general.sustrato}
              usaSustrato={general.usaSustrato}
              onChange={(valor) => cambiarMetodo(valor)}
              onChangeNombre={(valor) => aplicarCompartido("metodoNombre", valor)}
              onChangeSustrato={(valor) => aplicarCompartido("sustrato", valor)}
              onChangeUsaSustrato={(valor) => cambiarUsoSustrato(valor)}
            />
          </Aparecer>
          <label>
            <input
              type="radio"
              checked={modoEtapa === "misma"}
              onChange={() => cambiarModoEtapa("misma")}
            />
            Misma etapa para todas
          </label>
          <label>
            <input
              type="radio"
              checked={modoEtapa === "individual"}
              onChange={() => cambiarModoEtapa("individual")}
            />
            Personalizar por planta
          </label>
          <Aparecer visible={modoEtapa === "misma"}>
            <div>
              <SelectorEtapa
                nombre="etapa-general"
                valor={general.etapa}
                onChange={(valor) => aplicarCompartido("etapa", valor)}
              />
              <label className="formulario__campo">
                Inicio de la etapa
                <input
                  type="date"
                  value={general.fechaInicioEtapa}
                  onChange={(evento) => aplicarCompartido("fechaInicioEtapa", evento.target.value)}
                />
              </label>
            </div>
          </Aparecer>
        </fieldset>
      ) : null}
      {plantas.map((planta, indice) => {
        const numero = siguienteNumero + indice;
        return (
          <div className="bloque" key={numero}>
            <h3>Planta {numero}</h3>
            <CamposPlanta
              planta={planta}
              metodosPersonalizados={metodosPersonalizados}
              mostrarEtapa={!varias || modoEtapa === "individual"}
              nombreEtapa={`etapa-planta-${numero}`}
              onChange={(campo, valor) => cambiarPlanta(indice, campo, valor)}
            />
          </div>
        );
      })}
      <Boton type="submit" disabled={pendiente}>
        {plantas.length === 1 ? "Crear 1 planta" : `Crear ${plantas.length} plantas`}
      </Boton>
    </form>
  );
}
