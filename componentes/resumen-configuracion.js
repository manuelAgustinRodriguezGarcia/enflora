"use client";

export function ResumenConfiguracion({ titulo, grupos = [], children }) {
  return (
    <aside className="resumen-config">
      {titulo ? <h2 className="resumen-config__titulo">{titulo}</h2> : null}
      {grupos.map((grupo) => (
        <div className="resumen-config__grupo" key={grupo.id || grupo.titulo}>
          {grupo.titulo ? <p className="resumen-config__grupo-titulo">{grupo.titulo}</p> : null}
          {grupo.valor ? <p className="resumen-config__valor">{grupo.valor}</p> : null}
          {grupo.items?.length ? (
            <ul className="resumen-config__lista">
              {grupo.items.map((item) => (
                <li className="resumen-config__item" key={item.id || item.titulo}>
                  {item.onClick ? (
                    <button className="resumen-config__boton" type="button" onClick={item.onClick}>
                      <span className="resumen-config__item-titulo">{item.titulo}</span>
                      {item.meta ? <span className="resumen-config__item-meta">{item.meta}</span> : null}
                    </button>
                  ) : (
                    <>
                      <span className="resumen-config__item-titulo">{item.titulo}</span>
                      {item.meta ? <span className="resumen-config__item-meta">{item.meta}</span> : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
      {children}
    </aside>
  );
}
