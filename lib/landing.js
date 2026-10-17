export const PRECIO_PREMIUM = "Precio a definir";

export const navegacionLanding = [
  { id: "inicio", etiqueta: "Inicio" },
  { id: "para-que-sirve", etiqueta: "Descubrí" },
  { id: "flora", etiqueta: "Flora" },
  { id: "precios", etiqueta: "Planes" },
  { id: "instalar", etiqueta: "Descargar" },
  { id: "partners", etiqueta: "Partners" },
  { id: "contacto", etiqueta: "Contacto" },
  { id: "lanzamiento", etiqueta: "1/11", acento: true },
];

export const navegacionFlotante = navegacionLanding.filter((item) => item.id !== "inicio");

export const textos = {
  hero: {
    marca: "TU CULTIVO, MÁS SIMPLE",
    titulo: ["Tu cultivo,", "bajo control"],
    bajada:
      "Dejá tu cultivo en manos de Flora todo estará bajo control. Tomá las riendas de tus cultivos hoy mismo.",
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
    tituloPrefijo: "¿Por qué cultivar con",
    tituloMarca: "ENFLORA?",
    bajada:
      "Porque registrar lo que pasa hoy te ayuda a entender mejor tu cultivo mañana.",
    tarjetas: [
      {
        id: "registrar",
        numero: "01",
        titulo: "Registrás a diario",
        tituloLineas: ["Registrás", "a diario"],
        descripcion:
          "Guardás fotos, mediciones y todo lo que pasa con tus plantas.",
        ilustracion: {
          src: "/images/flora-landing-registra.png",
          alt: "Flora fotografiando una planta para registrar el cultivo",
          aspectRatio: "1 / 1",
          objectFit: "contain",
          placeholder: {
            tono: "verde",
            etiqueta: "Ilustración 01 — Flora registrando",
            icono: "libreta",
          },
        },
      },
      {
        id: "resolver",
        numero: "02",
        titulo: "Resolvés problemas",
        tituloLineas: ["Resolvés", "problemas"],
        descripcion:
          "Si algo cambia, el historial te da contexto para actuar.",
        ilustracion: {
          src: "/images/flora-landing-idea.png",
          alt: "Flora con una idea y un bloc de notas",
          aspectRatio: "1 / 1",
          objectFit: "contain",
          placeholder: {
            tono: "rosa",
            etiqueta: "Ilustración 02 — Flora investigando",
            icono: "lupa",
          },
        },
      },
      {
        id: "conocer",
        numero: "03",
        titulo: "Flora conoce tus cultivos",
        tituloLineas: ["Flora conoce", "tus cultivos"],
        descripcion:
          "Con tus registros, Flora va entendiendo mejor tu cultivo.",
        ilustracion: {
          src: "/images/flora-landing-conoce.png",
          alt: "Flora revisando fichas de plantas en el celular",
          aspectRatio: "1 / 1",
          objectFit: "contain",
          placeholder: {
            tono: "rosa",
            etiqueta: "Ilustración 03 — Flora y tus plantas",
            icono: "fichas",
          },
        },
      },
      {
        id: "mejorar",
        numero: "04",
        titulo: "Mejorás tu producción",
        tituloLineas: ["Mejorás tu", "producción"],
        descripcion:
          "Más orden y mejores decisiones para cultivar con control.",
        ilustracion: {
          src: "/images/flora-landing-produccion.png",
          alt: "Flora rodeada de brotes celebrando una buena producción",
          aspectRatio: "1 / 1",
          objectFit: "contain",
          placeholder: {
            tono: "verde",
            etiqueta: "Ilustración 04 — Flora y el progreso",
            icono: "progreso",
          },
        },
      },
    ],
  },
  conEnflora: {
    antetitulo: "Descubrí ENFLORA",
    titulo: "Tus cultivos tienen mucho para contar",
    tituloLineas: ["Tus cultivos tienen", "mucho para contar"],
    ruedaTitulo: "Con ENFLORA",
    frases: [
      "Todo bajo control",
      "Comparás cultivos",
      "Resolvés problemas",
      "Aprendés de tus plantas",
      "Aumentás tu producción",
      "Tomás mejores decisiones"
    ],
  },
  producto: {
    titulo: "Todas nuestras funcionalidades",
    bajada: "",
  },
  flora: {
    titulo: "Conocé a Flora",
  },
  regalo: {
    eyebrow: "UN REGALO DE ENFLORA",
    titulo: "Este cultivo va por nuestra cuenta.",
    bajada: "Tenemos algo especial para vos. Rompé el ticket y descubrí tu beneficio.",
    pistaTitulo: "Ya tenés tu entrada?",
    pistaBajada: "Hablá con Flora que seguro te consigue...",
    exitoEyebrow: "ACCESO APROBADO",
    exitoTitulo: "¡Estás en la lista VIP de Flora!",
    exitoBajada:
      "Pasaste el control de seguridad. Flora te dio el visto bueno para entrar.",
    beneficios: [
      "Acceso al plan gratuito de ENFLORA.",
      "Tu propio espacio de cultivo.",
      "Registros, parámetros e historial.",
      "Pase personal aprobado por Flora.",
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
    titulo: "Enflora va con vos.",
    bajada:
      "Podés usarla desde la PC y también desde tu celular. Instalá la app web y tené tus cultivos siempre a mano.",
    botonAndroid: "Descarga Android",
    botonApple: "Descarga Apple",
    nota: "Sin Google Play ni App Store, descargá la app web.",
  },
  contacto: {
    titulo: "¿Charlamos?",
    bajada:
      "Si tenés alguna duda, idea de mejora, feedback o simplemente querés charlar, escribime y te leo.",
  },
  lanzamiento: {
    titulo: "Lanzamiento 1/11",
    faltan: "Faltan solo",
    cinta: "LANZAMIENTO - 1/11 -",
    disponible: "¡ENFLORA ya está disponible!",
    descripcionAccesible:
      "Cuenta regresiva hasta el lanzamiento de ENFLORA el 1 de noviembre de 2026.",
  },
  cierre: {
    titulo: ["Tu cultivo genera información.", "Hacé que te sirva."],
  },
};
