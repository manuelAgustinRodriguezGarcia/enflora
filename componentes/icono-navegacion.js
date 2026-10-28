import {
  Bell,
  ClipboardList,
  ClipboardPen,
  History,
  Sparkles,
  Sprout,
  UserRound,
  Warehouse,
} from "lucide-react";

// Iconos de navegación y secciones. Lucide, trazo 1.75, color heredado.
const ICONOS = {
  espacios: Warehouse,
  cultivos: Sprout,
  historial: History,
  registro: ClipboardPen,
  flora: Sparkles,
  perfil: UserRound,
  notificaciones: Bell,
  lista: ClipboardList,
};

export function IconoNavegacion({ clave }) {
  const Icono = ICONOS[clave];
  if (!Icono) return null;

  return <Icono className="icono-navegacion" strokeWidth={1.75} aria-hidden="true" />;
}
