import Link from "next/link";
import { Footer } from "@/componentes/landing/footer";
import { PaginaPartnersInfo } from "@/componentes/landing/pagina-partners-info";
import { ProveedorMotion } from "@/componentes/proveedor-motion";

export const metadata = {
  title: "Cómo asocio mi marca? | ENFLORA Partners",
  description:
    "Conocé cómo asociar tu marca a ENFLORA Partners, las opciones de presencia publicitaria y enviá tu propuesta comercial.",
};

export default function PaginaPartnersInfoRuta() {
  return (
    <ProveedorMotion>
      <div className="landing landing--papelera">
        <header className="directorio__top">
          <Link className="directorio__marca" href="/" aria-label="ENFLORA">
            <img
              src="/logos/enflora-logo-apaisado-light.svg"
              alt=""
              width={1000}
              height={300}
              decoding="async"
            />
          </Link>
        </header>
        <main>
          <PaginaPartnersInfo />
        </main>
        <Footer />
      </div>
    </ProveedorMotion>
  );
}
