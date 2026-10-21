import { ArrowUpRight, CalendarDays, Clock3, Gift, MapPin, Sparkles, Sticker } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { EnlaceDesplazar } from "@/componentes/expo-cannabis/enlace-desplazar";
import { EntradaExpo, RuletaVitrina } from "@/componentes/expo-cannabis/entrada-expo";
import { IlustracionRegalo } from "@/componentes/expo-cannabis/ilustraciones-expo";
import { TextoExpo, TituloAcentoExpo } from "@/componentes/expo-cannabis/proveedor-expo";
import { expoCannabis } from "@/lib/expo-cannabis/configuracion";
import { dosDigitos } from "@/lib/expo-cannabis/tiempo";
import { ACIERTOS_PARA_GANAR, CATEGORIAS, VIDAS_INICIALES } from "@/lib/ruleta-420/configuracion";

const { ids, textos, assets, regalos } = expoCannabis;

const ICONOS_DONDE = {
  fecha: CalendarDays,
  lugar: MapPin,
  horario: Clock3,
};

const ICONOS_CHIPS = [Sticker, Gift, Sparkles];

function valorDato(dato) {
  if (dato.id === "sorpresas") return String(regalos.length);
  if (dato.id === "vidas") return dosDigitos(VIDAS_INICIALES);
  return dato.valor;
}

function completarRegla(regla) {
  return regla.replace("{vidas}", VIDAS_INICIALES).replace("{aciertos}", ACIERTOS_PARA_GANAR);
}

function ExpoHero() {
  const hero = textos.hero;

  return (
    <div className="expo-hero" data-logo="light">
      <div className="expo-hero__fondo" aria-hidden="true">
        <span className="expo-hero__aro expo-hero__aro--grande" />
        <span className="expo-hero__aro expo-hero__aro--chico" />
        <span className="expo-hero__brillo" />
      </div>

      <div className="expo-hero__contenedor">
        <div className="expo-hero__texto">
          <EntradaExpo retraso={0}>
            <p className="expo-eyebrow expo-eyebrow--lima">{hero.eyebrow}</p>
          </EntradaExpo>
          <EntradaExpo retraso={0.08}>
            <h2 className="expo-hero__titulo" id="expo-cannabis-titulo">
              <TituloAcentoExpo variantes={hero.titulo} claseAcento="expo-hero__acento" />
            </h2>
          </EntradaExpo>
          <EntradaExpo retraso={0.16}>
            <p className="expo-hero__descripcion">
              <TextoExpo textos={hero.descripcion} />
            </p>
          </EntradaExpo>
          <EntradaExpo retraso={0.24} className="expo-hero__acciones">
            <EnlaceDesplazar
              destino={ids.premios}
              className="landing__accion landing__accion--acento expo-boton"
            >
              {hero.ctaPrincipal}
              <ArrowUpRight size={18} strokeWidth={2.4} aria-hidden="true" />
            </EnlaceDesplazar>
            <EnlaceDesplazar destino={ids.donde} className="landing__accion expo-boton expo-boton--contorno">
              {hero.ctaSecundario}
              <ArrowUpRight size={18} strokeWidth={2.4} aria-hidden="true" />
            </EnlaceDesplazar>
          </EntradaExpo>
          <EntradaExpo retraso={0.32}>
            <ul className="expo-hero__datos">
              {hero.datos.map((dato) => (
                <li key={dato.id} className="expo-hero__dato">
                  <strong className="expo-hero__dato-valor">{valorDato(dato)}</strong>
                  <span className="expo-hero__dato-texto">
                    <span className="expo-hero__dato-etiqueta">{dato.etiqueta}</span>
                    <span className="expo-hero__dato-detalle">{dato.detalle}</span>
                  </span>
                </li>
              ))}
            </ul>
          </EntradaExpo>
        </div>

        <EntradaExpo className="expo-hero__ilustracion" retraso={0.2} desplazamiento={28}>
          <div className="expo-hero__marco">
            <Image
              className="expo-hero__imagen"
              src={assets.hero.src}
              alt={assets.hero.alt}
              width={assets.hero.width}
              height={assets.hero.height}
              sizes="(min-width: 64rem) 30rem, (min-width: 40rem) 24rem, 82vw"
            />
          </div>
          {hero.chips.map((chip, indice) => {
            const Icono = ICONOS_CHIPS[indice];
            return (
              <span key={chip} className={`expo-hero__chip expo-hero__chip--${indice + 1}`} aria-hidden="true">
                <Icono size={16} strokeWidth={2.4} />
                {chip}
              </span>
            );
          })}
        </EntradaExpo>
      </div>
    </div>
  );
}

