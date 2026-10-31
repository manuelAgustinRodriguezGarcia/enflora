import assert from "node:assert/strict";
import test from "node:test";
import * as autorizacion from "../lib/admin/autorizacion.js";
import { ErrorAdminNoAutorizado, crearNucleoAdmin } from "../lib/admin/nucleo.js";
import {
  MODULOS_ADMIN,
  MOTIVOS_ADMIN,
  VIA_ADMIN,
  analizarListaIds,
  contarEntradasInvalidas,
  diagnosticarConfiguracionAdmin,
  estadoHttpDeMotivo,
  evaluarAdmin,
  idsAutorizadosParaModulo,
  normalizarIds,
  variableAdminDeModulo,
} from "../lib/admin/reglas.js";
import * as expoAdmin from "../lib/expo-cannabis/admin.js";
import { CORREO_ADMIN_LEGADO } from "../lib/expo-cannabis/admin-legado.js";
import { conSupabaseFalso } from "./ayudas/supabase-falso.js";

const ID_ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_OTRO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID_TERCERO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CONFIRMADO = "2026-01-01T00:00:00Z";

function usuario(extra = {}) {
  return {
    id: ID_ADMIN,
    email: "persona@example.com",
    email_confirmed_at: CONFIRMADO,
    is_anonymous: false,
    ...extra,
  };
}

const ENV_ADMIN = { ADMIN_IDS: ID_ADMIN };

function nucleoDe(quien, { env = ENV_ADMIN, ...extra } = {}) {
  return crearNucleoAdmin({ leerUsuario: async () => quien, env, advertir: () => {}, ...extra });
}

async function credencialDe(modulo, opciones) {
  const resultado = await nucleoDe(usuario(), opciones).obtenerAdmin(modulo);
  assert.equal(resultado.ok, true);
  return resultado.credencial;
}

// ───────────────────────── Listas de UUID y configuración ─────────────────────────

test("listas de UUID: normaliza mayúsculas, espacios y repetidos", () => {
  const crudo = ` ${ID_ADMIN.toUpperCase()} , ${ID_OTRO},${ID_ADMIN}`;
  assert.deepEqual(normalizarIds(crudo), [ID_ADMIN, ID_OTRO]);
  assert.equal(analizarListaIds(crudo).duplicados, 1);
  assert.deepEqual(normalizarIds(undefined), []);
  assert.deepEqual(normalizarIds(""), []);
  assert.equal(contarEntradasInvalidas(`${ID_ADMIN},no-es-uuid`), 1);
});

test("listas de UUID: clasifica cada tipo de error sin aceptar la entrada", () => {
  const casos = [
    [`"${ID_ADMIN}"`, "comillas"],
    [`'${ID_ADMIN}'`, "comillas"],
    [`${ID_ADMIN};${ID_OTRO}`, "separador"],
    [`${ID_ADMIN} ${ID_OTRO}`, "separador"],
    [`${ID_ADMIN}|${ID_OTRO}`, "separador"],
    [`${ID_ADMIN}\n${ID_OTRO}`, "saltoInterno"],
    [ID_ADMIN.slice(0, 20), "truncado"],
    [ID_ADMIN.slice(0, 35), "truncado"],
    [`${ID_ADMIN}${ID_OTRO}`, "malformado"],
    ["00000000-0000-0000-0000-000000000000", "malformado"],
    [`[${ID_ADMIN}]`, "malformado"],
    ["true", "malformado"],
  ];
  for (const [valor, categoria] of casos) {
    const analisis = analizarListaIds(valor);
    assert.deepEqual(analisis.validos, [], `no debe aceptar: ${categoria}`);
    assert.equal(analisis.invalidas, 1, categoria);
    assert.equal(analisis.problemas[categoria], 1, categoria);
  }
});

