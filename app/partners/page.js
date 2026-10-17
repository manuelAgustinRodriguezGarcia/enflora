import Link from "next/link";
import { Footer } from "@/componentes/landing/footer";
import { DirectorioComercios } from "@/componentes/directorio-comercios";
import { ProveedorMotion } from "@/componentes/proveedor-motion";
import { cargarComerciosPublicos } from "@/lib/publicidad";

export const metadata = {
  title: "Comercios asociados | ENFLORA",
  description:
    "Directorio de marcas y comercios asociados a ENFLORA Partners. Solo acuerdos activos y vigentes.",
};

export default async function PaginaPartners() {
  const { comercios } = await cargarComerciosPublicos();

  return (
    <ProveedorMotion>
      <div className="landing">
        <header className="directorio__top">
          <Link className="directorio__marca" href="/" aria-label="ENFLORA">
            <img
              src="/logos/enflora-logo-apaisado.svg"
              alt=""
              width={1000}
              height={300}
              decoding="async"
            />
          </Link>
        </header>
        <main>
          <section className="directorio" data-logo="dark">
            <div className="directorio__contenedor">
              <header className="directorio__encabezado">
                <p className="directorio__eyebrow">ENFLORA PARTNERS</p>
                <h1 className="directorio__titulo">Comercios asociados</h1>
                <p className="directorio__bajada">
                  Marcas y comercios con acuerdos publicitarios activos dentro de ENFLORA.
                </p>
                <Link className="directorio__volver" href="/partners-info">
                  Cómo asocio mi marca?
                </Link>
              </header>
              <DirectorioComercios comercios={comercios} />
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </ProveedorMotion>
  );
}
