"use client";

import { useActionState, useState } from "react";
import { crearPlantas } from "@/app/espacios/[id]/acciones";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { ContadorCantidad } from "@/componentes/contador-cantidad";
import { PlantaAccordion } from "@/componentes/planta-accordion";
import { SelectorEtapa } from "@/componentes/selector-etapa";
import { SelectorFecha } from "@/componentes/selector-fecha";
import { SelectorGenetica } from "@/componentes/selector-genetica";
import { SelectorMetodo } from "@/componentes/selector-metodo";
import { camposGenetica, clonarGeneticaCompartida } from "@/lib/geneticas/reglas";
import { fechaHoy } from "@/lib/etapas";
import { estadoTrasMetodo, muestraSustrato } from "@/lib/metodos";

const MAXIMO = 100;

const MODOS = [
  {
    valor: "misma_genetica",
    etiqueta: "Misma genética",
    descripcion:
      "Todas las plantas tendrán inicialmente la misma genética. Podés modificar plantas individuales después.",
  },
  {
    valor: "mismo_metodo",
    etiqueta: "Mismo método",
    descripcion:
      "Todas las plantas utilizarán inicialmente el mismo método de cultivo. Podés modificar plantas individuales después.",
  },
  {
    valor: "misma_genetica_y_metodo",
    etiqueta: "Misma genética y método",
    descripcion:
      "Todas las plantas tendrán inicialmente la misma genética y utilizarán el mismo método de cultivo. Podés modificar plantas individuales después.",
  },
  {
    valor: "diferente",
    etiqueta: "Diferente genética y método",
    descripcion: "Cada planta podrá tener su propia genética y método de cultivo.",
  },
];

