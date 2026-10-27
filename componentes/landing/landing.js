import { BienvenidaExpo } from "@/componentes/expo-cannabis/bienvenida-expo";
import { PillExpo } from "@/componentes/expo-cannabis/pill-expo";
import { ProveedorExpo } from "@/componentes/expo-cannabis/proveedor-expo";
import { RedirigirAdminExpo } from "@/componentes/expo-cannabis/redirigir-admin";
import { SeccionExpo } from "@/componentes/expo-cannabis/seccion-expo";
import { ConEnflora } from "@/componentes/landing/con-enflora";
import { EncabezadoPublico } from "@/componentes/landing/encabezado-publico";
import { EscenaSolar } from "@/componentes/landing/escena-solar";
import { Footer } from "@/componentes/landing/footer";
import { Hero } from "@/componentes/landing/hero";
import { NavegacionFlotante } from "@/componentes/landing/navegacion-flotante";
import { PillLanzamientoFlotante } from "@/componentes/landing/pill-lanzamiento-flotante";
import { ParaQueSirve } from "@/componentes/landing/para-que-sirve";
import { Producto } from "@/componentes/landing/producto";
import { Revelar } from "@/componentes/landing/revelar";
import { SeccionConoceFlora } from "@/componentes/landing/seccion-conoce-flora";
import { SeccionContacto } from "@/componentes/landing/seccion-contacto";
import { SeccionInstalacion } from "@/componentes/landing/seccion-instalacion";
import { SeccionLanzamiento } from "@/componentes/landing/seccion-lanzamiento";
import { SeccionPartners } from "@/componentes/landing/seccion-partners";
import { SeccionPrecios } from "@/componentes/landing/seccion-precios";
import { SeccionRegalo } from "@/componentes/landing/seccion-regalo";
import { ProveedorMotion } from "@/componentes/proveedor-motion";
import { instanteExpo } from "@/lib/expo-cannabis/tiempo";
import { textos } from "@/lib/landing";

export function Landing({ cotizacion = null }) {
  const { instalacion } = textos;
  const expo = instanteExpo();

  return (
    <ProveedorMotion>
      <ProveedorExpo inicial={expo}>
        <div className="landing">
          <EncabezadoPublico />
          <main>
            <EscenaSolar>
              <Hero />
              <Revelar>
                <ParaQueSirve />
              </Revelar>
            </EscenaSolar>
            <SeccionExpo />
            <ConEnflora />
            <Producto />
            <SeccionConoceFlora />
            <SeccionRegalo />
            <SeccionPrecios cotizacion={cotizacion} />
            <SeccionInstalacion textos={instalacion} />
            <SeccionContacto />
            <SeccionPartners />
            <SeccionLanzamiento />
          </main>
          <Footer />
          <NavegacionFlotante />
          <PillLanzamientoFlotante />
          <PillExpo />
          <BienvenidaExpo />
          <RedirigirAdminExpo />
        </div>
      </ProveedorExpo>
    </ProveedorMotion>
  );
}
