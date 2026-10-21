export const VIDAS_INICIALES = 2;

export const ACIERTOS_PARA_GANAR = 3;

export const RONDAS_POSIBLES_ESPECIAL = [1, 2];

export const DURACION_GIRO_MS = 3600;

export const DURACION_GIRO_REDUCIDO_MS = 450;

export const PAUSA_RESULTADO_RULETA_MS = 1500;

export const VUELTAS_MINIMAS = 5;

export const IMAGENES_RULETA = {
  floraFumones: "",
  floraCultivo: "",
  floraPeliculas: "",
  floraBienvenida: "",
  floraFestejando: "",
  floraDerrotada: "",
  floraPremios: "",
  tricomas: "",
  picador: "",
  tuquera: "",
};

export const LOGO_ENFLORA = "/logos/enflora-logo-apaisado.svg";

export const ISOTIPO_ENFLORA = "/logos/enflora-isotipo-dark-green.svg";

export const CATEGORIAS = [
  {
    id: "fumones",
    nombre: "FUMONES ICÓNICOS",
    lineas: ["FUMONES", "ICÓNICOS"],
    color: "#0B3D2A",
    colorTexto: "#FDF1D7",
    imagen: "floraFumones",
    icono: "rapero",
    descripcionImagen: "Flora rapera",
  },
  {
    id: "cultivo",
    nombre: "CULTIVO 420",
    lineas: ["CULTIVO", "420"],
    color: "#A4C85B",
    colorTexto: "#0B3D2A",
    imagen: "floraCultivo",
    icono: "regando",
    descripcionImagen: "Flora regando",
  },
  {
    id: "peliculas",
    nombre: "PELÍCULAS FUMONAS",
    lineas: ["PELÍCULAS", "FUMONAS"],
    color: "#F0B4B4",
    colorTexto: "#0B3D2A",
    imagen: "floraPeliculas",
    icono: "pochoclos",
    descripcionImagen: "Flora con pochoclos",
  },
];

export const CATEGORIA_ESPECIAL = "cultivo";

export const PREMIOS = [
  {
    id: "picador",
    nombre: "PICADOR",
    lineas: ["PICADOR"],
    peso: 1,
    color: "#F0B4B4",
    colorTexto: "#0B3D2A",
    imagen: "picador",
    icono: "picador",
    descripcionImagen: "Picador",
  },
  {
    id: "tuquera",
    nombre: "TUQUERA",
    lineas: ["TUQUERA"],
    peso: 1,
    color: "#A4C85B",
    colorTexto: "#0B3D2A",
    imagen: "tuquera",
    icono: "tuquera",
    descripcionImagen: "Tuquera",
  },
  {
    id: "nada",
    nombre: "NADA",
    lineas: ["NADA"],
    peso: 1,
    color: "#FDF1D7",
    colorTexto: "#0B3D2A",
    imagen: "",
    icono: "nada",
    descripcionImagen: "Nada",
  },
];

export const PREMIO_ASEGURADO = "tuquera";

export const RESULTADOS_PREMIO = {
  asegurado: {
    titulo: "¡TUQUERA ASEGURADA!",
    descripcion: "¡TE LLEVÁS UNA TUQUERA!",
    secundario: "Jugaste a lo seguro y Flora lo respeta. ¡A disfrutarla!",
    imagen: "tuquera",
    icono: "tuquera",
    tono: "tuquera",
  },
  picador: {
    titulo: "¡PREMIO MAYOR!",
    descripcion: "¡TE GANASTE UN PICADOR!",
    secundario: "Flora no lo puede creer. ¡La suerte estuvo de tu lado!",
    imagen: "floraFestejando",
    icono: "festejo",
    tono: "picador",
  },
  tuquera: {
    titulo: "¡NO TE FUISTE CON LAS MANOS VACÍAS!",
    descripcion: "¡GANASTE UNA TUQUERA!",
    secundario: "Arriesgaste y sobreviviste. Algo es algo, ¿no?",
    imagen: "tuquera",
    icono: "tuquera",
    tono: "tuquera",
  },
  nada: {
    titulo: "¡NOOO, FLORA!",
    descripcion: "Esta vez la ruleta decidió que te vayas con las manos vacías.",
    secundario: "Por lo menos demostraste que sabés del mundo 420.",
    imagen: "floraDerrotada",
    icono: "nada",
    tono: "nada",
  },
};
