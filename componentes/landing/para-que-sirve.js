import Image from "next/image";
import {
  BookOpen,
  IdCard,
  Search,
  TrendingUp,
} from "lucide-react";
import { textos } from "@/lib/landing";

const ICONOS_PLACEHOLDER = {
  libreta: BookOpen,
  lupa: Search,
  fichas: IdCard,
  progreso: TrendingUp,
};

function PlaceholderIlustracion({ placeholder }) {
  const Icono = ICONOS_PLACEHOLDER[placeholder.icono] || BookOpen;

  return (
    <div
      className={`para-que-sirve__placeholder para-que-sirve__placeholder--${placeholder.tono}`}
      aria-hidden="true"
    >
      <span className="para-que-sirve__placeholder-deco para-que-sirve__placeholder-deco--oval" />
      <span className="para-que-sirve__placeholder-deco para-que-sirve__placeholder-deco--spark" />
      <span className="para-que-sirve__placeholder-deco para-que-sirve__placeholder-deco--stroke" />
      <div className="para-que-sirve__placeholder-cuerpo">
        <Icono className="para-que-sirve__placeholder-icono" strokeWidth={1.6} />
        <p className="para-que-sirve__placeholder-etiqueta">{placeholder.etiqueta}</p>
      </div>
    </div>
  );
}

function ZonaIlustracion({ ilustracion }) {
  if (ilustracion.src) {
    return (
      <div className="para-que-sirve__media">
        <Image
          src={ilustracion.src}
          alt={ilustracion.alt || ""}
          fill
          sizes="(min-width: 64rem) 18rem, (min-width: 48rem) 40vw, 70vw"
          className="para-que-sirve__img"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className="para-que-sirve__media" aria-hidden="true">
      <PlaceholderIlustracion placeholder={ilustracion.placeholder} />
    </div>
  );
}

function CardPorQueEnflora({ tarjeta }) {
  return (
    <li className="para-que-sirve__tarjeta" data-revelar>
      <div className="para-que-sirve__tarjeta-inner">
        <ZonaIlustracion ilustracion={tarjeta.ilustracion} />
        <div className="para-que-sirve__tarjeta-texto">
          <span className="para-que-sirve__numero">{tarjeta.numero}</span>
          <h3 className="para-que-sirve__tarjeta-titulo">
            {tarjeta.tituloLineas?.length ? (
              tarjeta.tituloLineas.map((linea) => (
                <span className="para-que-sirve__titulo-linea" key={linea}>
                  {linea}
                </span>
              ))
            ) : (
              tarjeta.titulo
            )}
          </h3>
          <p className="para-que-sirve__tarjeta-descripcion">{tarjeta.descripcion}</p>
        </div>
      </div>
    </li>
  );
}

export function ParaQueSirve() {
  const { queEs } = textos;

  return (
    <section className="para-que-sirve" id="para-que-sirve" data-logo="dark">
      <div className="para-que-sirve__fondo" aria-hidden="true" />
      <div className="para-que-sirve__layout">
        <header className="para-que-sirve__encabezado" data-revelar>
          <h2 className="para-que-sirve__titulo">
            <span className="para-que-sirve__titulo-prefijo">{queEs.tituloPrefijo}</span>{" "}
            <span className="para-que-sirve__titulo-marca">{queEs.tituloMarca}</span>
          </h2>
          <p className="para-que-sirve__bajada">{queEs.bajada}</p>
        </header>

        <ul className="para-que-sirve__grilla" aria-label="Por qué cultivar con ENFLORA">
          {queEs.tarjetas.map((tarjeta) => (
            <CardPorQueEnflora key={tarjeta.id} tarjeta={tarjeta} />
          ))}
        </ul>
      </div>
    </section>
  );
}