test("listas de UUID: entradas vacías y saltos de línea en los bordes se cuentan pero no rompen entradas válidas", () => {
  const analisis = analizarListaIds(` ,\r\n${ID_ADMIN}\r\n,, ${ID_OTRO} ,`);
  assert.deepEqual(analisis.validos, [ID_ADMIN, ID_OTRO]);
  assert.equal(analisis.problemas.vacias, 3);
  assert.ok(analisis.problemas.saltosDeLinea >= 1);
  assert.equal(analisis.invalidas, 0);
  assert.equal(analizarListaIds(",,  ,").problemas.vacias, 4);
  assert.equal(analizarListaIds(",,  ,").definida, true, "la variable está definida aunque no tenga ningún UUID");
  assert.equal(analizarListaIds("  ").definida, false);
});

test("configuración inválida: nunca concede acceso (fail-closed)", () => {
  const malas = [
    `"${ID_ADMIN}"`,
    `'${ID_ADMIN}'`,
    `"${ID_ADMIN},${ID_OTRO}"`,
    `${ID_ADMIN};${ID_OTRO}`,
    `${ID_ADMIN} ${ID_OTRO}`,
    `${ID_ADMIN}\n${ID_OTRO}`,
    `${ID_ADMIN}${ID_OTRO}`,
    ID_ADMIN.slice(0, 35),
    `[${ID_ADMIN}]`,
    "*",
    "true",
    " , , ",
    "",
    undefined,
    null,
  ];
  for (const valor of malas) {
    const global = evaluarAdmin(usuario(), "expo", { env: { ADMIN_IDS: valor } });
    const porModulo = evaluarAdmin(usuario(), "expo", { env: { ADMIN_IDS_EXPO: valor } });
    assert.equal(global.ok, false, `ADMIN_IDS=${JSON.stringify(valor)}`);
    assert.equal(porModulo.ok, false, `ADMIN_IDS_EXPO=${JSON.stringify(valor)}`);
  }
  assert.equal(evaluarAdmin(usuario(), "expo", { env: { ADMIN_IDS: `  ${ID_ADMIN}\r\n` } }).ok, true);
});

test("diagnóstico de configuración: informa conteos y nunca valores", () => {
  const env = {
    ADMIN_IDS: `"${ID_ADMIN}",${ID_OTRO};${ID_TERCERO},${ID_TERCERO.slice(0, 10)},`,
    ADMIN_IDS_EXPO: ID_ADMIN,
    ADMIN_IDS_PLANES: "basura",
  };
  const hallazgos = diagnosticarConfiguracionAdmin(env);
  const global = hallazgos.find((item) => item.variable === "ADMIN_IDS");
  assert.equal(global.conProblemas, true);
  assert.equal(global.validos, 0);
  assert.equal(global.problemas.comillas, 1);
  assert.equal(global.problemas.separador, 1);
  assert.equal(global.problemas.truncado, 1);
  assert.equal(global.problemas.vacias, 1);
  assert.equal(hallazgos.find((item) => item.variable === "ADMIN_IDS_EXPO").conProblemas, false);
  assert.equal(hallazgos.find((item) => item.variable === "ADMIN_IDS_PLANES").conProblemas, true);
  assert.equal(hallazgos.some((item) => item.variable === "ADMIN_IDS_USUARIOS"), false);

  const serializado = JSON.stringify(hallazgos);
  for (const id of [ID_ADMIN, ID_OTRO, ID_TERCERO]) {
    assert.equal(serializado.includes(id), false);
    assert.equal(serializado.includes(id.slice(0, 8)), false);
  }
});

test("módulos: ADMIN_IDS autoriza todo y ADMIN_IDS_<MÓDULO> solo ese módulo", () => {
  assert.equal(variableAdminDeModulo("flora_ia"), "ADMIN_IDS_FLORA_IA");
  assert.equal(variableAdminDeModulo("inexistente"), null);
  assert.equal(variableAdminDeModulo("__proto__"), null);

  const env = { ADMIN_IDS: ID_ADMIN, ADMIN_IDS_EXPO: ID_OTRO };
  assert.ok(idsAutorizadosParaModulo("expo", env).has(ID_ADMIN));
  assert.ok(idsAutorizadosParaModulo("expo", env).has(ID_OTRO));
  assert.ok(idsAutorizadosParaModulo("planes", env).has(ID_ADMIN));
  assert.equal(idsAutorizadosParaModulo("planes", env).has(ID_OTRO), false);
  assert.equal(idsAutorizadosParaModulo("inexistente", env).size, 0);
  for (const modulo of MODULOS_ADMIN) assert.ok(variableAdminDeModulo(modulo));
});

