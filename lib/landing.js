export const PRECIO_PREMIUM = "Precio a definir";

export const textos = {
  hero: {
    titulo: ["Entendé mejor", "cada cultivo."],
    bajada:
      "Registrá tus plantas, seguí su evolución y construí un historial que te ayude a entender qué pasó en cada etapa.",
  },
  problema: {
    titulo: "Cuando la información queda repartida, entender qué pasó se vuelve difícil.",
    bajada:
      "Una parte queda en la memoria, otra en una nota, otra en una foto o en un mensaje. Sin un lugar común, el cultivo se vuelve difícil de leer.",
    piezas: ["Nota", "Foto", "pH", "Riego", "Temperatura", "Fecha"],
  },
  caos: {
    titulo: "Del desorden a un registro que se puede leer.",
    fases: ["Desorden", "Registros", "Historial", "Información útil"],
    panel: "Planta 3 · Carpa 1",
  },
  queEs: {
    titulo: "Todo tu cultivo, en un solo lugar.",
    bajada:
      "ENFLORA ordena el seguimiento con la misma estructura de la aplicación: un espacio, sus unidades, las plantas y los registros de cada una.",
    pasos: [
      { nombre: "Espacio", ejemplo: "Cuartito del fondo" },
      { nombre: "Unidad", ejemplo: "Carpa 1" },
      { nombre: "Planta", ejemplo: "Planta 3" },
      { nombre: "Registros", ejemplo: "Historial" },
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
    bajada: "Un recorrido por la estructura real de ENFLORA. Es un ejemplo visual, no una sesión de la app.",
    pantallas: [
      {
        kicker: "Espacios",
        titulo: "Cuartito del fondo",
        detalle: "Interior",
        lineas: ["Carpa 1", "Estante de la ventana"],
      },
      {
        kicker: "Unidad",
        titulo: "Carpa 1",
        detalle: "Dentro del cuartito",
        lineas: ["Planta 1", "Planta 2", "Planta 3"],
      },
      {
        kicker: "Planta",
        titulo: "Planta 3",
        detalle: "Etapa vegetativo",
        lineas: ["Inicio registrado", "Seguimiento activo"],
      },
      {
        kicker: "Historial",
        titulo: "Lo que fue pasando",
        detalle: "Asociado a Planta 3",
        lineas: ["Riego", "Poda", "pH 6.2", "Foto"],
      },
    ],
  },
  flora: {
    titulo: "Conocé a Flora.",
    bajada:
      "Flora va a acompañarte mientras registrás, organizás y entendés mejor tu cultivo.",
    placeholder: "Placeholder · escena de Flora",
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
  cierre: {
    titulo: ["Tu cultivo genera información.", "Hacé que te sirva."],
  },
};
