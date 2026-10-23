export const ORIGENES_CONTACTO = ["landing", "ruleta_420", "manual", "registro"];
export const ORIGENES_PUBLICOS = ["landing", "ruleta_420"];
export const VERSION_CONSENTIMIENTO = "2026-10-v1";
export const TAMANO_PAGINA_CONTACTOS = 25;
export const MAXIMO_EXPORTACION = 5000;
export const LIMITE_ALTAS_CONTACTOS = Object.freeze({ maximo: 10, ventanaMs: 15 * 60 * 1000 });

export const ETIQUETAS_ORIGEN = {
  landing: "Landing",
  ruleta_420: "Ruleta",
  manual: "Manual",
  registro: "Registro",
};

export const FILTROS_CONTACTOS = ["todos", "landing", "ruleta_420", "manual", "registro", "con-consentimiento", "sin-consentimiento"];
export const ORDENES_CONTACTOS = ["recientes", "antiguos", "nombre"];

export const TEXTOS_CONSENTIMIENTO = {
  casilla: "Quiero recibir novedades, promociones y comunicaciones de Enflora por correo electrónico.",
  finalidadLanding:
    "Usamos tu correo solo para avisarte del lanzamiento y, si marcás la casilla, para mandarte novedades de Enflora. Podés pedir la baja cuando quieras.",
  finalidadRuleta:
    "Usamos tus datos solo para registrar tu participación y entregarte el premio si ganás. Las comunicaciones comerciales son opcionales.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NOMBRE_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]{0,79}$/u;
const NOMBRE_MAX = 80;
const EMAIL_MAX = 254;

function texto(valor) {
  return typeof valor === "string" ? valor.replace(/[\u0000-\u001F\u007F]/g, " ").trim() : "";
}

export function normalizarEmail(valor) {
  const limpio = texto(valor).toLowerCase();
  if (!limpio) return null;
  if (limpio.length > EMAIL_MAX || !EMAIL_RE.test(limpio)) return undefined;
  return limpio;
}

function quitarQuince(digitos) {
  const area = digitos.startsWith("11") ? 2 : digitos.slice(3, 5) === "15" ? 3 : digitos.slice(4, 6) === "15" ? 4 : 0;
  if (!area || digitos.slice(area, area + 2) !== "15") return digitos;
  return digitos.slice(0, area) + digitos.slice(area + 2);
}

export function normalizarTelefono(valor) {
  const crudo = texto(valor);
  if (!crudo) return null;
  if (/[^\d\s()+.-]/.test(crudo)) return undefined;
  const conPrefijo = crudo.startsWith("+") || crudo.startsWith("00");
  let digitos = crudo.replace(/\D/g, "");
  if (crudo.startsWith("00")) digitos = digitos.slice(2);
  if (!digitos) return undefined;
  if (!conPrefijo) {
    if (digitos.startsWith("0")) digitos = digitos.slice(1);
    if (digitos.length === 12) digitos = quitarQuince(digitos);
    if (!digitos.startsWith("54")) {
      if (digitos.length === 10) digitos = `549${digitos}`;
      else if (digitos.length === 8) digitos = `54911${digitos}`;
      else return undefined;
    } else if (digitos.length === 12 && !digitos.startsWith("549")) {
      digitos = `549${digitos.slice(2)}`;
    }
  }
  if (digitos.startsWith("0")) return undefined;
  if (digitos.length < 8 || digitos.length > 15) return undefined;
  return `+${digitos}`;
}

export function normalizarNombre(valor) {
  const limpio = texto(valor).replace(/\s+/g, " ");
  if (!limpio) return null;
  if (limpio.length > NOMBRE_MAX || !NOMBRE_RE.test(limpio)) return undefined;
  return limpio;
}

export const MENSAJES_CONTACTOS = {
  nombre: "Escribí tu nombre tal como te llamás, sin símbolos raros.",
  nombreObligatorio: "Necesitamos tu nombre para registrar la participación.",
  email: "Revisá el correo electrónico.",
  emailObligatorio: "Necesitamos tu correo electrónico para sumarte a la lista.",
  telefono: "Revisá el teléfono. Podés escribirlo con o sin el código de país.",
  algunContacto: "Dejanos al menos un dato de contacto: correo o teléfono.",
  generico: "No pudimos guardar tus datos. Probá de nuevo en unos segundos.",
  limite: "Hiciste varios intentos seguidos. Esperá unos minutos y probá de nuevo.",
};

export function validarContactoPublico(datos) {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
    return { ok: false, error: MENSAJES_CONTACTOS.generico };
  }
  if (typeof datos.empresa === "string" && datos.empresa.trim()) return { ok: true, honeypot: true };

  const origen = ORIGENES_PUBLICOS.includes(datos.origen) ? datos.origen : null;
  if (!origen) return { ok: false, error: MENSAJES_CONTACTOS.generico };

  const nombre = normalizarNombre(datos.nombre);
  const email = normalizarEmail(datos.email);
  const telefono = origen === "ruleta_420" ? normalizarTelefono(datos.telefono) : null;

  if (nombre === undefined) return { ok: false, error: MENSAJES_CONTACTOS.nombre, campo: "nombre" };
  if (email === undefined) return { ok: false, error: MENSAJES_CONTACTOS.email, campo: "email" };
  if (telefono === undefined) return { ok: false, error: MENSAJES_CONTACTOS.telefono, campo: "telefono" };

  if (origen === "landing" && !email) {
    return { ok: false, error: MENSAJES_CONTACTOS.emailObligatorio, campo: "email" };
  }
  if (origen === "ruleta_420") {
    if (!nombre) return { ok: false, error: MENSAJES_CONTACTOS.nombreObligatorio, campo: "nombre" };
    if (!email && !telefono) return { ok: false, error: MENSAJES_CONTACTOS.algunContacto, campo: "email" };
  }

  const detalle = texto(datos.detalle).slice(0, 40) || null;

  return {
    ok: true,
    honeypot: false,
    datos: {
      nombre,
      email,
      telefono,
      origen,
      detalle: detalle && /^[a-z0-9-]+$/i.test(detalle) ? detalle : null,
      consentimiento: datos.consentimiento === true,
    },
  };
}

