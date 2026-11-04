import "server-only";

import { createClient } from "@supabase/supabase-js";
import { crearAlmacenCompuesto, almacenCompartido } from "@/lib/clima/almacen";

function ausente(error) {
  const texto = `${error?.message || ""} ${error?.code || ""} ${error?.details || ""}`;
  return ["42P01", "PGRST205", "PGRST202", "42883"].includes(error?.code) || /clima_cache|clima_consumo|consumir_clima|devolver_clima/i.test(texto);
}

function clienteServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function crearAlmacenRemoto(cliente) {
  if (!cliente) return null;
  return {
    async leer(clave, ahora) {
      const { data, error } = await cliente
        .from("clima_cache")
        .select("cuerpo, obtenido_en, vence_en")
        .eq("clave", clave)
        .maybeSingle();
      if (error) return ausente(error) ? { ausente: true } : null;
      if (!data?.cuerpo) return null;
      const venceEn = new Date(data.vence_en).getTime();
      if (!Number.isFinite(venceEn) || venceEn <= ahora) return null;
      return {
        cuerpo: data.cuerpo,
        obtenidoEn: new Date(data.obtenido_en).getTime(),
        venceEn,
      };
    },
    async guardar(clave, cuerpo, obtenidoEn, venceEn) {
      const { error } = await cliente.from("clima_cache").upsert({
        clave,
        cuerpo,
        obtenido_en: new Date(obtenidoEn).toISOString(),
        vence_en: new Date(venceEn).toISOString(),
      });
      if (error && ausente(error)) return { ausente: true };
      if (error) throw error;
      return { ok: true };
    },
    async leerConsumo(alcance, ventana) {
      const { data, error } = await cliente
        .from("clima_consumo")
        .select("consultas")
        .eq("alcance", alcance)
        .eq("ventana", ventana)
        .maybeSingle();
      if (error) return ausente(error) ? { ausente: true } : 0;
      return Number(data?.consultas) || 0;
    },
    async consumir(alcance, ventana, limite) {
      const { data, error } = await cliente.rpc("consumir_clima", {
        p_alcance: alcance,
        p_ventana: ventana,
        p_limite: limite,
      });
      if (error) return ausente(error) ? { ausente: true } : { permitido: false };
      return { permitido: data === true };
    },
    async devolver(alcance, ventana) {
      const { error } = await cliente.rpc("devolver_clima", {
        p_alcance: alcance,
        p_ventana: ventana,
      });
      if (error && ausente(error)) return { ausente: true };
      if (error) throw error;
      return { ok: true };
    },
  };
}

export function almacenClima() {
  return crearAlmacenCompuesto(almacenCompartido(), crearAlmacenRemoto(clienteServicio()));
}
