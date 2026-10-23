import Link from "next/link";
import { Footer } from "@/componentes/landing/footer";
import { PaginaPartnersInfo } from "@/componentes/landing/pagina-partners-info";
import { ProveedorMotion } from "@/componentes/proveedor-motion";
import { metadatosPublicos, NOMBRE_MARCA } from "@/lib/seo";

export const metadata = metadatosPublicos({
  titulo: `Cómo asocio mi marca? | ${NOMBRE_MARCA} Partners`,
  descripcion:
    `Conocé cómo asociar tu marca a ${NOMBRE_MARCA} Partners, las opciones de presencia publicitaria y enviá tu propuesta comercial.`,
  canonical: "https://enflora.com.ar/partners-info",
});

export default function PaginaPartnersInfoRuta() {
  return (
    <ProveedorMotion>
      <div className="landing landing--papelera">
        <header className="directorio__top">
          <Link className="directorio__marca" href="/" aria-label={NOMBRE_MARCA}>
            <img
              src="/logos/enflora-logo-apaisado-light.svg"
              alt=""
              width={1000}
              height={300}
              decoding="async"
            />
          </Link>
        </header>
        <div>
          <PaginaPartnersInfo />
        </div>
        <Footer />
      </div>
    </ProveedorMotion>
  );
}
