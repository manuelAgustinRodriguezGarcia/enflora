"use client";

import { BeneficiosFlora } from "@/componentes/landing/beneficios-flora";
import { FichaFlora } from "@/componentes/landing/ficha-flora";
import { GaleriaFlora } from "@/componentes/landing/galeria-flora";
import { PerfilSocialFlora } from "@/componentes/landing/perfil-social-flora";
import { PlaylistFlora } from "@/componentes/landing/playlist-flora";
import { PresentacionFlora } from "@/componentes/landing/presentacion-flora";
import { floraLanding } from "@/lib/flora-landing";

export function SeccionConoceFlora() {
  const datos = floraLanding;

  return (
    <section
      className="flora"
      id="flora"
      data-logo="dark"
      aria-labelledby="flora-titulo"
    >
      <div className="flora__contenedor">
        <div className="flora__bloque flora__bloque--presentacion">
          <div className="flora__intro">
            <PresentacionFlora
              titulo={datos.titulo}
              tituloDestacado={datos.tituloDestacado}
              descripcion={datos.descripcion}
            />
          </div>
          <div className="flora__lateral">
            <FichaFlora
              ficha={datos.ficha}
              protagonista={datos.protagonista}
            />
          </div>
          <BeneficiosFlora beneficios={datos.beneficios} />
        </div>
        <div className="flora__bloque flora__bloque--galeria">
          <PerfilSocialFlora instagram={datos.instagram} />
          <PlaylistFlora playlist={datos.playlist} />
          <GaleriaFlora galeria={datos.galeria} />
        </div>
      </div>
    </section>
  );
}