test("escalada entre módulos: el permiso de un módulo no abre ningún otro", () => {
  for (const modulo of MODULOS_ADMIN) {
    const env = { [variableAdminDeModulo(modulo)]: ID_ADMIN };
    for (const otro of MODULOS_ADMIN) {
      assert.equal(evaluarAdmin(usuario(), otro, { env }).ok, otro === modulo, `${modulo} → ${otro}`);
    }
  }
});

// ───────────────────────── Reglas de cuenta ─────────────────────────

test("evaluarAdmin: sin sesión, sesión inválida, anónimo y correo sin confirmar", () => {
  for (const ausente of [null, undefined, "x", 0]) {
    assert.equal(evaluarAdmin(ausente, "expo", { env: ENV_ADMIN }).motivo, MOTIVOS_ADMIN.sinSesion);
  }
  for (const id of [undefined, "", "123", "no-es-uuid"]) {
    assert.equal(evaluarAdmin(usuario({ id }), "expo", { env: ENV_ADMIN }).motivo, MOTIVOS_ADMIN.sesionInvalida);
  }
  assert.equal(evaluarAdmin(usuario({ is_anonymous: true }), "expo", { env: ENV_ADMIN }).motivo, MOTIVOS_ADMIN.anonimo);
  for (const email_confirmed_at of [null, undefined, "", "no-es-fecha"]) {
    const resultado = evaluarAdmin(usuario({ email_confirmed_at }), "expo", { env: ENV_ADMIN });
    assert.equal(resultado.motivo, MOTIVOS_ADMIN.correoSinConfirmar);
  }
});

test("evaluarAdmin: UUID no autorizado, autorizado y módulo inválido", () => {
  assert.equal(evaluarAdmin(usuario({ id: ID_OTRO }), "expo", { env: ENV_ADMIN }).motivo, MOTIVOS_ADMIN.noAutorizado);
  assert.equal(evaluarAdmin(usuario(), "expo", { env: {} }).motivo, MOTIVOS_ADMIN.noAutorizado);
  const resultado = evaluarAdmin(usuario({ id: ID_ADMIN.toUpperCase() }), "planes", { env: ENV_ADMIN });
  assert.deepEqual(resultado, { ok: true, id: ID_ADMIN, modulo: "planes", via: VIA_ADMIN.uuid });
  for (const modulo of ["inexistente", undefined, "__proto__", ["expo"]]) {
    assert.equal(evaluarAdmin(usuario(), modulo, { env: ENV_ADMIN }).motivo, MOTIVOS_ADMIN.moduloInvalido);
  }
});

test("evaluarAdmin: el respaldo solo cuenta tras validar la cuenta y debe responder exactamente true", () => {
  let consultas = 0;
  const respaldo = () => {
    consultas += 1;
    return true;
  };
  assert.equal(evaluarAdmin(usuario({ id: ID_OTRO, is_anonymous: true }), "expo", { env: {}, respaldo }).ok, false);
  assert.equal(evaluarAdmin(usuario({ id: ID_OTRO, email_confirmed_at: null }), "expo", { env: {}, respaldo }).ok, false);
  assert.equal(consultas, 0);
  assert.equal(evaluarAdmin(usuario({ id: ID_OTRO }), "expo", { env: {}, respaldo }).via, VIA_ADMIN.respaldo);
  for (const ambiguo of ["true", 1, {}, undefined]) {
    assert.equal(evaluarAdmin(usuario({ id: ID_OTRO }), "expo", { env: {}, respaldo: () => ambiguo }).ok, false);
  }
});

test("estado HTTP por motivo", () => {
  assert.equal(estadoHttpDeMotivo(MOTIVOS_ADMIN.sinSesion), 401);
  assert.equal(estadoHttpDeMotivo(MOTIVOS_ADMIN.sesionInvalida), 401);
  for (const motivo of Object.values(MOTIVOS_ADMIN).filter((valor) => !["sin_sesion", "sesion_invalida"].includes(valor))) {
    assert.equal(estadoHttpDeMotivo(motivo), 403, motivo);
  }
});

