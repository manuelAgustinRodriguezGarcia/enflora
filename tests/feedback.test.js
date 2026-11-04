import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { enviarFeedback } from "../app/perfil/feedback/acciones.js";
import { enviarFeedbackUsuario } from "../lib/feedback/envio.js";
import {
  LIMITE_ENVIOS_FEEDBACK,
  LIMITE_MENSAJE_FEEDBACK,
  MINIMO_MENSAJE_FEEDBACK,
  VENTANA_DUPLICADO_MS,
  VENTANA_FEEDBACK_MS,
  aceptarEnvio,
  crearCupoSerializable,
  evaluarCupoFeedback,
  validarEnvioFeedback,
} from "../lib/feedback/reglas.js";
import { afirmarSqlAdministrativo, cuerpoSql } from "./ayudas/sintaxis-sql-admin.js";
import { conSupabaseFalso } from "./ayudas/supabase-falso.js";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MENSAJE = "Quiero mejorar el calendario de la aplicación.";
const SESION = { id: ID };

function formulario(extra = {}) {
  const datos = new FormData();
  datos.set("categoria", "sugerencia");
  datos.set("mensaje", MENSAJE);
  for (const [clave, valor] of Object.entries(extra)) datos.set(clave, valor);
  return datos;
}

function json(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });
}

test("la migración deja el alta en una función y no abre la tabla", () => {
  const archivo = "supabase/feedback-usuarios.sql";
  const texto = fs.readFileSync(path.join(RAIZ, archivo), "utf8");
  afirmarSqlAdministrativo(texto, archivo);
  const cuerpo = cuerpoSql(texto);
  assert.equal(LIMITE_ENVIOS_FEEDBACK, 5);
  assert.equal(VENTANA_FEEDBACK_MS, 24 * 60 * 60 * 1000);
  assert.equal(VENTANA_DUPLICADO_MS, 30 * 1000);
  assert.match(cuerpo, /v_cantidad >= 5/);
  assert.match(cuerpo, /interval '24 hours'/);
  assert.match(cuerpo, /interval '30 seconds'/);
  assert.match(cuerpo, /pg_advisory_xact_lock/);
  assert.match(cuerpo, /enable row level security/);
  assert.match(cuerpo, /revoke all on table public\.feedback_usuarios from public, anon, authenticated, service_role/);
  assert.equal(/create policy/i.test(cuerpo), false);
  assert.match(cuerpo, /grant execute on function public\.enviar_feedback_usuario\(text, text\) to authenticated/);
  assert.deepEqual(cuerpo.match(/to authenticated/g), ["to authenticated"]);
  assert.match(cuerpo, /new\.estado := 'nuevo'/);
  assert.match(cuerpo, /new\.prioridad := 'normal'/);
  assert.match(cuerpo, /new\.nota_admin := null/);
  assert.match(cuerpo, /new\.usuario_id := auth\.uid\(\)/);
  assert.match(cuerpo, /feedback_usuarios_creado_en_idx/);
  assert.match(cuerpo, /feedback_usuarios_usuario_id_idx/);
  assert.match(cuerpo, /feedback_usuarios_categoria_idx/);
  assert.match(cuerpo, /feedback_usuarios_estado_idx/);
  assert.match(cuerpo, /feedback_usuarios_marcar_actualizacion/);
  for (const palabra of ["apellido", "telefono", "planta", "espacio", "genetica", "fotografia", "conversacion"]) {
    assert.equal(cuerpo.includes(palabra), false, palabra);
  }
  const alta = cuerpo.split("function public.enviar_feedback_usuario")[1].split("function public.listar_feedback_admin")[0];
  assert.match(alta, /p_categoria text, p_mensaje text/);
  assert.equal(/usuario_id|p_estado|p_prioridad|nota_admin/.test(alta.split("begin")[0]), false);
});

test("valida categoría y largo, y no conserva campos administrativos", () => {
  assert.equal(validarEnvioFeedback({ categoria: "sugerencia", mensaje: MENSAJE }).ok, true);
  assert.equal(validarEnvioFeedback({ categoria: "error_app", mensaje: "a".repeat(MINIMO_MENSAJE_FEEDBACK) }).ok, true);
  assert.equal(validarEnvioFeedback({ categoria: "opinion", mensaje: "a".repeat(LIMITE_MENSAJE_FEEDBACK) }).ok, true);
  assert.equal(validarEnvioFeedback({ categoria: "otro", mensaje: `  ${MENSAJE}  ` }).mensaje, MENSAJE);
  assert.equal(validarEnvioFeedback({ categoria: "cultivo", mensaje: MENSAJE }).codigo, "categoria_invalida");
  assert.equal(validarEnvioFeedback({ categoria: "sugerencia", mensaje: "a".repeat(9) }).codigo, "mensaje_invalido");
  assert.equal(validarEnvioFeedback({ categoria: "sugerencia", mensaje: "a".repeat(2001) }).codigo, "mensaje_invalido");
  assert.equal(validarEnvioFeedback({ categoria: "sugerencia", mensaje: "   corto   " }).codigo, "mensaje_invalido");
  assert.match(validarEnvioFeedback({ categoria: "sugerencia", mensaje: `${MENSAJE}\u0000` }).error, /caracteres/);
  const validado = validarEnvioFeedback({
    categoria: "sugerencia",
    mensaje: MENSAJE,
    usuario_id: ID,
    estado: "implementado",
    prioridad: "alta",
    nota_admin: "interna",
  });
  assert.deepEqual(Object.keys(validado).sort(), ["categoria", "mensaje", "ok"]);
});

