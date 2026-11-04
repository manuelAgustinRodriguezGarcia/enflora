import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { crearAlmacenCompuesto, crearAlmacenMemoria } from "../lib/clima/almacen.js";
import { avisosDesdePronostico } from "../lib/clima/alertas.js";
import {
  TTL_PRONOSTICO_MS,
  TOPE_CACHE_CONDICION_MS,
  TOPE_CACHE_PRONOSTICO_MS,
  limitesClima,
  umbralesClima,
} from "../lib/clima/constantes.js";
import { normalizarBusqueda, normalizarPronostico } from "../lib/clima/normalizar.js";
import { buscarLocalidades, obtenerPronostico, resolverLugar } from "../lib/clima/servicio.js";
import { armarResumenInicio, resumenLugar } from "../lib/clima/resumen.js";
import {
  etiquetaActualizacion,
  formatearInstante,
  lineaResumen,
  lugarPublico,
  textoFecha,
  textoMilimetros,
  textoNieve,
  textoPronostico,
  textoTemperatura,
  textoViento,
} from "../lib/clima/texto.js";
import {
  consultaValida,
  coordenadaLeida,
  coordenadaValida,
  filtrarUbicaciones,
  puedeAsociarUbicacion,
  tablaClimaAusente,
  ventanaDia,
} from "../lib/clima/validar.js";

const AHORA = Date.parse("2026-11-03T21:00:00.000Z");
const USUARIO = "usuario-a";
const ENV = { WEATHERAPI_KEY: "test-key" };

function dia(fecha, max, min, lluvia, precip, viento, extra = {}) {
  const day = {
    maxtemp_c: max,
    mintemp_c: min,
    daily_chance_of_rain: lluvia,
    maxwind_kph: viento,
    condition: { text: "Nublado" },
    ...extra,
  };
  if (precip !== undefined) day.totalprecip_mm = precip;
  return { date: fecha, day };
}

function cuerpoPronostico(extra = {}) {
  return {
    location: {
      name: "Rosario",
      region: "Santa Fe",
      country: "Argentina",
      lat: -32.95,
      lon: -60.64,
      tz_id: "America/Argentina/Cordoba",
      localtime: "2026-11-03 18:00",
    },
    current: {
      last_updated: "2026-11-03 21:15",
      temp_c: 18.4,
      temp_f: 65.1,
      feelslike_c: 17.2,
      humidity: 70,
      condition: { text: "Parcialmente nublado" },
      wind_kph: 15,
      precip_mm: 0,
    },
    forecast: {
      forecastday: [
        dia("2026-11-03", 22, 14, 10, 0, 12),
        dia("2026-11-04", 19, 3, 80, 24, 55),
        dia("2026-11-05", 36, 20, 5, 0, 10),
        dia("2026-11-06", 1, -10, 0, 0, 5),
      ],
    },
    alerts: {
      alert: [
        {
          headline: "Alerta por tormentas",
          severity: "Moderate",
          event: "Tormenta",
          effective: "2026-11-04T12:00:00-03:00",
          expires: "2026-11-04T18:00:00-03:00",
          desc: "Lluvias intensas.",
          instruction: "Evitá la calle.",
        },
      ],
    },
    ...extra,
  };
}

