const NOMBRE_MIN = 2;
const NOMBRE_MAX = 100;
const CORREO_MAX = 254;
const MENSAJE_MIN = 10;
const MENSAJE_MAX = 3000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MENSAJES_CONTACTO = {
  campos: "Completá todos los campos para enviar tu consulta.",
  correo: "Revisá el correo electrónico.",
  nombreLargo: "El nombre debe tener entre 2 y 100 caracteres.",
  mensajeLargo: "El mensaje debe tener entre 10 y 3000 caracteres.",
  generico: "No pudimos enviar tu consulta. Intentá nuevamente",
  exito: "¡Tu consulta fue enviada! Te responderemos lo antes posible",
  enviando: "Enviando...",
};

function esString(valor) {
  return typeof valor === "string";
}

export function escaparHtml(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function sanitizarHeader(texto) {
  return String(texto).replace(/[\r\n\0]+/g, " ").trim();
}

export function validarContacto(datos) {
  if (!datos || typeof datos !== "object") {
    return { ok: false, error: MENSAJES_CONTACTO.campos };
  }

  const { nombre, correo, mensaje, empresa } = datos;

  if (esString(empresa) && empresa.trim() !== "") {
    return { ok: true, honeypot: true };
  }

  if (!esString(nombre) || !esString(correo) || !esString(mensaje)) {
    return { ok: false, error: MENSAJES_CONTACTO.campos };
  }

  const nombreLimpio = nombre.trim();
  const correoLimpio = correo.trim();
  const mensajeLimpio = mensaje.trim();

  if (!nombreLimpio || !correoLimpio || !mensajeLimpio) {
    return { ok: false, error: MENSAJES_CONTACTO.campos };
  }

  if (nombreLimpio.length < NOMBRE_MIN || nombreLimpio.length > NOMBRE_MAX) {
    return { ok: false, error: MENSAJES_CONTACTO.nombreLargo };
  }

  if (correoLimpio.length > CORREO_MAX || !EMAIL_RE.test(correoLimpio)) {
    return { ok: false, error: MENSAJES_CONTACTO.correo };
  }

  if (mensajeLimpio.length < MENSAJE_MIN || mensajeLimpio.length > MENSAJE_MAX) {
    return { ok: false, error: MENSAJES_CONTACTO.mensajeLargo };
  }

  return {
    ok: true,
    honeypot: false,
    datos: {
      nombre: sanitizarHeader(nombreLimpio),
      correo: sanitizarHeader(correoLimpio),
      mensaje: mensajeLimpio,
    },
  };
}

export function construirEmailContacto({ nombre, correo, mensaje }) {
  const nombreSeguro = escaparHtml(nombre);
  const correoSeguro = escaparHtml(correo);
  const mensajeSeguro = escaparHtml(mensaje).replaceAll("\n", "<br />");
  const asunto = `[ENFLORA] Nueva consulta de ${sanitizarHeader(nombre)}`;

  const text = [
    "ENFLORA — Nueva consulta recibida",
    "",
    `Nombre: ${nombre}`,
    `Correo electrónico: ${correo}`,
    "",
    "Mensaje:",
    mensaje,
    "",
    "---",
    "Enviado desde el formulario de contacto de ENFLORA.",
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
                <p style="margin:0;color:#A4C85B;font-size:13px;font-weight:700;letter-spacing:0.04em;">ENFLORA</p>
                <h1 style="margin:6px 0 0;color:#FDF1D7;font-size:20px;font-weight:700;line-height:1.3;">Nueva consulta recibida</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 12px;font-size:15px;line-height:1.5;"><strong>Nombre:</strong> ${nombreSeguro}</p>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.5;"><strong>Correo electrónico:</strong> ${correoSeguro}</p>
                <p style="margin:0 0 8px;font-size:15px;line-height:1.5;"><strong>Mensaje:</strong></p>
                <p style="margin:0;padding:14px 16px;background:#FDF1D7;border-left:4px solid #A4C85B;border-radius:8px;font-size:15px;line-height:1.55;">${mensajeSeguro}</p>
                <hr style="margin:24px 0 16px;border:0;border-top:1px solid rgba(11,61,42,0.12);" />
                <p style="margin:0;font-size:12px;line-height:1.4;color:rgba(11,61,42,0.65);">Enviado desde el formulario de contacto de ENFLORA.</p>
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
