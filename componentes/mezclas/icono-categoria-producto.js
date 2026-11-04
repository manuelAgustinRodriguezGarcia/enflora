import {
  Blend,
  Dna,
  FlaskConical,
  Leaf,
  Microscope,
  Package,
  Pipette,
  Scale,
  Shield,
  Shovel,
  Sparkles,
  Zap,
} from "lucide-react";

const ICONOS = {
  fertilizantes: FlaskConical,
  nutrientes: Leaf,
  estimulantes: Zap,
  ph: Pipette,
  potenciadores: Sparkles,
  correctores: Scale,
  microorganismos: Microscope,
  proteccion: Shield,
  enmiendas: Shovel,
  enzimas: Dna,
  aditivos: Blend,
  otro: Package,
};

export function IconoCategoriaProducto({ tono }) {
  const Icono = ICONOS[tono] || Package;
  return <Icono strokeWidth={1.75} aria-hidden="true" />;
}
