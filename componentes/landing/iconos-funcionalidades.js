import {
  Boxes,
  ClipboardList,
  Droplets,
  GitCommitHorizontal,
  GitFork,
  History,
  Images,
  Leaf,
  Network,
  Scissors,
  SlidersHorizontal,
  Sprout,
  Tag,
} from "lucide-react";

const mapa = {
  sprout: Sprout,
  "clipboard-list": ClipboardList,
  "git-fork": GitFork,
  boxes: Boxes,
  tag: Tag,
  "git-commit-horizontal": GitCommitHorizontal,
  droplets: Droplets,
  images: Images,
  "sliders-horizontal": SlidersHorizontal,
  history: History,
  scissors: Scissors,
  network: Network,
  leaf: Leaf,
};

export function IconoFuncionalidad({ nombre, size = 18, strokeWidth = 1.85, className }) {
  const Icono = mapa[nombre] || Leaf;
  return <Icono size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}
