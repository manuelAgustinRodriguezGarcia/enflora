"use client";

import { TextoCambio } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { etiquetaEstadoPlanta } from "@/componentes/contenido-tarjeta-planta";
import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { TransicionVista } from "@/componentes/transicion-vista";
import { ActividadDemo } from "@/componentes/demo/actividad-demo";
import { CambiarEtapaDemo, EtapaProgresoDemo } from "@/componentes/demo/etapas-planta-demo";
import { useDemo } from "@/componentes/demo/proveedor-demo";
import { VolverDemo } from "@/componentes/demo/volver-demo";
import { registrosDePlanta } from "@/lib/demo/registros-demo";
import {
  datosEtapaActual,
  diasEntre,
  esEtapa,
  fechaHoy,
  fechaInicioPlanta,
  formatearFecha,
  textoDias,
} from "@/lib/etapas";

function periodoHistorial(fila) {
  const inicio = formatearFecha(fila.fecha_inicio);
  if (!fila.fecha_fin) return `Desde ${inicio}`;
  return `${inicio} → ${formatearFecha(fila.fecha_fin)}`;
}

export function VistaPlanta() {
  const { estado, registrarDesde } = useDemo();
  const planta = estado.plantas.find((item) => item.id === estado.navegacion.plantaId);
  if (!planta) return null;

  const unidad = estado.unidades.find((item) => item.id === planta.unidad_cultivo_id);
  const espacio = estado.espacios.find((item) => item.id === unidad?.espacio_id);
  const hoy = fechaHoy();
  const historial = planta.historial || [];
  const datos = datosEtapaActual(planta.etapa, historial, hoy);
  const inicioPlanta = fechaInicioPlanta(planta);

  return (
    <TransicionVista key={planta.id}>
      <section className="espacio demo-modulo">
        <VolverDemo etiqueta="Volver a la unidad" />
        <header className="detalle-cabecera">
          <div className="detalle-cabecera__superior">
            <h1 className="detalle-cabecera__titulo">{planta.nombre}</h1>
          </div>
          <div className="tarjeta__metricas">
            <span className="tarjeta__dato">
              <span className="tarjeta__etiqueta">Genética</span>
              <span className="tarjeta__valor">{planta.genetica || "—"}</span>
            </span>
            <span className="tarjeta__dato">
              <span className="tarjeta__etiqueta">Método</span>
              <span className="tarjeta__valor">{planta.metodo || "—"}</span>
            </span>
            <span className="tarjeta__dato">
              <span className="tarjeta__etiqueta">Estado</span>
              <span className="tarjeta__valor">
                <TextoCambio>{etiquetaEstadoPlanta(planta.estado)}</TextoCambio>
              </span>
            </span>
            <span className="tarjeta__dato">
              <span className="tarjeta__etiqueta">Inicio</span>
              <span className="tarjeta__valor">{formatearFecha(inicioPlanta)}</span>
            </span>
            <span className="tarjeta__dato">
              <span className="tarjeta__etiqueta">Antigüedad</span>
              <span className="tarjeta__valor">{textoDias(Math.max(0, diasEntre(inicioPlanta, hoy)))}</span>
            </span>
            <span className="tarjeta__dato">
              <span className="tarjeta__etiqueta">Ubicación</span>
              <span className="tarjeta__valor">
                {espacio?.nombre || "—"} · {unidad?.nombre || "—"}
              </span>
            </span>
          </div>
        </header>
        <EtapaProgresoDemo
          planta={planta}
          dia={datos.dia}
          inicio={datos.inicio ? formatearFecha(datos.inicio) : ""}
        />
        <h2>Historial de etapas</h2>
        <ListaEntrada>
          {historial.map((fila, indice) => {
            const fin = fila.fecha_fin || hoy;
            const clase = esEtapa(fila.etapa)
              ? `tarjeta tarjeta--historial tarjeta--${fila.etapa}`
              : "tarjeta tarjeta--historial";
            return (
              <li className={clase} key={`${fila.etapa}-${fila.fecha_inicio}-${indice}`}>
                <IndicadorEtapa etapa={fila.etapa} tamano="compacto" />
                <div className="tarjeta__historial-derecha">
                  <span className="tarjeta__dias">{textoDias(diasEntre(fila.fecha_inicio, fin))}</span>
                  <span className="tarjeta__meta">{periodoHistorial(fila)}</span>
                </div>
              </li>
            );
          })}
        </ListaEntrada>
        <CambiarEtapaDemo planta={planta} />
        {unidad ? (
          <Boton
            type="button"
            variante="secundario"
            className="boton--ancho"
            onClick={() => registrarDesde(unidad.id, "plantas", [planta.id])}
          >
            Registrar actividad de esta planta
          </Boton>
        ) : null}
        <ActividadDemo
          id="demo-actividad-planta"
          registros={registrosDePlanta(estado.registros, planta.id)}
          titulo="Actividad de la planta"
          vacio="Todavía no registraste actividad para esta planta."
        />
      </section>
    </TransicionVista>
  );
}
