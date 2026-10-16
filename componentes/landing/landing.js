import { ConEnflora } from "@/componentes/landing/con-enflora";
import { EncabezadoPublico } from "@/componentes/landing/encabezado-publico";
import { EscenaSolar } from "@/componentes/landing/escena-solar";
import { Footer } from "@/componentes/landing/footer";
import { FormularioContacto } from "@/componentes/landing/formulario-contacto";
import { Hero } from "@/componentes/landing/hero";
import { NavegacionFlotante } from "@/componentes/landing/navegacion-flotante";
import { ParaQueSirve } from "@/componentes/landing/para-que-sirve";
import { Producto } from "@/componentes/landing/producto";
import { Revelar } from "@/componentes/landing/revelar";
import { SeccionInstalacion } from "@/componentes/landing/seccion-instalacion";
import { SeccionLanzamiento } from "@/componentes/landing/seccion-lanzamiento";
import { SeccionPrecios } from "@/componentes/landing/seccion-precios";
import { SeccionRegalo } from "@/componentes/landing/seccion-regalo";
import { ProveedorMotion } from "@/componentes/proveedor-motion";
import { textos } from "@/lib/landing";

export function Landing({ cotizacion = null }) {
  const {
    flora,
    instalacion,
    contacto,
  } = textos;

  return (
    <ProveedorMotion>
      <div className="landing">
        <EncabezadoPublico />
        <main>
          <EscenaSolar>
            <Hero />
            <Revelar>
              <ParaQueSirve />
            </Revelar>
          </EscenaSolar>
          <Revelar>
            <ConEnflora />
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
          <SeccionPrecios cotizacion={cotizacion} />
          <SeccionInstalacion textos={instalacion} />
          <Revelar>
            <section className="contacto" id="contacto" data-logo="dark">
              <div className="contacto__layout">
                <div className="contacto__texto" data-revelar>
                  <h2>{contacto.titulo}</h2>
                  <p>{contacto.bajada}</p>
                </div>
                <div className="contacto__form-wrap" data-revelar>
                  <FormularioContacto />
                </div>
              </div>
            </section>
          </Revelar>
          <SeccionLanzamiento />
        </main>
        <Footer />
        <NavegacionFlotante />
      </div>
    </ProveedorMotion>
  );
}
