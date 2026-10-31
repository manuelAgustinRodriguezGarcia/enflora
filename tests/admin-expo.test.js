import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as acciones from "../app/expo-cannabis/admin/acciones.js";
import { ErrorAdminNoAutorizado, obtenerAdmin } from "../lib/admin/autorizacion.js";
import { MOTIVOS_ADMIN } from "../lib/admin/reglas.js";
import { crearClienteRestringido } from "../lib/admin/servicio.js";
import {
  guardarInventarioServicio,
  mutarEntregaExpo,
  obtenerAdminExpo,
  obtenerPanelExpo,
  reiniciarParticipantesServicio,
} from "../lib/expo-cannabis/admin.js";
import { operacionesContactosAdmin } from "../lib/expo-cannabis/contactos-admin.js";
import { administradorPush } from "../lib/push/admin.js";
import { conSupabaseFalso } from "./ayudas/supabase-falso.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ID_ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_OTRO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID_CONTACTO = "11111111-1111-4111-8111-111111111111";
const ENV_ADMIN = { ADMIN_IDS: ID_ADMIN };

function usuario(extra = {}) {
  return { id: ID_ADMIN, email: "persona@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false, ...extra };
}

const FILA_STICKERS = { slug: "stickers", nombre: "Stickers", stock_total: 10, entregados: 1, reservados: 0, updated_at: "2026-10-31T12:00:00Z" };
const CONTACTO = {
  id: ID_CONTACTO,
  nombre: "Ana",
  email: "ana@example.com",
  telefono: null,
  origen_inicial: "manual",
  origenes: ["manual"],
  consentimiento_marketing: false,
  consentimiento_fecha: null,
  consentimiento_version: null,
  created_at: "2026-10-30T12:00:00Z",
  updated_at: "2026-10-30T12:00:00Z",
};

function json(cuerpo, cabeceras = {}) {
  return new Response(JSON.stringify(cuerpo), { status: 200, headers: { "content-type": "application/json", ...cabeceras } });
}

/** PostgREST falso con respuestas plausibles para cada operación del admin de Expo. */
function restDeExpo({ metodo, url }) {
  const ruta = url.pathname;
  if (ruta === "/rest/v1/rpc/registrar_entrega_expo" || ruta === "/rest/v1/rpc/guardar_inventario_expo") return json(FILA_STICKERS);
  if (ruta === "/rest/v1/rpc/reiniciar_participantes_expo") return json({ participantes: 2, partidas: 3 });
  if (ruta === "/rest/v1/rpc/resumen_participantes_expo") return json({ participantes: 4, partidas: 5 });
  if (ruta === "/rest/v1/rpc/resumen_contactos_enflora") return json([{ total: 1, landing: 0, ruleta: 0, con_consentimiento: 0, hoy: 1 }]);
  if (ruta === "/rest/v1/rpc/registrar_contacto_enflora") return json([{ id_contacto: ID_CONTACTO, es_nuevo: true }]);
  if (ruta === "/rest/v1/rpc/actualizar_consentimiento_contacto") return json(true);
  if (ruta === "/rest/v1/expo_inventario") return json([FILA_STICKERS]);
  if (ruta === "/rest/v1/contactos_enflora") {
    if (metodo === "DELETE") return json([{ id: ID_CONTACTO }]);
    return json([CONTACTO], { "content-range": "0-0/1" });
  }
  return null;
}

async function conAvisos(tarea) {
  const original = console.warn;
  const avisos = [];
  console.warn = (...argumentos) => avisos.push(argumentos.join(" "));
  try {
    return await tarea(avisos);
  } finally {
    console.warn = original;
  }
}

function rutas(entorno) {
  return entorno.rest.map((solicitud) => `${solicitud.metodo} ${solicitud.url.pathname}`);
}

// ───────────────────────── Funciones administrativas de Expo ─────────────────────────

test("Expo: sin credencial, con una falsa o con la de otro módulo, ninguna función toca datos", async () => {
  await conSupabaseFalso({ usuario: usuario(), entorno: ENV_ADMIN, rest: restDeExpo }, async (entorno) => {
    const otros = [];
    for (const modulo of ["planes", "usuarios", "dashboard", "flora_ia"]) {
      const resultado = await obtenerAdmin(modulo);
      assert.equal(resultado.ok, true);
      otros.push(resultado.credencial);
    }
    const falsas = [
      undefined,
      null,
      {},
      Object.freeze({ id: ID_ADMIN, modulo: "expo", via: "uuid" }),
      Object.freeze({ [Symbol.for("enflora.admin.credencial")]: true, id: ID_ADMIN, modulo: "expo", via: "uuid" }),
      new Proxy({}, { get: () => "expo" }),
    ];

    for (const credencial of [...falsas, ...otros]) {
      const motivo = otros.includes(credencial) ? MOTIVOS_ADMIN.moduloIncorrecto : MOTIVOS_ADMIN.sinCredencial;
      const rechaza = (error) => error instanceof ErrorAdminNoAutorizado && error.motivo === motivo;
      await assert.rejects(obtenerPanelExpo(credencial), rechaza);
      await assert.rejects(mutarEntregaExpo(credencial, "stickers", 1), rechaza);
      await assert.rejects(guardarInventarioServicio(credencial, "stickers", 10, 0), rechaza);
      await assert.rejects(reiniciarParticipantesServicio(credencial), rechaza);
      assert.throws(() => operacionesContactosAdmin(credencial), rechaza);
      assert.throws(() => crearClienteRestringido(credencial, "expo"), rechaza);
    }
    assert.deepEqual(rutas(entorno), [], "ninguna solicitud llegó a Supabase");
  });
});

test("Expo: una credencial de Expo vencida deja de servir en todas las funciones", async () => {
  await conSupabaseFalso({ usuario: usuario(), entorno: ENV_ADMIN, rest: restDeExpo }, async (entorno) => {
    const { credencial } = await obtenerAdminExpo();
    assert.equal((await obtenerPanelExpo(credencial)).error, null);

    const dateNow = Date.now;
    Date.now = () => dateNow() + 61_000;
    try {
      const vencida = (error) => error instanceof ErrorAdminNoAutorizado && error.motivo === MOTIVOS_ADMIN.credencialExpirada;
      const antes = entorno.rest.length;
      await assert.rejects(obtenerPanelExpo(credencial), vencida);
      await assert.rejects(mutarEntregaExpo(credencial, "stickers", 1), vencida);
      await assert.rejects(guardarInventarioServicio(credencial, "stickers", 10, 0), vencida);
      await assert.rejects(reiniciarParticipantesServicio(credencial), vencida);
      assert.throws(() => operacionesContactosAdmin(credencial), vencida);
      assert.equal(entorno.rest.length, antes);
    } finally {
      Date.now = dateNow;
    }
  });
});

test("Expo: con credencial válida inventario y participantes conservan su comportamiento", async () => {
  await conAvisos(async (avisos) => {
    await conSupabaseFalso({ usuario: usuario(), entorno: ENV_ADMIN, rest: restDeExpo }, async (entorno) => {
      const { credencial } = await obtenerAdminExpo();

      const panel = await obtenerPanelExpo(credencial);
      assert.equal(panel.error, null);
      assert.deepEqual(panel.productos, [FILA_STICKERS]);
      assert.equal(panel.participantes, 4);
      assert.equal(panel.partidas, 5);

      const entrega = await mutarEntregaExpo(credencial, "stickers", 1);
      assert.deepEqual(entrega, { ok: true, fila: FILA_STICKERS });
      const inventario = await guardarInventarioServicio(credencial, "stickers", 10, 2);
      assert.deepEqual(inventario, { ok: true, fila: FILA_STICKERS });
      const reinicio = await reiniciarParticipantesServicio(credencial);
      assert.deepEqual(reinicio, { ok: true, participantes: 2, partidas: 3 });

      const cuerpoEntrega = entorno.rest.find((solicitud) => solicitud.url.pathname.endsWith("registrar_entrega_expo")).cuerpo;
      assert.deepEqual(JSON.parse(cuerpoEntrega), { p_slug: "stickers", p_delta: 1 });
      const cuerpoInventario = entorno.rest.find((solicitud) => solicitud.url.pathname.endsWith("guardar_inventario_expo")).cuerpo;
      assert.deepEqual(JSON.parse(cuerpoInventario), { p_slug: "stickers", p_stock: 10, p_entregados: 2 });
      assert.equal(avisos.filter((aviso) => aviso.includes("[admin]")).length, 0, "nada se bloqueó");
    });
  });
});

test("Expo: sin clave de servicio las funciones devuelven el error de configuración de siempre", async () => {
  await conSupabaseFalso({ usuario: usuario(), entorno: ENV_ADMIN, servicio: false, rest: restDeExpo }, async (entorno) => {
    const { credencial } = await obtenerAdminExpo();
    const mensaje = "Falta la clave de servicio de Supabase en el servidor.";
    assert.equal((await obtenerPanelExpo(credencial)).error, mensaje);
    assert.deepEqual(await mutarEntregaExpo(credencial, "stickers", 1), { ok: false, error: mensaje });
    assert.deepEqual(await guardarInventarioServicio(credencial, "stickers", 10, 0), { ok: false, error: mensaje });
    assert.deepEqual(await reiniciarParticipantesServicio(credencial), { ok: false, error: mensaje });
    assert.equal(operacionesContactosAdmin(credencial), null);
    assert.deepEqual(rutas(entorno), []);
  });
});

test("Expo: las operaciones de contactos no entregan el cliente de Supabase", async () => {
  await conSupabaseFalso({ usuario: usuario(), entorno: ENV_ADMIN, rest: restDeExpo }, async () => {
    const { credencial } = await obtenerAdminExpo();
    const operaciones = operacionesContactosAdmin(credencial);
    assert.deepEqual(Object.keys(operaciones).sort(), ["cambiarConsentimiento", "crear", "editar", "eliminar", "exportar", "leer", "listar", "resumen"]);
    assert.equal(Object.isFrozen(operaciones), true);
    const resultado = await operaciones.listar({});
    assert.equal(resultado.ok, true);
    for (const valor of Object.values(operaciones)) assert.equal(typeof valor, "function");
    assert.equal(JSON.stringify(await operaciones.leer(ID_CONTACTO)).includes("clave"), false);
  });
});

// ───────────────────────── Acciones del servidor ─────────────────────────

const ACCIONES = {
  leerContactosExpo: () => acciones.leerContactosExpo({}),
  leerContactoExpo: () => acciones.leerContactoExpo(ID_CONTACTO),
  crearContactoExpo: () => acciones.crearContactoExpo({ nombre: "Ana", email: "ana@example.com", telefono: "" }),
  editarContactoExpo: () => acciones.editarContactoExpo(ID_CONTACTO, { nombre: "Ana", email: "ana@example.com", telefono: "" }),
  retirarConsentimientoExpo: () => acciones.retirarConsentimientoExpo(ID_CONTACTO),
  eliminarContactoExpo: () => acciones.eliminarContactoExpo(ID_CONTACTO),
  exportarContactosExpo: () => acciones.exportarContactosExpo({}),
  leerPanelExpo: () => acciones.leerPanelExpo(),
  registrarEntregaExpo: () => acciones.registrarEntregaExpo("stickers", 1),
  guardarInventarioExpo: () => acciones.guardarInventarioExpo("stickers", 10, 2),
  reiniciarParticipantesExpo: () => acciones.reiniciarParticipantesExpo(),
};

test("acciones: el listado de pruebas cubre exactamente las acciones exportadas", () => {
  assert.deepEqual(Object.keys(acciones).sort(), Object.keys(ACCIONES).sort());
  const fuente = fs.readFileSync(path.join(RAIZ, "app/expo-cannabis/admin/acciones.js"), "utf8");
  assert.match(fuente, /^"use server";/);
  const cuerpos = fuente.split(/^export async function /m).slice(1);
  assert.equal(cuerpos.length, Object.keys(ACCIONES).length);
  for (const cuerpo of cuerpos) {
    const lineas = cuerpo.split(/\r?\n/);
    assert.match(lineas[1], /const admin = await administrador\(\);/, `la acción ${lineas[0]} debe autorizar primero`);
    assert.match(lineas[2], /if \(!admin\) return NO_AUTORIZADO;/, lineas[0]);
  }
});

test("acciones: sin sesión, sin permisos, anónimo o sin correo confirmado, ninguna toca datos", async () => {
  const casos = [
    ["sin sesión", { usuario: null, entorno: ENV_ADMIN }],
    ["Auth caído", { usuario: usuario(), entorno: ENV_ADMIN, authCaido: true }],
    ["UUID no autorizado", { usuario: usuario({ id: ID_OTRO }), entorno: ENV_ADMIN }],
    ["administrador anónimo", { usuario: usuario({ is_anonymous: true }), entorno: ENV_ADMIN }],
    ["administrador sin correo confirmado", { usuario: usuario({ email_confirmed_at: null }), entorno: ENV_ADMIN }],
    ["sin listas configuradas", { usuario: usuario({ id: ID_OTRO, email: "cualquiera@example.com" }), entorno: {} }],
  ];
  for (const [nombre, configuracion] of casos) {
    await conSupabaseFalso({ ...configuracion, rest: restDeExpo }, async (entorno) => {
      for (const [accion, ejecutar] of Object.entries(ACCIONES)) {
        assert.deepEqual(await ejecutar(), { ok: false, error: "No autorizado." }, `${accion} (${nombre})`);
      }
      assert.deepEqual(rutas(entorno), [], `${nombre}: no debe haber llegado nada a PostgREST`);
    });
  }
});

test("acciones: sin ninguna configuración de Supabase todas responden No autorizado", async () => {
  const previo = Object.fromEntries(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].map((clave) => [clave, process.env[clave]]));
  for (const clave of Object.keys(previo)) delete process.env[clave];
  try {
    for (const [accion, ejecutar] of Object.entries(ACCIONES)) {
      assert.deepEqual(await ejecutar(), { ok: false, error: "No autorizado." }, accion);
    }
  } finally {
    for (const [clave, valor] of Object.entries(previo)) if (valor !== undefined) process.env[clave] = valor;
  }
});