function ExpoRegalos() {
  const premios = textos.premios;

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
                <div className="expo-regalo__ilustracion" aria-hidden={regalo.imagen ? undefined : "true"}>
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
                <div className="expo-regalo__texto">
                  <p className="expo-regalo__etiqueta">{regalo.etiqueta}</p>
                  <h4 className="expo-regalo__titulo">{regalo.titulo}</h4>
                  <p className="expo-regalo__descripcion">{regalo.descripcion}</p>
                </div>
              </article>
            </EntradaExpo>
          ))}
        </ul>

        <p className="expo-regalos__aclaracion">{premios.aclaracion}</p>
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
          <ul className="expo-desafio__categorias" aria-label="Categorías del desafío">
            {CATEGORIAS.map((categoria) => (
              <li
                key={categoria.id}
                className="expo-desafio__categoria"
                style={{ "--chip-fondo": categoria.color, "--chip-texto": categoria.colorTexto }}
              >
                {categoria.nombre}
              </li>
            ))}
          </ul>
          <ol className="expo-desafio__reglas">
            {desafio.reglas.map((regla) => (
              <li key={regla}>{completarRegla(regla)}</li>
            ))}
          </ol>
          <Link
            className="landing__accion landing__accion--acento expo-boton expo-desafio__cta"
            href={expoCannabis.rutaJuego}
          >
            {desafio.cta}
            <ArrowUpRight size={18} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </EntradaExpo>

        <div className="expo-desafio__visual">
          <span className="expo-desafio__halo" aria-hidden="true" />
          <RuletaVitrina className="expo-desafio__ruleta" etiqueta={desafio.etiquetaRuleta} />
        </div>
      </div>
    </section>
  );
}

function ExpoDonde() {
  const donde = textos.donde;

  return (
    <section
      className="expo-donde"
      id={ids.donde}
      data-logo="dark"
      aria-labelledby={`${ids.donde}-titulo`}
    >
      <div className="expo-contenedor">
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

function ExpoCierre() {
  const cierre = textos.cierre;

  return (
    <section className="expo-cierre" data-logo="dark" aria-labelledby="expo-cannabis-cierre-titulo">
      <div className="expo-contenedor expo-cierre__contenedor">
        <EntradaExpo className="expo-cierre__texto">
          <h3 className="expo-cierre__titulo" id="expo-cannabis-cierre-titulo">
            <TextoExpo textos={cierre.titulo} />
          </h3>
          <p className="expo-cierre__bajada">
            <TextoExpo textos={cierre.descripcion} />
          </p>
          <a
            className="landing__accion landing__accion--principal expo-boton"
            href={expoCannabis.urlInstagram}
            target="_blank"
            rel="noopener noreferrer"
          >
            {cierre.cta}
            <ArrowUpRight size={18} strokeWidth={2.4} aria-hidden="true" />
            <span className="expo-sr"> (se abre en una pestaña nueva)</span>
          </a>
        </EntradaExpo>
        <EntradaExpo className="expo-cierre__ilustracion" retraso={0.12}>
          <Image
            className="expo-cierre__imagen"
            src={assets.cierre.src}
            alt={assets.cierre.alt}
            width={assets.cierre.width}
            height={assets.cierre.height}
            sizes="(min-width: 64rem) 22rem, (min-width: 40rem) 18rem, 70vw"
          />
        </EntradaExpo>
      </div>
    </section>
  );
}

export function SeccionExpo() {
  if (!expoCannabis.publicada) return null;

  return (
    <section className="expo" id={ids.seccion} aria-labelledby="expo-cannabis-titulo">
      <ExpoHero />
      <ExpoRegalos />
      <ExpoDesafio />
      <ExpoDonde />
      <ExpoCierre />
    </section>
  );
}
