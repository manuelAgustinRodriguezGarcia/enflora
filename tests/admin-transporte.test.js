import assert from "node:assert/strict";
import test from "node:test";
import { ErrorAdminNoAutorizado, crearNucleoAdmin } from "../lib/admin/nucleo.js";
import { ACCESO_DATOS_ADMIN, evaluarSolicitudAdmin } from "../lib/admin/politica.js";
import { crearServicioDatosAdmin } from "../lib/admin/servicio.js";
import { MOTIVOS_ADMIN } from "../lib/admin/reglas.js";
import {
  actualizarConsentimiento,
  actualizarContacto,
  buscarContactoRegistrado,
  eliminarContacto,
  exportarContactos,
  leerContacto,
  listarContactos,
  registrarContacto,
  resumenContactos,
} from "../lib/contactos/datos.js";

const URL_BASE = "https://proyecto-falso.supabase.test";
const CLAVE = "clave-de-servicio-falsa-para-tests";
const ID_ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_CONTACTO = "11111111-1111-4111-8111-111111111111";
const ID_OTRO_CONTACTO = "22222222-2222-4222-8222-222222222222";
const ENV = { NEXT_PUBLIC_SUPABASE_URL: URL_BASE, SUPABASE_SERVICE_ROLE_KEY: CLAVE };

