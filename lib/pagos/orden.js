import "server-only";
import { Order } from "mercadopago";
import { obtenerClienteMercadoPago } from "../mercadopago.js";
import { leerAmbientePagos, leerRecepcionPagos } from "./ambiente.js";
import { claveIdempotenciaOrden, cuerpoOrdenLicencia } from "./cuerpo-orden.js";

export { claveIdempotenciaOrden, cuerpoOrdenLicencia };

function opciones(ambiente, idempotencyKey) {
  const pedido = { testToken: ambiente === "prueba" };
  if (idempotencyKey) pedido.idempotencyKey = idempotencyKey;
  return pedido;
}

function clienteOrden(lectura = false) {
  const ambiente = lectura ? leerRecepcionPagos() : leerAmbientePagos();
  if (!ambiente.ok) {
    const error = new Error(ambiente.codigo);
    error.codigo = ambiente.codigo;
    throw error;
  }
  return {
    ambiente: ambiente.ambiente,
    orden: new Order(obtenerClienteMercadoPago()),
  };
}

export async function crearOrdenLicencia({ pagoId, importeDecimal, email }) {
  const { ambiente, orden } = clienteOrden();
  return orden.create({
    body: cuerpoOrdenLicencia({ pagoId, importeDecimal, email }),
    requestOptions: opciones(ambiente, claveIdempotenciaOrden(pagoId, email)),
  });
}

export async function obtenerOrden(id) {
  const { ambiente, orden } = clienteOrden(true);
  return orden.get({
    id,
    requestOptions: opciones(ambiente, undefined),
  });
}
