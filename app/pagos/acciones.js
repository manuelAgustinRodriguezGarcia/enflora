"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor, obtenerUsuario } from "@/lib/supabase/servidor";
import { autorizarCompraPiloto, correoPayerOrden, leerAmbientePagos } from "@/lib/pagos/ambiente";
import { clientePagos } from "@/lib/pagos/datos";
import { centavosADecimal, escala4ADecimal, importeLicenciaCentavos } from "@/lib/pagos/dinero";
import { obtenerCotizacionBilleteVendedor } from "@/lib/pagos/cotizacion-bna";
import { crearOrdenLicencia, obtenerOrden } from "@/lib/pagos/orden";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ERRORES = new Set([
  "cultivo_ajeno",
  "licencia_activa",
  "nombre",
  "ciclo_finalizado",
  "pago_en_curso",
  "cotizacion_no_disponible",
  "cotizacion_invalida",
  "cotizacion_antigua",
  "ambiente_prueba_requerido",
  "pruebas_no_confirmadas",
  "cobros_reales_bloqueados",
  "cobros_reales_desactivados",
  "piloto_no_autorizado",
  "ambiente_no_declarado",
  "ambiente_contradictorio",
  "sin_servicio",
  "checkout_ausente",
  "comprador_prueba_invalido",
  "orden",
]);

function volver(codigo) {
  redirect(`/pagos/licencia?error=${ERRORES.has(codigo) ? codigo : "orden"}`);
}

function esRedireccion(error) {
  return typeof error?.digest === "string" && error.digest.startsWith("NEXT_REDIRECT");
}

export async function finalizarCiclo(formulario) {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/ingreso?siguiente=/pagos/licencia");

  const cicloId = String(formulario.get("cicloId") || "");
  if (!UUID.test(cicloId)) volver("cultivo_ajeno");

  const supabase = await crearClienteServidor();
  const resultado = await supabase.rpc("finalizar_ciclo_cultivo", { p_ciclo: cicloId });
  if (resultado.error || !resultado.data?.ok) volver(resultado.data?.codigo || "sin_servicio");
  redirect("/pagos/licencia");
}

export async function iniciarCompra(formulario) {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/ingreso?siguiente=/pagos/licencia");

  const destino = String(formulario.get("destino") || "");
  const unidadId = String(formulario.get("unidadId") || "");
  const nombre = String(formulario.get("nombreCiclo") || "").trim();
  const cicloExistente = UUID.test(destino);
  if (!cicloExistente && destino !== "nuevo") volver("cultivo_ajeno");
  if (!cicloExistente && (!UUID.test(unidadId) || nombre.length < 1 || nombre.length > 80)) {
    volver("nombre");
  }

  const ambiente = leerAmbientePagos();
  if (!ambiente.ok) volver(ambiente.codigo);

  const piloto = autorizarCompraPiloto(usuario.id);
  if (!piloto.ok) volver(piloto.codigo);

  const supabaseLectura = await crearClienteServidor();
  const { data: perfil } = await supabaseLectura
    .from("perfiles")
    .select("nombre, apellido")
    .eq("id", usuario.id)
    .maybeSingle();

  const comprador = correoPayerOrden({
    ambiente: ambiente.ambiente,
    emailUsuario: usuario.email || "",
  });
  if (comprador.codigo) volver(comprador.codigo);

  const cotizacion = await obtenerCotizacionBilleteVendedor();
  if (!cotizacion.ok) volver(cotizacion.codigo);

  const centavos = importeLicenciaCentavos(cotizacion.cotizacion.venta);
  const importe = centavosADecimal(centavos);
  const supabase = clientePagos();
  if (!supabase) volver("sin_servicio");

  const reserva = await supabase.rpc("reservar_pago_cultivo", {
    p_usuario: usuario.id,
    p_ciclo: cicloExistente ? destino : null,
    p_unidad: cicloExistente ? null : unidadId,
    p_nombre: cicloExistente ? null : nombre,
    p_ambiente: ambiente.ambiente,
    p_importe: importe,
    p_cotizacion: escala4ADecimal(cotizacion.cotizacion.venta),
    p_fuente: cotizacion.cotizacion.fuente,
    p_publicada: cotizacion.cotizacion.publicadaEn,
  });

  if (reserva.error || !reserva.data?.ok) volver(reserva.data?.codigo || "sin_servicio");

  const pago = reserva.data.pago;
  const importeOrden = Number(pago.importe_ars);
  if (!Number.isFinite(importeOrden) || importeOrden <= 0) volver("orden");
  let destinoCheckout = pago.checkout_url || "";

  try {
    if (!destinoCheckout && pago.order_id) {
      const existente = await obtenerOrden(pago.order_id);
      destinoCheckout = existente?.checkout_url || "";
    }

    if (!destinoCheckout) {
      const creada = await crearOrdenLicencia({
        pagoId: pago.id,
        importeDecimal: importeOrden,
        email: comprador.email,
        nombre: perfil?.nombre,
        apellido: perfil?.apellido,
        fechaRegistro: usuario.created_at,
      });
      destinoCheckout = creada?.checkout_url || "";
      if (!destinoCheckout || !creada?.id) volver("checkout_ausente");
      const guardado = await supabase.rpc("guardar_checkout_pago", {
        p_pago_id: pago.id,
        p_usuario: usuario.id,
        p_order_id: creada.id,
        p_checkout_url: destinoCheckout,
        p_vendedor: creada.user_id ? String(creada.user_id) : "",
      });
      if (guardado.error || !guardado.data?.ok) volver("orden");
    } else if (pago.order_id && destinoCheckout !== pago.checkout_url) {
      await supabase.rpc("guardar_checkout_pago", {
        p_pago_id: pago.id,
        p_usuario: usuario.id,
        p_order_id: pago.order_id,
        p_checkout_url: destinoCheckout,
        p_vendedor: pago.vendedor_mp || "",
      });
    }
  } catch (error) {
    if (esRedireccion(error)) throw error;
    console.error("[mercadopago] orden_no_creada");
    volver("orden");
  }

  redirect(destinoCheckout);
}
