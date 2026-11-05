import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const RAIZ = path.resolve(import.meta.dirname, "..");
const USUARIO = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";
const MENSAJE = "Quiero mejorar el calendario de la aplicación.";
const NOTA = "Revisar este comentario en el próximo corte.";

function leer(nombre) {
  return fs.readFileSync(path.join(RAIZ, "supabase", nombre), "utf8");
}

function json(valor) {
  return typeof valor === "string" ? JSON.parse(valor) : valor;
}

function esPermiso(error) {
  return error?.code === "42501" || /permission denied/i.test(String(error?.message || ""));
}

async function preparar(PGlite) {
  const db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key,
      email text
    );
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create or replace function auth.jwt()
    returns jsonb
    language sql
    stable
    as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
    $$;
    create table if not exists public.perfiles (
      id uuid primary key,
      nombre text,
      nombre_usuario text
    );
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator nologin; end if;
    end
    $$;
    grant anon, authenticated, service_role, authenticator to current_user;
    grant usage on schema public to anon, authenticated, service_role;
  `);
  await db.exec(leer("feedback-usuarios.sql"));
  return db;
}

async function identificar(db, id, anonimo = false) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ is_anonymous: anonimo ? "true" : "false" }),
  ]);
}

async function como(db, rol, sql, params = []) {
  await db.exec(`set role ${rol}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

async function alta(db, id, categoria, mensaje) {
  await identificar(db, id);
  const resultado = await como(db, "authenticated", "select public.enviar_feedback_usuario($1, $2) as dato", [
    categoria,
    mensaje,
  ]);
  return json(resultado.rows[0].dato);
}

