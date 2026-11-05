"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerAdmin } from "@/lib/admin/autorizacion";
import {
  cambiarEstadoCampanaPartners,
  cambiarEstadoComercioPartners,
  crearCampanaPartners,
  crearComercioPartners,
  editarCampanaPartners,
  editarComercioPartners,
  gestionarSolicitudPartners,
} from "@/lib/admin/partners";
import {
  mensajePartners,
  validarAltaComercio,
  validarCampana,
  validarEdicionComercio,
  validarEstadoComercio,
  validarGestionSolicitud,
} from "@/lib/admin/partners-reglas";

async function credencial() {
  const autorizacion = await obtenerAdmin("partners");
  if (!autorizacion.ok) return null;
  return autorizacion.credencial;
}

function campos(formulario) {
  return Object.fromEntries([...formulario.keys()].map((clave) => [clave, String(formulario.get(clave) ?? "")]));
}

export async function guardarComercio(_previo, formulario) {
  const entrada = campos(formulario);
  const sesion = await credencial();
  if (!sesion) return { ok: false, error: "No tenés permiso para cambiar partners." };
  const validado = entrada.id ? validarEdicionComercio(entrada) : validarAltaComercio(entrada);
  if (!validado.ok) return { ok: false, error: validado.error };
  const resultado = entrada.id ? await editarComercioPartners(sesion, validado) : await crearComercioPartners(sesion, validado);
  if (!resultado.ok) return { ok: false, error: resultado.error || mensajePartners("error") };
  revalidatePath("/admin/partners");
  revalidatePath("/admin/partners/comercios");
  if (!entrada.id && resultado.id) redirect(`/admin/partners/comercios/${resultado.id}`);
  revalidatePath(`/admin/partners/comercios/${entrada.id}`);
  return { ok: true };
}

export async function cambiarEstadoComercio(_previo, formulario) {
  const entrada = campos(formulario);
  const sesion = await credencial();
  if (!sesion) return { ok: false, error: "No tenés permiso para cambiar partners." };
  const validado = validarEstadoComercio(entrada);
  if (!validado.ok) return { ok: false, error: validado.error };
  const resultado = await cambiarEstadoComercioPartners(sesion, validado);
  if (!resultado.ok) return { ok: false, error: resultado.error || mensajePartners("error") };
  revalidatePath("/admin/partners");
  revalidatePath(`/admin/partners/comercios/${validado.id}`);
  return { ok: true };
}

export async function guardarSolicitudPartners(_previo, formulario) {
  const entrada = { ...campos(formulario), nota: String(formulario.get("nota") ?? "") };
  const sesion = await credencial();
  if (!sesion) return { ok: false, error: "No tenés permiso para cambiar partners." };
  const validado = validarGestionSolicitud(entrada);
  if (!validado.ok) return { ok: false, error: validado.error };
  const resultado = await gestionarSolicitudPartners(sesion, validado);
  if (!resultado.ok) return { ok: false, error: resultado.error || mensajePartners("error") };
  revalidatePath("/admin/partners/solicitudes");
  revalidatePath(`/admin/partners/solicitudes/${validado.id}`);
  return { ok: true };
}

export async function guardarCampana(_previo, formulario) {
  const entrada = campos(formulario);
  const sesion = await credencial();
  if (!sesion) return { ok: false, error: "No tenés permiso para cambiar partners." };
  const validado = validarCampana({ ...entrada, comercio: entrada.comercio, ubicacion: "listado_cultivos" }, Boolean(entrada.id));
  if (!validado.ok) return { ok: false, error: validado.error };
  const resultado = entrada.id ? await editarCampanaPartners(sesion, validado) : await crearCampanaPartners(sesion, validado);
  if (!resultado.ok) return { ok: false, error: resultado.error || mensajePartners("error") };
  if (!entrada.id && resultado.estadoCampana && resultado.estadoCampana !== "borrador") {
    return { ok: false, error: "La campaña no quedó en borrador." };
  }
  revalidatePath("/admin/partners");
  revalidatePath("/admin/partners/campanas");
  if (!entrada.id && resultado.id) redirect(`/admin/partners/campanas/${resultado.id}`);
  revalidatePath(`/admin/partners/campanas/${entrada.id}`);
  return { ok: true };
}

export async function cambiarEstadoCampana(_previo, formulario) {
  const entrada = campos(formulario);
  const sesion = await credencial();
  if (!sesion) return { ok: false, error: "No tenés permiso para cambiar partners." };
  if (!entrada.id || !entrada.estado) return { ok: false, error: mensajePartners("consulta") };
  const resultado = await cambiarEstadoCampanaPartners(sesion, { id: entrada.id, estado: entrada.estado });
  if (!resultado.ok) return { ok: false, error: resultado.error || mensajePartners("error") };
  revalidatePath("/admin/partners");
  revalidatePath(`/admin/partners/campanas/${entrada.id}`);
  return { ok: true };
}
