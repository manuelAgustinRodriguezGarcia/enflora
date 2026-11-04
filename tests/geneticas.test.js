import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cambiarGeneral, payloadCultivo } from "../lib/asistente-cultivo.js";
import { crearGeneticaPersonalizada } from "../lib/geneticas/datos.js";
import {
  actualizarPlanta,
  insertarPlantas,
  resolverListaGeneticas,
} from "../lib/geneticas/plantas.js";
import {
  clonarGeneticaCompartida,
  esUuid,
  filtrarGeneticasPropias,
  rutaImagenGeneticaValida,
  solicitudDeLaApp,
  validarBytesImagenGenetica,
  validarGeneticaPersonalizada,
} from "../lib/geneticas/reglas.js";
import { agruparPlantasPorGenetica, snapshotPlanta } from "../lib/registros.js";

const USUARIO = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";
const GENETICA = "33333333-3333-4333-8333-333333333333";

function cabeceras(valores) {
  return { get: (nombre) => valores[nombre] ?? null };
}

describe("genética personalizada", () => {
  it("acepta solo el nombre y no convierte un THC vacío en cero", () => {
    const valida = validarGeneticaPersonalizada({ nombre: "  Norte  ", thc: "  ", cbd: "", sabor: "", aroma: "" });
    assert.equal(valida.ok, true);
    assert.equal(valida.datos.nombre, "Norte");
    assert.equal(valida.datos.thc, null);
    assert.equal(valida.datos.cbd, null);
    assert.equal(validarGeneticaPersonalizada({ nombre: "Norte", thc: "0" }).datos.thc, 0);
    assert.equal(validarGeneticaPersonalizada({ nombre: "Norte", thc: "18,5" }).datos.thc, 18.5);
    assert.equal(validarGeneticaPersonalizada({ nombre: "   " }).ok, false);
    assert.equal(validarGeneticaPersonalizada({ nombre: "Norte", cbd: "101" }).ok, false);
    assert.equal(validarGeneticaPersonalizada({ nombre: "Norte", thc: "abc" }).ok, false);
  });

  it("filtra las genéticas propias sin distinguir mayúsculas ni acentos", () => {
    const lista = [{ nombre: "Norteña" }, { nombre: "Gorilla Glue" }];
    assert.deepEqual(
      filtrarGeneticasPropias(lista, "norte").map((item) => item.nombre),
      ["Norteña"]
    );
    assert.equal(filtrarGeneticasPropias(lista, "  ").length, 2);
  });

  it("reutiliza la genética propia y no sube otra imagen", async () => {
    let subidas = 0;
    const supabase = {
      from() {
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          ilike() { return builder; },
          maybeSingle: async () => ({
            data: {
              id: GENETICA,
              usuario_id: USUARIO,
              origen: "personalizada",
              nombre: "Norte",
              imagen_ruta: null,
              thc_valor: null,
              thc_min: null,
              thc_max: null,
              cbd_valor: null,
              cbd_min: null,
              cbd_max: null,
              sabor: null,
              aroma: null,
            },
            error: null,
          }),
        };
        return builder;
      },
      storage: { from() { return { upload() { subidas += 1; } }; } },
    };
    const resultado = await crearGeneticaPersonalizada(
      supabase,
      USUARIO,
      { nombre: "Norte", thc: 20, cbd: null, sabor: null, aroma: null },
      new Uint8Array(16)
    );
    assert.equal(resultado.reutilizada, true);
    assert.equal(resultado.detalle.id, GENETICA);
    assert.equal(resultado.detalle.thc.valor, null);
    assert.equal(subidas, 0);
  });

  it("rechaza una imagen que no es JPG, PNG o WEBP y borra el archivo si la fila no se guarda", async () => {
    const svg = new Uint8Array(16);
    svg.set([0x3c, 0x73, 0x76, 0x67], 0);
    assert.match(validarBytesImagenGenetica(svg).error, /JPG, PNG o WEBP/);
    const enorme = new Uint8Array(2 * 1024 * 1024 + 1);
    enorme[0] = 0xff;
    enorme[1] = 0xd8;
    enorme[2] = 0xff;
    assert.match(validarBytesImagenGenetica(enorme).error, /2 MB/);

    const jpeg = new Uint8Array(16);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    jpeg[2] = 0xff;
    assert.equal(validarBytesImagenGenetica(jpeg).tipo, "image/jpeg");

    let subidas = 0;
    let borrados = [];
    let lecturas = 0;
    const supabase = {
      from() {
        lecturas += 1;
        if (lecturas === 1) {
          const builder = {
            select() { return builder; },
            eq() { return builder; },
            ilike() { return builder; },
            maybeSingle: async () => ({ data: null, error: null }),
          };
          return builder;
        }
        return {
          insert() {
            return { select() { return { single: async () => ({ data: null, error: { code: "23505" } }) }; } };
          },
          select() { return this; },
          eq() { return this; },
          ilike() { return this; },
          maybeSingle: async () => ({ data: null, error: null }),
        };
      },
      storage: {
        from() {
          return {
            upload(ruta) {
              subidas += 1;
              assert.match(ruta, new RegExp(`^${USUARIO}/`));
              return { error: null };
            },
            remove(rutas) {
              borrados = rutas;
              return { error: null };
            },
          };
        },
      },
    };
    const resultado = await crearGeneticaPersonalizada(
      supabase,
      USUARIO,
      { nombre: "Norte", thc: null, cbd: null, sabor: null, aroma: null },
      jpeg
    );
    assert.equal(subidas, 1);
    assert.equal(borrados.length, 1);
    assert.equal(rutaImagenGeneticaValida(borrados[0], OTRO), false);
    assert.equal(rutaImagenGeneticaValida(`${OTRO}/../../${USUARIO}/foto.jpg`, USUARIO), false);
    assert.match(resultado.error, /no se pudo guardar/i);
  });
});