// ───────────────────────── Núcleo: obtención de identidad ─────────────────────────

test("núcleo: sin sesión, error del lector y datos basura rechazan (fail-closed)", async () => {
  assert.deepEqual(await nucleoDe(null).obtenerAdmin("expo"), { ok: false, motivo: MOTIVOS_ADMIN.sinSesion, estado: 401 });
  assert.equal((await nucleoDe("texto").obtenerAdmin("expo")).motivo, MOTIVOS_ADMIN.sinSesion);

  const roto = crearNucleoAdmin({
    leerUsuario: async () => {
      throw new Error("Auth caído");
    },
    env: ENV_ADMIN,
  });
  assert.deepEqual(await roto.obtenerAdmin("expo"), { ok: false, motivo: MOTIVOS_ADMIN.sesionInvalida, estado: 401 });

  const basura = await nucleoDe({ id: "xyz" }).obtenerAdmin("expo");
  assert.equal(basura.ok, false);
  assert.equal(basura.estado, 401);
});

test("núcleo: autoriza al administrador y rechaza anónimos, sin confirmar y no autorizados", async () => {
  assert.equal((await nucleoDe(usuario()).obtenerAdmin("expo")).ok, true);
  assert.equal((await nucleoDe(usuario({ is_anonymous: true })).obtenerAdmin("expo")).motivo, MOTIVOS_ADMIN.anonimo);
  assert.equal((await nucleoDe(usuario({ email_confirmed_at: null })).obtenerAdmin("expo")).motivo, MOTIVOS_ADMIN.correoSinConfirmar);
  assert.equal((await nucleoDe(usuario({ id: ID_OTRO })).obtenerAdmin("expo")).motivo, MOTIVOS_ADMIN.noAutorizado);
  assert.equal((await nucleoDe(usuario()).obtenerAdmin("inexistente")).motivo, MOTIVOS_ADMIN.moduloInvalido);
});

test("núcleo: requerirAdmin lanza con el estado HTTP correcto", async () => {
  const credencial = await nucleoDe(usuario()).requerirAdmin("planes");
  assert.equal(credencial !== null && typeof credencial === "object", true);

  await assert.rejects(nucleoDe(null).requerirAdmin("planes"), (error) => {
    assert.ok(error instanceof ErrorAdminNoAutorizado);
    return error.estado === 401 && error.motivo === MOTIVOS_ADMIN.sinSesion && error.message === "No autorizado.";
  });
  await assert.rejects(
    nucleoDe(usuario({ is_anonymous: true })).requerirAdmin("planes"),
    (error) => error.estado === 403 && error.motivo === MOTIVOS_ADMIN.anonimo,
  );
});

test("núcleo: respaldo por módulo, solo después de validar la cuenta y con el entorno del núcleo", async () => {
  const respaldos = { expo: (candidato, env) => candidato.email === "legado@example.com" && env.HABILITADO === "si" };
  const legado = usuario({ id: ID_OTRO, email: "legado@example.com" });

  const habilitado = nucleoDe(legado, { env: { HABILITADO: "si" }, respaldos });
  const resultado = await habilitado.obtenerAdmin("expo");
  assert.equal(resultado.ok, true);
  assert.equal(resultado.via, VIA_ADMIN.respaldo);
  assert.equal((await habilitado.obtenerAdmin("planes")).ok, false, "el respaldo de expo no abre otros módulos");

  assert.equal((await nucleoDe(legado, { env: {}, respaldos }).obtenerAdmin("expo")).ok, false);
  const anonimo = nucleoDe({ ...legado, is_anonymous: true }, { env: { HABILITADO: "si" }, respaldos });
  assert.equal((await anonimo.obtenerAdmin("expo")).motivo, MOTIVOS_ADMIN.anonimo);
  const sinConfirmar = nucleoDe({ ...legado, email_confirmed_at: null }, { env: { HABILITADO: "si" }, respaldos });
  assert.equal((await sinConfirmar.obtenerAdmin("expo")).motivo, MOTIVOS_ADMIN.correoSinConfirmar);
});