function usuarioAdmin() {
  return { id: ID_ADMIN, email: "admin@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false };
}

function intentar(tarea) {
  try {
    return tarea();
  } catch {
    return null;
  }
}

async function montar({ modulo = "expo", env = ENV, ahora } = {}) {
  const nucleo = crearNucleoAdmin({
    leerUsuario: async () => usuarioAdmin(),
    env: { ADMIN_IDS: ID_ADMIN },
    advertir: () => {},
    ...(ahora ? { ahora } : {}),
  });
  const { credencial } = await nucleo.obtenerAdmin(modulo);
  const salida = [];
  const avisos = [];
  const creaciones = [];
  const crear = crearServicioDatosAdmin({
    verificar: nucleo.verificar,
    env,
    fetchBase: async (entrada, inicio) => {
      salida.push({
        url: new URL(typeof entrada === "string" ? entrada : entrada.url),
        metodo: String(inicio?.method ?? "GET"),
        autorizacion: new Headers(inicio?.headers).get("authorization"),
      });
      return new Response("[]", { status: 200, headers: { "content-type": "application/json", "content-range": "0-0/0" } });
    },
    crearSupabase: (...argumentos) => {
      creaciones.push(argumentos);
      return null;
    },
    advertir: (mensaje) => avisos.push(mensaje),
  });
  // Cliente real de supabase-js: se vuelve a crear con la fábrica real para ejercitar el transporte.
  const real = crearServicioDatosAdmin({
    verificar: nucleo.verificar,
    env,
    fetchBase: async (entrada, inicio) => {
      salida.push({
        url: new URL(typeof entrada === "string" ? entrada : entrada.url),
        metodo: String(inicio?.method ?? "GET"),
        autorizacion: new Headers(inicio?.headers).get("authorization"),
      });
      return new Response("[]", { status: 200, headers: { "content-type": "application/json", "content-range": "0-0/0" } });
    },
    advertir: (mensaje) => avisos.push(mensaje),
  });
  return { nucleo, credencial, salida, avisos, creaciones, crearSimulado: crear, cliente: intentar(() => real(credencial, modulo)), crear: real };
}

/** Espera un constructor PostgREST y comprueba que el transporte lo bloqueó sin enviar nada. */
async function esperarBloqueo(contexto, constructor, motivo) {
  const antes = contexto.salida.length;
  const resultado = await constructor;
  assert.ok(resultado.error, "debe terminar en error");
  assert.match(String(resultado.error.message), new RegExp(`transporte_no_permitido:${motivo}`));
  assert.equal(contexto.salida.length, antes, "no debe haber llegado nada a la red");
  assert.ok(contexto.avisos.at(-1).includes(motivo), `el aviso debe nombrar el motivo ${motivo}: ${contexto.avisos.at(-1)}`);
  assert.equal(contexto.avisos.at(-1).includes(CLAVE), false);
}

async function esperarPermitido(contexto, constructor) {
  const antes = contexto.salida.length;
  const avisosAntes = contexto.avisos.length;
  const resultado = await constructor;
  assert.equal(resultado.error, null, `no debía bloquearse: ${resultado.error?.message}`);
  assert.equal(contexto.salida.length, antes + 1);
  assert.equal(contexto.avisos.length, avisosAntes);
}

// ───────────────────────── Acceso a la fábrica ─────────────────────────

test("cliente restringido: exige una credencial vigente del módulo antes de crear nada", async () => {
  const contexto = await montar();
  const intentos = [
    ["sin credencial", undefined, "expo", MOTIVOS_ADMIN.sinCredencial],
    ["objeto falso", Object.freeze({ id: ID_ADMIN, modulo: "expo" }), "expo", MOTIVOS_ADMIN.sinCredencial],
    ["símbolo global", Object.freeze({ [Symbol.for("enflora.admin.credencial")]: true, modulo: "expo" }), "expo", MOTIVOS_ADMIN.sinCredencial],
    ["módulo no indicado", contexto.credencial, undefined, MOTIVOS_ADMIN.moduloInvalido],
    ["otro módulo", contexto.credencial, "planes", MOTIVOS_ADMIN.moduloIncorrecto],
  ];
  for (const [nombre, credencial, modulo, motivo] of intentos) {
    assert.throws(
      () => contexto.crearSimulado(credencial, modulo),
      (error) => error instanceof ErrorAdminNoAutorizado && error.motivo === motivo,
      nombre,
    );
  }
  assert.equal(contexto.creaciones.length, 0, "nunca se llegó a crear un cliente de Supabase");
});

test("cliente restringido: una credencial vencida no entrega cliente", async () => {
  let ahora = 5_000_000;
  const contexto = await montar({ ahora: () => ahora });
  assert.ok(contexto.crear(contexto.credencial, "expo"));
  ahora += 61_000;
  assert.throws(() => contexto.crear(contexto.credencial, "expo"), (error) => error.motivo === MOTIVOS_ADMIN.credencialExpirada);
});

test("cliente restringido: un módulo sin política de datos no recibe cliente", async () => {
  const contexto = await montar({ modulo: "usuarios" });
  assert.throws(() => contexto.crearSimulado(contexto.credencial, "usuarios"), /modulo_sin_acceso_a_datos/);
  assert.equal(contexto.creaciones.length, 0);
  assert.equal(Object.hasOwn(ACCESO_DATOS_ADMIN, "usuarios"), false);
  assert.equal(Object.hasOwn(ACCESO_DATOS_ADMIN, "__proto__"), false);
});

test("cliente restringido: sin configuración devuelve null y con URL inválida también", async () => {
  const contexto = await montar();
  assert.equal(contexto.crear(contexto.credencial, "expo") !== null, true);
  const sinClave = crearServicioDatosAdmin({ verificar: contexto.nucleo.verificar, env: { NEXT_PUBLIC_SUPABASE_URL: URL_BASE } });
  const sinUrl = crearServicioDatosAdmin({ verificar: contexto.nucleo.verificar, env: { SUPABASE_SERVICE_ROLE_KEY: CLAVE } });
  const urlRota = crearServicioDatosAdmin({ verificar: contexto.nucleo.verificar, env: { ...ENV, NEXT_PUBLIC_SUPABASE_URL: "no es una url" } });
  assert.equal(sinClave(contexto.credencial, "expo"), null);
  assert.equal(sinUrl(contexto.credencial, "expo"), null);
  assert.equal(urlRota(contexto.credencial, "expo"), null);
});

// ───────────────────────── Superficie de la fachada ─────────────────────────

test("fachada: solo expone from y rpc, congelada, sin clave ni propiedades internas", async () => {
  const { cliente } = await montar();
  assert.deepEqual(Object.getOwnPropertyNames(cliente).sort(), ["from", "rpc"]);
  assert.equal(Object.isFrozen(cliente), true);
  for (const interna of ["auth", "storage", "functions", "realtime", "supabaseUrl", "supabaseKey", "rest", "headers", "fetch", "schema"]) {
    assert.equal(interna in cliente, false, interna);
  }
  assert.equal(JSON.stringify(cliente).includes(CLAVE), false);
  assert.equal(String(Object.keys(cliente)).includes(CLAVE), false);
});

test("fachada: rechaza tablas, RPC y nombres especiales fuera de la política", async () => {
  const { cliente } = await montar();
  for (const privada of ["registros", "pagos", "plus_suscripciones", "perfiles", "contactos_origenes", "contactos_consentimientos", "constructor", "__proto__", "toString", "hasOwnProperty", "", 7, null, undefined, ["expo_inventario"], { toString: () => "expo_inventario" }]) {
    assert.throws(() => cliente.from(privada), /tabla_no_permitida/, String(privada));
  }
  for (const rpc of ["crear_registro", "aplicar_resultado_pago", "registrar_partida_expo", "constructor", "__proto__", "", 7, null, undefined, ["registrar_entrega_expo"]]) {
    assert.throws(() => cliente.rpc(rpc), /rpc_no_permitida/, String(rpc));
  }
});

test("política: está congelada en todos los niveles", () => {
  const expo = ACCESO_DATOS_ADMIN.expo;
  assert.throws(() => {
    ACCESO_DATOS_ADMIN.otro = {};
  }, TypeError);
  assert.throws(() => {
    expo.tablas.pagos = {};
  }, TypeError);
  assert.throws(() => expo.rpcs.push("aplicar_resultado_pago"), TypeError);
  assert.throws(() => expo.tablas.contactos_enflora.metodos.push("PUT"), TypeError);
  assert.throws(() => expo.tablas.contactos_enflora.columnas.push("secreto"), TypeError);
  assert.throws(() => expo.tablas.contactos_enflora.embebidos.contactos_origenes.push("secreto"), TypeError);
  assert.throws(() => {
    expo.tablas.expo_inventario.metodos = ["GET", "DELETE"];
  }, TypeError);
});

// ───────────────────────── Elusión 1: mutar builder.url ─────────────────────────

test("elusión: mutar builder.url hacia otra tabla queda bloqueado en el transporte", async () => {
  const contexto = await montar();
  const cambios = [
    ["/rest/v1/registros", "tabla_no_permitida"],
    ["/rest/v1/pagos", "tabla_no_permitida"],
    ["/rest/v1/expo_inventario/../registros", "tabla_no_permitida"],
    ["/rest/v1/expo_inventario/%2e%2e/registros", "tabla_no_permitida"],
    ["/rest/v1/expo_inventario/extra", "tabla_no_permitida"],
    ["/rest/v1/", "tabla_no_permitida"],
    ["/rest/v1", "tabla_no_permitida"],
    ["/auth/v1/user", "tabla_no_permitida"],
    ["/storage/v1/object/fotos", "tabla_no_permitida"],
    ["/functions/v1/cualquiera", "tabla_no_permitida"],
    ["/rest/v1/rpc/aplicar_resultado_pago", "rpc_no_permitida"],
  ];
  for (const [ruta, motivo] of cambios) {
    const constructor = contexto.cliente.from("expo_inventario").select("slug");
    constructor.url.pathname = ruta;
    await esperarBloqueo(contexto, constructor, motivo);
  }
});

test("elusión: mutar host, protocolo, puerto o credenciales de la URL queda bloqueado", async () => {
  const contexto = await montar();
  const cambios = [
    (url) => { url.host = "otro-proyecto.supabase.test"; },
    (url) => { url.protocol = "http:"; },
    (url) => { url.port = "8443"; },
    (url) => { url.username = "usuario"; },
    (url) => { url.href = "https://atacante.test/rest/v1/expo_inventario?select=slug"; },
  ];
  for (const cambio of cambios) {
    const constructor = contexto.cliente.from("expo_inventario").select("slug");
    cambio(constructor.url);
    await esperarBloqueo(contexto, constructor, "destino_no_permitido");
  }
});

// ───────────────────────── Elusión 2: builder.fetch ─────────────────────────

test("elusión: builder.fetch no sirve para consultar otras tablas, hosts ni servicios", async () => {
  const contexto = await montar();
  const constructor = contexto.cliente.from("expo_inventario").select("slug");
  const peticiones = [
    [`${URL_BASE}/rest/v1/pagos?select=*`, undefined, /tabla_no_permitida/],
    [`${URL_BASE}/rest/v1/registros?select=id`, { method: "DELETE" }, /tabla_no_permitida/],
    [`${URL_BASE}/auth/v1/admin/users`, undefined, /tabla_no_permitida/],
    [`https://atacante.test/rest/v1/expo_inventario?select=slug`, undefined, /destino_no_permitido/],
    [`${URL_BASE}/rest/v1/expo_inventario?select=slug`, { method: "DELETE" }, /metodo_no_permitido/],
    [`${URL_BASE}/rest/v1/expo_inventario?select=slug`, { method: "PATCH", body: "{}" }, /metodo_no_permitido/],
    [`${URL_BASE}/rest/v1/expo_inventario?select=*`, undefined, /columna_no_permitida/],
    [new Request(`${URL_BASE}/rest/v1/pagos?select=id`), undefined, /tabla_no_permitida/],
    [new URL(`${URL_BASE}/rest/v1/pagos?select=id`), undefined, /tabla_no_permitida/],
  ];
  for (const [entrada, inicio, esperado] of peticiones) {
    const respuesta = await constructor.fetch(entrada, inicio);
    assert.equal(respuesta.status, 403, "el transporte responde 403 (no reintentable) sin enviar nada");
    assert.match((await respuesta.json()).message, esperado);
  }
  assert.equal(contexto.salida.length, 0);
  assert.equal(contexto.avisos.length, peticiones.length);
});

test("elusión: lo permitido sí sale, con la clave de servicio agregada solo en ese camino", async () => {
  const contexto = await montar();
  await esperarPermitido(contexto, contexto.cliente.from("expo_inventario").select("slug, nombre, stock_total"));
  const enviada = contexto.salida.at(-1);
  assert.equal(enviada.autorizacion, `Bearer ${CLAVE}`);
  assert.equal(enviada.url.pathname, "/rest/v1/expo_inventario");

  const constructor = contexto.cliente.from("expo_inventario").select("slug");
  assert.equal([...constructor.headers.values()].some((valor) => valor.includes(CLAVE)), false, "la clave no está en los headers del constructor");
  assert.equal(JSON.stringify(Object.fromEntries(constructor.headers)).includes(CLAVE), false);
});

// ───────────────────────── Elusión 3: relaciones embebidas ─────────────────────────

test("elusión: relaciones embebidas y selects no declarados quedan bloqueados", async () => {
  const contexto = await montar();
  const contactos = () => contexto.cliente.from("contactos_enflora");
  const bloqueados = [
    [contactos().select("*, contactos_origenes(*)"), "columna_no_permitida"],
    [contactos().select("id, pagos(*)"), "embebido_no_permitido"],
    [contactos().select("id, contactos_origenes(origen, secreto)"), "columna_embebida_no_permitida"],
    [contactos().select("id, contactos_origenes(*)"), "columna_embebida_no_permitida"],
    [contactos().select("id, contactos_origenes(origen, contactos_consentimientos(acepta))"), "embebido_invalido"],
    [contactos().select("id, contactos_origenes!inner(origen)"), "embebido_invalido"],
    [contactos().select("id, x:pagos(id)"), "embebido_no_permitido"],
    [contactos().select("*"), "columna_no_permitida"],
    [contactos().select("id, secreto"), "columna_no_permitida"],
    [contactos().select("id::text"), "columna_no_permitida"],
    [contactos().select("email->>x"), "columna_no_permitida"],
    [contactos().select("alias:email"), "columna_no_permitida"],
    [contexto.cliente.from("expo_inventario").select("slug, contactos_enflora(*)"), "embebido_no_permitido"],
    [contexto.cliente.from("expo_inventario").select("slug, contactos_enflora(email)"), "embebido_no_permitido"],
  ];
  for (const [constructor, motivo] of bloqueados) await esperarBloqueo(contexto, constructor, motivo);
});

test("elusión: filtros y orden sobre relaciones embebidas o columnas no declaradas quedan bloqueados", async () => {
  const contexto = await montar();
  const base = () => contexto.cliente.from("contactos_enflora").select("id, contactos_origenes(origen)");
  await esperarBloqueo(contexto, base().order("origen", { referencedTable: "contactos_origenes" }), "filtro_no_permitido");
  await esperarBloqueo(contexto, base().eq("contactos_origenes.origen", "landing"), "filtro_no_permitido");
  await esperarBloqueo(contexto, base().limit(1, { referencedTable: "contactos_origenes" }), "filtro_no_permitido");
  await esperarBloqueo(contexto, contexto.cliente.from("contactos_enflora").select("id").eq("secreto", "x"), "filtro_no_permitido");
  await esperarBloqueo(contexto, contexto.cliente.from("contactos_enflora").select("id").order("secreto"), "orden_no_permitido");
  await esperarBloqueo(contexto, contexto.cliente.from("contactos_enflora").select("id").or("secreto.eq.x"), "filtro_combinado_no_permitido");
  await esperarBloqueo(contexto, contexto.cliente.from("contactos_enflora").select("id").or("id.eq.x,(email.eq.y)"), "filtro_combinado_invalido");
});

// ───────────────────────── Elusión 4: esquema y cabeceras ─────────────────────────

test("elusión: cambiar de esquema o pedir formatos alternativos queda bloqueado", async () => {
  const contexto = await montar();

  // postgrest-js fija Accept-Profile / Content-Profile al enviar según `builder.schema`.
  const lectura = contexto.cliente.from("expo_inventario").select("slug");
  lectura.schema = "auth";
  await esperarBloqueo(contexto, lectura, "esquema_no_permitido");

  const otro = contexto.cliente.from("expo_inventario").select("slug");
  otro.schema = "storage";
  await esperarBloqueo(contexto, otro, "esquema_no_permitido");

  const escritura = contexto.cliente.from("contactos_enflora").update({ nombre: "x" }).eq("id", ID_CONTACTO);
  escritura.schema = "auth";
  await esperarBloqueo(contexto, escritura, "esquema_no_permitido");

  // Y por la vía directa de builder.fetch con cabeceras propias.
  const directo = await contexto.cliente
    .from("expo_inventario")
    .select("slug")
    .fetch(`${URL_BASE}/rest/v1/expo_inventario?select=slug`, { headers: { "Accept-Profile": "auth" } });
  assert.equal(directo.status, 403);
  assert.match((await directo.json()).message, /esquema_no_permitido/);
  assert.equal(contexto.salida.length, 0);

  await esperarBloqueo(contexto, contexto.cliente.from("expo_inventario").select("slug").csv(), "formato_no_permitido");
  await esperarBloqueo(contexto, contexto.cliente.from("expo_inventario").select("slug").geojson(), "formato_no_permitido");
  await esperarBloqueo(contexto, contexto.cliente.from("expo_inventario").select("slug").explain(), "formato_no_permitido");

  const publico = contexto.cliente.from("expo_inventario").select("slug");
  publico.schema = "public";
  await esperarPermitido(contexto, publico);
  await esperarPermitido(contexto, contexto.cliente.from("contactos_enflora").select("id").eq("id", ID_CONTACTO).single());
});

// ───────────────────────── Elusión 5: métodos HTTP ─────────────────────────

test("elusión: operaciones de escritura no previstas quedan bloqueadas", async () => {
  const contexto = await montar();
  const inventario = () => contexto.cliente.from("expo_inventario");
  const contactos = () => contexto.cliente.from("contactos_enflora");

  await esperarBloqueo(contexto, inventario().delete().eq("slug", "stickers"), "metodo_no_permitido");
  await esperarBloqueo(contexto, inventario().update({ stock_total: 1 }).eq("slug", "stickers"), "metodo_no_permitido");
  await esperarBloqueo(contexto, inventario().insert({ slug: "x" }), "metodo_no_permitido");
  await esperarBloqueo(contexto, inventario().upsert({ slug: "x" }), "metodo_no_permitido");
  await esperarBloqueo(contexto, contactos().insert({ nombre: "x" }), "metodo_no_permitido");
  await esperarBloqueo(contexto, contactos().upsert({ nombre: "x" }), "metodo_no_permitido");
  await esperarBloqueo(contexto, contactos().select("id", { head: true }), "metodo_no_permitido");

  const rpc = contexto.cliente.rpc("resumen_contactos_enflora");
  rpc.method = "DELETE";
  await esperarBloqueo(contexto, rpc, "metodo_no_permitido");
  const aTabla = contexto.cliente.rpc("resumen_contactos_enflora");
  aTabla.url.pathname = "/rest/v1/contactos_enflora";
  await esperarBloqueo(contexto, aTabla, "metodo_no_permitido");
  const aOtraRpc = contexto.cliente.rpc("resumen_contactos_enflora");
  aOtraRpc.url.pathname = "/rest/v1/rpc/aplicar_resultado_pago";
  await esperarBloqueo(contexto, aOtraRpc, "rpc_no_permitida");
});

test("elusión: borrados y cambios masivos o de columnas no previstas quedan bloqueados", async () => {
  const contexto = await montar();
  const contactos = () => contexto.cliente.from("contactos_enflora");

  await esperarBloqueo(contexto, contactos().delete(), "escritura_sin_id");
  await esperarBloqueo(contexto, contactos().delete().eq("nombre", "x"), "escritura_sin_id");
  await esperarBloqueo(contexto, contactos().delete().neq("id", ID_CONTACTO), "escritura_sin_id");
  await esperarBloqueo(contexto, contactos().delete().in("id", [ID_CONTACTO, ID_OTRO_CONTACTO]), "escritura_sin_id");
  await esperarBloqueo(contexto, contactos().delete().eq("id", "no-es-uuid"), "escritura_sin_id");
  await esperarBloqueo(contexto, contactos().delete().eq("id", ID_CONTACTO).eq("id", ID_OTRO_CONTACTO), "escritura_sin_id");
  await esperarBloqueo(contexto, contactos().delete().or("id.eq.x"), "escritura_sin_id");
  await esperarBloqueo(contexto, contactos().update({ nombre: "x" }), "escritura_sin_id");
  await esperarBloqueo(contexto, contactos().update({ nombre: "x" }).neq("id", ID_CONTACTO), "escritura_sin_id");
  await esperarBloqueo(contexto, contactos().update({ consentimiento_marketing: true }).eq("id", ID_CONTACTO), "columna_escritura_no_permitida");
  await esperarBloqueo(contexto, contactos().update({ nombre: "x", id: ID_OTRO_CONTACTO }).eq("id", ID_CONTACTO), "columna_escritura_no_permitida");
  await esperarBloqueo(contexto, contactos().update({ created_at: "2020-01-01" }).eq("id", ID_CONTACTO), "columna_escritura_no_permitida");
  await esperarBloqueo(contexto, contactos().update({}).eq("id", ID_CONTACTO), "columna_escritura_no_permitida");

  await esperarPermitido(contexto, contactos().update({ nombre: "A", email: "a@example.com", telefono: null }).eq("id", ID_CONTACTO).select("id").maybeSingle());
  await esperarPermitido(contexto, contactos().delete().eq("id", ID_CONTACTO).select("id"));
});

// ───────────────────────── Parámetros de consulta ─────────────────────────

test("transporte: parámetros repetidos, desmedidos o inesperados quedan bloqueados", async () => {
  const contexto = await montar();
  const lectura = () => contexto.cliente.from("expo_inventario").select("slug");

  const repetido = lectura();
  repetido.url.searchParams.append("select", "nombre");
  await esperarBloqueo(contexto, repetido, "parametro_repetido");

  const sinSelect = lectura();
  sinSelect.url.searchParams.delete("select");
  await esperarBloqueo(contexto, sinSelect, "select_obligatorio");

  const limite = lectura();
  limite.url.searchParams.set("limit", "abc");
  await esperarBloqueo(contexto, limite, "paginacion_invalida");

  const desplazamiento = lectura();
  desplazamiento.url.searchParams.set("offset", "-1");
  await esperarBloqueo(contexto, desplazamiento, "paginacion_invalida");

  const operador = lectura();
  operador.url.searchParams.set("slug", "fts.algo");
  await esperarBloqueo(contexto, operador, "operador_no_permitido");

  await esperarBloqueo(contexto, lectura().eq("slug", "x".repeat(600)), "parametro_demasiado_largo");
  await esperarBloqueo(contexto, lectura().eq("secreto", "x"), "filtro_no_permitido");

  const cuerpoEnLectura = await contexto.cliente.from("expo_inventario").select("slug").then(() => null);
  assert.equal(cuerpoEnLectura, null);
});

test("transporte: política pura — destino, prefijo y cuerpo", () => {
  const politica = ACCESO_DATOS_ADMIN.expo;
  const origen = "https://proyecto.supabase.test";
  const evaluar = (url, extra = {}, destino = { origen }) =>
    evaluarSolicitudAdmin(politica, { metodo: "GET", url, cabeceras: new Headers(), cuerpo: undefined, ...extra }, destino);

  assert.equal(evaluar(`${origen}/rest/v1/expo_inventario?select=slug`).ok, true);
  assert.equal(evaluar(`${origen}/rest/v1/expo_inventario?select=slug`, {}, { origen: "https://otro.test" }).motivo, "destino_no_permitido");
  assert.equal(evaluar("no es una url").motivo, "url_invalida");
  assert.equal(evaluar(`https://usuario:clave@proyecto.supabase.test/rest/v1/expo_inventario?select=slug`).motivo, "destino_no_permitido");

  const conPrefijo = { origen, prefijo: "/supabase" };
  assert.equal(evaluar(`${origen}/supabase/rest/v1/expo_inventario?select=slug`, {}, conPrefijo).ok, true);
  assert.equal(evaluar(`${origen}/rest/v1/expo_inventario?select=slug`, {}, conPrefijo).motivo, "ruta_no_permitida");

  assert.equal(evaluar(`${origen}/rest/v1/expo_inventario?select=slug`, { cuerpo: "{}" }).motivo, "cuerpo_invalido");
  assert.equal(evaluar(`${origen}/rest/v1/rpc/resumen_contactos_enflora`, { metodo: "POST", cuerpo: undefined }).motivo, "cuerpo_invalido");
  assert.equal(evaluar(`${origen}/rest/v1/rpc/resumen_contactos_enflora`, { metodo: "POST", cuerpo: "{}" }).ok, true);
  assert.equal(evaluar(`${origen}/rest/v1/rpc/resumen_contactos_enflora`, { metodo: "POST", cuerpo: "x".repeat(30_000) }).motivo, "cuerpo_invalido");
});

// ───────────────────────── Compatibilidad con las consultas reales ─────────────────────────

test("compatibilidad: todas las consultas reales de contactos de lib/contactos/datos.js pasan la política", async () => {
  const contexto = await montar();
  const db = contexto.cliente;
  const avisosAntes = contexto.avisos.length;

  await listarContactos(db, {});
  for (const filtro of ["landing", "ruleta_420", "manual", "registro", "con-consentimiento", "sin-consentimiento"]) {
    await listarContactos(db, { filtro, orden: "nombre", pagina: 3 });
  }
  await listarContactos(db, { busqueda: "Ana 11-2233 4455", orden: "antiguos" });
  await exportarContactos(db, { filtro: "landing", busqueda: "ana" });
  await exportarContactos(db, {});
  await leerContacto(db, ID_CONTACTO);
  await actualizarContacto(db, ID_CONTACTO, { nombre: "A", email: "a@example.com", telefono: "1122334455" });
  await eliminarContacto(db, ID_CONTACTO);
  await buscarContactoRegistrado(db, { email: "a@example.com", telefono: "1122334455" });
  await registrarContacto(db, { nombre: "A", email: "a@example.com", telefono: null, origen: "manual", detalle: "admin", consentimiento: false });
  await actualizarConsentimiento(db, ID_CONTACTO, false);
  await resumenContactos(db);

  assert.equal(contexto.avisos.length, avisosAntes, `ninguna consulta real debe bloquearse: ${contexto.avisos.slice(avisosAntes).join(" | ")}`);
  assert.ok(contexto.salida.length >= 15, "las consultas realmente salieron");
  for (const enviada of contexto.salida) {
    assert.equal(enviada.autorizacion, `Bearer ${CLAVE}`);
    assert.equal(enviada.url.origin, URL_BASE);
  }
  const rutas = new Set(contexto.salida.map((enviada) => enviada.url.pathname));
  assert.deepEqual([...rutas].sort(), [
    "/rest/v1/contactos_enflora",
    "/rest/v1/rpc/actualizar_consentimiento_contacto",
    "/rest/v1/rpc/registrar_contacto_enflora",
    "/rest/v1/rpc/resumen_contactos_enflora",
  ]);
});

test("compatibilidad: solicitudes concurrentes permitidas y bloqueadas no se mezclan", async () => {
  const contexto = await montar();
  const tareas = [];
  for (let indice = 0; indice < 10; indice += 1) {
    tareas.push(contexto.cliente.from("expo_inventario").select("slug"));
    const mala = contexto.cliente.from("expo_inventario").select("slug");
    mala.url.pathname = "/rest/v1/registros";
    tareas.push(mala);
  }
  const resultados = await Promise.all(tareas);
  assert.equal(resultados.filter((resultado) => resultado.error === null).length, 10);
  assert.equal(resultados.filter((resultado) => resultado.error !== null).length, 10);
  assert.equal(contexto.salida.length, 10);
  assert.equal(contexto.salida.every((enviada) => enviada.url.pathname === "/rest/v1/expo_inventario"), true);
  assert.equal(contexto.avisos.length, 10);
});
