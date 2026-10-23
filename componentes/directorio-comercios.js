import Link from "next/link";
import { enlaceExternoSeguro } from "@/lib/publicidad";
import { MarcaEnflora } from "@/componentes/marca-enflora";

const ETIQUETAS_PLAN = {
  presencia: "Presencia",
  visibilidad: "Visibilidad",
  inteligente: "Inteligente",
};

function TarjetaComercio({ comercio }) {
  const sitio = enlaceExternoSeguro(comercio.sitio_web);
  const plan = ETIQUETAS_PLAN[comercio.plan] || comercio.plan;

  return (
    <article className="directorio__tarjeta">
      <div className="directorio__logo-wrap">
        {comercio.logo_url ? (
          <img
            className="directorio__logo"
            src={comercio.logo_url}
            alt=""
            width={96}
            height={96}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="directorio__logo-vacio" aria-hidden="true">
            {comercio.nombre.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="directorio__cuerpo">
        <h2 className="directorio__nombre">{comercio.nombre}</h2>
        {comercio.rubro ? <p className="directorio__rubro">{comercio.rubro}</p> : null}
        <p className="directorio__plan">Plan {plan}</p>
        {sitio ? (
          <a
            className="directorio__enlace"
            href={sitio}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visitar sitio
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function DirectorioComercios({ comercios = [] }) {
  if (!comercios.length) {
    return (
      <div className="directorio__vacio">
        <p className="directorio__vacio-titulo">Todavía no hay comercios asociados.</p>
        <p className="directorio__vacio-texto">
          Cuando una marca active su acuerdo con <MarcaEnflora /> Partners, va a aparecer acá.
        </p>
        <Link className="landing__accion landing__accion--acento" href="/#partners">
          Conocer <MarcaEnflora /> Partners
        </Link>
      </div>
    );
  }

  return (
    <ul className="directorio__grilla">
      {comercios.map((comercio) => (
        <li key={comercio.id}>
          <TarjetaComercio comercio={comercio} />
        </li>
      ))}
    </ul>
  );
}