test("núcleo: no acepta identidades, entornos ni respaldos del llamador", async () => {
  const nucleo = nucleoDe(usuario({ id: ID_OTRO }));
  const intento = await nucleo.obtenerAdmin("expo", { respaldo: () => true, env: { ADMIN_IDS: ID_OTRO }, leerUsuario: async () => usuario() });
  assert.equal(intento.ok, false);
  await assert.rejects(nucleo.requerirAdmin("expo", { respaldo: () => true }), ErrorAdminNoAutorizado);
  assert.equal(nucleo.obtenerAdmin.length, 1);
  assert.equal(nucleo.requerirAdmin.length, 1);
  assert.throws(() => crearNucleoAdmin({ env: ENV_ADMIN }), TypeError);
  assert.throws(() => crearNucleoAdmin({ leerUsuario: async () => null }), TypeError);
});

// ───────────────────────── Credenciales ─────────────────────────

test("credencial: es opaca, no tiene propiedades y no se serializa con datos", async () => {
  const credencial = await credencialDe("expo");
  assert.equal(Object.isFrozen(credencial), true);
  assert.equal(Object.getPrototypeOf(credencial), null);
  assert.deepEqual(Reflect.ownKeys(credencial), []);
  assert.equal(JSON.stringify(credencial), "{}");
  assert.equal(credencial.id, undefined);
  assert.equal(credencial.modulo, undefined);
});

test("credencial: verificar devuelve la identidad, el módulo y la vía de la autorización original", async () => {
  const nucleo = nucleoDe(usuario());
  const { credencial } = await nucleo.obtenerAdmin("planes");
  assert.deepEqual(nucleo.verificar(credencial, "planes"), { id: ID_ADMIN, modulo: "planes", via: VIA_ADMIN.uuid });
});

test("credencial: no se puede falsificar con objetos arbitrarios", async () => {
  const nucleo = nucleoDe(usuario());
  const { credencial: real } = await nucleo.obtenerAdmin("expo");
  const otroNucleo = nucleoDe(usuario());
  const { credencial: deOtroNucleo } = await otroNucleo.obtenerAdmin("expo");

  const falsas = [
    ["símbolo global (el ataque original)", Object.freeze({ [Symbol.for("enflora.admin.credencial")]: true, id: ID_ADMIN, modulo: "expo", via: "uuid" })],
    ["objeto plano", { id: ID_ADMIN, modulo: "expo", via: "uuid" }],
    ["objeto congelado", Object.freeze({ id: ID_ADMIN, modulo: "expo", via: "uuid" })],
    ["sin prototipo", Object.freeze(Object.create(null))],
    ["con el mismo prototipo", Object.freeze(Object.create(Object.getPrototypeOf(real)))],
    ["copia de la real", Object.freeze(Object.assign(Object.create(null), real))],
    ["clon estructurado", structuredClone({ ...real })],
    ["proxy de la real", new Proxy(real, {})],
    ["proxy de un objeto", new Proxy({}, { get: () => true, has: () => true })],
    ["objeto con getters que dicen ser válido", { get modulo() { return "expo"; }, get id() { return ID_ADMIN; } }],
    ["credencial de otro núcleo", deOtroNucleo],
    ["cadena", "credencial"],
    ["número", 1],
    ["función", () => true],
    ["null", null],
    ["undefined", undefined],
  ];
  for (const [nombre, falsa] of falsas) {
    assert.throws(
      () => nucleo.verificar(falsa, "expo"),
      (error) => error instanceof ErrorAdminNoAutorizado && error.motivo === MOTIVOS_ADMIN.sinCredencial && error.estado === 403,
      nombre,
    );
  }
  assert.equal(nucleo.verificar(real, "expo").modulo, "expo");
});

test("credencial: el módulo se valida siempre y de forma explícita", async () => {
  const nucleo = nucleoDe(usuario());
  const { credencial } = await nucleo.obtenerAdmin("planes");

  assert.throws(() => nucleo.verificar(credencial, "expo"), (error) => error.motivo === MOTIVOS_ADMIN.moduloIncorrecto);
  for (const modulo of [undefined, null, "inexistente", "__proto__", ["planes"]]) {
    assert.throws(() => nucleo.verificar(credencial, modulo), (error) => error.motivo === MOTIVOS_ADMIN.moduloInvalido);
  }
  assert.equal(nucleo.verificar(credencial, "planes").modulo, "planes");
});

