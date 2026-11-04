"use client";

import { useState } from "react";
import { Eye, Flower2 } from "lucide-react";
import { FabNuevoChatFlora } from "@/componentes/flora/fab-nuevo-chat-flora";
import { FormularioGenetica } from "@/componentes/formulario-genetica";
import { FiguraGenetica, ModalGenetica } from "@/componentes/modal-genetica";
import { BuscadorGenetica, olvidarGenetica, recordarGenetica, textoPillGenetica } from "@/componentes/selector-genetica";
import { filtrarGeneticasPropias } from "@/lib/geneticas/reglas";

export function ListaGeneticas({ iniciales = [], esquemaAusente = false }) {
  const [geneticas, setGeneticas] = useState(iniciales);
  const [origen, setOrigen] = useState(iniciales);
  const [consulta, setConsulta] = useState("");
  const [ficha, setFicha] = useState(null);
  const [crear, setCrear] = useState(false);

  if (origen !== iniciales) {
    setOrigen(iniciales);
    setGeneticas(iniciales);
  }

  const visibles = filtrarGeneticasPropias(geneticas, consulta);

  if (esquemaAusente) {
    return <p>Falta aplicar la migración de genéticas en Supabase.</p>;
  }

  function sumar(detalle) {
    recordarGenetica(detalle);
    setGeneticas((actuales) => [detalle, ...actuales.filter((item) => item.id !== detalle.id)]);
    setConsulta("");
    setCrear(false);
    setFicha(detalle);
  }

  return (
    <div className="mis-geneticas">
      <FabNuevoChatFlora ariaLabel="Nueva genética" onClick={() => setCrear(true)} />
      <BuscadorGenetica
        id="buscar-mis-geneticas"
        etiqueta="Buscar"
        iniciales={geneticas}
        permitirCrear={false}
        onConsulta={setConsulta}
        onElegir={(genetica) => {
          setConsulta("");
          setFicha(genetica);
        }}
      />
      {visibles.length ? (
        <ul className="mis-geneticas__lista">
          {visibles.map((genetica) => (
            <li key={genetica.id}>
              <div className="genetica-tarjeta">
                <FiguraGenetica detalle={genetica} nombre={genetica.nombre} />
                <div className="genetica-tarjeta__cuerpo">
                  <span className="genetica-tarjeta__nombre">{genetica.nombre}</span>
                  <span className="genetica-tarjeta__pills">
                    <span className="genetica-tarjeta__pill genetica-tarjeta__pill--thc">
                      THC {textoPillGenetica(genetica.thc)}
                    </span>
                    <span className="genetica-tarjeta__pill genetica-tarjeta__pill--cbd">
                      CBD {textoPillGenetica(genetica.cbd)}
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  className="genetica-tarjeta__datos"
                  aria-label={`Ver datos de ${genetica.nombre}`}
                  onClick={() => setFicha(genetica)}
                >
                  <Eye strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="mis-geneticas__vacio">
            {geneticas.length
              ? "No hay genéticas con ese nombre."
              : "Todavía no cargaste genéticas."}
          </p>
          {geneticas.length ? null : (
            <button type="button" className="mis-geneticas__cargar" onClick={() => setCrear(true)}>
              <Flower2 strokeWidth={1.75} aria-hidden="true" />
              Cargá tus genéticas
            </button>
          )}
        </>
      )}
      <FormularioGenetica
        abierto={crear}
        onCerrar={() => setCrear(false)}
        onCreada={sumar}
      />
      <ModalGenetica
        abierto={Boolean(ficha)}
        detalle={ficha}
        nombre={ficha?.nombre || ""}
        onCerrar={() => setFicha(null)}
        onActualizada={(detalle) => {
          recordarGenetica(detalle);
          setGeneticas((actuales) => [detalle, ...actuales.filter((item) => item.id !== detalle.id)]);
          setFicha(detalle);
        }}
        onEliminada={(id) => {
          olvidarGenetica(id);
          setGeneticas((actuales) => actuales.filter((item) => item.id !== id));
          setFicha(null);
        }}
      />
    </div>
  );
}
