"use server";

import { redirect } from "next/navigation";
import { clientePagos } from "@/lib/pagos/datos";
import {
  cancelarSuscripcionPlus,
  iniciarCheckoutPlus,
  reconciliarSuscripcionPlus,
  resolverSuscripcionIdRetornoPlus,
} from "@/lib/pagos/plus/gestion-servidor";
import { obtenerUsuario } from "@/lib/supabase/servidor";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ERRORES = new Set([
  "plus_ya_activo",
  "suscripcion_en_curso",
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
  "plus_produccion_desactivado",
  "sin_servicio",
  "comprador_invalido",
  "comprador_prueba_invalido",
  "importe_incoherente",
  "importe_invalido",
  "persistencia_fallida",
  "checkout_ausente",
  "mp_no_disponible",
  "suscripcion_ausente",
  "mp_cancel_fallido",
  "retorno_ambiguo",
]);

function volver(codigo) {
  redirect(`/pagos/plus?error=${ERRORES.has(codigo) ? codigo : "checkout"}`);
}

export async function iniciarSuscripcionPlus() {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/ingreso?siguiente=/pagos/plus");

  const supabase = clientePagos();
  if (!supabase) volver("sin_servicio");

  let resultado;
  try {
    resultado = await iniciarCheckoutPlus({
      supabase,
      usuarioId: usuario.id,
      emailUsuario: usuario.email || "",
    });
  } catch {
    volver("checkout");
  }

  if (!resultado?.ok) volver(resultado.codigo || "checkout");
  if (!resultado.initPoint) volver("checkout_ausente");

  redirect(resultado.initPoint);
}

export async function cancelarPlus(formulario) {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/ingreso?siguiente=/pagos/plus");

  const suscripcionId = String(formulario.get("suscripcionId") || "");
  if (!UUID.test(suscripcionId)) volver("suscripcion_ausente");

  const supabase = clientePagos();
  if (!supabase) volver("sin_servicio");

  const resultado = await cancelarSuscripcionPlus({
    supabase,
    suscripcionId,
    usuarioId: usuario.id,
  });
  if (!resultado.ok) volver(resultado.codigo || "mp_cancel_fallido");
  redirect("/pagos/plus?cancelada=1");
}

export async function reconciliarPlusRetorno(suscripcionIdParam) {
  const usuario = await obtenerUsuario();
  if (!usuario) return { ok: false, codigo: "sin_sesion" };

  const supabase = clientePagos();
  if (!supabase) return { ok: false, codigo: "sin_servicio" };

  const resuelta = await resolverSuscripcionIdRetornoPlus({
    supabase,
    usuarioId: usuario.id,
    suscripcionIdParam,
  });
  if (!resuelta.ok) return resuelta;

  return reconciliarSuscripcionPlus({
    supabase,
    suscripcionId: resuelta.suscripcionId,
    usuarioId: usuario.id,
  });
}