function respuesta(cuerpo, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

function fetchContado(fabrica) {
  const llamadas = [];
  const fetchImpl = async (url) => {
    const ruta = new URL(url);
    llamadas.push(ruta);
    return fabrica(ruta, llamadas);
  };
  return { fetchImpl, llamadas };
}

function opciones(extra = {}) {
  return {
    usuarioId: USUARIO,
    ahora: AHORA,
    env: ENV,
    almacen: crearAlmacenMemoria(),
    ...extra,
  };
}

test("la caché de la respuesta combinada no supera el tope del proveedor", () => {
  assert.ok(TTL_PRONOSTICO_MS <= TOPE_CACHE_CONDICION_MS);
  assert.ok(TTL_PRONOSTICO_MS <= TOPE_CACHE_PRONOSTICO_MS);
  assert.equal(TTL_PRONOSTICO_MS, 30 * 60 * 1000);
});

test("rechaza coordenadas inválidas sin consultar al proveedor", async () => {
  let llamadas = 0;
  const resultado = await obtenerPronostico(
    opciones({
      latitud: 120,
      longitud: 10,
      fetchImpl: async () => {
        llamadas += 1;
        return respuesta(cuerpoPronostico());
      },
    })
  );
  assert.equal(resultado.ok, false);
  assert.equal(resultado.codigo, "ubicacion_invalida");
  assert.equal(llamadas, 0);
  assert.equal(coordenadaValida(" -32.95", -60.64), null);
  assert.deepEqual(coordenadaLeida("-32.95", "-60.64"), { latitud: -32.95, longitud: -60.64 });
});

test("acepta el nombre WEATHERAPI_API_KEY", async () => {
  let clave = "";
  const resultado = await buscarLocalidades(
    opciones({
      consulta: "Rosario",
      env: { WEATHERAPI_API_KEY: "alias-key" },
      fetchImpl: async (url) => {
        clave = new URL(url).searchParams.get("key");
        return respuesta([]);
      },
    })
  );
  assert.equal(clave, "alias-key");
  assert.equal(resultado.ok, true);
  assert.equal(resultado.codigo, "sin_resultados");
});

test("sin clave no inventa clima ni llama al proveedor", async () => {
  let llamadas = 0;
  const resultado = await obtenerPronostico(
    opciones({
      latitud: -32.95,
      longitud: -60.64,
      env: {},
      fetchImpl: async () => {
        llamadas += 1;
        return respuesta(cuerpoPronostico());
      },
    })
  );
  assert.equal(resultado.ok, false);
  assert.equal(resultado.codigo, "sin_configuracion");
  assert.equal(llamadas, 0);
  assert.equal("temperaturaC" in resultado, false);
});

test("normaliza unidades métricas, recorta a cuatro días y separa alertas", async () => {
  const { fetchImpl, llamadas } = fetchContado(() => respuesta(cuerpoPronostico()));
  const resultado = await obtenerPronostico(
    opciones({ latitud: -32.95, longitud: -60.64, fetchImpl })
  );

  assert.equal(resultado.ok, true);
  assert.equal(llamadas.length, 1);
  const url = llamadas[0];
  assert.equal(url.searchParams.get("days"), "4");
  assert.equal(url.searchParams.get("lang"), "es");
  assert.equal(url.searchParams.get("aqi"), "no");
  assert.equal(url.searchParams.get("alerts"), "yes");
  assert.equal(url.searchParams.get("q"), "-32.95,-60.64");
  assert.equal(JSON.stringify(resultado).includes("test-key"), false);

  const { clima } = resultado;
  assert.equal(clima.actual.temperaturaC, 18.4);
  assert.equal(clima.actual.sensacionC, 17.2);
  assert.equal(clima.actual.humedad, 70);
  assert.equal(clima.actual.vientoKph, 15);
  assert.equal(clima.actual.precipitacionMm, 0);
  assert.equal(clima.actual.codigo, null);
  assert.equal(clima.actual.esDia, null);
  assert.equal(clima.dias.length, 4);
  assert.deepEqual(
    clima.dias.map((item) => item.fecha),
    ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]
  );
  assert.equal(clima.dias.every((item) => item.esPronostico), true);
  assert.equal(clima.alertasOficiales[0].origen, "oficial");
  assert.equal(clima.alertasOficiales[0].indicacion, "Evitá la calle.");
  assert.deepEqual(
    clima.avisosEnflora.map((aviso) => aviso.tipo),
    ["temperatura_baja", "calor", "lluvia", "viento"]
  );
  assert.equal(clima.avisosEnflora.every((aviso) => aviso.origen === "enflora"), true);
  const textoAvisos = clima.avisosEnflora.map((aviso) => aviso.detalle).join(" ");
  assert.equal(/riego|poda|fertiliz|cosech/i.test(textoAvisos), false);
  assert.equal(textoAvisos.includes("Evitá la calle."), false);
  assert.match(textoPronostico(3), /No son mediciones/);
  assert.match(clima.atribucion.texto, /WeatherAPI\.com/);
  assert.equal(clima.atribucion.url, "https://www.weatherapi.com/");
  assert.match(textoTemperatura(18.4), /°C/);
  assert.match(textoViento(15), /km\/h/);
  assert.equal(textoMilimetros(0), "0 mm");
  assert.equal(textoTemperatura(18.4).includes("°F"), false);
});

