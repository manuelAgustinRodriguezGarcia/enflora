import { escaparHtml, sanitizarHeader } from "@/lib/contacto";
import { ESTILO_MARCA_CORREO, NOMBRE_MARCA } from "@/lib/seo";

const NOMBRE_MIN = 2;
const NOMBRE_MAX = 120;
const REPRESENTANTE_MAX = 100;
const CORREO_MAX = 254;
const SITIO_MAX = 200;
const RUBRO_MAX = 80;
const MENSAJE_MAX = 3000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PLANES_PARTNERS = [
  {
    id: "presencia",
    titulo: "Presencia",
    precioEtiqueta: "",
    periodicidad: "",
    descripcion: "Tu marca presente dentro de Enflora.",
    destacado: false,
    proximo: false,
    beneficios: [
      "Logo del comercio en el directorio de marcas asociadas.",
      "Nombre comercial.",
      "Enlace al sitio web o tienda del anunciante.",
      "Identificación de su rubro.",
      "Estadísticas básicas de visualizaciones y clics, cuando estén disponibles.",
    ],
    cta: "Me interesa",
  },
  {
    id: "visibilidad",
    titulo: "Visibilidad",
    precioEtiqueta: "",
    periodicidad: "",
    descripcion: "Más visibilidad para tu marca, en el momento indicado.",
    destacado: false,
    proximo: false,
    beneficios: [
      "Todo lo del plan Presencia.",
      "Banner publicitario dentro de espacios definidos de la aplicación.",
      "Imagen publicitaria y enlace externo.",
      "Presencia rotativa entre las marcas contratantes.",
    ],
    cta: "Me interesa",
  },
  {
    id: "inteligente",
    titulo: "Inteligente",
    precioEtiqueta: "",
    periodicidad: "",
    descripcion: "Tu marca conectada con las necesidades de cada cultivo.",
    destacado: true,
    proximo: true,
    beneficios: [
      "Todo lo del plan Visibilidad.",
      "Recomendaciones publicitarias inteligentes y contextuales dentro de Enflora, cuando esa funcionalidad esté desarrollada.",
    ],
    cta: "Me interesa",
    aclaracion:
      "Prestación futura. Podés dejar tu interés; no se cobra ni se compromete una fecha de lanzamiento.",
  },
];

export const PLAN_INDEFINIDO = "indefinido";

export const OPCIONES_PLAN_FORMULARIO = [
  ...PLANES_PARTNERS.map((plan) => ({
    id: plan.id,
    etiqueta: plan.titulo,
  })),
  {
    id: PLAN_INDEFINIDO,
    etiqueta: "Todavía no sé qué plan elegir.",
  },
];

export const textosPartners = {
  eyebrow: "PARTNERS DE FLORA",
  titulo: "Un lugar para tu marca",
  descripcion:
    "Conectá tu negocio con cultivadores que buscan herramientas, productos y soluciones para sus cultivos. Mostrá tu marca dentro de Enflora para llegar a potenciales clientes.",
  ctaPrincipal: "Quiero asociar mi marca",
  infoTitulo: "Cómo asocio mi marca?",
  infoDescripcion:
    "Conocé las opciones de presencia publicitaria y contanos sobre tu marca. Los acuerdos se cierran de forma personalizada con Enflora.",
  formTitulo: "Trabajemos juntos.",
  formSubtitulo: "Contanos sobre tu marca y descubramos cómo podemos crecer juntos.",
};

export const MENSAJES_PARTNERS = {
  campos: "Completá los campos obligatorios para enviar tu propuesta.",
  correo: "Revisá el correo electrónico.",
  nombreLargo: "El nombre del comercio debe tener entre 2 y 120 caracteres.",
  representanteLargo: "El nombre del representante debe tener entre 2 y 100 caracteres.",
  plan: "Elegí un plan de interés o indicá que todavía no sabés.",
  mensajeLargo: "El mensaje puede tener hasta 3000 caracteres.",
  generico: "No pudimos enviar tu propuesta. Intentá nuevamente",
  exito: "¡Tu propuesta fue enviada! Te contactaremos a la brevedad.",
  enviando: "Enviando...",
};

function esString(valor) {
  return typeof valor === "string";
}

function planValido(plan) {
  return (
    plan === PLAN_INDEFINIDO || PLANES_PARTNERS.some((item) => item.id === plan)
  );
}

export function etiquetaPlan(planId) {
  if (planId === PLAN_INDEFINIDO) return "Todavía no sé qué plan elegir.";
  const plan = PLANES_PARTNERS.find((item) => item.id === planId);
  return plan ? plan.titulo : planId;
}

