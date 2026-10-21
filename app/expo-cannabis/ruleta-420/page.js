import { ProveedorMotion } from "@/componentes/proveedor-motion";
import { JuegoRuleta } from "@/componentes/ruleta-420/juego-ruleta";

export const metadata = {
  title: "La Ruleta 420 de Flora",
  description: "3 categorías. 2 vidas. 1 oportunidad de ganar. Demostrá cuánto sabés del mundo 420 y llevate un premio de ENFLORA.",
  robots: { index: false, follow: false },
};

export default function PaginaRuleta420() {
  return (
    <ProveedorMotion>
      <JuegoRuleta />
    </ProveedorMotion>
  );
}