describe("plantas, historial y aislamiento", () => {
  it("no vincula una genética de otro usuario y mantiene el texto si el catálogo todavía no existe", async () => {
    const supabase = {
      from() {
        return {
          select() { return this; },
          eq(_campo, valor) {
            this.usuario = valor;
            return this;
          },
          in(_campo, ids) {
            const propias = [
              { id: GENETICA, usuario_id: USUARIO, nombre: "Norte" },
              { id: "44444444-4444-4444-8444-444444444444", usuario_id: OTRO, nombre: "Ajena" },
            ].filter((fila) => ids.includes(fila.id) && fila.usuario_id === this.usuario);
            return Promise.resolve({ data: propias, error: null });
          },
        };
      },
    };
    const ajena = "44444444-4444-4444-8444-444444444444";
    const rechazada = await resolverListaGeneticas(supabase, USUARIO, [
      { genetica: "Ajena", geneticaId: ajena },
    ]);
    assert.match(rechazada.error, /no se encontró/i);

    const propia = await resolverListaGeneticas(supabase, USUARIO, [
      { genetica: "nombre del cliente", geneticaId: GENETICA },
      { genetica: "  Solo texto  ", geneticaId: "" },
    ]);
    assert.equal(propia.plantas[0].genetica, "Norte");
    assert.equal(propia.plantas[0].genetica_id, GENETICA);
    assert.equal(propia.plantas[1].genetica, "Solo texto");
    assert.equal(propia.plantas[1].genetica_id, null);

    const sinTabla = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          in() {
            return Promise.resolve({
              data: null,
              error: { message: "Could not find the table 'public.geneticas' in the schema cache", code: "PGRST205" },
            });
          },
        };
      },
    };
    const libre = await resolverListaGeneticas(sinTabla, USUARIO, [{ genetica: "Gelato", geneticaId: GENETICA }]);
    assert.equal(libre.plantas[0].genetica, "Gelato");
    assert.equal(libre.plantas[0].genetica_id, null);
  });

  it("crea varias plantas con la misma ficha y edita una existente aunque falte la columna nueva", async () => {
    const compartida = clonarGeneticaCompartida(
      [{ genetica: "Norte", geneticaId: GENETICA, geneticaDetalle: { id: GENETICA, nombre: "Norte" } }, { genetica: "" }],
      { genetica: "" }
    );
    assert.equal(compartida.geneticaId, GENETICA);

    const estado = cambiarGeneral(
      {
        indice: 0,
        unidades: [{
          nombre: "Carpa 1",
          tipo: "carpa",
          tipoPersonalizado: "",
          numero: 1,
          modo: "misma_genetica",
          general: { genetica: "", geneticaId: "", geneticaDetalle: null },
          plantas: [{ genetica: "" }, { genetica: "" }],
        }],
      },
      "genetica",
      { nombre: "Norte", id: GENETICA, detalle: { id: GENETICA, nombre: "Norte", origen: "personalizada" } }
    );
    const payload = payloadCultivo({ ...estado, nombre: "Indoor", tipo: "interior" });
    assert.equal(payload.unidades[0].plantas.length, 2);
    assert.equal(payload.unidades[0].plantas[0].genetica, "Norte");
    assert.equal(payload.unidades[0].plantas[1].geneticaId, GENETICA);

    let enviadas = [];
    const supabase = {
      from() {
        return {
          insert(filas) {
            enviadas.push(filas);
            if (filas.some((fila) => Object.prototype.hasOwnProperty.call(fila, "genetica_id"))) {
              return { select: () => Promise.resolve({ data: null, error: { message: "Could not find the 'genetica_id' column of 'plantas' in the schema cache", code: "PGRST204" } }) };
            }
            return { select: () => Promise.resolve({ data: filas.map((fila, indice) => ({ id: String(indice), unidad_cultivo_id: fila.unidad_cultivo_id, numero: fila.numero })), error: null }) };
          },
          update(valores) {
            enviadas.push(valores);
            if (Object.prototype.hasOwnProperty.call(valores, "genetica_id")) {
              return { eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: null, error: { message: "column genetica_id does not exist", code: "42703" } }) }) }) };
            }
            return { eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [{ id: "planta" }], error: null }) }) }) };
          },
        };
      },
    };
    const alta = await insertarPlantas(supabase, [
      { nombre: "Planta 1", genetica: "Norte", genetica_id: GENETICA, numero: 1 },
      { nombre: "Planta 2", genetica: "Norte", genetica_id: GENETICA, numero: 2 },
    ]);
    assert.equal(alta.error, null);
    assert.equal(alta.data.length, 2);
    assert.equal(enviadas.at(-1).some((fila) => "genetica_id" in fila), false);
    assert.equal(enviadas.at(-1)[1].genetica, "Norte");

    const edicion = await actualizarPlanta(supabase, "planta", "unidad", {
      nombre: "Planta 1",
      genetica: "Gelato histórica",
      genetica_id: null,
    });
    assert.equal(edicion.error, null);
    assert.equal(edicion.data[0].id, "planta");
  });

  it("sigue agrupando el historial por el texto de la genética", () => {
    const grupos = agruparPlantasPorGenetica([
      { id: "a", genetica: "Gelato", genetica_id: GENETICA },
      { id: "b", genetica: " gelato ", genetica_id: null },
      { id: "c", genetica: "Norte" },
    ]);
    assert.equal(grupos.length, 2);
    assert.equal(grupos.find((grupo) => grupo.clave === "gelato").plantas.length, 2);

    const copia = snapshotPlanta({ id: "a", nombre: "Planta 1", genetica: "Gelato", genetica_id: GENETICA }, null);
    assert.equal(copia.genetica, "Gelato");
    assert.equal("genetica_id" in copia, false);
  });

  it("las políticas solo dejan leer y escribir genéticas e imágenes propias", () => {
    const sql = readFileSync(new URL("../supabase/geneticas.sql", import.meta.url), "utf8");
    for (const politica of ["geneticas_lee_propias", "geneticas_inserta_propias", "geneticas_actualiza_propias", "geneticas_borra_propias"]) {
      assert.match(sql, new RegExp(politica));
    }
    assert.match(sql, /enable row level security/);
    assert.equal((sql.match(/auth\.uid\(\) = usuario_id/g) || []).length >= 4, true);
    assert.match(sql, /revoke all on public\.geneticas from anon/);
    assert.match(sql, /geneticas-imagenes/);
    assert.match(sql, /public = false/);
    assert.match(sql, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
    assert.doesNotMatch(sql, /drop column genetica/i);
    assert.match(sql, /on delete set null/);
    assert.match(sql, /geneticas_personalizada_nombre_idx/);
    assert.match(sql, /geneticas_strainapi_slug_idx/);
    assert.equal(esUuid(GENETICA), true);
    assert.equal(esUuid("no-es-uuid"), false);
  });
});

describe("acceso a las fichas guardadas", () => {
  it("solo acepta pedidos del mismo origen", () => {
    assert.equal(solicitudDeLaApp(cabeceras({ "sec-fetch-site": "cross-site" })), false);
    assert.equal(solicitudDeLaApp(cabeceras({ "sec-fetch-site": "same-origin" })), true);
    assert.equal(solicitudDeLaApp(cabeceras({})), false);
  });
});
