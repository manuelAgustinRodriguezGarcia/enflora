import dynamic from "next/dynamic";
import { ProveedorExpo } from "@/componentes/expo-cannabis/proveedor-expo";
import { SeccionExpo } from "@/componentes/expo-cannabis/seccion-expo";
import { EncabezadoPublico } from "@/componentes/landing/encabezado-publico";
import { EscenaSolar } from "@/componentes/landing/escena-solar";
import { Footer } from "@/componentes/landing/footer";
import { Hero } from "@/componentes/landing/hero";
import { ParaQueSirve } from "@/componentes/landing/para-que-sirve";
import { Revelar } from "@/componentes/landing/revelar";
import { instanteExpo } from "@/lib/expo-cannabis/tiempo";
import { textos } from "@/lib/landing";
import { obtenerCotizacionComercial } from "@/lib/pagos/cotizacion-comercial";

const ConEnflora = dynamic(() =>
  import("@/componentes/landing/con-enflora").then((modulo) => ({ default: modulo.ConEnflora })),
);

const Producto = dynamic(() =>
  import("@/componentes/landing/producto").then((modulo) => ({ default: modulo.Producto })),
);

const SeccionConoceFlora = dynamic(() =>
  import("@/componentes/landing/seccion-conoce-flora").then((modulo) => ({
    default: modulo.SeccionConoceFlora,
  })),
);

const SeccionPrecios = dynamic(() =>
  import("@/componentes/landing/seccion-precios").then((modulo) => ({ default: modulo.SeccionPrecios })),
);

const ESPERA_COTIZACION_MS = 2500;

export function PreciosLandingFallback() {
  return <SeccionPrecios cotizacion={null} />;
}

export async function PreciosLanding() {
  const cotizacion = await obtenerCotizacionComercial(new Date(), { timeoutMs: ESPERA_COTIZACION_MS });
  return <SeccionPrecios cotizacion={cotizacion} />;
}

const SeccionInstalacion = dynamic(() =>
  import("@/componentes/landing/seccion-instalacion").then((modulo) => ({
    default: modulo.SeccionInstalacion,
  })),
);

const SeccionContacto = dynamic(() =>
  import("@/componentes/landing/seccion-contacto").then((modulo) => ({ default: modulo.SeccionContacto })),
);

const SeccionPartners = dynamic(() =>
  import("@/componentes/landing/seccion-partners").then((modulo) => ({ default: modulo.SeccionPartners })),
);

const NavegacionFlotante = dynamic(() =>
  import("@/componentes/landing/navegacion-flotante").then((modulo) => ({
    default: modulo.NavegacionFlotante,
  })),
);

const PillExpo = dynamic(() =>
  import("@/componentes/expo-cannabis/pill-expo").then((modulo) => ({ default: modulo.PillExpo })),
);

const BienvenidaExpo = dynamic(() =>
  import("@/componentes/expo-cannabis/bienvenida-expo").then((modulo) => ({
    default: modulo.BienvenidaExpo,
  })),
);

const RedirigirAdminExpo = dynamic(() =>
  import("@/componentes/expo-cannabis/redirigir-admin").then((modulo) => ({
    default: modulo.RedirigirAdminExpo,
  })),
);

export function Landing({ precios }) {
  const { instalacion } = textos;
  const expo = instanteExpo();

  return (
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
          {precios}
          <SeccionInstalacion textos={instalacion} />
          <SeccionContacto />
          <SeccionPartners />
        </main>
        <Footer />
        <NavegacionFlotante />
        <PillExpo />
        <BienvenidaExpo />
        <RedirigirAdminExpo />
      </div>
    </ProveedorExpo>
  );
}
