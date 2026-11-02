import Link from "next/link";
import { EnlaceBoton } from "@/componentes/boton";
import { IndicadorEtapa } from "@/componentes/indicador-etapa";

function textoDia(dia) {
  if (dia === null || dia === undefined) return "Sin día de inicio";
  return `Día ${dia}`;
}

function textoPlantas(cantidad) {
  return cantidad === 1 ? "1 planta activa" : `${cantidad} plantas activas`;
}

function Seccion({ id, titulo, enlace, children }) {
  return (
    <section className="inicio__seccion" aria-labelledby={id}>
      <div className="inicio__seccion-cabecera">
        <h2 id={id}>{titulo}</h2>
        {enlace ? (
          <Link className="inicio__enlace" href={enlace.href}>
            {enlace.etiqueta}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Aviso({ children, error = false }) {
  return (
    <p className={error ? "inicio__error" : "inicio__vacio"} role={error ? "alert" : undefined}>
      {children}
    </p>
  );
}

function claseTipoEspacio(tipo) {
  if (tipo === "interior" || tipo === "exterior") return `tarjeta__tipo tarjeta__tipo--${tipo}`;
  return "tarjeta__tipo";
}

function TarjetaUnidad({ unidad }) {
  return (
    <li>
      <Link className="tarjeta inicio__tarjeta" href={unidad.href}>
        <span className="tarjeta__cabecera">
          <span className="tarjeta__nombre">{unidad.nombre}</span>
          {unidad.tipoEtiqueta ? (
            <span className={claseTipoEspacio(unidad.tipoEspacio)}>{unidad.tipoEtiqueta}</span>
          ) : null}
        </span>
        <span className="inicio__lugar">{unidad.espacioNombre}</span>
        {unidad.uniforme ? (
          <span className="inicio__uniforme">
            <IndicadorEtapa etapa={unidad.etapaCodigo} tamano="compacto" />
            <span>{textoDia(unidad.diaUnico)}</span>
            <span>{textoPlantas(unidad.plantasActivas)}</span>
          </span>
        ) : (
          <>
            <span className="inicio__lugar">{textoPlantas(unidad.plantasActivas)}</span>
            <span className="inicio__lineas">
              {unidad.lineas.map((linea) => (
                <span className="inicio__linea" key={linea.id}>
                  <span className="inicio__linea-nombre">{linea.nombre}</span>
                  <IndicadorEtapa etapa={linea.etapa} tamano="compacto" />
                  <span>{textoDia(linea.dia)}</span>
                </span>
              ))}
            </span>
            {unidad.lineasOcultas > 0 ? (
              <span className="inicio__lugar">
                {unidad.lineasOcultas === 1 ? "y 1 planta más" : `y ${unidad.lineasOcultas} plantas más`}
              </span>
            ) : null}
          </>
        )}
      </Link>
    </li>
  );
}

export function PanelInicio({ panel }) {
  const cultivos = panel.cultivos;
  const tareas = panel.tareas;

  return (
    <div className="inicio">
      <header className="inicio__cabecera">
        <h1>Inicio</h1>
      </header>

      <section className="inicio__seccion" aria-labelledby="inicio-acciones">
        <h2 id="inicio-acciones" className="inicio__sr">
          Acciones rápidas
        </h2>
        <div className="inicio__acciones">
          {panel.acciones.map((accion) => (
            <EnlaceBoton
              key={accion.clave}
              href={accion.href}
              variante={accion.primaria ? undefined : "secundario"}
              className="inicio__accion"
            >
              {accion.etiqueta}
            </EnlaceBoton>
          ))}
        </div>
      </section>

      <Seccion id="inicio-cultivos" titulo="Cultivos activos" enlace={{ href: "/espacios", etiqueta: "Ver cultivos" }}>
        {cultivos.estado === "error" ? <Aviso error>No se pudieron cargar los cultivos.</Aviso> : null}
        {cultivos.estado === "vacio" ? (
          <Aviso>
            No hay cultivos activos.{" "}
            <Link href="/espacios/nuevo">Crear un espacio</Link>
          </Aviso>
        ) : null}
        {cultivos.estado === "listo" ? (
          <>
            {cultivos.avisoEtapas ? <Aviso>{cultivos.avisoEtapas}</Aviso> : null}
            <ul className="inicio__lista">
              {cultivos.unidades.map((unidad) => (
                <TarjetaUnidad key={unidad.id} unidad={unidad} />
              ))}
            </ul>
          </>
        ) : null}
      </Seccion>

      <Seccion id="inicio-tareas" titulo="Próximas tareas">
        {tareas.estado === "no_disponible" ? (
          <Aviso>Las tareas programadas no están disponibles en esta base.</Aviso>
        ) : null}
        {tareas.estado === "error" ? <Aviso error>No se pudieron cargar las tareas.</Aviso> : null}
        {tareas.estado === "vacio" ? <Aviso>No hay tareas pendientes.</Aviso> : null}
        {tareas.estado === "listo" ? (
          <ul className="inicio__bloque">
            {tareas.items.map((tarea) => (
              <li key={tarea.id}>
                <Link className="inicio__evento" href={tarea.href}>
                  <span className="inicio__evento-titulo">{tarea.descripcion}</span>
                  <span className="inicio__evento-meta">
                    <span className={tarea.vencida ? "inicio__vencida" : undefined}>
                      {tarea.vencida ? `Vencida · ${tarea.textoFecha}` : tarea.textoFecha}
                    </span>
                    {tarea.unidadNombre ? ` · ${tarea.unidadNombre}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Seccion>
    </div>
  );
}