test("PostgreSQL ejecuta el alta, el cupo y la gestión sin la comprobación que aborta", async (t) => {
  let PGlite;
  try {
    ({ PGlite } = await import("@electric-sql/pglite"));
  } catch {
    t.skip("No hay PostgreSQL embebido ni una base de desarrollo local.");
    return;
  }

  const db = await preparar(PGlite);
  try {
    await assert.rejects(
      () => db.query("select pg_catalog.strpos($1, pg_catalog.chr(0))", ["mensaje valido"]),
      (error) => error?.code === "54000" || /null character/i.test(String(error?.message || "")),
    );

    await db.query("insert into auth.users (id, email) values ($1, $2), ($3, $4), ($5, $6)", [
      USUARIO,
      "ana.perez@example.com",
      OTRO,
      "otro.usuario@example.com",
      ADMIN,
      "admin@example.com",
    ]);
    await db.query("insert into public.perfiles (id, nombre, nombre_usuario) values ($1, $2, $3), ($4, $5, $6)", [
      USUARIO,
      "Ana",
      "ana",
      OTRO,
      "Otro",
      "otro",
    ]);

    const primero = await alta(db, USUARIO, "sugerencia", MENSAJE);
    assert.deepEqual(primero, { ok: true });
    const guardado = await db.query(
      "select categoria, mensaje, estado, prioridad, nota_admin, revisado_por from public.feedback_usuarios where usuario_id = $1",
      [USUARIO],
    );
    assert.equal(guardado.rows.length, 1);
    assert.equal(guardado.rows[0].categoria, "sugerencia");
    assert.equal(guardado.rows[0].mensaje, MENSAJE);
    assert.equal(guardado.rows[0].estado, "nuevo");
    assert.equal(guardado.rows[0].prioridad, "normal");
    assert.equal(guardado.rows[0].nota_admin, null);
    assert.equal(guardado.rows[0].revisado_por, null);

    assert.deepEqual(await alta(db, USUARIO, "sugerencia", MENSAJE), { ok: false, codigo: "duplicado" });
    assert.equal(
      (await db.query("select count(*)::int as total from public.feedback_usuarios where usuario_id = $1", [USUARIO])).rows[0].total,
      1,
    );
    assert.deepEqual(await alta(db, USUARIO, "opinion", "123456789"), { ok: false, codigo: "mensaje_invalido" });
    assert.deepEqual(await alta(db, USUARIO, "cultivo", MENSAJE), { ok: false, codigo: "categoria_invalida" });

    await identificar(db, USUARIO, true);
    const anonimo = await como(db, "authenticated", "select public.enviar_feedback_usuario($1, $2) as dato", [
      "sugerencia",
      "Otro comentario de una cuenta anónima.",
    ]);
    assert.deepEqual(json(anonimo.rows[0].dato), { ok: false, codigo: "anonimo" });

    for (let indice = 0; indice < 4; indice += 1) {
      const extra = await alta(db, USUARIO, "error_app", `Falla distinta número ${indice} en la aplicación.`);
      assert.equal(extra.ok, true);
    }
    assert.deepEqual(
      await alta(db, USUARIO, "otro", "Este sexto envío tiene que quedar fuera del cupo."),
      { ok: false, codigo: "limite" },
    );
    assert.equal(
      (await db.query("select count(*)::int as total from public.feedback_usuarios where usuario_id = $1", [USUARIO])).rows[0].total,
      5,
    );

    await assert.rejects(
      () => como(db, "anon", "select public.enviar_feedback_usuario($1, $2)", ["sugerencia", MENSAJE]),
      esPermiso,
    );
    await assert.rejects(
      () => como(db, "authenticated", "select mensaje from public.feedback_usuarios"),
      esPermiso,
    );
    await assert.rejects(
      () => como(db, "authenticated", "select public.listar_feedback_admin($1::uuid, 'todos', 'todos', 'todos', 20, 0)", [ADMIN]),
      esPermiso,
    );
    await assert.rejects(
      () => como(db, "service_role", "select mensaje from public.feedback_usuarios"),
      esPermiso,
    );

    const ajeno = await alta(db, OTRO, "opinion", "Comentario propio de la segunda cuenta.");
    assert.deepEqual(ajeno, { ok: true });
    assert.deepEqual(Object.keys(ajeno), ["ok"]);

    const listado = await como(
      db,
      "service_role",
      "select public.listar_feedback_admin($1::uuid, 'todos', 'todos', 'todos', 20, 0) as dato",
      [ADMIN],
    );
    const lista = json(listado.rows[0].dato);
    assert.equal(lista.ok, true);
    assert.equal(lista.total, 6);
    const serializado = JSON.stringify(lista);
    assert.equal(serializado.includes("usuario_id"), false);
    assert.equal(serializado.includes("ana.perez@example.com"), false);
    assert.equal(serializado.includes("a***@example.com"), true);
    assert.equal(lista.filas.some((fila) => fila.mensaje), false);

    const id = (
      await db.query("select id from public.feedback_usuarios where usuario_id = $1 and categoria = 'sugerencia'", [USUARIO])
    ).rows[0].id;
    const detalle = await como(db, "service_role", "select public.detalle_feedback_admin($1::uuid, $2::uuid) as dato", [ADMIN, id]);
    const ficha = json(detalle.rows[0].dato);
    assert.equal(ficha.ok, true);
    assert.equal(ficha.feedback.mensaje, MENSAJE);
    assert.equal(ficha.feedback.correo, "a***@example.com");
    assert.equal(JSON.stringify(ficha).includes("usuario_id"), false);
    assert.equal(JSON.stringify(ficha).includes("ana.perez@"), false);

    const gestion = await como(
      db,
      "service_role",
      "select public.gestionar_feedback_admin($1::uuid, $2::uuid, $3, $4, $5) as dato",
      [ADMIN, id, "en_revision", "alta", NOTA],
    );
    assert.deepEqual(json(gestion.rows[0].dato), { ok: true, cambio: true });
    const repetida = await como(
      db,
      "service_role",
      "select public.gestionar_feedback_admin($1::uuid, $2::uuid, $3, $4, $5) as dato",
      [ADMIN, id, "en_revision", "alta", NOTA],
    );
    assert.deepEqual(json(repetida.rows[0].dato), { ok: true, cambio: false });
    const actualizado = (
      await db.query("select estado, prioridad, nota_admin, revisado_por from public.feedback_usuarios where id = $1", [id])
    ).rows[0];
    assert.equal(actualizado.estado, "en_revision");
    assert.equal(actualizado.prioridad, "alta");
    assert.equal(actualizado.nota_admin, NOTA);
    assert.equal(actualizado.revisado_por, ADMIN);
    const auditoria = await db.query(
      "select accion from public.admin_auditoria_feedback where feedback_id = $1 or administrador_id = $2 order by registrado_en",
      [id, ADMIN],
    );
    assert.deepEqual(
      auditoria.rows.map((fila) => fila.accion),
      ["listado", "detalle", "gestion"],
    );
    await assert.rejects(
      () =>
        como(db, "authenticated", "select public.gestionar_feedback_admin($1::uuid, $2::uuid, 'descartado', 'baja', '')", [
          OTRO,
          id,
        ]),
      esPermiso,
    );

    const antes = (
      await db.query("select count(*)::int as total from public.feedback_usuarios")
    ).rows[0].total;
    await db.exec(`
      create or replace function public.enviar_feedback_usuario(p_categoria text, p_mensaje text)
      returns jsonb
      language plpgsql
      security definer
      set search_path = ''
      as $$
      begin
        if pg_catalog.strpos(coalesce(p_mensaje, ''), pg_catalog.chr(0)) > 0 then
          return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'mensaje_invalido');
        end if;
        return pg_catalog.jsonb_build_object('ok', true);
      end;
      $$;
    `);
    await assert.rejects(() => alta(db, OTRO, "otro", "Mensaje posterior al cuerpo roto."), (error) => error?.code === "54000");
    assert.equal((await db.query("select count(*)::int as total from public.feedback_usuarios")).rows[0].total, antes);

    await db.exec(leer("feedback-usuarios-fix.sql"));
    const privilegios = await db.query(`
      select
        has_function_privilege('authenticated', 'public.enviar_feedback_usuario(text, text)', 'execute') as alta_usuario,
        has_function_privilege('anon', 'public.enviar_feedback_usuario(text, text)', 'execute') as alta_anon,
        has_function_privilege('service_role', 'public.enviar_feedback_usuario(text, text)', 'execute') as alta_servicio,
        has_function_privilege('service_role', 'public.gestionar_feedback_admin(uuid, uuid, text, text, text)', 'execute') as gestion_servicio,
        has_function_privilege('authenticated', 'public.gestionar_feedback_admin(uuid, uuid, text, text, text)', 'execute') as gestion_usuario
    `);
    assert.deepEqual(privilegios.rows[0], {
      alta_usuario: true,
      alta_anon: false,
      alta_servicio: false,
      gestion_servicio: true,
      gestion_usuario: false,
    });
    assert.deepEqual(await alta(db, OTRO, "otro", "Mensaje posterior a la corrección incremental."), { ok: true });
    assert.equal((await db.query("select count(*)::int as total from public.feedback_usuarios")).rows[0].total, antes + 1);
    assert.equal(
      (
        await db.query("select estado, nota_admin from public.feedback_usuarios where id = $1", [id])
      ).rows[0].nota_admin,
      NOTA,
    );
    const fuente = await db.query(
      "select position('chr' || '(0)' in prosrc) as pos from pg_proc where proname in ('enviar_feedback_usuario', 'gestionar_feedback_admin')",
    );
    assert.deepEqual(fuente.rows.map((fila) => fila.pos), [0, 0]);
  } finally {
    await db.close();
  }
});
