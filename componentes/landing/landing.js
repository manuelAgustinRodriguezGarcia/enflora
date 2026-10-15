import Link from "next/link";
import { Caos } from "@/componentes/landing/caos";
import { Cierre } from "@/componentes/landing/cierre";
import { ConEnflora } from "@/componentes/landing/con-enflora";
import { EncabezadoPublico } from "@/componentes/landing/encabezado-publico";
import { Hero } from "@/componentes/landing/hero";
import { Historial } from "@/componentes/landing/historial";
import { NavegacionFlotante } from "@/componentes/landing/navegacion-flotante";
import { Producto } from "@/componentes/landing/producto";
import { Revelar } from "@/componentes/landing/revelar";
import { SeccionRegalo } from "@/componentes/landing/seccion-regalo";
import { ProveedorMotion } from "@/componentes/proveedor-motion";
import { textos } from "@/lib/landing";

export function Landing() {
  const {
    queEs,
    beneficios,
    flora,
    planes,
    instalacion,
    novedades,
    contacto,
  } = textos;

  return (
    <ProveedorMotion>
      <div className="landing">
        <EncabezadoPublico />
        <main>
          <Hero />
          <Caos />
          <Revelar>
            <section className="para-que-sirve" id="para-que-sirve" data-logo="dark">
              <div className="para-que-sirve__texto" data-revelar>
                <h2>{queEs.titulo}</h2>
                <p>{queEs.bajada}</p>
              </div>
              <ol className="para-que-sirve__pasos">
                {queEs.pasos.map((paso) => (
                  <li data-revelar key={paso.nombre}>
                    <span>{paso.nombre}</span>
                    <strong>{paso.ejemplo}</strong>
                  </li>
                ))}
              </ol>
              <ConEnflora />
            </section>
          </Revelar>
          <Revelar>
            <section className="beneficios" id="beneficios" data-logo="dark">
              <h2 data-revelar>{beneficios.titulo}</h2>
              <div className="beneficios__grilla">
                {beneficios.items.map((item) => (
                  <article data-revelar className={`beneficios__item beneficios__item--${item.tamano}`} key={item.nombre}>
                    <h3>{item.nombre}</h3>
                    <p>{item.texto}</p>
                  </article>
                ))}
              </div>
            </section>
          </Revelar>
          <Producto />
          <SeccionRegalo />
          <Revelar>
            <section className="flora" id="flora" data-logo="dark">
              <div className="flora__escena" data-revelar data-asset="flora-escena">
                <img src="/logos/enflora-isotipo-dark-green.svg" alt="Flora" />
                <p>{flora.placeholder}</p>
              </div>
              <div className="flora__texto" data-revelar>
                <h2>{flora.titulo}</h2>
                <p>{flora.bajada}</p>
              </div>
            </section>
          </Revelar>
          <Revelar>
            <section className="novedades" id="novedades" data-logo="dark">
              <div className="novedades__texto" data-revelar>
                <h2>{novedades.titulo}</h2>
                <p>{novedades.bajada}</p>
              </div>
              <div className="novedades__placa" data-revelar data-asset="novedades">
                <span>Próximamente</span>
              </div>
            </section>
          </Revelar>
          <Historial />
          <Revelar>
            <section className="planes" id="planes" data-logo="dark">
              <div className="planes__texto" data-revelar>
                <h2>{planes.titulo}</h2>
                <p>{planes.bajada}</p>
              </div>
              <div className="planes__opciones">
                <article className="planes__gratis" data-revelar>
                  <h3>{planes.gratis.nombre}</h3>
                  <p className="planes__precio">{planes.gratis.precio}</p>
                  <ul>
                    {planes.gratis.puntos.map((punto) => (
                      <li key={punto}>{punto}</li>
                    ))}
                  </ul>
                  <Link className="landing__accion landing__accion--linea" href="/registro">Empezar gratis</Link>
                </article>
                <article className="planes__premium" data-revelar>
                  <img src="/logos/enflora-isotipo-light.svg" alt="" />
                  <h3>{planes.premium.nombre}</h3>
                  <p className="planes__precio">{planes.premium.precio}</p>
                  <ul>
                    {planes.premium.puntos.map((punto) => (
                      <li key={punto}>
                        {punto}
                        {punto.includes("IA") ? <span>{planes.premium.nota}</span> : null}
                      </li>
                    ))}
                  </ul>
                  <Link className="landing__accion landing__accion--acento" href="/registro">Crear cuenta</Link>
                </article>
              </div>
            </section>
          </Revelar>
          <Revelar>
            <section className="instalacion" id="instalar" data-logo="dark">
              <div className="instalacion__telefono" data-revelar aria-hidden="true">
                <img src="/logos/enflora-logo-apaisado.svg" alt="" />
                <span>ENFLORA</span>
              </div>
              <div className="instalacion__texto" data-revelar>
                <h2>{instalacion.titulo}</h2>
                <p>{instalacion.bajada}</p>
                <p className="instalacion__aclaracion">{instalacion.aclaracion}</p>
                <Link className="landing__accion landing__accion--principal" href="/registro">Crear cuenta</Link>
              </div>
            </section>
          </Revelar>
          <Revelar>
            <section className="contacto" id="contacto" data-logo="dark">
              <div className="contacto__texto" data-revelar>
                <h2>{contacto.titulo}</h2>
                <p>{contacto.bajada}</p>
                <div className="contacto__acciones">
                  <Link className="landing__accion landing__accion--principal" href="/registro">Crear cuenta</Link>
                  <Link className="landing__accion landing__accion--linea" href="/ingreso">Ingresar</Link>
                </div>
              </div>
            </section>
          </Revelar>
          <Cierre />
        </main>
        <footer className="pie" data-logo="light">
          <Link href="/" aria-label="ENFLORA">
            <img src="/logos/enflora-logo-apaisado-light.svg" alt="" />
          </Link>
          <p>ENFLORA</p>
          <nav aria-label="Acceso">
            <Link href="/ingreso">Ingresar</Link>
            <Link href="/registro">Crear cuenta</Link>
          </nav>
          <p>Aviso legal y privacidad, próximamente.</p>
          <p>{new Date().getFullYear()}</p>
        </footer>
        <NavegacionFlotante />
      </div>
    </ProveedorMotion>
  );
}