test("acciones: el administrador autorizado conserva el comportamiento de cada acción", async () => {
  await conAvisos(async (avisos) => {
    await conSupabaseFalso({ usuario: usuario(), entorno: ENV_ADMIN, rest: restDeExpo }, async (entorno) => {
      const lectura = await ACCIONES.leerContactosExpo();
      assert.equal(lectura.ok, true);
      assert.equal(lectura.total, 1);
      assert.equal(lectura.resumen.total, 1);

      const contacto = await ACCIONES.leerContactoExpo();
      assert.equal(contacto.ok, true);
      assert.equal(contacto.contacto.id, ID_CONTACTO);

      const creado = await ACCIONES.crearContactoExpo();
      assert.equal(creado.ok, true);
      assert.equal(creado.id, ID_CONTACTO);
      assert.equal(creado.nuevo, true);

      const editado = await ACCIONES.editarContactoExpo();
      assert.equal(editado.ok, true);
      assert.equal(editado.contacto.id, ID_CONTACTO);

      assert.deepEqual(await ACCIONES.retirarConsentimientoExpo(), { ok: true });
      assert.deepEqual(await ACCIONES.eliminarContactoExpo(), { ok: true });

      const exportado = await ACCIONES.exportarContactosExpo();
      assert.equal(exportado.ok, true);
      assert.equal(exportado.cantidad, 1);
      assert.equal(typeof exportado.csv, "string");

      const panel = await ACCIONES.leerPanelExpo();
      assert.equal(panel.ok, true);
      assert.equal(panel.participantes, 4);

      const entrega = await ACCIONES.registrarEntregaExpo();
      assert.equal(entrega.ok, true);
      assert.equal(entrega.producto.slug, "stickers");

      const inventario = await ACCIONES.guardarInventarioExpo();
      assert.equal(inventario.ok, true);
      assert.equal(inventario.producto.stockTotal, 10);

      const reinicio = await ACCIONES.reiniciarParticipantesExpo();
      assert.equal(reinicio.ok, true);
      assert.equal(reinicio.participantes, 2);

      assert.equal(avisos.filter((aviso) => aviso.includes("[admin]")).length, 0, "ninguna solicitud legítima se bloqueó");
      const usadas = new Set(rutas(entorno).map((ruta) => ruta.replace(/^(GET|POST|PATCH|DELETE) /, "")));
      for (const ruta of usadas) {
        assert.match(ruta, /^\/rest\/v1\/(expo_inventario|contactos_enflora|rpc\/(registrar_entrega_expo|guardar_inventario_expo|resumen_participantes_expo|reiniciar_participantes_expo|registrar_contacto_enflora|actualizar_consentimiento_contacto|resumen_contactos_enflora))$/);
      }
      const metodos = new Set(entorno.rest.filter((solicitud) => solicitud.url.pathname === "/rest/v1/contactos_enflora").map((solicitud) => solicitud.metodo));
      assert.deepEqual([...metodos].sort(), ["DELETE", "GET", "PATCH"]);
    });
  });
});

