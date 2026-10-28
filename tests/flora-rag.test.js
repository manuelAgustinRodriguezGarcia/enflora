import assert from "node:assert/strict";
import test from "node:test";

import { buscarEnGuiaCultivo, buscarEnGuiaCultivoLocal } from "../lib/flora-conocimiento.js";
import { FUENTE_GUIA } from "../lib/flora-contrato.js";
import { mapearFilasRagAFragmentosGuia } from "../lib/flora-rag-mapeo.js";
import { motorGuiaFlora, FLORA_RAG_EMBEDDING_MODEL, FLORA_RAG_EMBEDDING_DIMENSION } from "../lib/flora-rag-config.js";

test("config RAG: modelo y dimensión acordados", () => {
  assert.equal(FLORA_RAG_EMBEDDING_MODEL, "gemini-embedding-2");
  assert.equal(FLORA_RAG_EMBEDDING_DIMENSION, 768);
});

test("mapeo RAG conserva contrato Gemini (documento, sección, bibliografía)", () => {
  const filas = [
    {
      documento_slug: "rdwc-parametros",
      seccion_id: "ph",
      seccion_titulo: "pH en solución",
      contenido: "El pH en RDWC suele mantenerse en un rango estable.",
      palabras_clave: ["ph", "rdwc"],
      puntaje: 0.032,
      titulo_documento: "Parámetros RDWC",
      tema: "hidroponia",
      subtema: "rdwc",
      referencias: [{ cita: "Resumen editorial ENFLORA" }],
      version_documento: "1",
      publicado_en: "2026-11-01T12:00:00Z",
      incorporado_en: "2026-11-01",
      fuente_codigo: "fuente-001-hidroponia-natural",
      fuente_titulo: "Hidroponía Natural",
      fuente_autor: "Editorial",
      fuente_url: "https://example.com",
      fuente_procedencia: "Fuente 001",
      condiciones_uso: "Resúmenes propios",
    },
  ];

  const fragmentos = mapearFilasRagAFragmentosGuia(filas);
  assert.equal(fragmentos.length, 1);
  assert.equal(fragmentos[0].documentoId, "rdwc-parametros");
  assert.equal(fragmentos[0].seccionId, "ph");
  assert.ok(fragmentos[0].fragmento.includes("RDWC"));
  assert.equal(fragmentos[0].bibliografia.autor, "Editorial");
  assert.equal(fragmentos[0].bibliografia.estado, "publicado");
  assert.ok(fragmentos[0].referencias.length);
});

test("mapeo: términos técnicos EC pH PPM en contenido", () => {
  const fragmentos = mapearFilasRagAFragmentosGuia([
    {
      documento_slug: "tec",
      seccion_id: "s1",
      contenido: "EC, pH y PPM en solución nutritiva.",
      palabras_clave: ["ec"],
      puntaje: 1,
      titulo_documento: "T",
      referencias: [],
    },
  ]);
  assert.match(fragmentos[0].fragmento, /PPM/);
});

test("motor local por defecto en tests", () => {
  const prev = process.env.FLORA_GUIA_MOTOR;
  delete process.env.FLORA_GUIA_MOTOR;
  assert.equal(motorGuiaFlora(), "local");
  process.env.FLORA_GUIA_MOTOR = prev;
});

test("supabase sin sesión en auto degrada sin romper contrato", async () => {
  const prev = process.env.FLORA_GUIA_MOTOR;
  process.env.FLORA_GUIA_MOTOR = "auto";
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
    },
  };
  const r = await buscarEnGuiaCultivo({ consulta: "ph ec", supabase });
  assert.equal(r.fuente, FUENTE_GUIA);
  assert.ok(Array.isArray(r.datos));
  assert.ok(r.limitaciones?.some((l) => /respaldo|local/i.test(l)) || r.metadatos?.ragDegradado);
  process.env.FLORA_GUIA_MOTOR = prev;
});

test("supabase puro sin RAG devuelve vacío controlado", async () => {
  const prev = process.env.FLORA_GUIA_MOTOR;
  process.env.FLORA_GUIA_MOTOR = "supabase";
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
    },
  };
  const r = await buscarEnGuiaCultivo({ consulta: "rdwc", supabase });
  assert.equal(r.datos.length, 0);
  assert.equal(r.metadatos.sinDatos, true);
  assert.ok(r.limitaciones?.length);
  process.env.FLORA_GUIA_MOTOR = prev;
});

test("local explícito: resultado vacío sin inventar", () => {
  const r = buscarEnGuiaCultivoLocal({
    consulta: "zzz",
    carpeta: "C:\\enflora-guia-inexistente-tests",
  });
  assert.equal(r.datos.length, 0);
  assert.equal(r.metadatos.motor, "local_json");
});
