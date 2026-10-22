import { ArrowUpRight, CalendarDays, Clock3, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { EntradaExpo, RuletaVitrina } from "@/componentes/expo-cannabis/entrada-expo";
import { IlustracionRegalo } from "@/componentes/expo-cannabis/ilustraciones-expo";
import { TextoExpo } from "@/componentes/expo-cannabis/proveedor-expo";
import { expoCannabis } from "@/lib/expo-cannabis/configuracion";
import { ACIERTOS_PARA_GANAR, VIDAS_INICIALES } from "@/lib/ruleta-420/configuracion";

const { ids, textos, regalos } = expoCannabis;

const ICONOS_DONDE = {
  fecha: CalendarDays,
  lugar: MapPin,
  horario: Clock3,
};

function completarRegla(regla) {
  return regla.replace("{vidas}", VIDAS_INICIALES).replace("{aciertos}", ACIERTOS_PARA_GANAR);
}

function ExpoRegalos() {
  const premios = textos.premios;
  const donde = textos.donde;

  return (
    <section
      className="expo-regalos"
      id={ids.premios}
      data-logo="dark"
      aria-labelledby={`${ids.premios}-titulo`}
    >
      <div className="expo-contenedor">
        <EntradaExpo className="expo-encabezado">
          <p className="expo-eyebrow">
            <TextoExpo textos={premios.eyebrow} />
          </p>
          <h3 className="expo-titulo" id={`${ids.premios}-titulo`}>
            <TextoExpo textos={premios.titulo} />
          </h3>
          <p className="expo-bajada">
            <TextoExpo textos={premios.descripcion} />
          </p>
        </EntradaExpo>

        <ul className="expo-regalos__grilla">
          {regalos.map((regalo, indice) => (
            <EntradaExpo key={regalo.id} as="li" retraso={indice * 0.08} className="expo-regalos__item">
              <article className={`expo-regalo expo-regalo--${regalo.tono}`}>
                <div className="expo-regalo__ilustracion">
                  {regalo.imagen ? (
                    <Image
                      src={regalo.imagen.src}
                      alt={regalo.imagen.alt}
                      fill
                      sizes="(min-width: 64rem) 16rem, (min-width: 22.5rem) 45vw, 30vw"
                      className="expo-regalo__imagen"
                    />
                  ) : (
                    <IlustracionRegalo nombre={regalo.ilustracion} />
                  )}
                </div>
                <p className="expo-regalo__titulo">{regalo.titulo}</p>
              </article>
            </EntradaExpo>
          ))}
        </ul>
      </div>

      <div className="expo-contenedor expo-donde" id={ids.donde}>
        <EntradaExpo className="expo-donde__tarjeta">
          <h3 className="expo-donde__titulo" id={`${ids.donde}-titulo`}>
            <TextoExpo textos={donde.titulo} />
          </h3>
          <dl className="expo-donde__lista">
            {donde.items.map((item) => {
              const Icono = ICONOS_DONDE[item.icono];
              return (
                <div key={item.id} className="expo-donde__item">
                  <span className="expo-donde__icono" aria-hidden="true">
                    <Icono size={22} strokeWidth={2.2} />
                  </span>
                  <div className="expo-donde__datos">
                    <dt className="expo-donde__etiqueta">{item.etiqueta}</dt>
                    <dd className="expo-donde__valor">{item.valor}</dd>
                    <dd className="expo-donde__detalle">
                      {item.detalle}
                      {item.enlace ? (
                        <>
                          {" "}
                          <a
                            className="expo-donde__enlace"
                            href={expoCannabis.urlOficial}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {item.enlace}
                            <ArrowUpRight size={14} strokeWidth={2.4} aria-hidden="true" />
                            <span className="expo-sr"> (se abre en una pestaña nueva)</span>
                          </a>
                        </>
                      ) : null}
                    </dd>
                  </div>
                </div>
              );
            })}
          </dl>
        </EntradaExpo>
      </div>
    </section>
  );
}

function ExpoDesafio() {
  const desafio = textos.desafio;

  return (
    <section
      className="expo-desafio"
      id={ids.desafio}
      data-logo="light"
      aria-labelledby={`${ids.desafio}-titulo`}
    >
      <div className="expo-desafio__fondo" aria-hidden="true" />
      <div className="expo-contenedor expo-desafio__contenedor">
        <EntradaExpo className="expo-desafio__texto">
          <p className="expo-eyebrow expo-eyebrow--lima">{desafio.eyebrow}</p>
          <h3 className="expo-titulo expo-titulo--claro" id={`${ids.desafio}-titulo`}>
            {desafio.titulo}
          </h3>
          <p className="expo-bajada expo-bajada--claro">
            <TextoExpo textos={desafio.descripcion} />
          </p>
        </EntradaExpo>

        <div className="expo-desafio__visual">
          <Link className="expo-desafio__juego" href={`${expoCannabis.rutaJuego}?bienvenida=1`} aria-label={desafio.cta}>
            <RuletaVitrina className="expo-desafio__ruleta" etiqueta={desafio.etiquetaRuleta} />
          </Link>
        </div>

        <ol className="expo-desafio__reglas">
          {desafio.reglas.map((regla) => (
            <li key={regla}>{completarRegla(regla)}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function SeccionExpo() {
  if (!expoCannabis.publicada) return null;

  return (
    <section className="expo" id={ids.seccion} aria-labelledby={`${ids.desafio}-titulo`}>
      <ExpoDesafio />
      <ExpoRegalos />
    </section>
  );
}
