export const PRECIO_PREMIUM = "Precio a definir";

export const navegacionLanding = [
  { id: "inicio", etiqueta: "Inicio" },
  { id: "para-que-sirve", etiqueta: "Para qué sirve" },
  { id: "flora", etiqueta: "Flora" },
  { id: "planes", etiqueta: "Planes" },
  { id: "contacto", etiqueta: "Contacto" },
];

export const navegacionFlotante = navegacionLanding.filter((item) => item.id !== "inicio");

export const textos = {
  hero: {
    marca: "TU CULTIVO, MÁS SIMPLE",
    titulo: ["Tu cultivo,", "bajo control"],
    bajada:
      "De la mano de Flora todo tu cultivo está bajo control. Toma las riendas de tus cultivos hoy mismo.",
    beneficios: [
      {
        icono: "hoja",
        titulo: "Mejorá tu producción",
        detalle: "Cultiva más y mejor.",
        rotacion: -4,
      },
      {
        icono: "planta",
        titulo: "Seguí cada planta",
        detalle: "Una planta, una historia.",
        rotacion: 3,
      },
      {
        icono: "registro",
        titulo: "Registrá cada etapa",
        detalle: "De semilla a cosecha.",
        rotacion: 3.5,
      },
      {
        icono: "corazon",
        titulo: "Flora te acompaña",
        detalle: "Tu cultivo controlado.",
        rotacion: -3,
      },
    ],
  },
  queEs: {
    antetitulo: "Tu cultivo organizado",
    titulo: "Todo tu cultivo, en un solo lugar.",
    bajada:
      "Mantené tu cultivo ordenado consiguiente mejores resultados, preguntale a Flora que sabe todo de tus cultivos y mostrales a tus amigos como van creciendo tus plantas.",
    tarjetas: [
      {
        id: "registros",
        titulo: "Registros",
        descripcion: "Tus registros son la mejor solución a tus problemas.",
        eyebrow: "Seguimiento",
        imagen: "/images/flora-landing-registros.png",
        alt: "Flora organizando su archivo botánico",
      },
      {
        id: "flora",
        titulo: "Flora",
        descripcion:
          "Tu asistente para acompañarte, guiarte y hacer el seguimiento más simple.",
        eyebrow: "Tu asistente",
        imagen: "/images/flora-en-la-ofi.png",
        alt: "Flora en la oficina de ENFLORA",
      },
      {
        id: "compartir",
        titulo: "Compartí tu progreso",
        descripcion:
          "Hace un seguimiento visual de las plantas y compartilo con tus amigos.",
        eyebrow: "Progreso",
        imagen: "/images/flora-landing-compartir.png",
        alt: "Flora fotografiando una planta más alta que ella",
      },
    ],
  },
  conEnflora: {
    antetitulo: "Descubrí ENFLORA",
    titulo: "Tus cultivos tienen mucho para contar",
    tituloLineas: ["Tus cultivos tienen", "mucho para contar"],
    ruedaTitulo: "Con ENFLORA",
    frases: [
      "Aprendés de tus plantas",
      "Descubrís cosas nuevas",
      "Registrás a diario",
      "Todo bajo control",
      "Entendés más",
      "Comparás cultivos",
      "Resolvés problemas",
      "Detectás cambios",
      "Seguís tu progreso",
      "Tomás mejores decisiones",
      "Aumentás tu producción"
    ],
  },
  beneficios: {
    titulo: "Más datos, más contexto, mejores decisiones.",
    items: [
      {
        nombre: "Registrá",
        texto: "Guardá información importante de cada planta.",
        tamano: "grande",
      },
      {
        nombre: "Organizá",
        texto: "Toda la información queda asociada al lugar y a la planta correctos.",
        tamano: "medio",
      },
      {
        nombre: "Compará",
        texto: "El historial permite mirar hacia atrás y entender diferencias.",
        tamano: "ancho",
      },
      {
        nombre: "Aprendé",
        texto: "Cada cultivo genera información que puede ayudarte en el próximo.",
        tamano: "medio",
      },
      {
        nombre: "Centralizá",
        texto: "Fotos, acciones, mediciones y notas en una misma herramienta.",
        tamano: "medio",
      },
      {
        nombre: "Decidí con más contexto",
        texto: "Más registros permiten entender mejor qué ocurrió.",
        tamano: "ancho",
      },
    ],
  },
  producto: {
    titulo: "Así se organiza un cultivo.",
    bajada: "Un recorrido por la estructura real de ENFLORA.",
  },
  flora: {
    titulo: "Conocé a Flora.",
    bajada:
      "Flora va a acompañarte mientras registrás, organizás y entendés mejor tu cultivo.",
    placeholder: "Placeholder · escena de Flora",
  },
  regalo: {
    eyebrow: "UN REGALO DE ENFLORA",
    titulo: "Este cultivo va por nuestra cuenta.",
    bajada: "Tenemos algo especial para vos. Rompé el ticket y descubrí tu beneficio.",
    exitoEyebrow: "¡LO CONSEGUISTE!",
    exitoTitulo: "Tu acceso especial a ENFLORA está listo.",
    exitoBajada:
      "Desbloqueaste un beneficio para registrar tus cultivos sin pagar, de por vida, dentro de los límites de este acceso especial.",
    beneficios: [
      "Acceso gratuito de por vida",
      "Hasta 15 plantas",
      "Funcionalidades esenciales de seguimiento",
      "Acceso limitado a herramientas de IA",
    ],
  },
  novedades: {
    titulo: "Novedades",
    bajada:
      "Vamos sumando mejoras al seguimiento y a la experiencia. Acá vas a enterarte de lo nuevo cuando esté listo para vos.",
  },
  historial: {
    titulo: "Lo que hoy registrás, mañana te ayuda a entender.",
    bajada: "Encontrá patrones. Compará lo que hiciste. Revisá cómo evolucionó.",
    eventos: [
      { fecha: "12 SEP", hecho: "Riego" },
      { fecha: "16 SEP", hecho: "Poda" },
      { fecha: "18 SEP", hecho: "pH 6.2" },
      { fecha: "21 SEP", hecho: "Foto" },
      { fecha: "25 SEP", hecho: "Cambio a Enflora" },
    ],
  },
  planes: {
    titulo: "Empezá gratis. Sumá capacidad cuando la necesites.",
    bajada: "Los límites todavía se están definiendo. Esta comparación es un primer esquema, fácil de ajustar.",
    gratis: {
      nombre: "Gratis",
      precio: "Sin costo",
      puntos: [
        "Seguimiento principal",
        "Cantidad limitada de plantas",
        "Límites de imágenes",
        "Funciones básicas",
      ],
    },
    premium: {
      nombre: "Premium",
      precio: PRECIO_PREMIUM,
      puntos: [
        "Más capacidad",
        "Más imágenes",
        "Funciones avanzadas",
        "Funciones de IA en desarrollo",
      ],
      nota: "Próximamente",
    },
  },
  instalacion: {
    titulo: "ENFLORA va con vos.",
    bajada:
      "Funciona como aplicación web. Podés tenerla en el celular, con acceso rápido, y tus datos disponibles desde el navegador o la app instalada.",
    aclaracion: "Todavía no está publicada en App Store ni en Google Play.",
  },
  contacto: {
    titulo: "Empezá cuando quieras.",
    bajada: "Creá tu cuenta gratis o ingresá si ya formás parte de ENFLORA.",
  },
  cierre: {
    titulo: ["Tu cultivo genera información.", "Hacé que te sirva."],
  },
};
