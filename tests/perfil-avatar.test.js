import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_BYTES_AVATAR,
  MAX_BYTES_ORIGINAL_AVATAR,
  cajaRotada,
  debeRenovarAvatar,
  limitarRecorte,
  rutaAvatar,
  rutaAvatarValida,
  validarArchivoAvatar,
  validarBytesSubidaAvatar,
} from "../lib/perfil/avatar.js";
import { persistirAvatar, quitarAvatar } from "../lib/perfil/avatar-servidor.js";

const USUARIO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTRO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ARCHIVO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function bytesWebp(largo = 32) {
  const bytes = new Uint8Array(largo);
  bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  return bytes;
}

function bytesJpeg() {
  const bytes = new Uint8Array(16);
  bytes.set([0xff, 0xd8, 0xff]);
  return bytes;
}

function clienteAvatar({ rpcError = null, anterior = null, uploadError = null, rpc = "guardar_avatar_perfil" } = {}) {
  const llamadas = { subidas: [], borrados: [], firmas: [], rpc: null };
  const supabase = {
    storage: {
      from(bucket) {
        assert.equal(bucket, "avatars");
        return {
          upload(ruta, bytes, opciones) {
            llamadas.subidas.push({ ruta, bytes, opciones });
            return { error: uploadError };
          },
          remove(rutas) {
            llamadas.borrados.push(rutas);
            return { error: null };
          },
          createSignedUrl(ruta, segundos) {
            llamadas.firmas.push({ ruta, segundos });
            return { data: { signedUrl: `https://firmada.example/${ruta}?token=abc` }, error: null };
          },
        };
      },
    },
    rpc(nombre, args) {
      llamadas.rpc = { nombre, args };
      assert.equal(nombre, rpc);
      if (rpcError) return { data: null, error: rpcError };
      return { data: anterior, error: null };
    },
  };
  return { supabase, llamadas };
}

test("rechaza originales vacíos, pesados o de un formato no permitido", () => {
  assert.match(validarArchivoAvatar(null).error, /leer/);
  assert.match(validarArchivoAvatar({ size: 0, type: "image/jpeg", name: "a.jpg" }).error, /vacío/);
  assert.match(
    validarArchivoAvatar({ size: MAX_BYTES_ORIGINAL_AVATAR + 1, type: "image/jpeg", name: "a.jpg" }).error,
    /8 MB/,
  );
  assert.equal(
    validarArchivoAvatar({ size: MAX_BYTES_ORIGINAL_AVATAR, type: "image/png", name: "a.png" }).error,
    "",
  );
  assert.match(validarArchivoAvatar({ size: 10, type: "image/svg+xml", name: "a.svg" }).error, /JPG, PNG o WEBP/);
  assert.match(validarArchivoAvatar({ size: 10, type: "", name: "foto.heic" }).error, /no es compatible/);
});

test("la subida solo acepta la firma real de WEBP o JPEG y un peso liviano", () => {
  assert.equal(validarBytesSubidaAvatar(bytesWebp()).tipo, "image/webp");
  assert.equal(validarBytesSubidaAvatar(bytesJpeg()).extension, "jpg");
  const png = new Uint8Array(16);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.match(validarBytesSubidaAvatar(png).error, /no es válida/);
  const svg = new Uint8Array(16);
  svg.set([0x3c, 0x73, 0x76, 0x67]);
  assert.match(validarBytesSubidaAvatar(svg).error, /no es válida/);
  assert.match(validarBytesSubidaAvatar(bytesWebp(MAX_BYTES_AVATAR + 1)).error, /demasiado pesada/);
});

test("la referencia estable pertenece solo a esa persona y nunca es una URL firmada", () => {
  const ruta = rutaAvatar(USUARIO, ARCHIVO, "webp");
  assert.equal(rutaAvatarValida(ruta, USUARIO), true);
  assert.equal(rutaAvatarValida(ruta, OTRO), false);
  assert.equal(rutaAvatarValida(`${USUARIO}/../${OTRO}/${ARCHIVO}.webp`, USUARIO), false);
  assert.equal(
    rutaAvatarValida(`https://proyecto.supabase.co/storage/v1/object/sign/avatars/${ruta}?token=abc`, USUARIO),
    false,
  );
  assert.equal(rutaAvatarValida(`${OTRO}/${ARCHIVO}.webp`, USUARIO), false);
});

test("renueva una URL firmada cerca del vencimiento y no una vista local reciente", () => {
  const ahora = 1_000_000;
  assert.equal(debeRenovarAvatar(ahora + 3 * 60 * 1000, ahora), false);
  assert.equal(debeRenovarAvatar(ahora + 60 * 1000, ahora), true);
  assert.equal(debeRenovarAvatar(0, ahora), true);
  assert.equal(debeRenovarAvatar(Number.MAX_SAFE_INTEGER, ahora), false);
});

