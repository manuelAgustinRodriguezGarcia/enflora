"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import { AvatarUsuario } from "@/componentes/avatar-usuario";
import { esRutaApp } from "@/lib/navegacion";

export function EnlacePerfilCliente({ inicial = "", avatar = { url: "", expira: 0 } }) {
  const ruta = usePathname();
  if (!esRutaApp(ruta)) return null;

  const activo = ruta === "/perfil" || ruta.startsWith("/perfil/");
  const letra = inicial.trim().slice(0, 1).toUpperCase();

  return (
    <Link
      href="/perfil"
      className={`encabezado__perfil${activo ? " encabezado__perfil--activo" : ""}`}
      aria-label="Perfil"
      aria-current={activo ? "page" : undefined}
    >
      <AvatarUsuario url={avatar.url || ""} expira={avatar.expira || 0} alt="">
        {letra ? (
          <span aria-hidden="true">{letra}</span>
        ) : (
          <UserRound size={18} strokeWidth={1.75} aria-hidden="true" />
        )}
      </AvatarUsuario>
    </Link>
  );
}
