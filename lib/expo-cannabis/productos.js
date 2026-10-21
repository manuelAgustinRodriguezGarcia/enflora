function fotoPremio(archivo, alt) {
  return { src: `/images/premios/${archivo}`, alt };
}

export const productosExpo = [
  {
    slug: "stickers",
    nombre: "Stickers",
    ilustracion: "stickers",
    imagen: fotoPremio("enflora_stickers_web_1280.webp", "Stickers de Flora"),
  },
  {
    slug: "filtros",
    nombre: "Filtros",
    ilustracion: "filtros",
    imagen: fotoPremio("enflora_filtros_web_1280.webp", "Filtros de ENFLORA"),
  },
  {
    slug: "folletos",
    nombre: "Folletos",
    ilustracion: "folletos",
    imagen: fotoPremio("enflora_folletos_web_1280.webp", "Folletos de ENFLORA"),
  },
  {
    slug: "tuqueros",
    nombre: "Tuqueros",
    ilustracion: "tuqueros",
    imagen: fotoPremio("enflora_tuqueros_web_1280.webp", "Tuqueros de ENFLORA"),
  },
  {
    slug: "picadores",
    nombre: "Picadores",
    ilustracion: "picadores",
    imagen: fotoPremio("enflora_picadores_web_1280.webp", "Picadores de ENFLORA"),
  },
];

const DELTAS_ENTREGA = [-1, 1, 2, 3];
const PREMIOS_DE_A_UNO = new Set(["tuqueros", "picadores"]);

export function productoExpo(slug) {
  return productosExpo.find((producto) => producto.slug === slug) ?? null;
}

export function deltasEntregaExpo(slug) {
  if (PREMIOS_DE_A_UNO.has(slug)) return [-1, 1];
  return DELTAS_ENTREGA;
}