test("el recorte queda dentro de la foto y un giro de 90° cambia el lado", () => {
  assert.deepEqual(limitarRecorte({ x: -20, y: 5, width: 900, height: 40 }, 100, 80), {
    x: 0,
    y: 5,
    width: 100,
    height: 40,
  });
  const caja = cajaRotada(100, 40, 90);
  assert.ok(Math.abs(caja.ancho - 40) < 0.001);
  assert.ok(Math.abs(caja.alto - 100) < 0.001);
});

test("si el perfil no se actualiza, borra la foto nueva y conserva la anterior", async () => {
  const { supabase, llamadas } = clienteAvatar({ rpcError: { message: "No se encontró el perfil." } });
  const resultado = await persistirAvatar(supabase, USUARIO, bytesWebp());
  assert.match(resultado.error, /No se encontró el perfil/);
  assert.equal(llamadas.subidas.length, 1);
  assert.equal(llamadas.borrados.length, 1);
  assert.deepEqual(llamadas.borrados[0], [llamadas.subidas[0].ruta]);
  assert.equal(llamadas.firmas.length, 0);
  assert.match(llamadas.subidas[0].ruta, new RegExp(`^${USUARIO}/`));
  assert.equal(llamadas.rpc.args.ruta, llamadas.subidas[0].ruta);
});

test("al reemplazar, solo borra la foto anterior del mismo usuario", async () => {
  const anterior = rutaAvatar(USUARIO, ARCHIVO, "jpg");
  const { supabase, llamadas } = clienteAvatar({ anterior });
  const resultado = await persistirAvatar(supabase, USUARIO, bytesWebp());
  assert.equal(resultado.error, "");
  assert.match(resultado.url, /^https:\/\/firmada\.example\//);
  assert.equal(resultado.url.includes(llamadas.subidas[0].ruta), true);
  assert.deepEqual(llamadas.borrados, [[anterior]]);
  assert.equal(llamadas.rpc.args.ruta.startsWith(`${OTRO}/`), false);
});

test("no borra una ruta que pertenece a otra persona", async () => {
  const ajena = rutaAvatar(OTRO, ARCHIVO, "webp");
  const { supabase, llamadas } = clienteAvatar({ anterior: ajena });
  const resultado = await persistirAvatar(supabase, USUARIO, bytesWebp());
  assert.equal(resultado.error, "");
  assert.deepEqual(llamadas.borrados, []);
});

test("un archivo inválido no se sube", async () => {
  const { supabase, llamadas } = clienteAvatar();
  const resultado = await persistirAvatar(supabase, USUARIO, new Uint8Array([1, 2, 3, 4]));
  assert.match(resultado.error, /No se pudo leer|no es válida/);
  assert.equal(llamadas.subidas.length, 0);
  assert.equal(llamadas.rpc, null);
});

test("si falla la subida, no toca el perfil", async () => {
  const { supabase, llamadas } = clienteAvatar({ uploadError: { message: "Bucket not found" } });
  const resultado = await persistirAvatar(supabase, USUARIO, bytesWebp());
  assert.match(resultado.error, /almacenamiento de avatares/);
  assert.equal(llamadas.rpc, null);
  assert.deepEqual(llamadas.borrados, []);
});

test("quitar la foto no borra archivos de otra persona y, si falla, no borra nada", async () => {
  const propio = rutaAvatar(USUARIO, ARCHIVO, "webp");
  const ok = clienteAvatar({ anterior: propio, rpc: "quitar_avatar_perfil" });
  const quitado = await quitarAvatar(ok.supabase, USUARIO);
  assert.equal(quitado.error, "");
  assert.deepEqual(ok.llamadas.borrados, [[propio]]);
  assert.equal(ok.llamadas.rpc.args, undefined);

  const ajeno = clienteAvatar({ anterior: rutaAvatar(OTRO, ARCHIVO, "webp"), rpc: "quitar_avatar_perfil" });
  await quitarAvatar(ajeno.supabase, USUARIO);
  assert.deepEqual(ajeno.llamadas.borrados, []);

  const fallo = clienteAvatar({ rpcError: { message: "timeout" }, rpc: "quitar_avatar_perfil" });
  const resultado = await quitarAvatar(fallo.supabase, USUARIO);
  assert.match(resultado.error, /No se pudo quitar/);
  assert.deepEqual(fallo.llamadas.borrados, []);
});

test("ignora un id que no es de la sesión", async () => {
  const { supabase, llamadas } = clienteAvatar();
  const resultado = await persistirAvatar(supabase, "otro-usuario", bytesWebp());
  assert.equal(resultado.error, "No hay sesión.");
  assert.equal(llamadas.subidas.length, 0);
});
