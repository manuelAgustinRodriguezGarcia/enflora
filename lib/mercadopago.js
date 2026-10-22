import "server-only";
import { MercadoPagoConfig } from "mercadopago";

const PREFIJOS = [
  { texto: "TEST-", clave: "TEST" },
  { texto: "APP_USR-", clave: "APP_USR" },
];
const TIEMPO_ESPERA_MS = 5000;

function leerAccessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ?? "";

  if (!token) {
    return { ok: false, codigo: "falta_access_token" };
  }

  const prefijo = PREFIJOS.find((item) => token.startsWith(item.texto));

  if (!prefijo) {
    return { ok: false, codigo: "formato_no_reconocido" };
  }

  return { ok: true, token, prefijo: prefijo.clave };
}

export function obtenerClienteMercadoPago() {
  const lectura = leerAccessToken();

  if (!lectura.ok) {
    const error = new Error(lectura.codigo);
    error.codigo = lectura.codigo;
    throw error;
  }

  return new MercadoPagoConfig({
    accessToken: lectura.token,
    options: { timeout: TIEMPO_ESPERA_MS },
  });
}

export function diagnosticarMercadoPago() {
  const base = {
    sdkInicializado: false,
    accessTokenConfigurado: false,
    prefijo: null,
    credencialDePrueba: null,
    conexionRemotaVerificada: false,
  };

  const lectura = leerAccessToken();

  if (!lectura.ok) {
    return {
      ...base,
      ok: false,
      accessTokenConfigurado: lectura.codigo !== "falta_access_token",
      codigo: lectura.codigo,
    };
  }

  const credencialDePrueba = lectura.prefijo === "TEST" ? true : null;

  try {
    const cliente = obtenerClienteMercadoPago();
    const sdkInicializado = cliente instanceof MercadoPagoConfig;

    return {
      ...base,
      ok: sdkInicializado,
      sdkInicializado,
      accessTokenConfigurado: true,
      prefijo: lectura.prefijo,
      credencialDePrueba,
      codigo: sdkInicializado ? "sdk_inicializado" : "inicializacion_fallida",
    };
  } catch {
    return {
      ...base,
      ok: false,
      accessTokenConfigurado: true,
      prefijo: lectura.prefijo,
      credencialDePrueba,
      codigo: "inicializacion_fallida",
    };
  }
}
