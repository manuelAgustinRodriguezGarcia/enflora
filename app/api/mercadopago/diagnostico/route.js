import { diagnosticarMercadoPago } from "@/lib/mercadopago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MENSAJES = {
  falta_access_token:
    "Falta MERCADOPAGO_ACCESS_TOKEN en el entorno del servidor.",
  formato_no_reconocido:
    "El Access Token no tiene un prefijo reconocido. Checkout Pro usa APP_USR- y otras integraciones de prueba usan TEST-.",
  inicializacion_fallida: "No se pudo inicializar el SDK en el servidor.",
  sdk_inicializado_test:
    "El SDK se inicializó en el servidor con un Access Token de prefijo TEST-. Mercado Pago no fue consultado: esto no confirma que la credencial sea válida.",
  sdk_inicializado_app_usr:
    "El SDK se inicializó en el servidor. Checkout Pro usa el prefijo APP_USR- tanto en la pestaña Pruebas como en Producción. Mercado Pago no fue consultado: este resultado no distingue de qué pestaña salió el token ni confirma que sea válido.",
};

function mensajeDe(estado) {
  if (estado.codigo === "sdk_inicializado" && estado.prefijo === "APP_USR") {
    return MENSAJES.sdk_inicializado_app_usr;
  }
  if (estado.codigo === "sdk_inicializado") {
    return MENSAJES.sdk_inicializado_test;
  }
  return MENSAJES[estado.codigo] ?? MENSAJES.inicializacion_fallida;
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  const estado = diagnosticarMercadoPago();

  return Response.json({
    ok: estado.ok,
    sdkInicializado: estado.sdkInicializado,
    accessTokenConfigurado: estado.accessTokenConfigurado,
    prefijo: estado.prefijo,
    credencialDePrueba: estado.credencialDePrueba,
    conexionRemotaVerificada: false,
    mensaje: mensajeDe(estado),
  });
}
