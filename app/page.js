import { redirect } from "next/navigation";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { obtenerUsuario } from "@/lib/supabase/servidor";

export default async function PaginaInicio({ searchParams }) {
  const parametros = await searchParams;
  const codigo = typeof parametros?.code === "string" ? parametros.code : "";
  const token = typeof parametros?.token_hash === "string" ? parametros.token_hash : "";

  if (codigo || token) {
    const consulta = new URLSearchParams();
    if (codigo) consulta.set("code", codigo);
    if (token) consulta.set("token_hash", token);
    if (typeof parametros.type === "string") consulta.set("type", parametros.type);
    redirect(`/correo/confirmar?${consulta.toString()}`);
  }

  if (!configuracionLista()) {
    return (
      <section className="auth">
        <h1>Enflorar</h1>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const usuario = await obtenerUsuario();
  redirect(usuario ? "/espacios" : "/entrar");
}
