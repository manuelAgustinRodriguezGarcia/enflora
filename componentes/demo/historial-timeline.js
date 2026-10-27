"use client";

import { useMemo, useState } from "react";
import { Boton } from "@/componentes/boton";
import { HistorialDia } from "@/componentes/demo/historial-dia";
import { VisorFotos } from "@/componentes/demo/historial-galeria";
import { Selector } from "@/componentes/selector";
import {
  agruparPorMes,
  diasFiltrados,
  etapasConRegistros,
  etiquetaEtapaHistorial,
  fotosDeDia,
  mapaFotos,
} from "@/lib/demo/historial/historial-demo";

const PASO = 10;
const TODO_EL_CULTIVO = "todo";

export function HistorialTimeline({ historial }) {
  const [etapa, setEtapa] = useState("");
  const [visibles, setVisibles] = useState(PASO);
  const [fotoAbierta, setFotoAbierta] = useState(null);
  const mapa = useMemo(() => mapaFotos(historial), [historial]);
  const etapas = etapasConRegistros(historial);
  const dias = diasFiltrados(historial, etapa);
  const recortados = dias.slice(0, visibles);
  const grupos = agruparPorMes(recortados);
  const restantes = dias.length - recortados.length;

  function filtrar(valor) {
    setEtapa(valor);
    setVisibles(PASO);
  }

  return (
    <section className="historial-timeline" aria-labelledby="historial-timeline-titulo">
      <div className="historial-timeline__cabecera">
        <h2 id="historial-timeline-titulo">Registro día a día</h2>
      </div>
      {etapas.length > 1 ? (
        <Selector
          etiqueta="Filtrar por etapa"
          id="historial-filtro-etapa"
          className="historial-filtro-etapa"
          valor={etapa || TODO_EL_CULTIVO}
          onChange={(valor) => filtrar(valor === TODO_EL_CULTIVO ? "" : valor)}
          opciones={[
            { valor: TODO_EL_CULTIVO, etiqueta: "Todo el cultivo" },
            ...etapas.map((item) => ({ valor: item.etapa, etiqueta: etiquetaEtapaHistorial(item.etapa) })),
          ]}
        />
      ) : null}

      {grupos.map((grupo) => (
        <div key={grupo.clave} className="historial-mes">
          <h3 className="historial-mes__titulo">{grupo.titulo}</h3>
          <ol className="historial-dias">
            {grupo.dias.map((dia) => (
              <HistorialDia
                key={dia.id}
                dia={dia}
                fotos={fotosDeDia(historial, dia, mapa)}
                onAbrirFoto={setFotoAbierta}
              />
            ))}
          </ol>
        </div>
      ))}

      {restantes > 0 ? (
        <Boton
          type="button"
          variante="secundario"
          className="boton--ancho"
          onClick={() => setVisibles((valor) => valor + PASO)}
        >
          Mostrar más días ({restantes} {restantes === 1 ? "restante" : "restantes"})
        </Boton>
      ) : (
        <p className="demo__aviso historial-timeline__fin">
          Llegaste al último registro disponible de este cultivo.
        </p>
      )}

      <VisorFotos
        fotos={historial.fotos}
        fotoId={fotoAbierta}
        onCerrar={() => setFotoAbierta(null)}
        onCambiar={setFotoAbierta}
      />
    </section>
  );
}
