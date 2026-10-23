import Link from "next/link";
import { Lock, Mail, Store } from "lucide-react";
import { MarcaEnflora } from "@/componentes/marca-enflora";
import { CORREO_PUBLICO, INSTAGRAM_URL, NOMBRE_MARCA } from "@/lib/seo";

const ENLACES = [
  {
    id: "instagram",
    href: INSTAGRAM_URL,
    etiqueta: "Instagram",
    externo: true,
    Icono: IconoInstagram,
  },
  {
    id: "linkedin",
    href: "https://www.linkedin.com/in/manuel-agustin-rodriguez-garcia/?isSelfProfile=true",
    etiqueta: "LinkedIn",
    externo: true,
    Icono: IconoLinkedIn,
  },
  {
    id: "correo",
    href: `mailto:${CORREO_PUBLICO}`,
    etiqueta: CORREO_PUBLICO,
    externo: false,
    Icono: Mail,
  },
  {
    id: "partners",
    href: "/partners",
    etiqueta: "Comercios asociados",
    externo: false,
    Icono: Store,
    clase: "pie__enlace pie__enlace--cta",
  },
  {
    id: "admin",
    href: "/expo-cannabis/admin",
    etiqueta: "Administración",
    externo: false,
    Icono: Lock,
    clase: "pie__enlace pie__enlace--cta pie__enlace--admin",
    prefetch: false,
  },
];

function IconoInstagram({ size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle
        cx="12"
        cy="12"
        r="4.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
    </svg>
  );
}

function IconoLinkedIn({ size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M7.2 10.2v6.6M7.2 7.35v.05"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M11.1 16.8v-3.9c0-1.55.95-2.4 2.2-2.4 1.15 0 1.9.75 1.9 2.25v4.05"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Footer() {
  const anio = new Date().getFullYear();

  return (
    <footer className="pie" data-logo="light">
      <div className="pie__contenedor">
        <div className="pie__principal">
          <Link className="pie__marca" href="/" aria-label={NOMBRE_MARCA}>
            <img
              src="/logos/enflora-logo-apaisado-light.svg"
              alt=""
              width={1000}
              height={300}
              decoding="async"
              loading="lazy"
            />
          </Link>

          <nav className="pie__contacto" aria-label="Contacto y redes">
            {ENLACES.map(({ id, href, etiqueta, externo, Icono, clase = "pie__enlace", prefetch }) => {
              const contenido = (
                <>
                  <Icono size={18} />
                  <span>{etiqueta}</span>
                </>
              );

              if (externo) {
                return (
                  <a
                    key={id}
                    className={clase}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={etiqueta}
                  >
                    {contenido}
                  </a>
                );
              }

              if (href.startsWith("/")) {
                return (
                  <Link key={id} className={clase} href={href} aria-label={etiqueta} prefetch={prefetch}>
                    {contenido}
                  </Link>
                );
              }

              return (
                <a key={id} className={clase} href={href} aria-label={etiqueta}>
                  {contenido}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="pie__separador" aria-hidden="true" />

        <div className="pie__base">
          <p className="pie__copy">
            © {anio} <MarcaEnflora />. Todos los derechos reservados.
          </p>
          <Link className="pie__copy pie__legal" href="/privacidad">
            Política de privacidad
          </Link>
        </div>
      </div>

      <a
        className="pie__credito-tira"
        href="https://www.grgsolutions.com.ar"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Un producto de GRG Solutions"
      >
        <p className="pie__credito">
          Un producto de{" "}
          <span className="pie__credito-enlace">
            <img
              className="pie__credito-logo"
              src="/logos/logo-grg.svg"
              alt=""
              width={998}
              height={364}
              decoding="async"
              loading="lazy"
            />
          </span>
        </p>
      </a>
    </footer>
  );
}
