"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bot,
  HardDrive,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";

const ICONOS = {
  dashboard: LayoutDashboard,
  usuarios: Users,
  planes: Wallet,
  flora_ia: Bot,
  almacenamiento: HardDrive,
  notificaciones: Bell,
  partners: Megaphone,
  expo: Ticket,
  auditoria: ScrollText,
};

function activa(ruta, seccion) {
  if (!ruta || !seccion?.href) return false;
  if (seccion.exacto) return ruta === seccion.href;
  return ruta === seccion.href || ruta.startsWith(`${seccion.href}/`);
}

export function NavegacionAdmin({ secciones, onNavegar }) {
  const ruta = usePathname() || "";

  return (
    <nav className="admin-nav" aria-label="Módulos administrativos">
      <ul className="admin-nav__lista">
        {secciones.map((seccion) => {
          const Icono = ICONOS[seccion.id];
          const actual = activa(ruta, seccion);
          return (
            <li key={seccion.id}>
              <Link
                href={seccion.href}
                className="admin-nav__enlace"
                aria-current={actual ? "page" : undefined}
                prefetch={false}
                onClick={onNavegar}
              >
                {Icono ? <Icono size={18} strokeWidth={2.2} aria-hidden="true" /> : null}
                <span>{seccion.titulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
