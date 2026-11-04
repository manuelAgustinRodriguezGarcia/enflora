import assert from "node:assert/strict";
import test from "node:test";
import { CODIGOS_CLIMA, ICONO_RESPALDO, iconoClima, iconoPronostico } from "../lib/clima/iconos.js";
import { ICONOS_METEOCONS, svgMeteocons } from "../lib/clima/meteocons-flat.js";
import { climaGuardadoValido, normalizarPronostico } from "../lib/clima/normalizar.js";
import { momentoClima, rangoTemperatura, temaClima } from "../lib/clima/tema.js";

function canal(hex, indice) {
  const valor = Number.parseInt(hex.slice(1 + indice * 2, 3 + indice * 2), 16) / 255;
  return valor <= 0.03928 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
}

function contraste(fondo, tinta) {
  const luminancia = (hex) => {
    const [rojo, verde, azul] = [0, 1, 2].map((indice) => canal(hex, indice));
    return 0.2126 * rojo + 0.7152 * verde + 0.0722 * azul;
  };
  const [clara, oscura] = [luminancia(fondo), luminancia(tinta)].sort((a, b) => b - a);
  return (clara + 0.05) / (oscura + 0.05);
}

function cuerpo(actual = {}, dia = {}) {
  return {
    location: {
      name: "Rosario",
      region: "Santa Fe",
      country: "Argentina",
      lat: -32.95,
      lon: -60.64,
      tz_id: "America/Argentina/Cordoba",
    },
    current: {
      last_updated: "2026-11-03 21:15",
      temp_c: 22,
      feelslike_c: 21,
      humidity: 40,
      condition: { text: "Despejado", code: 1000 },
      is_day: 1,
      wind_kph: 10,
      precip_mm: 0,
      ...actual,
    },
    forecast: {
      forecastday: [
        {
          date: "2026-11-03",
          day: {
            maxtemp_c: 24,
            mintemp_c: 14,
            daily_chance_of_rain: 20,
            totalprecip_mm: 3,
            maxwind_kph: 18,
            condition: { text: "Lluvia moderada", code: 1189 },
            ...dia,
          },
        },
      ],
    },
    alerts: { alert: [] },
  };
}

test("los rangos visuales cubren los bordes sin usar el reloj del navegador", () => {
  assert.equal(rangoTemperatura(9.9), "hielo");
  assert.equal(rangoTemperatura(10), "fresco");
  assert.equal(rangoTemperatura(17.9), "fresco");
  assert.equal(rangoTemperatura(18), "templado");
  assert.equal(rangoTemperatura(25.9), "templado");
  assert.equal(rangoTemperatura(26), "calido");
  assert.equal(rangoTemperatura(32), "calido");
  assert.equal(rangoTemperatura(32.1), "intenso");
  assert.equal(rangoTemperatura(-40), "hielo");
  assert.equal(rangoTemperatura(Number.NaN), "neutro");
  assert.equal(rangoTemperatura(Number.POSITIVE_INFINITY), "neutro");
  assert.equal(rangoTemperatura(null), "neutro");
  assert.equal(momentoClima(true), "dia");
  assert.equal(momentoClima(false), "noche");
  assert.equal(momentoClima(null), "indeterminado");
  assert.equal(momentoClima(1), "indeterminado");
  assert.equal(momentoClima(0), "indeterminado");
  assert.equal(momentoClima("0"), "indeterminado");
});

test("el tema sale de la temperatura, is_day y el código, con paleta legible", () => {
  const dia = temaClima({ temperaturaC: 22, esDia: true, codigo: 1003 });
  assert.equal(dia.rango, "templado");
  assert.equal(dia.momento, "dia");
  assert.equal(dia.icono, "partly-cloudy-day");
  assert.equal(dia.paleta.tinta, "#0B3D2A");
  assert.equal(dia.paleta.acento, "#A4C85B");

  const noche = temaClima({ temperaturaC: 4, esDia: false, codigo: 1000 });
  assert.equal(noche.rango, "hielo");
  assert.equal(noche.momento, "noche");
  assert.equal(noche.icono, "clear-night");
  assert.equal(noche.paleta.fondo, "#10243A");
  assert.notEqual(noche.paleta.fondoFin, temaClima({ temperaturaC: 36, esDia: false, codigo: 1000 }).paleta.fondoFin);

  const incompleto = temaClima({ temperaturaC: null, esDia: null, codigo: "Soleado" });
  assert.equal(incompleto.rango, "neutro");
  assert.equal(incompleto.momento, "indeterminado");
  assert.equal(incompleto.icono, ICONO_RESPALDO);
  assert.equal(incompleto.paleta.fondo, "#F5F8EF");

  for (const esDia of [true, false]) {
    for (const temperaturaC of [0, 14, 22, 29, 40, null]) {
      const tema = temaClima({ temperaturaC, esDia, codigo: 1000 });
      assert.ok(contraste(tema.paleta.fondo, tema.paleta.tinta) >= 4.5);
      assert.ok(contraste(tema.paleta.fondoFin, tema.paleta.tinta) >= 4.5);
      assert.ok(contraste(tema.paleta.fondo, tema.paleta.tintaSuave) >= 4.5);
      assert.ok(contraste(tema.paleta.fondoFin, tema.paleta.tintaSuave) >= 4.5);
    }
  }
});

