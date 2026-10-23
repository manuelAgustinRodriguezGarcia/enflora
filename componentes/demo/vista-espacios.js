"use client";

import { Boton } from "@/componentes/boton";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { TransicionVista } from "@/componentes/transicion-vista";
import { AccionesDemo } from "@/componentes/demo/acciones-demo";
import { GuiaDemo } from "@/componentes/demo/guia-demo";
import { useDemo } from "@/componentes/demo/proveedor-demo";
import { puedeCrearEspacio } from "@/lib/demo/estado-demo";
import { LIMITES_DEMO } from "@/lib/demo/generar-cultivo";
import { etiquetaTipoEspacio, textoCantidad } from "@/lib/unidades";

export function VistaEspacios() {
  const { estado, irACrear, verEspacio } = useDemo();

  return (
    <TransicionVista>
      <section className="espacios demo-modulo">
        <GuiaDemo />
        <h1>Espacios</h1>
        {puedeCrearEspacio(estado) ? (
          <Boton type="button" onClick={irACrear}>
            Crear espacio
          </Boton>
        ) : (
          <p className="demo__aviso">
            Llegaste al máximo de {LIMITES_DEMO.espacios} espacios de esta demo.
          </p>
        )}
        <ListaEntrada>
          {estado.espacios.map((espacio) => {
            const unidades = estado.unidades.filter((unidad) => unidad.espacio_id === espacio.id);
            const ids = new Set(unidades.map((unidad) => unidad.id));
            const plantas = estado.plantas.filter((planta) => ids.has(planta.unidad_cultivo_id)).length;
            return (
              <li className="tarjeta" key={espacio.id}>
                <button
                  type="button"
                  className="tarjeta__cuerpo demo-pulsable"
                  onClick={() => verEspacio(espacio.id)}
                >
                  <span className="tarjeta__cabecera">
                    <span className="tarjeta__nombre">{espacio.nombre}</span>
                    <span className="tarjeta__tipo">{etiquetaTipoEspacio(espacio.tipo)}</span>
                  </span>
                  <span className="tarjeta__metricas">
                    <span className="tarjeta__dato">
                      <span className="tarjeta__etiqueta">Unidades</span>
                      <span className="tarjeta__valor">
                        {unidades.length === 1 ? "1 unidad" : `${unidades.length} unidades`}
                      </span>
                    </span>
                    <span className="tarjeta__dato">
                      <span className="tarjeta__etiqueta">Plantas</span>
                      <span className="tarjeta__valor">{textoCantidad(plantas)}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ListaEntrada>
        <AccionesDemo />
      </section>
    </TransicionVista>
  );
}