function plantaNueva(fechaInicio) {
  return {
    nombre: "",
    genetica: "",
    geneticaId: "",
    geneticaDetalle: null,
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

function CamposPlanta({ planta, idGenetica, metodosPersonalizados, mostrarEtapa, nombreEtapa, onChange }) {
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
      <SelectorGenetica
        id={idGenetica}
        nombre={planta.genetica}
        detalle={planta.geneticaDetalle}
        onChange={(seleccion) => onChange("genetica", seleccion)}
      />
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
          <SelectorFecha
            etiqueta="Inicio de la etapa"
            valor={planta.fechaInicioEtapa}
            onChange={(valor) => onChange("fechaInicioEtapa", valor)}
          />
        </div>
      </Aparecer>
      <SelectorFecha
        etiqueta="Fecha de inicio"
        valor={planta.fechaInicio}
        onChange={(valor) => onChange("fechaInicio", valor)}
      />
    </>
  );
}

export function FormularioPlanta({
  unidadId,
  siguienteNumero = 1,
  metodosPersonalizados = [],
  onCancelar,
}) {
  const [estado, accion, pendiente] = useActionState(crearPlantas, null);
  const [modo, setModo] = useState("diferente");
  const [modoEtapa, setModoEtapa] = useState("misma");
  const [abiertas, setAbiertas] = useState(() => new Set([0]));
  const [general, setGeneral] = useState({
    genetica: "",
    geneticaId: "",
    geneticaDetalle: null,
    metodo: "",
    metodoNombre: "",
    usaSustrato: "",
    sustrato: "",
    etapa: "",
    fechaInicioEtapa: fechaHoy(),
  });
  const [plantas, setPlantas] = useState(() => [plantaNueva(fechaHoy())]);
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

      const fecha = actuales[0]?.fechaInicio || fechaHoy();
      const extra = [];
      for (let i = actuales.length; i < nueva; i += 1) {
        extra.push({
          ...plantaNueva(fecha),
          genetica: usaGenetica(modo) ? general.genetica : "",
          geneticaId: usaGenetica(modo) ? general.geneticaId || "" : "",
          geneticaDetalle: usaGenetica(modo) ? general.geneticaDetalle || null : null,
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
    setAbiertas((actual) => {
      const siguiente = new Set([...actual].filter((indice) => indice < nueva));
      if (!siguiente.size) siguiente.add(0);
      return siguiente;
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

  function aplicarGenetica(seleccion) {
    const campos = camposGenetica(seleccion);
    setGeneral((actual) => ({ ...actual, ...campos }));
    setPlantas((actuales) => actuales.map((planta) => ({ ...planta, ...campos })));
  }

  function cambiarModo(nuevo) {
    const compartida = usaGenetica(nuevo) ? clonarGeneticaCompartida(plantas, general) : null;
    const metodo = usaMetodo(nuevo) ? valorDeLaPrimera(plantas, "metodo") || general.metodo : null;
    const metodoNombre = usaMetodo(nuevo)
      ? valorDeLaPrimera(plantas, "metodoNombre") || general.metodoNombre
      : null;
    const usaSustrato = usaMetodo(nuevo)
      ? valorDeLaPrimera(plantas, "usaSustrato") || general.usaSustrato
      : null;
    const sustrato = usaMetodo(nuevo) ? valorDeLaPrimera(plantas, "sustrato") || general.sustrato : null;

    setModo(nuevo);
    if (compartida || metodo !== null) {
      setGeneral((actual) => ({
        ...actual,
        ...(compartida ? compartida : {}),
        ...(metodo !== null
          ? { metodo, metodoNombre: metodoNombre || "", usaSustrato: usaSustrato || "", sustrato: sustrato || "" }
          : {}),
      }));
    }
    setPlantas((actuales) =>
      actuales.map((planta) => ({
        ...planta,
        genetica: compartida ? compartida.genetica : planta.genetica,
        geneticaId: compartida ? compartida.geneticaId : planta.geneticaId,
        geneticaDetalle: compartida ? compartida.geneticaDetalle : planta.geneticaDetalle,
        metodo: metodo === null ? planta.metodo : metodo,
        metodoNombre: metodoNombre === null ? planta.metodoNombre : metodoNombre || "",
        usaSustrato: usaSustrato === null ? planta.usaSustrato : usaSustrato || "",
        sustrato:
          sustrato === null
            ? planta.sustrato
            : muestraSustrato(metodo, usaSustrato)
              ? sustrato || ""
              : "",
      }))
    );
  }

  function cambiarMetodo(valor, indice) {
    const todas = indice === undefined;
    setGeneral((actual) => {
      if (!todas) return actual;
      return estadoTrasMetodo(actual, valor);
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
    if (campo === "genetica") {
      const campos = camposGenetica(valor);
      setPlantas((actuales) => actuales.map((planta, i) => (i === indice ? { ...planta, ...campos } : planta)));
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
    geneticaId: planta.geneticaId || "",
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
      <ContadorCantidad
        valor={plantas.length}
        onChange={cambiarCantidad}
        minimo={1}
        maximo={MAXIMO}
        contexto="Cantidad de plantas"
        ariaLabel="Cantidad de plantas"
        deshabilitado={pendiente}
      />
      {varias ? (
        <div className="bloque">
          <p className="asistente__actual">Configuración general</p>
          <div className="eleccion eleccion--modos">
            {MODOS.map((item) => (
              <button
                key={item.valor}
                type="button"
                className={modo === item.valor ? "eleccion__activa" : undefined}
                aria-pressed={modo === item.valor}
                onClick={() => cambiarModo(item.valor)}
              >
                {item.etiqueta}
              </button>
            ))}
          </div>
          <p className="eleccion__nota">{MODOS.find((item) => item.valor === modo)?.descripcion}</p>
          <Aparecer visible={usaGenetica(modo)}>
            <SelectorGenetica
              id="genetica-alta-general"
              nombre={general.genetica}
              detalle={general.geneticaDetalle}
              onChange={aplicarGenetica}
            />
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
          <fieldset className="opciones">
            <legend>Etapa inicial</legend>
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
          </fieldset>
          <Aparecer visible={modoEtapa === "misma"}>
            <div>
              <SelectorEtapa
                nombre="etapa-general"
                valor={general.etapa}
                onChange={(valor) => aplicarCompartido("etapa", valor)}
              />
              <SelectorFecha
                etiqueta="Inicio de la etapa"
                valor={general.fechaInicioEtapa}
                onChange={(valor) => aplicarCompartido("fechaInicioEtapa", valor)}
              />
            </div>
          </Aparecer>
        </div>
      ) : null}
      {plantas.map((planta, indice) => {
        const numero = siguienteNumero + indice;
        const titulo = planta.nombre.trim() || `Planta ${numero}`;
        return (
          <PlantaAccordion
            key={numero}
            titulo={titulo}
            meta={planta.genetica || ""}
            abierto={abiertas.has(indice)}
            onToggle={() =>
              setAbiertas((actual) => {
                const siguiente = new Set(actual);
                if (siguiente.has(indice)) siguiente.delete(indice);
                else siguiente.add(indice);
                return siguiente;
              })
            }
          >
            <CamposPlanta
              planta={planta}
              idGenetica={`genetica-alta-${numero}`}
              metodosPersonalizados={metodosPersonalizados}
              mostrarEtapa={!varias || modoEtapa === "individual"}
              nombreEtapa={`etapa-planta-${numero}`}
              onChange={(campo, valor) => cambiarPlanta(indice, campo, valor)}
            />
          </PlantaAccordion>
        );
      })}
      <div className="acciones">
        {onCancelar ? (
          <Boton type="button" variante="ghost" onClick={onCancelar} disabled={pendiente}>
            Cancelar
          </Boton>
        ) : null}
        <Boton type="submit" disabled={pendiente}>
          {plantas.length === 1 ? "Crear 1 planta" : `Crear ${plantas.length} plantas`}
        </Boton>
      </div>
    </form>
  );
}