test("no fabrica precipitación ni temperatura ausentes", () => {
  const cuerpo = cuerpoPronostico();
  delete cuerpo.current.temp_c;
  delete cuerpo.current.feelslike_c;
  delete cuerpo.forecast.forecastday[1].day.totalprecip_mm;
  cuerpo.current.temp_f = 65.1;
  const normalizado = normalizarPronostico(cuerpo, {
    latitud: -32.95,
    longitud: -60.64,
    incluirAlertas: true,
  });
  assert.equal(normalizado.actual.temperaturaC, null);
  assert.notEqual(normalizado.actual.temperaturaC, 18.4);
  assert.equal(normalizado.dias[1].precipitacionMm, null);
  assert.equal(textoMilimetros(null), "");
  assert.equal(textoMilimetros(0), "0 mm");
  assert.equal(textoNieve(0), "");
  assert.equal(textoNieve(2), "2 cm");
});

test("una respuesta lejana, rota o con error no se guarda ni se muestra como clima", async () => {
  const lejos = cuerpoPronostico();
  lejos.location.lat = 48.85;
  lejos.location.lon = 2.35;
  const casos = [
    respuesta(lejos),
    respuesta({ error: { code: 2007, message: "quota" } }, 403),
    new Response("<html>", { status: 200 }),
    new Response("no-json", { status: 502 }),
  ];

  for (const cuerpo of casos) {
    let llamadas = 0;
    const almacen = crearAlmacenMemoria();
    const resultado = await obtenerPronostico(
      opciones({
        latitud: -32.95,
        longitud: -60.64,
        almacen,
        fetchImpl: async () => {
          llamadas += 1;
          return cuerpo;
        },
      })
    );
    assert.equal(resultado.ok, false);
    assert.equal(resultado.clima, undefined);
    assert.equal(llamadas, 1);
    const repetido = await obtenerPronostico(
      opciones({
        latitud: -32.95,
        longitud: -60.64,
        almacen,
        fetchImpl: async () => {
          llamadas += 1;
          return cuerpo;
        },
      })
    );
    assert.equal(repetido.ok, false);
    assert.equal(llamadas, 2);
  }
});

test("reutiliza la caché vigente y vuelve a consultar cuando vence", async () => {
  let llamadas = 0;
  const almacen = crearAlmacenMemoria();
  const fetchImpl = async () => {
    llamadas += 1;
    return respuesta(cuerpoPronostico());
  };
  const primero = await obtenerPronostico(opciones({ latitud: -32.95, longitud: -60.64, almacen, fetchImpl }));
  const segundo = await obtenerPronostico(
    opciones({
      latitud: -32.951,
      longitud: -60.639,
      almacen,
      fetchImpl,
      umbrales: umbralesClima({ CLIMA_UMBRAL_CALOR_C: 50, CLIMA_UMBRAL_FRIO_C: -20, CLIMA_UMBRAL_LLUVIA_MM: 100, CLIMA_UMBRAL_VIENTO_KPH: 100 }),
    })
  );
  assert.equal(primero.desdeCache, false);
  assert.equal(segundo.desdeCache, true);
  assert.equal(llamadas, 1);
  assert.equal(segundo.clima.avisosEnflora.length, 0);

  const vencido = await obtenerPronostico(
    opciones({
      latitud: -32.95,
      longitud: -60.64,
      almacen,
      fetchImpl,
      ahora: AHORA + TTL_PRONOSTICO_MS,
    })
  );
  assert.equal(vencido.desdeCache, false);
  assert.equal(llamadas, 2);
});

test("el límite propio corta la consulta y no completa datos", async () => {
  let llamadas = 0;
  const almacen = crearAlmacenMemoria();
  const env = { ...ENV, CLIMA_LIMITE_USUARIO_DIA: 1, CLIMA_LIMITE_GLOBAL_DIA: 10 };
  const base = { latitud: -32.95, longitud: -60.64, almacen, env, fetchImpl: async () => {
    llamadas += 1;
    return respuesta(cuerpoPronostico());
  } };
  const primero = await obtenerPronostico(opciones(base));
  const segundo = await obtenerPronostico(opciones({ ...base, latitud: -31.4, longitud: -64.18 }));
  assert.equal(primero.ok, true);
  assert.equal(segundo.ok, false);
  assert.equal(segundo.codigo, "limite");
  assert.equal(llamadas, 1);
});

