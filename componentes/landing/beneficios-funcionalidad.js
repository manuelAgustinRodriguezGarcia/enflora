"use client";

import MagicBento from "@/componentes/landing/magic-bento";
import { IconoFuncionalidad } from "@/componentes/landing/iconos-funcionalidades";

export function BeneficiosFuncionalidad({ beneficios }) {
  const items = beneficios.map((beneficio) => {
    const sufijo =
      beneficio.estado === "proximamente"
        ? " (Próximamente)"
        : beneficio.estado === "pendiente"
          ? " (En definición)"
          : "";
    return {
      id: beneficio.id,
      icon: <IconoFuncionalidad nombre={beneficio.icono} size={16} />,
      title: beneficio.titulo,
      description: `${beneficio.descripcion}${sufijo}`,
    };
  });

  return (
    <div className="producto-beneficios">
      <MagicBento
        key={beneficios.map((b) => b.id).join("-")}
        items={items}
        columns={3}
        rowHeight={180}
        gap={12}
        radius={20}
        theme="light"
        glowColor="#A4C85B"
        enableBorderGlow
        enableSpotlight
        spotlightRadius={250}
        enableStars={false}
        enableTilt={false}
        enableMagnetism={false}
        clickEffect={false}
        intro
        textAutoHide={false}
      />
    </div>
  );
}
