"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { leerUbicacion } from "@/lib/clima/cargar";
import { mensajeClima } from "@/lib/clima/constantes";
import { buscarLocalidades, resolverLugar } from "@/lib/clima/servicio";
import { lugarPublico } from "@/lib/clima/texto";
import { esUuid, puedeAsociarUbicacion } from "@/lib/clima/validar";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";
import { almacenClima } from "@/lib/clima/almacen-servidor";

function fallo(codigo) {
  return { ok: false, codigo, mensaje: mensajeClima(codigo) };
}

async function sesion() {
  if (!configuracionLista()) return fallo("no_disponible");
  const supabase = await crearClienteServidor();
  const user = await obtenerSesionRapida();
  if (!user) redirect("/ingreso");
  return { ok: true, supabase, user };
}

async function espacioDelUsuario(supabase, espacioId, usuarioId) {
  if (!esUuid(espacioId)) return null;
  const { data, error } = await supabase
    .from("espacios")
    .select("id, nombre, tipo, usuario_id")
    .eq("id", espacioId)
    .maybeSingle();
  if (error || !data) return null;
  if (!puedeAsociarUbicacion({ usuarioId, duenoId: data.usuario_id, tipo: data.tipo })) return null;
  return data;
}

function refrescar(espacioId) {
  revalidatePath("/inicio");
  revalidatePath("/perfil");
  revalidatePath("/cultivos");
  if (!espacioId) return;
  revalidatePath(`/cultivos/${espacioId}`);
  revalidatePath(`/cultivos/${espacioId}/clima`);
}

export async function buscarLocalidadesClima(consulta) {
  const actual = await sesion();
  if (!actual.ok) return actual;
  const busqueda = await buscarLocalidades({
    consulta,
    usuarioId: actual.user.id,
    almacen: almacenClima(),
  });
  if (!busqueda.ok) return busqueda;
  return {
    ok: true,
    lugares: busqueda.lugares.map(lugarPublico),
    mensaje: busqueda.lugares.length ? "" : busqueda.mensaje || mensajeClima("sin_resultados"),
  };
}

export async function guardarLocalidadClima(espacioId, lugarId, consulta) {
  const actual = await sesion();
  if (!actual.ok) return actual;
  const espacio = await espacioDelUsuario(actual.supabase, espacioId, actual.user.id);
  if (!espacio) return fallo("espacio_invalido");

  const lugar = await resolverLugar({
    consulta,
    lugarId,
    usuarioId: actual.user.id,
    almacen: almacenClima(),
  });
  if (!lugar.ok) return lugar;

  const { error } = await actual.supabase.from("ubicaciones_clima").upsert(
    {
      espacio_id: espacio.id,
      usuario_id: actual.user.id,
      nombre: lugar.lugar.nombre,
      region: lugar.lugar.region || null,
      pais: lugar.lugar.pais || null,
      latitud: lugar.lugar.latitud,
      longitud: lugar.lugar.longitud,
      zona_horaria: null,
      proveedor: "weatherapi",
      proveedor_lugar_id: lugar.lugar.id,
    },
    { onConflict: "espacio_id" }
  );

  if (error) return fallo("no_disponible");
  refrescar(espacio.id);
  return { ok: true };
}

export async function guardarInteresClima(verClima) {
  const actual = await sesion();
  if (!actual.ok) return actual;
  if (typeof verClima !== "boolean") return fallo("consulta_invalida");

  const { error } = await actual.supabase.from("preferencias_clima").upsert(
    { usuario_id: actual.user.id, ver_clima: verClima },
    { onConflict: "usuario_id" }
  );
  if (error) return fallo("no_disponible");
  refrescar();
  return { ok: true, verClima };
}

export async function guardarLocalidadUsuario(lugarId, consulta) {
  const actual = await sesion();
  if (!actual.ok) return actual;

  const lugar = await resolverLugar({
    consulta,
    lugarId,
    usuarioId: actual.user.id,
    almacen: almacenClima(),
  });
  if (!lugar.ok) return lugar;

  const { error } = await actual.supabase.from("preferencias_clima").upsert(
    {
      usuario_id: actual.user.id,
      nombre: lugar.lugar.nombre,
      region: lugar.lugar.region || null,
      pais: lugar.lugar.pais || null,
      latitud: lugar.lugar.latitud,
      longitud: lugar.lugar.longitud,
      zona_horaria: null,
      proveedor: "weatherapi",
      proveedor_lugar_id: lugar.lugar.id,
    },
    { onConflict: "usuario_id" }
  );

  if (error) return fallo("no_disponible");
  refrescar();
  return { ok: true };
}

export async function quitarLocalidadUsuario() {
  const actual = await sesion();
  if (!actual.ok) return actual;

  const { error } = await actual.supabase
    .from("preferencias_clima")
    .update({
      nombre: null,
      region: null,
      pais: null,
      latitud: null,
      longitud: null,
      zona_horaria: null,
      proveedor: null,
      proveedor_lugar_id: null,
    })
    .eq("usuario_id", actual.user.id);

  if (error) return fallo("no_disponible");
  refrescar();
  return { ok: true };
}

export async function quitarLocalidadClima(formulario) {
  const actual = await sesion();
  if (!actual.ok) return actual;
  const espacioId = String(formulario.get("espacio_id") || "");
  const espacio = await espacioDelUsuario(actual.supabase, espacioId, actual.user.id);
  if (!espacio) return fallo("espacio_invalido");

  const previa = await leerUbicacion(actual.supabase, espacio.id, actual.user.id);
  if (previa.estado === "no_disponible") return fallo("no_disponible");

  const { error } = await actual.supabase.from("ubicaciones_clima").delete().eq("espacio_id", espacio.id);
  if (error) return fallo("no_disponible");
  refrescar(espacio.id);
  return { ok: true };
}