test("credencial: vence a los 60 segundos por defecto y no se reactiva", async () => {
  let ahora = 1_000_000;
  const nucleo = nucleoDe(usuario(), { ahora: () => ahora, ttlMs: 60_000 });
  const { credencial } = await nucleo.obtenerAdmin("expo");

  ahora += 59_999;
  assert.equal(nucleo.verificar(credencial, "expo").id, ID_ADMIN);
  ahora += 1;
  assert.throws(() => nucleo.verificar(credencial, "expo"), (error) => error.motivo === MOTIVOS_ADMIN.credencialExpirada);
  ahora -= 10_000;
  assert.equal(nucleo.verificar(credencial, "expo").modulo, "expo", "con el reloj hacia atrás vuelve a ser válida: el reloj es de confianza");
  ahora += 1_000_000;
  assert.throws(() => nucleo.verificar(credencial, "expo"), (error) => error.motivo === MOTIVOS_ADMIN.credencialExpirada);
});

test("credencial: el vencimiento por defecto es corto", async () => {
  const { TTL_CREDENCIAL_MS } = await import("../lib/admin/nucleo.js");
  assert.ok(TTL_CREDENCIAL_MS > 0 && TTL_CREDENCIAL_MS <= 120_000);
});

test("credencial: cada solicitud recibe una credencial propia y no hay estado compartido", async () => {
  const nucleo = nucleoDe(usuario());
  const primera = (await nucleo.obtenerAdmin("expo")).credencial;
  const segunda = (await nucleo.obtenerAdmin("expo")).credencial;
  assert.notEqual(primera, segunda);

  const otro = nucleoDe(usuario({ id: ID_OTRO }), { env: { ADMIN_IDS: `${ID_ADMIN},${ID_OTRO}` } });
  const deOtro = (await otro.obtenerAdmin("expo")).credencial;
  assert.throws(() => nucleo.verificar(deOtro, "expo"), (error) => error.motivo === MOTIVOS_ADMIN.sinCredencial);
});

test("credencial: solicitudes concurrentes de usuarios distintos no se mezclan", async () => {
  const cola = [];
  for (let indice = 0; indice < 40; indice += 1) cola.push(indice % 2 === 0 ? ID_ADMIN : ID_OTRO);
  let turno = 0;
  const nucleo = crearNucleoAdmin({
    leerUsuario: async () => {
      const id = cola[turno];
      turno += 1;
      await new Promise((resolver) => setTimeout(resolver, (turno * 7) % 5));
      return usuario({ id });
    },
    env: { ADMIN_IDS: `${ID_ADMIN},${ID_OTRO}` },
    advertir: () => {},
  });

  const resultados = await Promise.all(Array.from({ length: 40 }, () => nucleo.obtenerAdmin("expo")));
  const ids = resultados.map((resultado) => nucleo.verificar(resultado.credencial, "expo").id);
  assert.equal(new Set(resultados.map((resultado) => resultado.credencial)).size, 40);
  assert.equal(ids.filter((id) => id === ID_ADMIN).length, 20);
  assert.equal(ids.filter((id) => id === ID_OTRO).length, 20);
});

// ───────────────────────── Advertencias de configuración ─────────────────────────

