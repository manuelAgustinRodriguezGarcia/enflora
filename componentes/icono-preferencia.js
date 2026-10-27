import {
  Atom,
  Beaker,
  Camera,
  Droplet,
  Droplets,
  FlaskConical,
  Gauge,
  LayoutGrid,
  ListChecks,
  Pencil,
  Plus,
  Scissors,
  StickyNote,
  Thermometer,
  Zap,
} from "lucide-react";

// Iconos funcionales de acciones y parámetros. Lucide, trazo 1.75, color heredado.
const ICONOS = {
  riego: Droplets,
  foto: Camera,
  nota: StickyNote,
  tarea: ListChecks,
  poda: Scissors,
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
