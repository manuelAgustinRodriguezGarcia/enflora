import {
  MercadoPagoError,
  MPAuthenticationError,
  MPConnectionError,
  MPForbiddenError,
  Preference,
} from "mercadopago";
import { obtenerClienteMercadoPago } from "@/lib/mercadopago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARTICULO_PRUEBA = {
  id: "enflora-prueba-integracion",
  title: "Enflora - Prueba de integración",
  quantity: 1,
  currency_id: "ARS",
  unit_price: 100,
};

function enDesarrollo() {
  return process.env.NODE_ENV === "development";
}

function noEncontrado() {
  return new Response(null, { status: 404 });
}

function metodoNoPermitido() {
  if (!enDesarrollo()) return noEncontrado();
  return new Response(null, { status: 405 });
}

export const GET = metodoNoPermitido;
export const PUT = metodoNoPermitido;
export const PATCH = metodoNoPermitido;
export const DELETE = metodoNoPermitido;
export const HEAD = metodoNoPermitido;
export const OPTIONS = metodoNoPermitido;

function json(body, status = 200) {
  return Response.json(body, { status });
}

function mapearError(error) {
  const codigo =
    error && typeof error === "object" && "codigo" in error ? error.codigo : null;

  if (codigo === "falta_access_token") {
    return {
      status: 503,
      codigo,
      mensaje: "Falta MERCADOPAGO_ACCESS_TOKEN en el entorno del servidor.",
    };
  }

  if (codigo === "formato_no_reconocido") {
    return {
      status: 503,
      codigo,
      mensaje:
        "El Access Token no tiene un prefijo reconocido. Checkout Pro usa APP_USR- y otras integraciones de prueba usan TEST-.",
    };
  }

  if (error instanceof MPAuthenticationError) {
    return {
      status: 401,
      codigo: "autenticacion",
      mensaje: "Mercado Pago rechazó el Access Token.",
    };
  }

  if (error instanceof MPForbiddenError) {
    return {
      status: 403,
      codigo: "permisos",
      mensaje: "Mercado Pago no permitió crear la preferencia con estas credenciales.",
    };
  }

  if (error instanceof MPConnectionError) {
    return {
      status: 503,
      codigo: "conexion",
      mensaje: "No se pudo conectar con Mercado Pago.",
    };
  }

  if (error instanceof MercadoPagoError) {
    return {
      status: 502,
      codigo: "respuesta",
      mensaje: "Mercado Pago rechazó la solicitud de preferencia.",
    };
  }

  return {
    status: 500,
    codigo: "inesperado",
    mensaje: "No se pudo crear la preferencia de prueba.",
  };
}

export async function POST() {
  if (!enDesarrollo()) return noEncontrado();

  if (process.env.MERCADOPAGO_PRUEBAS_CONFIRMADAS !== "true") {
    return json(
      {
        ok: false,
        conexionRemotaVerificada: false,
        preferenceId: null,
        mensaje:
          "Definí MERCADOPAGO_PRUEBAS_CONFIRMADAS=true en el entorno local después de comprobar que el Access Token proviene de la pestaña Pruebas. No copies esa variable a producción.",
      },
      403,
    );
  }

  try {
    const preference = new Preference(obtenerClienteMercadoPago());
    const creada = await preference.create({
      body: { items: [ARTICULO_PRUEBA] },
    });
    const preferenceId = typeof creada?.id === "string" ? creada.id : "";

    if (!preferenceId) {
      return json(
        {
          ok: false,
          conexionRemotaVerificada: false,
          preferenceId: null,
          mensaje:
            "Mercado Pago respondió sin un identificador de preferencia. No se inició un pago.",
        },
        502,
      );
    }

    return json({
      ok: true,
      conexionRemotaVerificada: true,
      preferenceId,
      mensaje:
        "Mercado Pago aceptó la preferencia de prueba. Una preferencia creada no significa que un pago haya sido aprobado.",
    });
  } catch (error) {
    const mapeado = mapearError(error);
    console.error(`[mercadopago] prueba-preferencia ${mapeado.codigo}`);
    return json(
      {
        ok: false,
        conexionRemotaVerificada: false,
        preferenceId: null,
        mensaje: mapeado.mensaje,
      },
      mapeado.status,
    );
  }
}
