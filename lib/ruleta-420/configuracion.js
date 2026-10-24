import { PESOS_RULETA_FINAL } from "@/lib/ruleta-420/premios";

export const VIDAS_INICIALES = 3;

export const ACIERTOS_PARA_GANAR = 3;

export const RONDAS_POSIBLES_ESPECIAL = [3];

export const DURACION_GIRO_MS = 3600;

export const DURACION_GIRO_REDUCIDO_MS = 450;

export const PAUSA_RESULTADO_RULETA_MS = 1500;

export const VUELTAS_MINIMAS = 5;

export const IMAGENES_RULETA = {
  floraFumones: "/images/flora-snoop.png",
  floraCultivo: "/images/flora-cultivo420.png",
  floraPeliculas: "/images/flora-pelis.png",
  floraBienvenida: "/images/flora-ruleta.png",
  floraFestejando: "",
  floraDerrotada: "/images/flora-perdio.png",
  floraPremios: "",
  floraArriesga: "/images/flora-arriesga.png",
  tricomas: "",
  picador: "/images/premios/enflora_picadores_web_1280.webp",
  tuquera: "/images/premios/enflora_tuqueros_web_1280.webp",
  stickers: "/images/premios/enflora_stickers_web_1280.webp",
  filtros: "/images/premios/enflora_filtros_web_1280.webp",
};

export const LOGO_ENFLORA = "/logos/enflora-logo-apaisado.svg";

export const ISOTIPO_ENFLORA = "/logos/enflora-isotipo-dark-green.svg";

export const CATEGORIAS = [
  {
    id: "fumones",
    nombre: "Fumones Icónicos",
    lineas: ["FUMONES", "ICÓNICOS"],
    color: "#D4AF37",
    colorTexto: "#0B3D2A",
    imagen: "floraFumones",
    icono: "rapero",
    descripcionImagen: "Flora rapera",
  },
  {
    id: "cultivo",
    nombre: "Cultivo 420",
    lineas: ["CULTIVO", "420"],
    color: "#0B3D2A",
    colorTexto: "#F3E6C8",
    imagen: "floraCultivo",
    icono: "regando",
    descripcionImagen: "Flora regando",
  },
  {
    id: "peliculas",
    nombre: "Películas Fumonas",
    lineas: ["PELÍCULAS", "FUMONAS"],
    color: "#1C1C1C",
    colorTexto: "#D4AF37",
    imagen: "floraPeliculas",
    icono: "pochoclos",
    descripcionImagen: "Flora con pochoclos",
  },
];

export const CATEGORIA_ESPECIAL = "cultivo";

export const PREMIOS = [
  {
    id: "GRINDER",
    nombre: "PICADOR",
    lineas: ["PICADOR"],
    peso: PESOS_RULETA_FINAL.GRINDER,
    color: "#F0B4B4",
    colorTexto: "#0B3D2A",
    imagen: "picador",
    icono: "picador",
    descripcionImagen: "Picador",
  },
  {
    id: "TUBE",
    nombre: "TUQUERO",
    lineas: ["TUQUERO"],
    peso: PESOS_RULETA_FINAL.TUBE,
    color: "#A4C85B",
    colorTexto: "#0B3D2A",
    imagen: "tuquera",
    icono: "tuquera",
    descripcionImagen: "Tuquero",
  },
  {
    id: "BONUS_PACK",
    nombre: "3 STICKERS A ELECCIÓN - 3 FILTROS",
    lineas: ["3 STICKERS", "3 FILTROS"],
    peso: PESOS_RULETA_FINAL.BONUS_PACK,
    color: "#0B3D2A",
    colorTexto: "#FDF1D7",
    imagen: "",
    imagenes: ["stickers", "filtros"],
    icono: "premios",
    descripcionImagen: "Pack especial",
  },
  {
    id: "CONSOLATION",
    nombre: "-1 STICKER Y -1 FILTRO",
    lineas: [],
    peso: PESOS_RULETA_FINAL.CONSOLATION,
    color: "#FDF1D7",
    colorTexto: "#0B3D2A",
    imagen: "",
    icono: "nada",
    descripcionImagen: "Nada",
  },
];

export const PREMIO_ASEGURADO = "SAFE_PACK";

export const RESULTADOS_PREMIO = {
  SAFE_PACK: {
    titulo: "¡YA TENÉS TU PREMIO!",
    descripcion: "Te llevás 2 stickers a elección y 2 filtros de Enflora.",
    secundario: "Jugaste a lo seguro y Flora lo respeta.",
    imagen: "floraFestejando",
    icono: "premios",
    tono: "tuquera",
  },
  GRINDER: {
    titulo: "¡TE LLEVÁS UN PICADOR!",
    descripcion: "1 PICADOR",
    secundario: "Flora no lo puede creer. ¡La suerte estuvo de tu lado!",
    imagen: "picador",
    icono: "picador",
    tono: "picador",
  },
  TUBE: {
    titulo: "¡TE LLEVÁS UN TUQUERO!",
    descripcion: "1 TUQUERO",
    secundario: "Arriesgaste y la ruleta te dejó un tuquero.",
    imagen: "tuquera",
    icono: "tuquera",
    tono: "tuquera",
  },
  BONUS_PACK: {
    titulo: "¡3 STICKERS Y 3 FILTROS!",
    descripcion: "3 STICKERS A ELECCIÓN - 3 FILTROS",
    secundario: "Te llevás 3 stickers a elección y 3 filtros.",
    imagen: "floraFestejando",
    icono: "premios",
    tono: "picador",
  },
  CONSOLATION: {
    titulo: "¡PERDISTE 1 STICKER Y 1 FILTRO!",
    descripcion: "1 STICKER + 1 FILTRO",
    secundario: "Del premio seguro te queda 1 sticker a elección y 1 filtro.",
    imagen: "floraDerrotada",
    icono: "derrota",
    tono: "nada",
  },
};
