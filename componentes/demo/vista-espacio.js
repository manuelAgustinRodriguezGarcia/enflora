"use client";

import { Aparecer } from "@/componentes/aparecer";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { TransicionVista } from "@/componentes/transicion-vista";
import { useDemo } from "@/componentes/demo/proveedor-demo";
import { VolverDemo } from "@/componentes/demo/volver-demo";
import { etiquetaTipoEspacio, etiquetaTipoUnidad, textoCantidad } from "@/lib/unidades";

export function VistaEspacio() {
  const { estado, verUnidad } = useDemo();
  const espacio = estado.espacios.find((item) => item.id === estado.navegacion.espacioId);
  if (!espacio) return null;

  const unidades = estado.unidades
    .filter((item) => item.espacio_id === espacio.id)
    .sort((a, b) => a.numero - b.numero);
  const cantidades = Object.fromEntries(
    unidades.map((unidad) => [
      unidad.id,
      estado.plantas.filter((planta) => planta.unidad_cultivo_id === unidad.id).length,
    ])
  );
  const total = Object.values(cantidades).reduce((suma, cantidad) => suma + cantidad, 0);
  const recienCreado = estado.aviso?.tipo === "espacio-creado" && estado.aviso.espacioId === espacio.id;

  return (
    <TransicionVista key={espacio.id}>
      <section className="espacio demo-modulo">
        <VolverDemo etiqueta="Volver a espacios" />
        <Aparecer visible={recienCreado}>
          <p className="demo-confirmacion" role="status">
            <strong>¡Tu espacio está listo!</strong> Tocá una unidad para ver sus plantas.
          </p>
        </Aparecer>
        <header className="detalle-cabecera">
          <h1 className="detalle-cabecera__titulo">{espacio.nombre}</h1>
          <div className="detalle-cabecera__fila">
            <span className={`detalle-cabecera__chip detalle-cabecera__chip--${espacio.tipo}`}>
              {etiquetaTipoEspacio(espacio.tipo)}
            </span>
            <span className="detalle-cabecera__meta">
              {unidades.length === 1 ? "1 unidad" : `${unidades.length} unidades`}
            </span>
            <span className="detalle-cabecera__meta">{textoCantidad(total)}</span>
          </div>
        </header>
        <h2>Unidades</h2>
        <ListaEntrada>
          {unidades.map((unidad) => (
            <li key={unidad.id}>
              <button type="button" className="tarjeta demo-pulsable" onClick={() => verUnidad(unidad.id)}>
                <span className="tarjeta__cabecera">
                  <span className="tarjeta__nombre">{unidad.nombre}</span>
                  <span className="tarjeta__tipo">
                    {etiquetaTipoUnidad(unidad.tipo, unidad.tipo_personalizado || "")}
                  </span>
                </span>
                <span className="tarjeta__metricas">
                  <span className="tarjeta__dato">
                    <span className="tarjeta__etiqueta">Plantas</span>
                    <span className="tarjeta__valor">{textoCantidad(cantidades[unidad.id] || 0)}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ListaEntrada>
      </section>
    </TransicionVista>
  );
}
