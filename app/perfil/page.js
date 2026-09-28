import { redirect } from "next/navigation";
import { FormularioPerfil } from "@/componentes/formulario-perfil";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export default async function PaginaPerfil() {
  if (!configuracionLista()) {
    return <p>Falta la configuración de Supabase.</p>;
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar");
  }

  const { data: perfil, error } = await supabase
    .from("perfiles")
    .select("nombre, apellido, telefono, nombre_usuario, cambios_nombre_usuario")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return <p>No se pudo cargar el perfil.</p>;
  }

  return (
    <section className="auth">
      <h1>Perfil</h1>
      <FormularioPerfil perfil={perfil} email={user.email || ""} />
    </section>
  );
}