test("advertencias: configuración inválida avisa una vez, sin UUID, y no concede acceso", async () => {
  const avisos = [];
  const env = { ADMIN_IDS: `"${ID_ADMIN}",${ID_OTRO};${ID_TERCERO}`, ADMIN_IDS_EXPO: `${ID_ADMIN.slice(0, 12)},` };
  const nucleo = crearNucleoAdmin({ leerUsuario: async () => usuario(), env, advertir: (mensaje) => avisos.push(mensaje) });

  assert.equal((await nucleo.obtenerAdmin("expo")).ok, false);
  assert.equal((await nucleo.obtenerAdmin("expo")).ok, false);
  assert.equal(avisos.length, 2, "una advertencia por variable, sin repetir");
  assert.ok(avisos.some((mensaje) => mensaje.includes("ADMIN_IDS:") && mensaje.includes("comillas")));
  assert.ok(avisos.some((mensaje) => mensaje.includes("ADMIN_IDS_EXPO") && mensaje.includes("truncadas")));
  for (const mensaje of avisos) {
    for (const id of [ID_ADMIN, ID_OTRO, ID_TERCERO]) {
      assert.equal(mensaje.includes(id), false);
      assert.equal(mensaje.includes(id.slice(0, 8)), false);
    }
    assert.equal(mensaje.includes("persona@example.com"), false);
  }

  env.ADMIN_IDS = `"${ID_ADMIN}"`;
  await nucleo.obtenerAdmin("expo");
  assert.equal(avisos.length, 3, "cambia la configuración, cambia el aviso");
});

test("advertencias: una configuración correcta no avisa y un fallo al registrar no cambia el resultado", async () => {
  const avisos = [];
  const correcto = crearNucleoAdmin({ leerUsuario: async () => usuario(), env: ENV_ADMIN, advertir: (mensaje) => avisos.push(mensaje) });
  assert.equal((await correcto.obtenerAdmin("expo")).ok, true);
  assert.deepEqual(avisos, []);

  const ruidoso = crearNucleoAdmin({
    leerUsuario: async () => usuario(),
    env: { ADMIN_IDS: `${ID_ADMIN},"roto"` },
    advertir: () => {
      throw new Error("registro caído");
    },
  });
  assert.equal((await ruidoso.obtenerAdmin("expo")).ok, true, "el UUID válido sigue funcionando");
});

// ───────────────────────── API de producción (Supabase falso, código real) ─────────────────────────

test("API de producción: expone solo funciones que no aceptan identidades ni opciones", () => {
  assert.deepEqual(Object.keys(autorizacion).sort(), ["ErrorAdminNoAutorizado", "obtenerAdmin", "requerirAdmin", "verificarCredencial"]);
  assert.equal(autorizacion.obtenerAdmin.length, 1);
  assert.equal(autorizacion.requerirAdmin.length, 1);
  assert.equal(autorizacion.verificarCredencial.length, 2);

  for (const retirada of ["esAdministradorExpo", "autorizarUsuarioExpo", "autorizarUsuarioAdmin", "esCredencialAdmin"]) {
    assert.equal(retirada in expoAdmin || retirada in autorizacion, false, `${retirada} no debe existir`);
  }
  assert.equal(expoAdmin.obtenerAdminExpo.length, 0);
  assert.equal(expoAdmin.verificarAdminExpo.length, 1);
});

test("API de producción: la identidad sale de Supabase Auth y las opciones del llamador se ignoran", async () => {
  const noAdmin = usuario({ id: ID_OTRO, email: "otra@example.com" });
  await conSupabaseFalso({ usuario: noAdmin, entorno: ENV_ADMIN }, async () => {
    const intento = await expoAdmin.obtenerAdminExpo({ respaldo: () => true, env: { ADMIN_IDS: ID_OTRO }, leerUsuario: async () => usuario() });
    assert.equal(intento.ok, false);
    assert.equal(intento.motivo, MOTIVOS_ADMIN.noAutorizado);
    assert.equal((await autorizacion.obtenerAdmin("expo", { respaldo: () => true })).ok, false);
    await assert.rejects(autorizacion.requerirAdmin("expo", { respaldo: () => true }), ErrorAdminNoAutorizado);
  });
});

test("API de producción: sin sesión, Auth caído o sesión sin usuario rechazan", async () => {
  await conSupabaseFalso({ usuario: null, entorno: ENV_ADMIN }, async () => {
    const resultado = await expoAdmin.obtenerAdminExpo();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.estado, 401);
  });
  await conSupabaseFalso({ usuario: usuario(), entorno: ENV_ADMIN, authCaido: true }, async () => {
    assert.equal((await expoAdmin.obtenerAdminExpo()).ok, false);
  });
  const previo = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    assert.equal((await expoAdmin.obtenerAdminExpo()).motivo, MOTIVOS_ADMIN.sinSesion);
  } finally {
    if (previo.url !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = previo.url;
    if (previo.anon !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previo.anon;
  }
});