test("el mapa de iconos usa el código y tiene respaldo de día y de noche", () => {
  assert.equal(iconoClima(1000, "dia"), "clear-day");
  assert.equal(iconoClima(1000, "noche"), "clear-night");
  assert.equal(iconoClima(1000, "indeterminado"), "clear-day");
  assert.equal(iconoClima(1189, "noche"), "rain");
  assert.equal(iconoClima(1273, "noche"), "thunderstorms-night-rain");
  assert.equal(iconoPronostico(1000), "clear-day");
  assert.equal(iconoClima("Soleado", "dia"), ICONO_RESPALDO);
  assert.equal(iconoClima(1000.5, "dia"), ICONO_RESPALDO);
  assert.equal(iconoClima(9999, "noche"), ICONO_RESPALDO);
  assert.equal(iconoClima(null, "dia"), ICONO_RESPALDO);

  for (const codigo of CODIGOS_CLIMA) {
    for (const momento of ["dia", "noche"]) {
      const nombre = iconoClima(codigo, momento);
      assert.equal(typeof ICONOS_METEOCONS[nombre], "string", `${codigo} ${momento}`);
    }
  }
});

test("el svg estático quita la animación y aísla los ids", () => {
  const animado = svgMeteocons("rain");
  const quieto = svgMeteocons("rain", { estatico: true, prefijo: "fila" });
  assert.match(animado, /<animate/);
  assert.equal(quieto.includes("<animate"), false);
  assert.match(quieto, /aria-hidden="true"/);
  const parcial = svgMeteocons("partly-cloudy-day", { prefijo: "hero" });
  assert.match(parcial, /id="hero-clip0_2045_39567"/);
  assert.match(parcial, /url\(#hero-clip0_2045_39567\)/);
  assert.equal(parcial.includes("url(#clip0_2045_39567)"), false);
  assert.match(svgMeteocons("no-existe"), /not-available/);
});

test("la normalización conserva is_day y el código sin inventarlos", () => {
  const noche = normalizarPronostico(cuerpo({ is_day: 0, condition: { text: "Cielo claro", code: 1000 } }), {
    latitud: -32.95,
    longitud: -60.64,
    incluirAlertas: true,
  });
  assert.equal(noche.actual.esDia, false);
  assert.equal(noche.actual.codigo, 1000);
  assert.equal(noche.actual.condicion, "Cielo claro");
  assert.equal(noche.dias[0].codigo, 1189);
  assert.equal(temaClima(noche.actual).icono, "clear-night");
  assert.equal(iconoPronostico(noche.dias[0].codigo), "rain");

  const cuerpoSinMarca = cuerpo();
  delete cuerpoSinMarca.current.is_day;
  cuerpoSinMarca.current.condition = { text: "Despejado" };
  const incompleto = normalizarPronostico(cuerpoSinMarca, {
    latitud: -32.95,
    longitud: -60.64,
    incluirAlertas: true,
  });
  assert.equal(incompleto.actual.esDia, null);
  assert.equal(incompleto.actual.codigo, null);
  assert.equal(temaClima(incompleto.actual).momento, "indeterminado");
  assert.equal(temaClima(incompleto.actual).icono, ICONO_RESPALDO);

  const textoComoCodigo = cuerpo();
  textoComoCodigo.current.is_day = "0";
  textoComoCodigo.current.condition = { text: "Noche despejada", code: "1000" };
  const rechazado = normalizarPronostico(textoComoCodigo, {
    latitud: -32.95,
    longitud: -60.64,
    incluirAlertas: true,
  });
  assert.equal(rechazado.actual.esDia, null);
  assert.equal(rechazado.actual.codigo, null);

  assert.ok(climaGuardadoValido(incompleto));
  assert.equal(climaGuardadoValido({ ...incompleto, actual: { ...incompleto.actual, codigo: "1000" } }), null);
  assert.equal(climaGuardadoValido({ ...incompleto, actual: { ...incompleto.actual, esDia: 0 } }), null);
});