test("el cupo global se comparte entre usuarios", async () => {
  const almacen = crearAlmacenMemoria();
  const env = { ...ENV, CLIMA_LIMITE_GLOBAL_DIA: 1, CLIMA_LIMITE_USUARIO_DIA: 10 };
  let llamadas = 0;
  const fetchImpl = async () => {
    llamadas += 1;
    return respuesta(cuerpoPronostico());
  };
  const primero = await obtenerPronostico(
    opciones({ latitud: -32.95, longitud: -60.64, almacen, env, fetchImpl, usuarioId: "usuario-a" })
  );
  const segundo = await obtenerPronostico(
    opciones({ latitud: -31.42, longitud: -64.18, almacen, env, fetchImpl, usuarioId: "usuario-b" })
  );
  assert.equal(primero.ok, true);
  assert.equal(segundo.codigo, "limite");
  assert.equal(llamadas, 1);
});

test("si el plan solo entrega tres días, conserva el pronóstico disponible", async () => {
  const { fetchImpl, llamadas } = fetchContado((ruta) => {
    if (ruta.searchParams.get("days") === "4") {
      return respuesta({ error: { code: 2009, message: "plan" } }, 403);
    }
    return respuesta(cuerpoPronostico());
  });
  const resultado = await obtenerPronostico(opciones({ latitud: -32.95, longitud: -60.64, fetchImpl }));
  assert.equal(resultado.ok, true);
  assert.equal(llamadas.at(-1).searchParams.get("days"), "3");
  assert.equal(llamadas.at(-1).searchParams.get("alerts"), "yes");
});

test("si el plan no entrega alertas, reintenta sin marcar alertas oficiales", async () => {
  const { fetchImpl, llamadas } = fetchContado((ruta) => {
    if (ruta.searchParams.get("alerts") === "yes") {
      return respuesta({ error: { code: 2009, message: "plan" } }, 403);
    }
    const cuerpo = cuerpoPronostico();
    delete cuerpo.alerts;
    return respuesta(cuerpo);
  });
  const resultado = await obtenerPronostico(opciones({ latitud: -32.95, longitud: -60.64, fetchImpl }));
  assert.equal(resultado.ok, true);
  assert.equal(resultado.clima.alertasOficiales, null);
  assert.equal(llamadas.length, 2);
  assert.equal(llamadas[1].searchParams.get("alerts"), "no");
});

test("la búsqueda solo acepta ciudades devueltas por el proveedor", async () => {
  assert.equal(consultaValida("R"), "");
  assert.equal(consultaValida("<script>"), "");
  assert.equal(consultaValida("-32.95,-60.64"), "");
  const almacen = crearAlmacenMemoria();
  let llamadas = 0;
  const fetchImpl = async (url) => {
    llamadas += 1;
    assert.equal(new URL(url).searchParams.get("q"), "Rosario");
    return respuesta([
      { id: 10, name: "Rosario", region: "Santa Fe", country: "Argentina", lat: -32.95, lon: -60.64 },
      { id: 0, name: "Incompleta", lat: 1, lon: 1 },
      { name: "Sin id", lat: 1, lon: 2 },
    ]);
  };
  const busqueda = await buscarLocalidades(opciones({ consulta: " Rosario ", fetchImpl, almacen }));
  assert.equal(busqueda.ok, true);
  assert.equal(busqueda.lugares.length, 1);
  assert.deepEqual(lugarPublico(busqueda.lugares[0]), { id: 10, etiqueta: "Rosario, Santa Fe, Argentina" });
  assert.equal("latitud" in lugarPublico(busqueda.lugares[0]), false);

  const resuelta = await resolverLugar(
    opciones({
      consulta: "Rosario",
      lugarId: 10,
      latitud: 0,
      longitud: 0,
      almacen,
      fetchImpl,
    })
  );
  assert.equal(resuelta.ok, true);
  assert.equal(resuelta.lugar.latitud, -32.95);
  assert.equal(llamadas, 1);
  const ajena = await resolverLugar(opciones({ consulta: "Rosario", lugarId: 99, almacen, fetchImpl }));
  assert.equal(ajena.ok, false);
  assert.equal(ajena.codigo, "ubicacion_invalida");
});