test("API de producción: cuentas anónimas, sin correo confirmado o fuera de la lista no ingresan", async () => {
  const casos = [
    [usuario({ is_anonymous: true }), MOTIVOS_ADMIN.anonimo],
    [usuario({ email_confirmed_at: null }), MOTIVOS_ADMIN.correoSinConfirmar],
    [usuario({ id: ID_OTRO }), MOTIVOS_ADMIN.noAutorizado],
  ];
  for (const [quien, motivo] of casos) {
    await conSupabaseFalso({ usuario: quien, entorno: ENV_ADMIN }, async () => {
      const resultado = await expoAdmin.obtenerAdminExpo();
      assert.equal(resultado.ok, false);
      assert.equal(resultado.motivo, motivo);
    });
  }
});

test("API de producción: UUID autorizado ingresa y los permisos por módulo no escalan", async () => {
  await conSupabaseFalso({ usuario: usuario(), entorno: ENV_ADMIN }, async () => {
    const resultado = await expoAdmin.obtenerAdminExpo();
    assert.equal(resultado.ok, true);
    assert.equal(resultado.via, VIA_ADMIN.uuid);
    assert.equal((await autorizacion.obtenerAdmin("planes")).ok, true);
  });
  await conSupabaseFalso({ usuario: usuario(), entorno: { ADMIN_IDS_PLANES: ID_ADMIN } }, async () => {
    assert.equal((await autorizacion.obtenerAdmin("planes")).ok, true);
    assert.equal((await expoAdmin.obtenerAdminExpo()).ok, false);
    assert.equal((await autorizacion.obtenerAdmin("usuarios")).ok, false);
  });
  await conSupabaseFalso({ usuario: usuario(), entorno: { ADMIN_IDS_EXPO: ID_ADMIN } }, async () => {
    assert.equal((await expoAdmin.obtenerAdminExpo()).ok, true);
    assert.equal((await autorizacion.obtenerAdmin("planes")).ok, false);
  });
});

test("compatibilidad: el acceso anterior de Expo sigue funcionando y exige cuenta válida", async () => {
  const legado = usuario({ id: ID_OTRO, email: CORREO_ADMIN_LEGADO });
  await conSupabaseFalso({ usuario: legado, entorno: {} }, async () => {
    const resultado = await expoAdmin.obtenerAdminExpo();
    assert.equal(resultado.ok, true);
    assert.equal(resultado.via, VIA_ADMIN.respaldo);
    assert.equal((await autorizacion.obtenerAdmin("planes")).ok, false, "el legado no abre otros módulos");
  });
  await conSupabaseFalso({ usuario: usuario({ id: ID_OTRO, email: "Extra@Example.com" }), entorno: { EXPO_ADMIN_EMAILS: "uno@example.com, extra@example.com" } }, async () => {
    assert.equal((await expoAdmin.obtenerAdminExpo()).via, VIA_ADMIN.respaldo);
  });
  await conSupabaseFalso({ usuario: usuario({ id: ID_TERCERO }), entorno: { EXPO_ADMIN_IDS: ID_TERCERO } }, async () => {
    assert.equal((await expoAdmin.obtenerAdminExpo()).via, VIA_ADMIN.respaldo);
  });
  for (const rechazado of [{ is_anonymous: true }, { email_confirmed_at: null }]) {
    await conSupabaseFalso({ usuario: { ...legado, ...rechazado }, entorno: {} }, async () => {
      assert.equal((await expoAdmin.obtenerAdminExpo()).ok, false);
    });
  }
});

test("compatibilidad: retirar un UUID de ADMIN_IDS no revoca el acceso anterior (documentado)", async () => {
  await conSupabaseFalso({ usuario: usuario({ id: ID_OTRO, email: CORREO_ADMIN_LEGADO }), entorno: { ADMIN_IDS: ID_ADMIN } }, async () => {
    const resultado = await expoAdmin.obtenerAdminExpo();
    assert.equal(resultado.ok, true);
    assert.equal(resultado.via, VIA_ADMIN.respaldo);
  });
});