test("sin sesión o anónimo no envía, y un fallo de guardado no es éxito", async () => {
  const entrada = {
    categoria: "sugerencia",
    mensaje: MENSAJE,
    usuario_id: ID,
    estado: "descartado",
    prioridad: "alta",
    nota_admin: "secreta",
  };
  const sinSesion = await enviarFeedbackUsuario({ sesion: null, entrada, persistir: () => { throw new Error("no"); } });
  assert.equal(sinSesion.ok, false);
  assert.equal(sinSesion.codigo, "sin_sesion");
  assert.equal(sinSesion.mensaje, MENSAJE);
  assert.equal(Object.hasOwn(sinSesion, "usuario_id"), false);

  let llamadas = 0;
  const anonimo = await enviarFeedbackUsuario({
    sesion: { id: ID, esAnonimo: true },
    entrada,
    persistir: () => {
      llamadas += 1;
      return { data: { ok: true } };
    },
  });
  assert.equal(anonimo.codigo, "anonimo");
  assert.equal(llamadas, 0);

  const recibidos = [];
  const guardado = await enviarFeedbackUsuario({
    sesion: SESION,
    entrada,
    persistir: async (datos) => {
      recibidos.push(datos);
      return { data: null, error: { code: "XX000", message: "persona@example.com fallo" } };
    },
  });
  assert.equal(guardado.ok, false);
  assert.equal(guardado.mensaje, MENSAJE);
  assert.equal(String(guardado.error).includes("persona@"), false);
  assert.deepEqual(recibidos, [{ categoria: "sugerencia", mensaje: MENSAJE }]);

  const filtrado = await enviarFeedbackUsuario({
    sesion: SESION,
    entrada,
    persistir: async () => ({ data: { ok: true, nota_admin: "secreta", estado: "implementado" } }),
  });
  assert.equal(filtrado.ok, false);
  assert.equal(filtrado.mensaje, MENSAJE);

  const exito = await enviarFeedbackUsuario({
    sesion: SESION,
    entrada,
    persistir: async () => ({ data: { ok: true } }),
  });
  assert.deepEqual(exito, { ok: true });
});

test("el cupo admite cinco envíos y ordena la concurrencia", async () => {
  const ahora = Date.parse("2026-11-04T18:00:00.000Z");
  const marcas = [1, 2, 3, 4].map((hora) => ({ en: ahora - hora * 1000, clave: `k${hora}` }));
  assert.equal(evaluarCupoFeedback(marcas, ahora, "nueva").permitido, true);
  marcas.push({ en: ahora, clave: "quinta" });
  assert.equal(evaluarCupoFeedback(marcas, ahora, "sexta").codigo, "limite");
  assert.equal(evaluarCupoFeedback([{ en: ahora - VENTANA_FEEDBACK_MS - 1, clave: "vieja" }], ahora, "nueva").permitido, true);
  assert.equal(evaluarCupoFeedback([{ en: ahora - 1000, clave: "igual" }], ahora, "igual").codigo, "duplicado");

  const cupo = crearCupoSerializable();
  const simultaneos = await Promise.all(
    Array.from({ length: 8 }, (_, indice) => cupo.intentar(ahora, `sugerencia\nMensaje distinto número ${indice}.`)),
  );
  assert.equal(simultaneos.filter((item) => item.permitido).length, 5);
  assert.equal(simultaneos.filter((item) => item.codigo === "limite").length, 3);

  const repetido = crearCupoSerializable();
  const clave = `sugerencia\n${MENSAJE}`;
  const par = await Promise.all([repetido.intentar(ahora, clave), repetido.intentar(ahora, clave)]);
  assert.equal(par.filter((item) => item.permitido).length, 1);
  assert.equal(par.some((item) => item.codigo === "duplicado"), true);
  assert.equal(aceptarEnvio({ pendiente: true, enCurso: false }), false);
  assert.equal(aceptarEnvio({ pendiente: false, enCurso: true }), false);
  assert.equal(aceptarEnvio({ pendiente: false, enCurso: false }), true);
});

