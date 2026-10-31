/**
 * Verifica la configuración de administradores SIN imprimir UUID, correos ni claves.
 *
 *   node --env-file=.env scripts/verificar-admin.mjs            # estado general
 *   node --env-file=.env scripts/verificar-admin.mjs <uuid>     # + módulos a los que accedería ese UUID
 *
 * Para revisar lo que hay en Vercel: `vercel env pull .env.vercel --environment=production`
 * (o `preview`) y usar `--env-file=.env.vercel`. Ese archivo contiene secretos: no se commitea
 * y conviene borrarlo al terminar.
 *
 * No se conecta a Supabase ni a ningún servicio: solo lee variables de entorno.
 * Para ver tu UUID: Supabase Dashboard → Authentication → Users (columna "User UID").
 *
 * Código de salida: 0 si el reemplazo de Expo está configurado y sin problemas; 1 si falta o
 * hay entradas inválidas (útil para automatizar el chequeo).
 */
import {
  MODULOS_ADMIN,
  diagnosticarConfiguracionAdmin,
  esUuid,
  evaluarAdmin,
  idsAutorizadosParaModulo,
} from "../lib/admin/reglas.js";
import { correosAdminLegado, esAdminExpoLegado, idsAdminLegado, idsLegadoInvalidos } from "../lib/expo-cannabis/admin-legado.js";

const env = process.env;
const linea = (texto = "") => console.log(texto);
let hayProblemas = false;

linea("== Autorización central ==");
const hallazgos = diagnosticarConfiguracionAdmin(env);
if (!hallazgos.length) linea("Ninguna variable ADMIN_IDS* está definida.");
for (const hallazgo of hallazgos) {
  const estado = hallazgo.conProblemas ? "REVISAR" : "ok";
  linea(`${hallazgo.variable}: ${hallazgo.validos} UUID válidos [${estado}]`);
  if (hallazgo.conProblemas) {
    hayProblemas = true;
    linea(`  → ${hallazgo.resumen}`);
  }
  if (hallazgo.duplicados) linea(`  → ${hallazgo.duplicados} repetidos (se cuentan una vez)`);
}
linea("Formato esperado: UUID completos separados SOLO por coma, sin comillas, sin punto y coma y sin saltos de línea.");

const efectivosExpo = idsAutorizadosParaModulo("expo", env).size;
linea();
linea("Administradores efectivos por módulo (por UUID):");
for (const modulo of MODULOS_ADMIN) {
  const cantidad = idsAutorizadosParaModulo(modulo, env).size;
  if (cantidad || modulo === "expo") linea(`  ${modulo}: ${cantidad}`);
}

linea();
linea("== Mecanismo anterior (solo Expo) — TODAVÍA ACTIVO ==");
linea("Correo fijo en el código: activo mientras no se retire el mecanismo anterior");
linea(`EXPO_ADMIN_EMAILS: ${correosAdminLegado(env).length - 1} correos adicionales`);
linea(`EXPO_ADMIN_IDS: ${idsAdminLegado(env).length} UUID válidos, ${idsLegadoInvalidos(env)} inválidos`);
linea("Aviso: quitar un UUID de ADMIN_IDS NO revoca el acceso de quien entra por este mecanismo.");

linea();
linea("== Veredicto ==");
if (efectivosExpo === 0) {
  hayProblemas = true;
  linea("El reemplazo NO está configurado: no hay UUID válidos en ADMIN_IDS ni ADMIN_IDS_EXPO.");
  linea("No retires el mecanismo anterior todavía.");
} else if (hayProblemas) {
  linea("Hay UUID válidos, pero también entradas a corregir (ver arriba). Las inválidas no conceden acceso.");
} else {
  linea("El reemplazo está configurado para Expo. Falta verificar el ingreso real antes de retirar el anterior.");
}

const candidato = process.argv[2];
if (candidato) {
  linea();
  linea("== UUID consultado ==");
  if (!esUuid(candidato.trim())) {
    hayProblemas = true;
    linea("El valor recibido no es un UUID completo y válido.");
  } else {
    const usuario = { id: candidato.trim(), email_confirmed_at: new Date().toISOString(), is_anonymous: false };
    const respaldo = (valor) => esAdminExpoLegado(valor, env);
    for (const modulo of MODULOS_ADMIN) {
      const resultado = evaluarAdmin(usuario, modulo, { env, respaldo: modulo === "expo" ? respaldo : null });
      linea(`  ${modulo}: ${resultado.ok ? `SÍ (${resultado.via})` : `no (${resultado.motivo})`}`);
    }
    linea("(Se asume cuenta con correo confirmado y no anónima; eso depende del usuario real en Supabase Auth.)");
  }
}

process.exitCode = hayProblemas ? 1 : 0;