test("acciones: validaciones propias de cada acción se mantienen (después de autorizar)", async () => {
  await conSupabaseFalso({ usuario: usuario(), entorno: ENV_ADMIN, rest: restDeExpo }, async (entorno) => {
    assert.deepEqual(await acciones.leerContactoExpo("no-es-un-id"), { ok: false, error: "El contacto no existe." });
    assert.deepEqual(await acciones.eliminarContactoExpo("no-es-un-id"), { ok: false, error: "El contacto no existe." });
    assert.deepEqual(await acciones.registrarEntregaExpo("inexistente", 1), { ok: false, error: "La operación no es válida." });
    assert.deepEqual(await acciones.guardarInventarioExpo("stickers", -1, 0), { ok: false, error: "Las cantidades no son válidas." });
    assert.deepEqual(await acciones.guardarInventarioExpo("stickers", 1, 5), { ok: false, error: "Las entregas no pueden superar el stock." });
    assert.equal((await acciones.crearContactoExpo({ nombre: "", email: "", telefono: "" })).ok, false);
    assert.deepEqual(rutas(entorno), []);
  });
});

// ───────────────────────── Pruebas push (comparten el admin de Expo) ─────────────────────────

function solicitudPush(extra = {}) {
  return { headers: new Headers({ origin: "https://enflora.test", host: "enflora.test", ...extra }) };
}

