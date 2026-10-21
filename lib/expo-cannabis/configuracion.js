export const EXPO_START = "2026-10-23T10:00:00-03:00";

export const EXPO_END = "2026-10-25T20:00:00-03:00";

export const ESTADOS_EXPO = {
  proximo: "proximo",
  enCurso: "enCurso",
  finalizado: "finalizado",
};

const NOMBRE = "Expo Cannabis 2026";
const PREDIO = "La Rural";
const CIUDAD = "Buenos Aires";
const SECTOR = "Pabellón Ocre y sector al aire libre";
const HORARIO = "10:00 a 20:00 h";

export const expoCannabis = {
  publicada: true,
  nombre: NOMBRE,
  inicio: EXPO_START,
  fin: EXPO_END,
  lugar: `${PREDIO}, ${CIUDAD}`,
  sector: SECTOR,
  horario: HORARIO,
  urlOficial: "https://expocannabis.com.ar/",
  urlInstagram: "https://www.instagram.com/enflora.420/",
  rutaJuego: "/expo-cannabis/ruleta-420",
  ids: {
    seccion: "expo-cannabis",
    premios: "expo-cannabis-premios",
    desafio: "expo-cannabis-desafio",
    donde: "expo-cannabis-donde",
  },
  pill: {
    visible: true,
    horasVisibleTrasFinalizar: 48,
    retraccionMobileMs: 6000,
    retrasoEntradaMs: 900,
  },
  assets: {
    hero: {
      src: "/images/flora-en-la-expo.png",
      alt: "Flora con gorro de ENFLORA cargando bolsas de regalos de Expo Cannabis 2026",
      width: 1024,
      height: 1536,
    },
    cierre: {
      src: "/images/flora-en-la-expo-2.png",
      alt: "Flora saludando desde las tribunas de La Rural, en Buenos Aires",
      width: 1086,
      height: 1448,
    },
  },
  regalos: [
    {
      id: "stickers",
      etiqueta: "REGALO · GRATIS",
      titulo: "Stickers",
      descripcion: "Diseños originales y coleccionables de Flora.",
      tono: "verde",
      ilustracion: "stickers",
      imagen: null,
    },
    {
      id: "filtros",
      etiqueta: "REGALO · GRATIS",
      titulo: "Filtros",
      descripcion: "Un detalle de ENFLORA para llevarte.",
      tono: "durazno",
      ilustracion: "filtros",
      imagen: null,
    },
    {
      id: "tuqueros",
      etiqueta: "PREMIO DEL JUEGO",
      titulo: "Tuqueros",
      descripcion: "Un premio para quienes completen el reto.",
      tono: "amarillo",
      ilustracion: "tuqueros",
      imagen: null,
    },
    {
      id: "picadores",
      etiqueta: "PREMIO ESPECIAL",
      titulo: "Picadores",
      descripcion: "¿Te animás a arriesgarlo todo por uno?",
      tono: "violeta",
      ilustracion: "picadores",
      imagen: null,
    },
  ],
  textos: {
    pill: {
      nombre: "EXPO CANNABIS",
      insignia: "EXPO",
      enCurso: "¡LA EXPO YA EMPEZÓ!",
      finalizado: "¡GRACIAS POR ACOMPAÑARNOS!",
      abrir: `Abrir información de ${NOMBRE}`,
    },
    modal: {
      proximo: {
        etiqueta: "¡YA FALTA POCO!",
        titulo: "Flora va a la Expo.",
        descripcion: "Regalos, desafíos y premios nos esperan del 23 al 25 de octubre.",
        cta: "Descubrir los regalos",
      },
      enCurso: {
        etiqueta: "¡ESTAMOS EN LA EXPO!",
        titulo: "Flora ya está en la Expo.",
        descripcion: "Regalos, desafíos y premios te esperan hasta el 25 de octubre.",
        estado: "¡LA EXPO YA EMPEZÓ!",
        cta: "Descubrir los regalos",
      },
      finalizado: {
        etiqueta: "¡GRACIAS POR ACOMPAÑARNOS!",
        titulo: "Flora volvió de la Expo.",
        descripcion: "Gracias por acompañarnos del 23 al 25 de octubre.",
        estado: "¡GRACIAS POR ACOMPAÑARNOS!",
        cta: "Ver lo que preparamos",
      },
      info: `${NOMBRE} — ${PREDIO}, ${CIUDAD}.`,
      cerrar: "Cerrar",
    },
    hero: {
      eyebrow: `23 — 25 octubre · ${PREDIO}, ${CIUDAD}`,
      titulo: {
        proximo: { antes: "¡FLORA SE VA A LA ", acento: "EXPO", despues: "!" },
        enCurso: { antes: "¡FLORA ESTÁ EN LA ", acento: "EXPO", despues: "!" },
        finalizado: { antes: "¡FLORA FUE A LA ", acento: "EXPO", despues: "!" },
      },
      descripcion: {
        proximo:
          "Y no va con las manos vacías. Nos encontramos en Expo Cannabis 2026 con regalos, sorpresas y un desafío para los que se animen a jugar.",
        enCurso:
          "Y no vino con las manos vacías. Ya estamos en Expo Cannabis 2026 con regalos, sorpresas y un desafío para los que se animen a jugar.",
        finalizado:
          "Gracias a todos los que se acercaron a Expo Cannabis 2026. Muy pronto vamos a compartir lo mejor de esos tres días.",
      },
      ctaPrincipal: "Ver los regalos",
      ctaSecundario: "¿Dónde es?",
      datos: [
        { id: "dias", valor: "03", etiqueta: "DÍAS", detalle: "de Expo" },
        { id: "sorpresas", valor: null, etiqueta: "SORPRESAS", detalle: "para descubrir" },
        { id: "vidas", valor: null, etiqueta: "VIDAS", detalle: "en el desafío" },
      ],
      chips: ["Stickers", "Premios", "Desafío 420"],
    },
    premios: {
      eyebrow: {
        proximo: "ALGO LINDO PARA LLEVARTE",
        enCurso: "ALGO LINDO PARA LLEVARTE",
        finalizado: "LO QUE PREPARAMOS",
      },
      titulo: {
        proximo: "No te vayas con las manos vacías.",
        enCurso: "No te vayas con las manos vacías.",
        finalizado: "Gracias por llevarte algo de Flora.",
      },
      descripcion: {
        proximo:
          "Preparamos pequeños regalos y premios especiales para que tu encuentro con Flora tenga recuerdo.",
        enCurso:
          "Preparamos pequeños regalos y premios especiales para que tu encuentro con Flora tenga recuerdo.",
        finalizado:
          "Estos fueron los regalos y premios que preparamos para que tu encuentro con Flora tuviera recuerdo.",
      },
      aclaracion: "Regalos y premios sujetos a disponibilidad durante el evento.",
    },
    desafio: {
      eyebrow: "EL DESAFÍO DE FLORA",
      titulo: "Dos vidas. Tres categorías. Una última decisión.",
      descripcion: {
        proximo:
          "Poné a prueba cuánto sabés. Al llegar al final, elegí: ¿te quedás con el tuquero o arriesgás todo por el picador?",
        enCurso:
          "Poné a prueba cuánto sabés. Al llegar al final, elegí: ¿te quedás con el tuquero o arriesgás todo por el picador?",
        finalizado:
          "El desafío de la Expo terminó, pero las preguntas siguen ahí. ¿Cuánto sabés del mundo 420?",
      },
      reglas: [
        "Empezás con {vidas} vidas.",
        "Necesitás {aciertos} respuestas correctas para superar el desafío.",
        "Cada respuesta incorrecta te resta una vida.",
        "Al final elegís: tuquero asegurado o arriesgarlo en la ruleta.",
        "La ruleta puede darte un picador, un tuquero o nada.",
      ],
      cta: "Conocer el desafío",
      etiquetaRuleta: "Ruleta ilustrativa con las tres categorías del desafío",
    },
    donde: {
      titulo: {
        proximo: "Dónde y cuándo",
        enCurso: "Dónde y cuándo",
        finalizado: "Dónde estuvimos",
      },
      items: [
        {
          id: "fecha",
          icono: "fecha",
          etiqueta: "FECHA",
          valor: "23, 24 y 25 de octubre",
          detalle: "Viernes, sábado y domingo de 2026.",
        },
        {
          id: "lugar",
          icono: "lugar",
          etiqueta: "LUGAR",
          valor: `${PREDIO} · ${CIUDAD}`,
          detalle: `${SECTOR}.`,
        },
        {
          id: "horario",
          icono: "horario",
          etiqueta: "HORARIO",
          valor: HORARIO,
          detalle: "Consultá entradas en el",
          enlace: "sitio oficial",
        },
      ],
    },
    cierre: {
      titulo: {
        proximo: "¿Nos vemos en la Expo?",
        enCurso: "¡Estamos en la Expo!",
        finalizado: "¡Gracias por acompañarnos!",
      },
      descripcion: {
        proximo: "Seguí a Flora para enterarte dónde encontrarnos y conocer las sorpresas.",
        enCurso: "Seguí a Flora para enterarte dónde encontrarnos y conocer las sorpresas.",
        finalizado: "Seguí a Flora para revivir la Expo y enterarte de lo que se viene.",
      },
      cta: "Seguinos en Instagram",
    },
  },
};