test("interpreta la hora local del cultivo y convierte solo instantes con zona", () => {
  const local = etiquetaActualizacion("2026-11-03 21:15", "America/Argentina/Cordoba");
  assert.match(local, /21:15/);
  assert.match(local, /America\/Argentina\/Cordoba/);
  assert.equal(local.includes("00:15"), false);
  const convertido = formatearInstante("2026-11-04T00:15:00.000Z", "America/Argentina/Cordoba");
  assert.match(convertido, /21:15/);
  assert.match(convertido, /3/);
  const fecha = textoFecha("2026-11-04");
  assert.match(fecha, /miércoles/i);
  assert.match(fecha, /noviembre/i);
  assert.match(fecha, /2026/);
  assert.equal(fecha.includes("3 de noviembre"), false);
  assert.equal(
    ventanaDia(Date.parse("2026-11-03T23:30:00.000Z")),
    ventanaDia(Date.parse("2026-11-03T00:30:00.000Z"))
  );
  assert.notEqual(
    ventanaDia(Date.parse("2026-11-03T23:30:00.000Z")),
    ventanaDia(Date.parse("2026-11-04T00:30:00.000Z"))
  );
});

test("los umbrales inválidos vuelven al valor seguro y los avisos salen del pronóstico", () => {
  const umbrales = umbralesClima({ CLIMA_UMBRAL_FRIO_C: 40, CLIMA_UMBRAL_CALOR_C: 10 });
  assert.equal(umbrales.temperaturaBajaC, 5);
  assert.equal(umbrales.calorC, 35);
  assert.equal(limitesClima({ CLIMA_LIMITE_GLOBAL_DIA: 9000 }).globalDia, 2000);
  const avisos = avisosDesdePronostico(
    [{ fecha: "2026-11-04", minimaC: 0, maximaC: null, precipitacionMm: null, vientoKph: null, esPronostico: true }],
    umbrales
  );
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].tipo, "temperatura_baja");
  assert.equal(
    avisosDesdePronostico(
      [{ fecha: "2026-11-04", minimaC: null, maximaC: null, precipitacionMm: null, vientoKph: null, esPronostico: false }],
      umbrales
    ).length,
    0
  );
});

test("el inicio muestra los tres días siguientes al actual", () => {
  const lugar = resumenLugar({
    espacio: { id: "e1", nombre: "Patio" },
    ubicacion: { nombre: "Rosario", region: "Santa Fe", pais: "Argentina" },
    ahora: new Date("2026-11-04T15:00:00-03:00"),
    resultado: {
      ok: true,
      clima: {
        localidad: { zonaHoraria: "America/Argentina/Cordoba" },
        actual: { temperaturaC: 18, condicion: "Nublado" },
        dias: [
          { fecha: "2026-11-04", maximaC: 23.4, minimaC: 16, probabilidadLluvia: 57, codigo: 1063 },
          { fecha: "2026-11-05", maximaC: 25, minimaC: 13.4, probabilidadLluvia: 3, codigo: 1000 },
          { fecha: "2026-11-06", maximaC: 22.4, minimaC: 15.3, probabilidadLluvia: 59, codigo: 1063 },
          { fecha: "2026-11-07", maximaC: 21, minimaC: 14, probabilidadLluvia: 10, codigo: 1000 },
        ],
      },
    },
  });
  assert.deepEqual(
    lugar.vista.dias.map((dia) => dia.fecha),
    ["2026-11-05", "2026-11-06", "2026-11-07"]
  );
});

test("cada espacio exterior conserva su localidad", () => {
  const patio = resumenLugar({
    espacio: { id: "e1", nombre: "Patio" },
    ubicacion: { nombre: "Rosario", region: "Santa Fe", pais: "Argentina" },
    resultado: {
      ok: true,
      clima: {
        actual: { temperaturaC: 18, condicion: "Nublado" },
        dias: [{ maximaC: 22, minimaC: 14 }],
        avisosEnflora: [{ titulo: "Temperatura baja" }],
        alertasOficiales: [],
      },
    },
  });
  const quinta = resumenLugar({
    espacio: { id: "e2", nombre: "Quinta" },
    ubicacion: null,
    resultado: null,
  });
  const resumen = armarResumenInicio({ lugares: [patio, quinta] });
  assert.equal(resumen.visible, true);
  assert.equal(patio.localidad.includes("Rosario"), true);
  assert.equal(patio.lugarNombre, "Rosario");
  assert.equal(patio.region, "Santa Fe");
  assert.equal(patio.pais, "Argentina");
  assert.equal(quinta.estado, "sin_localidad");
  assert.equal(patio.linea.includes("18"), true);
  assert.equal(patio.vista.actual.temperaturaC, 18);
  assert.equal(patio.vista.dias.length, 1);
  assert.equal(patio.vista.dias[0].maximaC, 22);
  assert.equal(quinta.vista, undefined);
  assert.equal(quinta.linea.includes("18"), false);
  assert.match(patio.avisoEnflora, /ENFLORA/);
  assert.equal(quinta.avisoOficial, "");
  assert.match(lineaResumen(patio ? { actual: { temperaturaC: 18, condicion: "Nublado" }, dias: [{ maximaC: 22, minimaC: 14 }] } : null), /prevista/);
  assert.equal(armarResumenInicio().visible, false);
});

