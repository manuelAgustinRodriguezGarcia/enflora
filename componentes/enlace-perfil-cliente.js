"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import { cargarEncabezadoPerfil } from "@/app/perfil/acciones-encabezado";
import { AvatarUsuario } from "@/componentes/avatar-usuario";
import { esRutaApp } from "@/lib/navegacion";

const AVATAR_VACIO = { url: "", expira: 0 };

let pedidoEncabezado = null;

function pedirEncabezado() {
  if (!pedidoEncabezado) {
    pedidoEncabezado = cargarEncabezadoPerfil()
      .catch(() => null)
      .then((datos) => {
        if (!datos) pedidoEncabezado = null;
        return datos;
      });
  }
  return pedidoEncabezado;
}

export function EnlacePerfilCliente({
  inicial = "",
  avatar = AVATAR_VACIO,
  resuelto = false,
  consultar = false,
}) {
  const rutaRouter = usePathname() || "";
  const [rutaNavegador, setRutaNavegador] = useState("");
  const firma = `${resuelto ? 1 : 0}|${inicial}|${avatar?.url || ""}|${avatar?.expira || 0}`;
  const [firmaVista, setFirmaVista] = useState(firma);
  const [vista, setVista] = useState({
    inicial,
    avatar: avatar?.url ? avatar : AVATAR_VACIO,
    resuelto,
  });

  if (firmaVista !== firma) {
    setFirmaVista(firma);
    setVista({
      inicial,
      avatar: avatar?.url ? avatar : AVATAR_VACIO,
      resuelto,
    });
  }

  // El layout raíz no se vuelve a renderizar al cambiar de ruta. Si usePathname
  // no coincide con la URL real, igual mostramos el botón con la ruta del navegador.
  useEffect(() => {
    if (esRutaApp(rutaRouter)) return undefined;
    const actual = window.location.pathname || "";
    if (!esRutaApp(actual)) return undefined;
    setRutaNavegador((previo) => (previo === actual ? previo : actual));
    return undefined;
  }, [rutaRouter]);

  const ruta = esRutaApp(rutaRouter) ? rutaRouter : rutaNavegador;

  useEffect(() => {
    if (!consultar || vista.resuelto || !esRutaApp(ruta)) return undefined;
    let vivo = true;
    pedirEncabezado().then((datos) => {
      if (!vivo || !datos) return;
      setVista({
        inicial: datos.inicial || "",
        avatar: datos.avatar?.url ? datos.avatar : AVATAR_VACIO,
        resuelto: true,
      });
    });
    return () => {
      vivo = false;
    };
  }, [consultar, ruta, vista.resuelto]);

  if (!esRutaApp(ruta)) return null;

  const activo = ruta === "/perfil" || ruta.startsWith("/perfil/");
  const letra = String(vista.inicial || "").trim().slice(0, 1).toUpperCase();
  const foto = vista.avatar?.url ? vista.avatar : AVATAR_VACIO;

  return (
    <Link
      href="/perfil"
      className={`encabezado__perfil${activo ? " encabezado__perfil--activo" : ""}`}
      aria-label="Perfil"
      aria-current={activo ? "page" : undefined}
    >
      <AvatarUsuario url={foto.url || ""} expira={foto.expira || 0} alt="">
        {letra ? (
          <span aria-hidden="true">{letra}</span>
        ) : (
          <UserRound size={18} strokeWidth={1.75} aria-hidden="true" />
        )}
      </AvatarUsuario>
    </Link>
  );
}