test("push: el administrador de pruebas sigue siendo el administrador de Expo y obtiene su id de Auth", async () => {
  await conSupabaseFalso({ usuario: usuario(), entorno: ENV_ADMIN }, async () => {
    assert.deepEqual(await administradorPush(solicitudPush()), { id: ID_ADMIN });
    assert.equal(await administradorPush(solicitudPush({ origin: "https://atacante.test" })), null);
  });
  for (const rechazado of [usuario({ id: ID_OTRO }), usuario({ is_anonymous: true }), usuario({ email_confirmed_at: null })]) {
    await conSupabaseFalso({ usuario: rechazado, entorno: ENV_ADMIN }, async () => {
      assert.equal(await administradorPush(solicitudPush()), null);
    });
  }
  await conSupabaseFalso({ usuario: null, entorno: ENV_ADMIN }, async () => {
    assert.equal(await administradorPush(solicitudPush()), null);
  });
});

// ───────────────────────── Límites entre módulos (análisis estático) ─────────────────────────

function listarArchivos(directorio, salida = []) {
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(entrada.name)) continue;
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) listarArchivos(ruta, salida);
    else if (/\.(js|mjs)$/.test(entrada.name)) salida.push(ruta);
  }
  return salida;
}

const CODIGO = ["app", "componentes", "lib", "scripts"].flatMap((carpeta) => listarArchivos(path.join(RAIZ, carpeta))).concat([path.join(RAIZ, "proxy.js")]);