test("aísla ubicaciones por usuario y exige espacio exterior", () => {
  assert.equal(puedeAsociarUbicacion({ usuarioId: "a", duenoId: "a", tipo: "exterior" }), true);
  assert.equal(puedeAsociarUbicacion({ usuarioId: "a", duenoId: "b", tipo: "exterior" }), false);
  assert.equal(puedeAsociarUbicacion({ usuarioId: "a", duenoId: "a", tipo: "interior" }), false);
  const filas = filtrarUbicaciones(
    [
      { usuario_id: "a", nombre: "Rosario" },
      { usuario_id: "b", nombre: "Córdoba" },
    ],
    "a"
  );
  assert.deepEqual(filas.map((fila) => fila.nombre), ["Rosario"]);
  assert.equal(tablaClimaAusente({ code: "42P01", message: "ubicaciones_clima" }), true);
  assert.equal(tablaClimaAusente({ code: "42P01", message: "preferencias_clima" }), true);
  assert.equal(tablaClimaAusente({ code: "42501", message: "permission denied" }), false);
  assert.equal(resumenLugar({ espacio: { id: "e1", nombre: "Patio" }, ubicacion: null }).href, "/cultivos/e1/clima");
  assert.equal(
    resumenLugar({
      espacio: { id: "usuario:a", nombre: "Tu localidad", href: "/perfil#clima" },
      ubicacion: { nombre: "Rosario", region: "Santa Fe", pais: "Argentina" },
      resultado: { ok: false, codigo: "sin_datos" },
    }).href,
    "/perfil#clima"
  );
});

test("la migración deja el clima del usuario aislado y la caché fuera del cliente", () => {
  const sql = readFileSync(new URL("../supabase/clima-ubicaciones.sql", import.meta.url), "utf8");
  assert.match(sql, /auth\.uid\(\) = usuario_id/);
  assert.match(sql, /espacios\.tipo = 'exterior'/);
  assert.match(sql, /revoke all on public\.clima_cache from public, anon, authenticated/);
  assert.match(sql, /revoke all on public\.clima_consumo from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.consumir_clima\(text, timestamptz, integer\) to service_role/);
  assert.equal(/push/i.test(sql), true);
  assert.match(sql, /no forman parte/i);
});

test("la preferencia de clima es de la cuenta y no exige un espacio", () => {
  const sql = readFileSync(new URL("../supabase/clima-preferencias.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.preferencias_clima/);
  assert.match(sql, /ver_clima boolean not null default true/);
  assert.match(sql, /auth\.uid\(\) = usuario_id/);
  assert.match(sql, /references auth\.users \(id\)/);
  assert.doesNotMatch(sql, /references public\.espacios/);
  assert.match(sql, /grant select, insert, update, delete on public\.preferencias_clima to authenticated/);
});

test("si la caché remota no existe, la memoria sigue respondiendo", async () => {
  const local = crearAlmacenMemoria();
  const mixto = crearAlmacenCompuesto(local, {
    async leer() {
      return { ausente: true };
    },
    async guardar() {
      return { ausente: true };
    },
    async leerConsumo() {
      return { ausente: true };
    },
    async consumir() {
      return { ausente: true };
    },
  });
  await mixto.guardar("clave", { valor: 1 }, 0, 100);
  assert.deepEqual(await mixto.leer("clave", 50), { valor: 1 });
  assert.equal((await mixto.consumir("global", "dia", 1)).permitido, true);
  assert.equal((await mixto.consumir("global", "dia", 1)).permitido, false);
});

test("una búsqueda vacía no inventa ciudades", () => {
  assert.deepEqual(normalizarBusqueda([]), []);
  assert.equal(normalizarBusqueda({ location: { name: "Rosario" } }), null);
});
