import { ArrowUpRight, Mail, MessageCircle } from "lucide-react";
import { FormularioContacto } from "@/componentes/landing/formulario-contacto";

const TARJETAS = [
  {
    id: "instagram",
    href: "https://www.instagram.com/enflora420/?hl=es-la",
    titulo: "Seguinos en Instagram",
    texto: "@enflora420",
    externo: true,
    Icono: IconoInstagram,
  },
  {
    id: "email",
    href: "mailto:enflora.420@gmail.com",
    titulo: "Mandame un mail",
    texto: "enflora.420@gmail.com",
    externo: false,
    Icono: Mail,
  },
  {
    id: "linkedin",
    href: "https://www.linkedin.com/in/manuel-agustin-rodriguez-garcia/",
    titulo: "LinkedIn del creador",
    texto: "Manuel Rodríguez García",
    externo: true,
    Icono: IconoLinkedIn,
  },
];

function IconoInstagram({ size = 20, ...props }) {
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

function IconoLinkedIn({ size = 20, ...props }) {
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

export function SeccionContacto() {
  return (
    <section className="contacto" id="contacto" data-logo="dark">
      <div className="contacto__layout">
        <div className="contacto__intro">
          <h2 className="contacto__titulo">¿Charlamos?</h2>
          <p className="contacto__bajada">
            Si tenés alguna duda, idea de mejora, feedback o simplemente querés
            charlar, escribime y te leo.
          </p>

          <ul className="contacto__tarjetas">
            {TARJETAS.map(({ id, href, titulo, texto, externo, Icono }) => (
              <li key={id}>
                <a
                  className="contacto__tarjeta"
                  href={href}
                  {...(externo
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  <span className="contacto__tarjeta-icono" aria-hidden="true">
                    <Icono size={20} strokeWidth={1.75} />
                  </span>
                  <span className="contacto__tarjeta-texto">
                    <span className="contacto__tarjeta-titulo">{titulo}</span>
                    <span className="contacto__tarjeta-detalle">{texto}</span>
                  </span>
                  <ArrowUpRight
                    className="contacto__tarjeta-flecha"
                    size={18}
                    strokeWidth={1.9}
                    aria-hidden="true"
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="contacto__form-wrap">
          <div className="contacto__form-card">
            <div className="contacto__form-cabecera">
              <span className="contacto__form-icono" aria-hidden="true">
                <MessageCircle size={20} strokeWidth={1.75} />
              </span>
              <div className="contacto__form-titulos">
                <h3 className="contacto__form-titulo">Dejame un mensaje</h3>
                <p className="contacto__form-subtitulo">Contame qué necesitás</p>
              </div>
            </div>
            <FormularioContacto />
          </div>
        </div>
      </div>
    </section>
  );
}
