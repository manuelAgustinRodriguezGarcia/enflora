import Link from "next/link";
import { Footer } from "@/componentes/landing/footer";
import { DirectorioComercios } from "@/componentes/directorio-comercios";
import { ProveedorMotion } from "@/componentes/proveedor-motion";
import { cargarComerciosPublicos } from "@/lib/publicidad";
import { metadatosPublicos, NOMBRE_MARCA } from "@/lib/seo";
import { MarcaEnflora } from "@/componentes/marca-enflora";

export async function generateMetadata() {
  const metadatos = metadatosPublicos({
    titulo: `Comercios asociados | ${NOMBRE_MARCA}`,
    descripcion:
      `Directorio de marcas y comercios asociados a ${NOMBRE_MARCA}. Solo acuerdos activos y vigentes.`,
    canonical: "https://enflora.com.ar/partners",
  });
  const { comercios } = await cargarComerciosPublicos();
  if (comercios.length > 0) return metadatos;
  return {
    ...metadatos,
    robots: { index: false, follow: true },
  };
}

export default async function PaginaPartners() {
  const { comercios } = await cargarComerciosPublicos();

  return (
    <ProveedorMotion>
      <div className="landing">
        <header className="directorio__top">
          <Link className="directorio__marca" href="/" aria-label={NOMBRE_MARCA}>
            <img
              src="/logos/enflora-logo-apaisado.svg"
              alt=""
              width={1000}
              height={300}
              decoding="async"
            />
          </Link>
        </header>
        <div>
          <section className="directorio" data-logo="dark">
            <div className="directorio__contenedor">
              <header className="directorio__encabezado">
                <p className="directorio__eyebrow">
                  TU MARCA
                </p>
                <h1 className="directorio__titulo">Comercios asociados</h1>
                <p className="directorio__bajada">
                  Marcas y comercios con acuerdos publicitarios activos dentro de <MarcaEnflora />.
                </p>
                <Link className="directorio__volver" href="/partners-info">
                  Cómo asocio mi marca?
                </Link>
              </header>
              <DirectorioComercios comercios={comercios} />
            </div>
          </section>
        </div>
        <Footer />
      </div>
    </ProveedorMotion>
  );
}
