import {
  Cog,
  Droplets,
  Gift,
  HeartCrack,
  Leaf,
  MicVocal,
  Microscope,
  PartyPopper,
  Popcorn,
  Sparkles,
  Trophy,
  Wind,
} from "lucide-react";

export const ICONOS_RULETA = {
  rapero: MicVocal,
  regando: Droplets,
  pochoclos: Popcorn,
  picador: Cog,
  tuquera: Leaf,
  nada: Wind,
  festejo: PartyPopper,
  derrota: HeartCrack,
  bienvenida: Sparkles,
  premios: Gift,
  trofeo: Trophy,
  tricomas: Microscope,
};

export function IconoRuleta({ nombre, ...props }) {
  const Icono = ICONOS_RULETA[nombre] ?? Sparkles;
  return <Icono aria-hidden="true" {...props} />;
}