test("la acción real no manda identidad ni campos administrativos", async () => {
  const fuente = fs.readFileSync(path.join(RAIZ, "app/perfil/feedback/acciones.js"), "utf8");
  assert.match(fuente, /obtenerUsuario\(\)/);
  assert.match(fuente, /redirect\("\/ingreso"\)/);
  assert.match(fuente, /enviar_feedback_usuario/);
  assert.doesNotMatch(fuente, /usuario_id|nota_admin|prioridad|estado/);
  const formularioFuente = fs.readFileSync(path.join(RAIZ, "componentes/feedback/formulario-feedback.js"), "utf8");
  assert.match(formularioFuente, /Enviar feedback/);
  assert.match(formularioFuente, /Ayudanos a mejorar Enflora\./);
  assert.match(formularioFuente, /¡Gracias por ayudarnos a mejorar Enflora! Leemos cada sugerencia\./);
  assert.doesNotMatch(formularioFuente, /dangerouslySetInnerHTML/);
  const perfil = fs.readFileSync(path.join(RAIZ, "componentes/perfil-vista.js"), "utf8");
  assert.match(perfil, /href="\/perfil\/feedback"/);
  assert.match(perfil, /Enviar feedback/);
  const cultivo = fs.readFileSync(path.join(RAIZ, "componentes/formulario-registro-cultivo.js"), "utf8");
  assert.match(cultivo, /problema/);

  await conSupabaseFalso({ usuario: null }, async (entorno) => {
    await assert.rejects(() => enviarFeedback(null, formulario()), (error) => {
      const texto = `${error?.digest || ""} ${error?.message || ""}`;
      return /NEXT_REDIRECT|ingreso/.test(texto);
    });
    assert.equal(entorno.rest.length, 0);
  });

  await conSupabaseFalso(
    {
      usuario: { id: ID, email: "persona@example.com", is_anonymous: true },
    },
    async (entorno) => {
      const resultado = await enviarFeedback(null, formulario());
      assert.equal(resultado.ok, false);
      assert.equal(resultado.codigo, "anonimo");
      assert.equal(resultado.mensaje, MENSAJE);
      assert.equal(entorno.rest.length, 0);
    },
  );

  await conSupabaseFalso(
    {
      usuario: { id: ID, email: "persona@example.com", is_anonymous: false },
      rest: ({ url, cuerpo, metodo }) => {
        assert.equal(metodo, "POST");
        assert.equal(url.pathname, "/rest/v1/rpc/enviar_feedback_usuario");
        assert.deepEqual(JSON.parse(cuerpo), { p_categoria: "sugerencia", p_mensaje: MENSAJE });
        return json({ ok: true });
      },
    },
    async (entorno) => {
      const resultado = await enviarFeedback(
        null,
        formulario({
          usuario_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          estado: "implementado",
          prioridad: "alta",
          nota_admin: "no debe viajar",
        }),
      );
      assert.deepEqual(resultado, { ok: true });
      assert.equal(entorno.rest.length, 1);
      assert.notEqual(entorno.rest[0].apikey, process.env.SUPABASE_SERVICE_ROLE_KEY);
      assert.equal(String(entorno.rest[0].cuerpo).includes("nota_admin"), false);
      assert.equal(String(entorno.rest[0].cuerpo).includes(ID), false);
    },
  );

  await conSupabaseFalso(
    {
      usuario: { id: ID, email: "persona@example.com", is_anonymous: false },
      rest: () => json({ message: "relation missing persona@example.com" }, 500),
    },
    async () => {
      const resultado = await enviarFeedback(null, formulario());
      assert.equal(resultado.ok, false);
      assert.equal(resultado.mensaje, MENSAJE);
      assert.equal(String(resultado.error).includes("persona@"), false);
      assert.match(resultado.error, /sigue acá/);
    },
  );
});

test("dos altas simultáneas del mismo texto dejan una sola", async () => {
  const cupo = crearCupoSerializable();
  const ahora = Date.parse("2026-11-04T18:00:00.000Z");
  await conSupabaseFalso(
    {
      usuario: { id: ID, email: "persona@example.com", is_anonymous: false },
      rest: async () => {
        const decision = await cupo.intentar(ahora, `sugerencia\n${MENSAJE}`);
        if (!decision.permitido) return json({ ok: false, codigo: decision.codigo });
        return json({ ok: true });
      },
    },
    async () => {
      const [primero, segundo] = await Promise.all([
        enviarFeedback(null, formulario()),
        enviarFeedback(null, formulario()),
      ]);
      const exitos = [primero, segundo].filter((item) => item.ok);
      assert.equal(exitos.length, 1);
      assert.equal([primero, segundo].some((item) => item.codigo === "duplicado"), true);
      assert.equal([primero, segundo].every((item) => item.ok || item.mensaje === MENSAJE), true);
    },
  );
});
