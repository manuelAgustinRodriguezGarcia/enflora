import {
  MOTIVOS_ADMIN,
  VARIABLE_ADMIN_GLOBAL,
  diagnosticarConfiguracionAdmin,
  esModuloAdmin,
  estadoHttpDeMotivo,
  evaluarAdmin,
  variableAdminDeModulo,
} from "./reglas.js";

/**
 * Núcleo de la autorización administrativa: obtiene la identidad, la evalúa y emite credenciales.
 *
 * ┌ SOLO LO IMPORTA `autorizacion.js` (instancia de producción) Y LOS TESTS. ┐
 * Esta fábrica acepta una función `leerUsuario` inyectada: es el punto de prueba. Si la
 * aplicación la usara, podría fabricar identidades. Un test estático verifica que ningún otro
 * archivo la importe. La aplicación usa únicamente las funciones de `autorizacion.js`, que
 * toman la identidad de Supabase Auth y no aceptan opciones.
 *
 * Credenciales:
 *  - Son objetos opacos, sin propiedades: la autenticidad NO depende de su forma sino de estar
 *    registradas en un WeakMap privado de esta instancia. No existe un símbolo global ni un
 *    campo que se pueda copiar o imitar; un objeto creado por otro módulo (aunque sea
 *    idéntico, congelado o un Proxy) no figura en el registro y se rechaza.
 *  - Cada credencial queda ligada a un id de usuario, un módulo y un vencimiento corto.
 *  - Cada llamada a `obtenerAdmin` emite una credencial nueva: no hay credencial "actual"
 *    compartida entre solicitudes. El WeakMap no retiene credenciales descartadas.
 *
 * Límite: una credencial sigue siendo una capacidad en memoria. Código que ya se ejecuta en el
 * servidor y recibe una credencial legítima puede usarla hasta su vencimiento; por eso se
 * pasa solo a funciones de lib/ y nunca a componentes cliente.
 */

export const TTL_CREDENCIAL_MS = 60_000;

export class ErrorAdminNoAutorizado extends Error {
  constructor(motivo) {
    super("No autorizado.");
    this.name = "ErrorAdminNoAutorizado";
    this.motivo = motivo;
    this.estado = estadoHttpDeMotivo(motivo);
  }
}

function rechazo(motivo) {
  return { ok: false, motivo, estado: estadoHttpDeMotivo(motivo) };
}

/**
 * @param {object} config
 * @param {() => Promise<object|null>} config.leerUsuario  Identidad (Supabase Auth, `getUser`).
 * @param {object} config.env                              Variables de entorno (ADMIN_IDS…).
 * @param {Record<string,(usuario:object, env:object)=>boolean>} [config.respaldos]
 *        Mecanismos anteriores por módulo, transitorios.
 * @param {() => number} [config.ahora]
 * @param {number} [config.ttlMs]
 * @param {(mensaje:string)=>void} [config.advertir]       Sin UUID, correos ni secretos.
 */
export function crearNucleoAdmin({
  leerUsuario,
  env,
  respaldos = {},
  ahora = () => Date.now(),
  ttlMs = TTL_CREDENCIAL_MS,
  advertir = (mensaje) => console.warn(mensaje),
}) {
  if (typeof leerUsuario !== "function") throw new TypeError("leerUsuario es obligatorio");
  if (!env || typeof env !== "object") throw new TypeError("env es obligatorio");

  const registro = new WeakMap();
  const avisados = new Set();

  function emitir({ id, modulo, via }) {
    const credencial = Object.freeze(Object.create(null));
    registro.set(credencial, Object.freeze({ id, modulo, via, vence: ahora() + ttlMs }));
    return credencial;
  }

  // Avisa (una vez por configuración distinta) si las variables que gobiernan `modulo` están mal.
  function advertirConfiguracion(modulo) {
    const variables = [VARIABLE_ADMIN_GLOBAL, variableAdminDeModulo(modulo)];
    for (const hallazgo of diagnosticarConfiguracionAdmin(env, variables)) {
      if (!hallazgo.conProblemas) continue;
      const mensaje = `[admin] Configuración inválida en ${hallazgo.variable}: ${hallazgo.resumen}. Las entradas inválidas se ignoran y no conceden acceso.`;
      if (avisados.has(mensaje)) continue;
      avisados.add(mensaje);
      try {
        advertir(mensaje);
      } catch {
        // Un fallo al registrar el aviso nunca debe cambiar el resultado de la autorización.
      }
    }
  }

  /** Obtiene la identidad de Supabase Auth y autoriza para `modulo`. */
  async function obtenerAdmin(modulo) {
    if (!esModuloAdmin(modulo)) return rechazo(MOTIVOS_ADMIN.moduloInvalido);

    let usuario;
    try {
      usuario = await leerUsuario();
    } catch {
      return rechazo(MOTIVOS_ADMIN.sesionInvalida);
    }

    advertirConfiguracion(modulo);

    const respaldoDelModulo = respaldos[modulo];
    const evaluacion = evaluarAdmin(usuario, modulo, {
      env,
      respaldo: typeof respaldoDelModulo === "function" ? (candidato) => respaldoDelModulo(candidato, env) : null,
    });
    if (!evaluacion.ok) return rechazo(evaluacion.motivo);

    return { ok: true, credencial: emitir(evaluacion), via: evaluacion.via };
  }

  /** Igual que obtenerAdmin, pero lanza ErrorAdminNoAutorizado cuando no hay permisos. */
  async function requerirAdmin(modulo) {
    const resultado = await obtenerAdmin(modulo);
    if (!resultado.ok) throw new ErrorAdminNoAutorizado(resultado.motivo);
    return resultado.credencial;
  }

  /**
   * Comprueba que `valor` sea una credencial emitida por ESTE núcleo, vigente y del módulo
   * esperado. `modulo` es obligatorio: no existe una verificación "de cualquier módulo".
   * Devuelve { id, modulo, via } o lanza ErrorAdminNoAutorizado.
   */
  function verificar(valor, modulo) {
    if (!esModuloAdmin(modulo)) throw new ErrorAdminNoAutorizado(MOTIVOS_ADMIN.moduloInvalido);
    const datos = valor !== null && typeof valor === "object" ? registro.get(valor) : undefined;
    if (!datos) throw new ErrorAdminNoAutorizado(MOTIVOS_ADMIN.sinCredencial);
    if (datos.modulo !== modulo) throw new ErrorAdminNoAutorizado(MOTIVOS_ADMIN.moduloIncorrecto);
    if (!(ahora() < datos.vence)) throw new ErrorAdminNoAutorizado(MOTIVOS_ADMIN.credencialExpirada);
    return { id: datos.id, modulo: datos.modulo, via: datos.via };
  }

  return Object.freeze({ obtenerAdmin, requerirAdmin, verificar });
}
