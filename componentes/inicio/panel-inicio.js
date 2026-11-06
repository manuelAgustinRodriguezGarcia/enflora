import Link from "next/link";
import { ArrowUpDown, Images } from "lucide-react";
import { IconoNavegacion } from "@/componentes/icono-navegacion";
import { IconoPreferencia } from "@/componentes/icono-preferencia";
import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { ResumenClimaInicio } from "@/componentes/clima/resumen-inicio";
import { InvitacionFeedback } from "@/componentes/invitacion-feedback";
import { BotonReporteProblema } from "@/componentes/problemas/boton-reporte-problema";
import { ACCIONES_CULTIVO, hrefAccionCultivo } from "@/lib/inicio/resumen";

function textoDia(dia) {
  if (dia === null || dia === undefined) return "Sin día de inicio";
  return `Día ${dia}`;
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

function IconoAccionCultivo({ clave }) {
  switch (clave) {
    case "registrar":
      return <IconoNavegacion clave="registro" />;
    case "foto":
    case "problema":
    case "riego":
      return <IconoPreferencia clave={clave} />;
    case "etapa":
      return <ArrowUpDown className="icono-navegacion" strokeWidth={1.75} aria-hidden="true" />;
    default:
      return null;
  }
}

function AccionesCultivo({ unidad }) {
  return (
    <div className="inicio__acciones inicio__acciones--cultivo" role="group" aria-label={`Acciones de ${unidad.nombre}`}>
      {ACCIONES_CULTIVO.map((accion) =>
        accion.clave === "problema" ? (
          <BotonReporteProblema
            key={accion.clave}
            className="inicio__accion inicio__accion--problema"
            origen="inicio"
            unidadId={unidad.id}
          >
            <IconoAccionCultivo clave={accion.clave} />
            <span>{accion.etiqueta}</span>
          </BotonReporteProblema>
        ) : (
          <Link
            key={accion.clave}
            className="inicio__accion"
            href={hrefAccionCultivo(unidad, accion.clave)}
          >
            <IconoAccionCultivo clave={accion.clave} />
            <span>{accion.etiqueta}</span>
          </Link>
        ),
      )}
    </div>
  );
}

function EtapasUnidad({ unidad }) {
  if (unidad.uniforme) {
    return (
      <span className="inicio__etapas">
        <IndicadorEtapa
          etapa={unidad.etapaCodigo}
          tamano="compacto"
          conteo={unidad.plantasActivas}
          dias={Number.isFinite(unidad.diaUnico) ? [unidad.diaUnico] : []}
        />
      </span>
    );
  }

  return (
    <span className="inicio__etapas inicio__etapas--filas">
      {unidad.etapasConPlantas.map((item) => (
        <span key={item.etapa || "sin-etapa"} className="inicio__etapa-fila">
          <IndicadorEtapa etapa={item.etapa} tamano="compacto" conteo={item.cantidad} dias={item.dias} />
        </span>
      ))}
    </span>
  );
}

function TarjetaUnidad({ unidad }) {
  return (
    <li>
      <article className="tarjeta inicio__tarjeta">
        <div className="tarjeta__cuerpo inicio__cuerpo">
          <span className="tarjeta__cabecera">
            <span className="inicio__identidad">
              <Link className="tarjeta__nombre inicio__nombre" href={unidad.href}>
                {unidad.nombre}
              </Link>
              {unidad.espacioNombre ? (
                <Link className="inicio__lugar" href={unidad.hrefEspacio}>
                  {`en ${unidad.espacioNombre}`}
                </Link>
              ) : null}
              {unidad.uniforme ? <EtapasUnidad unidad={unidad} /> : null}
            </span>
            {unidad.tipoEtiqueta || Number.isFinite(unidad.diaUnidad) ? (
              <span className="inicio__lateral">
                {Number.isFinite(unidad.diaUnidad) ? (
                  <span className="inicio__dia">{textoDia(unidad.diaUnidad)}</span>
                ) : null}
                {unidad.tipoEtiqueta ? (
                  <span className={claseTipoEspacio(unidad.tipoEspacio)}>{unidad.tipoEtiqueta}</span>
                ) : null}
              </span>
            ) : null}
          </span>
          {unidad.uniforme ? null : <EtapasUnidad unidad={unidad} />}
          <Link className="inicio__ficha" href={unidad.href} tabIndex={-1} aria-hidden="true" />
        </div>
        <AccionesCultivo unidad={unidad} />
      </article>
    </li>
  );
}

function FotosInicio({ fotos }) {
  if (!fotos.length) {
    return (
      <section className="inicio__fotos" aria-label="Galería de Flora">
        <p>Mirá las fotos de tus plantas en</p>
        <Link className="inicio__galeria" href="/galeria">
          <Images strokeWidth={1.75} aria-hidden="true" />
          <span>Galería de Flora</span>
        </Link>
      </section>
    );
  }

  const visibles = fotos.slice(0, 3);

  return (
    <section className="inicio__fotos inicio__fotos--muestra" aria-labelledby="inicio-fotos">
      <header className="inicio__fotos-cabecera">
        <h2 id="inicio-fotos">Tus últimas fotos</h2>
        <p>Podés ver todas las fotos en tu galería</p>
      </header>
      <ul
        className="inicio__fotos-fila"
        style={{ gridTemplateColumns: `repeat(${visibles.length + 1}, minmax(0, 1fr))` }}
      >
        {visibles.map((foto) => (
          <li key={foto.id}>
            <Link className="inicio__foto" href="/galeria" aria-label={foto.etiqueta}>
              {foto.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto.url} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="inicio__foto-vacia">Sin vista previa</span>
              )}
              {foto.unidad || foto.fecha ? (
                <span className="inicio__foto-meta">
                  {foto.unidad ? <span className="inicio__foto-unidad">{foto.unidad}</span> : null}
                  {foto.fecha ? <span className="inicio__foto-fecha">{foto.fecha}</span> : null}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
        <li>
          <Link className="inicio__fotos-galeria" href="/galeria">
            <Images strokeWidth={1.75} aria-hidden="true" />
            <span>Galería de Flora</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}

export function PanelInicio({ panel, saludo = "Inicio", clima = null, fotos = [] }) {
  const cultivos = panel.cultivos;

  return (
    <div className="inicio">
      <header className="inicio__cabecera">
        <h1 className="inicio__saludo">
          <span className="inicio__saludo-texto">{saludo}</span>
          <span className="inicio__saludo-flora" aria-hidden="true">
            <img src="/images/flora-dashboard.png" alt="" />
          </span>
        </h1>
      </header>

      <ResumenClimaInicio clima={clima} />

      <Seccion id="inicio-cultivos" titulo="Tus cultivos">
        {cultivos.estado === "error" ? <Aviso error>No se pudieron cargar los cultivos.</Aviso> : null}
        {cultivos.estado === "vacio" ? (
          <div className="inicio__vacio-accion">
            <Link className="inicio__crear" href="/cultivos/nuevo">
              Creá tu cultivo
            </Link>
          </div>
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

      <FotosInicio fotos={fotos} />
      <InvitacionFeedback />
    </div>
  );
}
