"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const CLASES = ["landing-cuerpo", "ruleta-cuerpo", "expo-admin-cuerpo", "admin-cuerpo"];

function claseDeRuta(ruta) {
  if (ruta === "/") return "landing-cuerpo";
  if (ruta === "/admin" || ruta.startsWith("/admin/")) return "admin-cuerpo";
  if (ruta === "/expo-cannabis/admin") return "expo-admin-cuerpo";
  if (ruta.startsWith("/expo-cannabis/")) return "ruleta-cuerpo";
  return "";
}

export function ClaseCuerpo() {
  const ruta = usePathname() || "";

  useEffect(() => {
    const clase = claseDeRuta(ruta);
    for (const item of CLASES) {
      document.body.classList.toggle(item, item === clase);
    }
  }, [ruta]);

  return null;
}
