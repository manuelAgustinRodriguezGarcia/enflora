"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import { esRutaApp } from "@/lib/navegacion";

export function EnlacePerfilCliente({ inicial = "" }) {
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
      {letra ? (
        <span aria-hidden="true">{letra}</span>
      ) : (
        <UserRound size={18} strokeWidth={1.75} aria-hidden="true" />
      )}
    </Link>
  );
}
