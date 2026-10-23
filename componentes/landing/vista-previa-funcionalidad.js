import Image from "next/image";
import Link from "next/link";

const ANCHO_MOCKUP = 1448;
const ALTO_MOCKUP = 1086;

const MOCKUPS = {
  "mis-cultivos": {
    src: "/images/demo-mockup-espacios.png",
    alt: "Demo de Enflora: creación de un espacio de cultivo y lista de plantas de una carpa.",
  },
  "mi-seguimiento": {
    src: "/images/demo-mockup-registros.png",
    alt: "Demo de Enflora: formulario de nuevo registro con parámetros, acciones y observaciones.",
  },
  "origen-e-historia": {
    src: "/images/demo-mockup-historial.png",
    alt: "Demo de Enflora: historial del cultivo RDWC #1 con su línea de tiempo, fotos y mediciones.",
  },
};

export function VistaPreviaFuncionalidad({ preview, titulo }) {
  const mockup = MOCKUPS[preview] || MOCKUPS["mis-cultivos"];

  return (
    <div className="producto-preview" aria-label={`Vista previa: ${titulo}`}>
      <div className="producto-preview__marco">
        <Image
          src={mockup.src}
          alt={mockup.alt}
          width={ANCHO_MOCKUP}
          height={ALTO_MOCKUP}
          sizes="(min-width: 64rem) 30rem, 100vw"
          className="producto-preview__imagen"
        />
        <div className="producto-preview__demo">
          <p className="producto-preview__demo-texto">¿Querés probarlo vos?</p>
          <Link
            className="landing__accion landing__accion--principal producto-preview__demo-boton"
            href="/demo"
            aria-label={`Probar demo de ${titulo}`}
          >
            Probar demo
          </Link>
        </div>
      </div>
      <Link
        className="landing__accion landing__accion--principal producto-preview__cta"
        href="/demo"
        aria-label={`Probar demo de ${titulo}`}
      >
        Probar demo
      </Link>
    </div>
  );
}