export function validarContactoManual(datos) {
  if (!datos || typeof datos !== "object") return { ok: false, error: "Los datos no son válidos." };
  const nombre = normalizarNombre(datos.nombre);
  const email = normalizarEmail(datos.email);
  const telefono = normalizarTelefono(datos.telefono);
  if (nombre === undefined) return { ok: false, error: "El nombre tiene caracteres no permitidos.", campo: "nombre" };
  if (email === undefined) return { ok: false, error: "El correo no es válido.", campo: "email" };
  if (telefono === undefined) return { ok: false, error: "El teléfono no es válido.", campo: "telefono" };
  if (!email && !telefono) return { ok: false, error: "Cargá al menos un correo o un teléfono.", campo: "email" };
  return { ok: true, datos: { nombre, email, telefono } };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function esIdContacto(valor) {
  return typeof valor === "string" && UUID_RE.test(valor);
}

export function filtroValido(valor) {
  return FILTROS_CONTACTOS.includes(valor) ? valor : "todos";
}

export function ordenValido(valor) {
  return ORDENES_CONTACTOS.includes(valor) ? valor : "recientes";
}

export function limpiarBusqueda(valor) {
  return texto(valor).replace(/[%_,()\\*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export function paginaValida(valor) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > 100000) return 1;
  return numero;
}

export function etiquetasOrigenes(contacto) {
  const lista = Array.isArray(contacto?.origenes) && contacto.origenes.length
    ? contacto.origenes
    : [contacto?.origen_inicial].filter(Boolean);
  const unicos = [...new Set(lista)].filter((origen) => ETIQUETAS_ORIGEN[origen]);
  return unicos.map((origen) => ETIQUETAS_ORIGEN[origen]);
}

export function escaparCsv(valor) {
  let celda = valor == null ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(celda)) celda = `'${celda}`;
  if (/[",\n\r;]/.test(celda)) celda = `"${celda.replaceAll('"', '""')}"`;
  return celda;
}

export function construirCsvContactos(filas) {
  const cabecera = ["Nombre", "Email", "Teléfono", "Origen", "Consentimiento publicitario", "Fecha de registro"];
  const lineas = [cabecera.map(escaparCsv).join(",")];
  for (const fila of filas) {
    lineas.push(
      [
        fila.nombre || "",
        fila.email || "",
        fila.telefono || "",
        etiquetasOrigenes(fila).join(" / "),
        fila.consentimiento_marketing ? "Aceptó" : "No aceptó",
        fila.created_at ? new Date(fila.created_at).toISOString() : "",
      ]
        .map(escaparCsv)
        .join(","),
    );
  }
  return `\uFEFF${lineas.join("\r\n")}\r\n`;
}
