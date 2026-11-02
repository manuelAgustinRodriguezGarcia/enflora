"use client";

import { IconoPlanta } from "@/componentes/iconos-ui";
import { etiquetaTipoEspacio, textoCantidad } from "@/lib/unidades";

function GrupoEspacioResumen({ grupo }) {
  const tipo = grupo.tipoEspacio === "interior" || grupo.tipoEspacio === "exterior" ? grupo.tipoEspacio : null;
  return (
    <div className="resumen-config__grupo resumen-config__grupo--espacio">
      <div className="resumen-config__espacio-cabecera">
        {grupo.titulo ? <p className="resumen-config__grupo-titulo">{grupo.titulo}</p> : null}
        {tipo ? (
          <span className={`tarjeta__tipo tarjeta__tipo--${tipo}`}>{etiquetaTipoEspacio(tipo)}</span>
        ) : null}
      </div>
      {grupo.nombre ? <p className="resumen-config__espacio-nombre">{grupo.nombre}</p> : null}
    </div>
  );
}

export function PillPlantas({ cantidad }) {
  if (!Number.isInteger(cantidad) || cantidad <= 0) return null;

  return (
    <span className="resumen-config__plantas" aria-label={textoCantidad(cantidad)}>
      <IconoPlanta className="resumen-config__plantas-icono" />
      <span aria-hidden="true">x{cantidad}</span>
    </span>
  );
}

function ContenidoItem({ item }) {
  return (
    <>
      <span className="resumen-config__item-textos">
        <span className="resumen-config__item-titulo">{item.titulo}</span>
        {item.meta ? <span className="resumen-config__item-meta">{item.meta}</span> : null}
      </span>
      <PillPlantas cantidad={item.cantidadPlantas} />
    </>
  );
}

export function ResumenConfiguracion({ titulo, grupos = [], children }) {
  return (
    <aside className="resumen-config">
      {titulo ? <h2 className="resumen-config__titulo">{titulo}</h2> : null}
      {grupos.map((grupo) =>
        grupo.presentacion === "espacio" ? (
          <GrupoEspacioResumen key={grupo.id || grupo.titulo} grupo={grupo} />
        ) : (
          <div className="resumen-config__grupo" key={grupo.id || grupo.titulo}>
            {grupo.titulo ? <p className="resumen-config__grupo-titulo">{grupo.titulo}</p> : null}
            {grupo.valor ? <p className="resumen-config__valor">{grupo.valor}</p> : null}
            {grupo.items?.length ? (
              <ul className="resumen-config__lista">
                {grupo.items.map((item) => (
                  <li className="resumen-config__item" key={item.id || item.titulo}>
                    {item.onClick ? (
                      <button className="resumen-config__boton" type="button" onClick={item.onClick}>
                        <ContenidoItem item={item} />
                      </button>
                    ) : (
                      <ContenidoItem item={item} />
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ),
      )}
      {children}
    </aside>
  );
}
