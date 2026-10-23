"use client";

import { Boton } from "@/componentes/boton";
import { ContenidoTarjetaPlanta } from "@/componentes/contenido-tarjeta-planta";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { TransicionVista } from "@/componentes/transicion-vista";
import { ActividadDemo } from "@/componentes/demo/actividad-demo";
import { useDemo } from "@/componentes/demo/proveedor-demo";
import { VolverDemo } from "@/componentes/demo/volver-demo";
import { registrosDeUnidad } from "@/lib/demo/registros-demo";
import { datosEtapaActual, esEtapa, fechaHoy } from "@/lib/etapas";
import { etiquetaTipoUnidad, textoCantidad } from "@/lib/unidades";

export function VistaUnidad() {
  const { estado, verPlanta, registrarDesde } = useDemo();
  const unidad = estado.unidades.find((item) => item.id === estado.navegacion.unidadId);
  if (!unidad) return null;

  const espacio = estado.espacios.find((item) => item.id === unidad.espacio_id);
  const plantas = estado.plantas
    .filter((planta) => planta.unidad_cultivo_id === unidad.id)
    .sort((a, b) => a.numero - b.numero);
  const hoy = fechaHoy();

  return (
    <TransicionVista key={unidad.id}>
      <section className="espacio demo-modulo">
        <VolverDemo etiqueta="Volver al espacio" />
        <header className="detalle-cabecera">
          <h1 className="detalle-cabecera__titulo">{unidad.nombre}</h1>
          <div className="detalle-cabecera__fila">
            <span className="detalle-cabecera__chip">
              {etiquetaTipoUnidad(unidad.tipo, unidad.tipo_personalizado || "")}
            </span>
            <span className="detalle-cabecera__meta">{textoCantidad(plantas.length)}</span>
            {espacio ? <span className="detalle-cabecera__meta">{espacio.nombre}</span> : null}
          </div>
        </header>
        <div className="demo-registrar">
          <Boton type="button" className="boton--ancho" onClick={() => registrarDesde(unidad.id, "plantas")}>
            Registrar actividad
          </Boton>
          <Boton
            type="button"
            variante="secundario"
            className="boton--ancho"
            onClick={() => registrarDesde(unidad.id, "ambiente")}
          >
            Registrar ambiente
          </Boton>
        </div>
        <div className="seleccion-plantas">
          <div className="seleccion-plantas__cabecera">
            <h2>Plantas</h2>
          </div>
          <ListaEntrada>
            {plantas.map((planta) => {
              const clase = esEtapa(planta.etapa)
                ? `tarjeta tarjeta--planta tarjeta--${planta.etapa}`
                : "tarjeta tarjeta--planta";
              return (
                <li key={planta.id}>
                  <button
                    type="button"
                    className={`${clase} demo-pulsable`}
                    onClick={() => verPlanta(planta.id)}
                    aria-label={`Ver ${planta.nombre}`}
                  >
                    <ContenidoTarjetaPlanta planta={planta} datos={datosEtapaActual(planta.etapa, planta.historial, hoy)} />
                  </button>
                </li>
              );
            })}
          </ListaEntrada>
        </div>
        <ActividadDemo
          id="demo-actividad-unidad"
          registros={registrosDeUnidad(estado.registros, unidad.id)}
          titulo="Actividad de la unidad"
          vacio="Todavía no registraste actividad en esta unidad."
        />
      </section>
    </TransicionVista>
  );
}
