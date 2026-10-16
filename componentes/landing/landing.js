import { ConEnflora } from "@/componentes/landing/con-enflora";
import { EncabezadoPublico } from "@/componentes/landing/encabezado-publico";
import { EscenaSolar } from "@/componentes/landing/escena-solar";
import { Footer } from "@/componentes/landing/footer";
import { Hero } from "@/componentes/landing/hero";
import { NavegacionFlotante } from "@/componentes/landing/navegacion-flotante";
import { ParaQueSirve } from "@/componentes/landing/para-que-sirve";
import { Producto } from "@/componentes/landing/producto";
import { Revelar } from "@/componentes/landing/revelar";
import { SeccionConoceFlora } from "@/componentes/landing/seccion-conoce-flora";
import { SeccionContacto } from "@/componentes/landing/seccion-contacto";
import { SeccionInstalacion } from "@/componentes/landing/seccion-instalacion";
import { SeccionLanzamiento } from "@/componentes/landing/seccion-lanzamiento";
import { SeccionPrecios } from "@/componentes/landing/seccion-precios";
import { SeccionRegalo } from "@/componentes/landing/seccion-regalo";
import { ProveedorMotion } from "@/componentes/proveedor-motion";
import { textos } from "@/lib/landing";

export function Landing({ cotizacion = null }) {
  const { instalacion } = textos;

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
          <SeccionConoceFlora />
          <SeccionRegalo />
          <SeccionPrecios cotizacion={cotizacion} />
          <SeccionInstalacion textos={instalacion} />
          <SeccionContacto />
          <SeccionLanzamiento />
        </main>
        <Footer />
        <NavegacionFlotante />
      </div>
    </ProveedorMotion>
  );
}
