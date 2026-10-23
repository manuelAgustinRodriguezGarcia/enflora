import Link from "next/link";
import { Footer } from "@/componentes/landing/footer";
import { TextoConMarca } from "@/componentes/marca-enflora";
import { ProveedorMotion } from "@/componentes/proveedor-motion";
import { CORREO_PUBLICO, NOMBRE_MARCA, metadatosPublicos } from "@/lib/seo";

export const metadata = metadatosPublicos({
  titulo: `Política de privacidad | ${NOMBRE_MARCA}`,
  descripcion: `Qué datos recopila ${NOMBRE_MARCA}, para qué los usa, cómo los protege y cómo podés ejercer tus derechos.`,
  canonical: "https://enflora.com.ar/privacidad",
});

const SECCIONES = [
  {
    titulo: "Qué datos recopilamos",
    parrafos: [
      "Cuando te sumás a la lista de novedades desde la landing guardamos tu correo electrónico y, si lo completás, tu nombre.",
      "Cuando participás de la Ruleta 420 guardamos tu nombre y al menos una forma de contacto: correo electrónico o teléfono.",
      "Si creás una cuenta en Enflora, guardamos los datos necesarios para que funcione tu espacio de cultivo, según se detalla al registrarte.",
    ],
  },
  {
    titulo: "Para qué los usamos",
    parrafos: [
      "Para registrar tu interés en el lanzamiento y tu participación en la Ruleta 420, incluida la entrega de premios.",
      "Solo si marcaste la casilla correspondiente, para enviarte novedades, promociones y comunicaciones comerciales de Enflora por correo electrónico. Esa casilla es opcional y no condiciona tu participación.",
      "Nunca vendemos ni cedemos tus datos a terceros con fines publicitarios.",
    ],
  },
  {
    titulo: "Consentimiento y baja",
    parrafos: [
      "Registramos la fecha y la versión del texto que aceptaste al marcar la casilla de comunicaciones. Podés retirar ese consentimiento en cualquier momento escribiéndonos y lo registramos sin afectar el resto de tus datos.",
      "Si nunca marcaste la casilla, no vas a recibir comunicaciones comerciales.",
    ],
  },
  {
    titulo: "Dónde y cómo se guardan",
    parrafos: [
      "Los datos se almacenan en infraestructura de Supabase con acceso restringido al equipo administrador de Enflora. Las operaciones públicas solo permiten registrar datos, nunca consultarlos.",
      "Conservamos la información mientras sea necesaria para las finalidades indicadas o hasta que pidas su eliminación.",
    ],
  },
  {
    titulo: "Tus derechos",
    parrafos: [
      `Podés pedir acceso, corrección o eliminación de tus datos escribiendo a ${CORREO_PUBLICO}. Respondemos en un plazo razonable y verificamos que la solicitud provenga de la persona titular.`,
      "Esta política aplica según la Ley 25.326 de Protección de los Datos Personales de la República Argentina.",
    ],
  },
];

export default function PaginaPrivacidad() {
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
        <main className="privacidad" data-logo="dark">
          <article className="privacidad__contenedor">
            <header className="privacidad__cabecera">
              <p className="privacidad__eyebrow">
                <TextoConMarca texto="Enflora" />
              </p>
              <h1 className="privacidad__titulo">Política de privacidad</h1>
              <p className="privacidad__intro">
                <TextoConMarca texto="Acá te contamos qué datos guarda Enflora, para qué los usa y cómo podés pedir que los corrijamos o eliminemos." />
              </p>
              <p className="privacidad__fecha">Última actualización: octubre de 2026.</p>
            </header>

            {SECCIONES.map((seccion) => (
              <section key={seccion.titulo} className="privacidad__seccion">
                <h2>{seccion.titulo}</h2>
                {seccion.parrafos.map((parrafo) => (
                  <p key={parrafo}>
                    <TextoConMarca texto={parrafo} />
                  </p>
                ))}
              </section>
            ))}

            <p className="privacidad__volver">
              <Link href="/">Volver al inicio</Link>
            </p>
          </article>
        </main>
        <Footer />
      </div>
    </ProveedorMotion>
  );
}