export function validarPartners(datos) {
  if (!datos || typeof datos !== "object") {
    return { ok: false, error: MENSAJES_PARTNERS.campos };
  }

  const {
    comercio,
    representante,
    correo,
    sitio,
    rubro,
    plan,
    mensaje,
    empresa,
  } = datos;

  if (esString(empresa) && empresa.trim() !== "") {
    return { ok: true, honeypot: true };
  }

  if (!esString(comercio) || !esString(representante) || !esString(correo) || !esString(plan)) {
    return { ok: false, error: MENSAJES_PARTNERS.campos };
  }

  const comercioLimpio = comercio.trim();
  const representanteLimpio = representante.trim();
  const correoLimpio = correo.trim();
  const sitioLimpio = esString(sitio) ? sitio.trim() : "";
  const rubroLimpio = esString(rubro) ? rubro.trim() : "";
  const mensajeLimpio = esString(mensaje) ? mensaje.trim() : "";
  const planLimpio = plan.trim();

  if (!comercioLimpio || !representanteLimpio || !correoLimpio || !planLimpio) {
    return { ok: false, error: MENSAJES_PARTNERS.campos };
  }

  if (comercioLimpio.length < NOMBRE_MIN || comercioLimpio.length > NOMBRE_MAX) {
    return { ok: false, error: MENSAJES_PARTNERS.nombreLargo };
  }

  if (
    representanteLimpio.length < NOMBRE_MIN ||
    representanteLimpio.length > REPRESENTANTE_MAX
  ) {
    return { ok: false, error: MENSAJES_PARTNERS.representanteLargo };
  }

  if (correoLimpio.length > CORREO_MAX || !EMAIL_RE.test(correoLimpio)) {
    return { ok: false, error: MENSAJES_PARTNERS.correo };
  }

  if (!planValido(planLimpio)) {
    return { ok: false, error: MENSAJES_PARTNERS.plan };
  }

  if (sitioLimpio.length > SITIO_MAX || rubroLimpio.length > RUBRO_MAX) {
    return { ok: false, error: MENSAJES_PARTNERS.campos };
  }

  if (mensajeLimpio.length > MENSAJE_MAX) {
    return { ok: false, error: MENSAJES_PARTNERS.mensajeLargo };
  }

  return {
    ok: true,
    honeypot: false,
    datos: {
      comercio: sanitizarHeader(comercioLimpio),
      representante: sanitizarHeader(representanteLimpio),
      correo: sanitizarHeader(correoLimpio),
      sitio: sanitizarHeader(sitioLimpio),
      rubro: sanitizarHeader(rubroLimpio),
      plan: planLimpio,
      mensaje: mensajeLimpio,
    },
  };
}

export function construirEmailPartners(datos) {
  const {
    comercio,
    representante,
    correo,
    sitio,
    rubro,
    plan,
    mensaje,
  } = datos;

  const planEtiqueta = etiquetaPlan(plan);
  const asunto = "OPORTUNIDAD PROMO MARCA";

  const text = [
    "Enflora Partners — Nueva propuesta comercial",
    "",
    `Comercio / marca: ${comercio}`,
    `Representante: ${representante}`,
    `Correo: ${correo}`,
    `Sitio web o Instagram: ${sitio || "(no informado)"}`,
    `Rubro: ${rubro || "(no informado)"}`,
    `Plan de interés: ${planEtiqueta}`,
    "",
    "Mensaje o propuesta:",
    mensaje || "(sin mensaje)",
    "",
    "---",
    "Enviado desde el formulario de acuerdos publicitarios de Enflora.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background:#FDF1D7;font-family:Arial,Helvetica,sans-serif;color:#0B3D2A;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDF1D7;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid rgba(11,61,42,0.12);border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#0B3D2A;padding:18px 24px;">
                <p style="margin:0;color:#A4C85B;font-size:13px;font-weight:700;letter-spacing:0.04em;"><span style="${ESTILO_MARCA_CORREO}">${NOMBRE_MARCA}</span> PARTNERS</p>
                <h1 style="margin:6px 0 0;color:#FDF1D7;font-size:20px;font-weight:700;line-height:1.3;">Nueva propuesta comercial</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 12px;font-size:15px;line-height:1.5;"><strong>Comercio / marca:</strong> ${escaparHtml(comercio)}</p>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.5;"><strong>Representante:</strong> ${escaparHtml(representante)}</p>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.5;"><strong>Correo:</strong> ${escaparHtml(correo)}</p>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.5;"><strong>Sitio web o Instagram:</strong> ${escaparHtml(sitio || "(no informado)")}</p>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.5;"><strong>Rubro:</strong> ${escaparHtml(rubro || "(no informado)")}</p>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.5;"><strong>Plan de interés:</strong> ${escaparHtml(planEtiqueta)}</p>
                <p style="margin:0 0 8px;font-size:15px;line-height:1.5;"><strong>Mensaje o propuesta:</strong></p>
                <p style="margin:0;padding:14px 16px;background:#FDF1D7;border-left:4px solid #A4C85B;border-radius:8px;font-size:15px;line-height:1.55;">${escaparHtml(mensaje || "(sin mensaje)").replaceAll("\n", "<br />")}</p>
                <hr style="margin:24px 0 16px;border:0;border-top:1px solid rgba(11,61,42,0.12);" />
                <p style="margin:0;font-size:12px;line-height:1.4;color:rgba(11,61,42,0.65);">Enviado desde el formulario de acuerdos publicitarios de <span style="${ESTILO_MARCA_CORREO}">${NOMBRE_MARCA}</span>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { asunto, text, html };
}
