import {
  Bell,
  Blender,
  CalendarDays,
  ClipboardList,
  ClipboardPen,
  Ellipsis,
  Flower2,
  History,
  Images,
  House,
  PackageOpen,
  Sparkles,
  Sprout,
  UserRound,
  Warehouse,
} from "lucide-react";

// Iconos de navegación y secciones. Lucide, trazo 1.75, color heredado.
const ICONOS = {
  espacios: Warehouse,
  inicio: House,
  cultivos: Sprout,
  calendario: CalendarDays,
  historial: History,
  registro: ClipboardPen,
  flora: Sparkles,
  perfil: UserRound,
  mas: Ellipsis,
  productos: PackageOpen,
  mezclas: Blender,
  geneticas: Flower2,
  galeria: Images,
  notificaciones: Bell,
  lista: ClipboardList,
};

export function IconoNavegacion({ clave }) {
  const Icono = ICONOS[clave];
  if (!Icono) return null;

  return <Icono className="icono-navegacion" strokeWidth={1.75} aria-hidden="true" />;
}
