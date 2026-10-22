export const floraLanding = {
  titulo: "Conocé a",
  tituloDestacado: "Flora",
  descripcion:
    "Holis, soy Flora, asistente de Enflora y estoy acá para acompañarte mientras organizás, registrás y conocés mejor tus cultivos. Trabajo mejor si me das más información sobre tus plantas, y mi misión es ayudarte a que coseches más y mejor.",
  protagonista: {
    src: "/images/flora-en-la-ofi.png",
    alt: "Flora, la cara de ENFLORA, con el pulgar arriba",
    width: 720,
    height: 900,
  },
  ficha: {
    nombre: "Flora Tricoma",
    rol: "EMPLEADA DE",
    logo: {
      src: "/logos/enflora-logo-apaisado.svg",
      alt: "ENFLORA",
      width: 120,
      height: 36,
    },
    campos: [
      { etiqueta: "N°ID", valor: "#000420" },
      {
        etiqueta: "Puesto",
        valor: "Asistente",
        valorCorto: "Asistente",
      },
      { etiqueta: "Cumpleaños", etiquetaCorta: "Cumple", valor: "20 de abril" },
    ],
  },
  instagram: {
    usuario: "@enflora420",
    cta: "Seguinos en Instagram!",
    ctaEscritorio: [
      "Enterate de novedades, eventos, lanzamientos",
      "o mandanos un mensajito en nuestro Instagram.",
    ],
    href: "https://www.instagram.com/enflora420/?hl=es-la",
    avatar: {
      src: "/images/flora-landingl-selfie.png",
      alt: "Foto de perfil de Flora Tricoma",
    },
  },
  beneficios: {
    items: [
      {
        id: "registrar",
        titulo: "Te ayuda a registrar",
        descripcion:
          "Te acompaña para organizar mediciones y acciones, escribiendo la historia de tus plantas.",
        icono: "clipboard",
        tono: "verde",
      },
      {
        id: "entender",
        titulo: "Te ayuda a entender",
        descripcion:
          "Flora analiza todo lo que vos registrás: mientras más registros tengas, más te va a entender.",
        icono: "sparkles",
        tono: "lima",
      },
      {
        id: "aprender",
        titulo: "Te acompaña mientras aprendés",
        descripcion:
          "Flora va aprendiendo junto a vos, para mejorar con cada cultivo.",
        icono: "sprout",
        tono: "rosa",
      },
    ],
  },
  galeria: {
    titulo: "Galería de Flora",
    bajada: "Las mejores fotos de Flora.",
    items: [
      {
        id: "registros",
        src: "/images/flora-landing-registros.png",
        alt: "Flora organizando registros en carpetas",
        caption: "#Laburando",
        width: 800,
        height: 1000,
      },
      {
        id: "plantas",
        src: "/images/flora-landing-compartir.png",
        alt: "Flora junto a una planta en el cultivo",
        caption: "#ConLasPlantas",
        width: 800,
        height: 1000,
      },
      {
        id: "gaucha",
        src: "/images/flora-gaucha.png",
        alt: "Flora gaucha enfrentando a un insecto en el campo",
        caption: "#FacaContraLaPlaga",
        width: 800,
        height: 1000,
      },
      {
        id: "expo",
        src: "/images/flora-en-la-expo.png",
        alt: "Flora con gorro de ENFLORA cargando bolsas de regalos en Expo Cannabis 2026",
        caption: "#FloraEnLaExpo",
        width: 1024,
        height: 1536,
      },
      {
        id: "tribuna",
        src: "/images/flora-en-la-expo-2.png",
        alt: "Flora asomada a las tribunas de La Rural, en Buenos Aires",
        caption: "#DesdeLaTribuna",
        width: 1086,
        height: 1448,
      },
      {
        id: "congreso",
        src: "/images/flora-contra-25-congreso.png",
        alt: "Flora enfrentando a un cogollo prensado frente al Congreso de la Nación",
        caption: "#NoCompramosConEl25",
        width: 1161,
        height: 1355,
      },
    ],
  },
};