function relativa(ruta) {
  return path.relative(RAIZ, ruta).replaceAll("\\", "/");
}

function importaciones(ruta) {
  const fuente = fs.readFileSync(ruta, "utf8");
  return [...fuente.matchAll(/^import\s[^;]*?from\s+"([^"]+)"|^import\s+"([^"]+)"/gm)].map((coincidencia) => coincidencia[1] ?? coincidencia[2]);
}

function resolverImportacion(desde, especificador) {
  if (especificador.startsWith("@/")) return especificador.slice(2);
  if (especificador.startsWith(".")) return relativa(path.resolve(path.dirname(desde), especificador));
  return null;
}

function archivosQueImportan(destino) {
  return CODIGO.filter((ruta) => importaciones(ruta).some((especificador) => {
    const resuelta = resolverImportacion(ruta, especificador);
    return resuelta !== null && (resuelta === destino || resuelta === destino.replace(/\.js$/, ""));
  })).map(relativa).sort();
}

test("límites: solo autorizacion.js usa la fábrica del núcleo (el punto de inyección de pruebas)", () => {
  assert.deepEqual(archivosQueImportan("lib/admin/nucleo.js"), ["lib/admin/autorizacion.js"]);
});

test("límites: el cliente restringido solo lo reciben módulos de lib/ de Expo, nunca páginas ni componentes", () => {
  assert.deepEqual(archivosQueImportan("lib/admin/servicio.js"), ["lib/expo-cannabis/admin.js", "lib/expo-cannabis/contactos-admin.js"]);
  for (const prohibido of ["lib/admin/servicio.js", "lib/admin/nucleo.js", "lib/admin/politica.js"]) {
    const intrusos = archivosQueImportan(prohibido).filter((ruta) => /^(app|componentes)\//.test(ruta) || ruta === "proxy.js");
    assert.deepEqual(intrusos, [], prohibido);
  }
});

test("límites: las acciones y la página administrativa no importan clientes ni datos privados directamente", () => {
  for (const archivo of ["app/expo-cannabis/admin/acciones.js", "app/expo-cannabis/admin/page.js"]) {
    const especificadores = importaciones(path.join(RAIZ, archivo));
    assert.equal(especificadores.some((valor) => /lib\/admin\/(servicio|nucleo|politica)|lib\/contactos\/datos|supabase-js/.test(valor)), false, archivo);
  }
});

test("límites: componentes cliente no importan código de administración ni del servidor", () => {
  for (const ruta of CODIGO.filter((archivo) => relativa(archivo).startsWith("componentes/"))) {
    const especificadores = importaciones(ruta);
    assert.equal(
      especificadores.some((valor) => /lib\/admin|lib\/expo-cannabis\/(admin|contactos-admin)|lib\/contactos\/datos|supabase\/servidor/.test(valor)),
      false,
      relativa(ruta),
    );
  }
});

test("límites: la clave de servicio solo aparece en los módulos que ya la usaban más la capa central", () => {
  const conClave = CODIGO.filter((ruta) =>
    fs
      .readFileSync(ruta, "utf8")
      .split(/\r?\n/)
      .some((linea) => linea.includes("SUPABASE_SERVICE_ROLE_KEY") && !/^\s*(\*|\/\/|\/\*)/.test(linea)),
  )
    .map(relativa)
    .filter((ruta) => !ruta.startsWith("tests/") && !ruta.startsWith("scripts/"))
    .sort();
  assert.deepEqual(conClave, [
    "lib/admin/servicio.js",
    "lib/contactos/datos.js",
    "lib/expo-cannabis/visitante.js",
    "lib/pagos/datos.js",
    "lib/pagos/infra-diagnostico.js",
    "lib/push/datos.js",
    "lib/ruleta-420/servidor.js",
  ]);
});

test("límites: la autenticidad de las credenciales no usa símbolos globales y los imports administrativos son los esperados", () => {
  for (const archivo of ["autorizacion", "nucleo", "servicio", "politica", "respaldos", "reglas"]) {
    const fuente = fs.readFileSync(path.join(RAIZ, `lib/admin/${archivo}.js`), "utf8");
    assert.equal(/Symbol\.for\(/.test(fuente), false, `${archivo}.js no debe usar Symbol.for`);
  }
  const esperadas = {
    "lib/admin/reglas.js": [],
    "lib/admin/politica.js": ["./reglas.js"],
    "lib/admin/nucleo.js": ["./reglas.js"],
    "lib/admin/respaldos.js": ["../expo-cannabis/admin-legado.js"],
    "lib/admin/autorizacion.js": ["./nucleo.js", "./respaldos.js", "@/lib/supabase/servidor", "server-only"],
    "lib/admin/servicio.js": ["./autorizacion.js", "./politica.js", "@supabase/supabase-js", "server-only"],
    "lib/expo-cannabis/admin-legado.js": ["../admin/reglas.js"],
    "lib/expo-cannabis/visitante.js": ["@supabase/supabase-js", "next/headers", "server-only"],
  };
  for (const [archivo, lista] of Object.entries(esperadas)) {
    assert.deepEqual(importaciones(path.join(RAIZ, archivo)).sort(), [...lista].sort(), archivo);
  }
});

test("límites: lo público de Expo no importa autorización ni cliente administrativo", () => {
  for (const ruta of ["participar", "ruleta"]) {
    const archivo = `app/api/expo-cannabis/${ruta}/route.js`;
    const especificadores = importaciones(path.join(RAIZ, archivo));
    assert.ok(especificadores.includes("@/lib/expo-cannabis/visitante"), archivo);
    assert.equal(especificadores.some((valor) => /lib\/admin|expo-cannabis\/(admin|contactos-admin)/.test(valor)), false, archivo);
  }
  const admin = fs.readFileSync(path.join(RAIZ, "lib/expo-cannabis/admin.js"), "utf8");
  assert.doesNotMatch(admin, /export (async )?function (visitanteExpo|registrarPartidaExpo)/);
  assert.equal(importaciones(path.join(RAIZ, "lib/expo-cannabis/admin.js")).includes("next/headers"), false);
});
