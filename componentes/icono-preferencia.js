import {
  AlertTriangle,
  Atom,
  Beaker,
  BrushCleaning,
  Camera,
  Cannabis,
  Droplet,
  Droplets,
  Dumbbell,
  FlaskConical,
  Gauge,
  LayoutGrid,
  Leaf,
  ListChecks,
  Pencil,
  Plus,
  Shovel,
  StickyNote,
  Thermometer,
  Zap,
} from "lucide-react";

// Iconos funcionales de acciones y parámetros. Lucide, trazo 1.75, color heredado.
const ICONOS = {
  riego: Droplets,
  poda: Leaf,
  defoliacion: Cannabis,
  trasplante: Shovel,
  entrenamiento: Dumbbell,
  limpieza: BrushCleaning,
  problema: AlertTriangle,
  foto: Camera,
  nota: StickyNote,
  tarea: ListChecks,
  fertilizacion: FlaskConical,
  ph: Beaker,
  ec: Zap,
  ppm: Atom,
  temperatura: Thermometer,
  humedad: Droplet,
  vpd: Gauge,
  personalizado: LayoutGrid,
  agregar: Plus,
  editar: Pencil,
};

export function IconoPreferencia({ clave }) {
  const Icono = ICONOS[clave];
  if (!Icono) return null;

  return <Icono className="icono-preferencia" strokeWidth={1.75} aria-hidden="true" />;
}
