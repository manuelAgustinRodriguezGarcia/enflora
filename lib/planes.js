export const planesEnflora = {
  eyebrow: "PLANES ENFLORA",
  titulo: "Elegí tu mejor plan",
  leyendaArs:
    "Referencia en ARS según dólar oficial (API pública, actualización a las 4:20 y 16:20 ART). El importe final se confirmará antes del pago.",
  hrefRegistro: "/registro",
  items: [
    {
      id: "gratuito",
      variante: "gratis",
      titulo: "Gratuito",
      precioUsd: 0,
      precioEtiqueta: "US$ 0",
      periodicidad: null,
      modalidad: "Gratis para siempre",
      frase: "Para empezar.",
      beneficios: [
        "Hasta 9 plantas por cultivo",
        "Registros diarios",
        "Límite de fotos por cultivo",
        "Memoria IA Flora limitada",
        "Estadísticas básicas",
      ],
      cta: "Empezar gratis",
      ctaVariante: "secundario",
      mostrarArs: false,
      destacado: false,
    },
    {
      id: "plus",
      variante: "plus",
      badge: "RECOMENDADO",
      titulo: "PLAN 420",
      precioUsd: 4.2,
      precioEtiqueta: "US$ 4,20",
      periodicidad: "AL MES",
      frase: "La sugerencia de Flora para tu cultivo.",
      beneficios: [
        "Plantas ilimitadas",
        "Sugerencias de Flora en cada cultivo",
        "Parámetros y registros personalizados en cada cultivo",
        "Recordatorios de eventos y tareas",
        "IA Flora con capacidad ilimitada",
        "Avisos meteorológicos para cultivos de exterior",
        "Historial y galería de fotos",
        "Esquejes y ADN cannábico",
        "Acceso a todas las funcionalidades",
      ],
      cta: "Quiero el PLAN 420",
      ctaVariante: "principal",
      ctaSecundario: "¿Que compro con 4,20 dólares hoy?",
      mostrarArs: true,
      destacado: true,
    },
    {
      id: "por-cultivo",
      variante: "cultivo",
      titulo: "Por cultivo",
      precioUsd: 30,
      precioEtiqueta: "US$ 30",
      periodicidad: null,
      modalidad: "Pago único",
      modalidadExtra: "Sin vencimiento",
      frase: "Pensado para cultivos más extensos.",
      beneficios: [
        "Todos los beneficios del PLAN 420",
        "No se puede reutilizar para varios cultivos",
        "Historial y galería de fotos",
        "Sin límite de plantas",
        "Sin fecha de vencimiento",
      ],
      aclaracion:
        "La licencia corresponde a un único cultivo y no puede reutilizarse para iniciar otro.",
      cta: "Elegir un cultivo",
      ctaVariante: "secundario",
      mostrarArs: true,
      destacado: false,
    },
  ],
};

export const equivalenciasPlus = {
  titulo: "¿Qué te comprás con US$ 4,20?",
  subtitulo: "Flora te hace las cuentas.",
  items: [
    "Un G de no muy buena calidad",
    "3 sedas",
    "2 papeles de blunt",
    "2 clippers",
    "Alguna cosita en el grow",
  ],
  cierre: "O podés tenerme a mí organizando tus cultivos todo el mes.",
  cta: "Me quedo con Flora",
};

export const faqPrecios = [
  {
    id: "cancelar-plus",
    pregunta: "¿Puedo cancelar ENFLORA Plus?",
    respuesta:
      "Sí. La suscripción es mensual y podrá cancelarse para evitar futuras renovaciones. La cancelación no implica borrar tus registros.",
  },
  {
    id: "fin-cultivo",
    pregunta: "¿Qué pasa cuando termina mi cultivo de pago único?",
    respuesta:
      "Conservás el historial, pero esa licencia no puede utilizarse para empezar otro cultivo.",
  },
  {
    id: "duracion-licencia",
    pregunta: "¿Cuánto dura una licencia por cultivo?",
    respuesta: "Todo lo que dure ese cultivo. No tiene vencimiento temporal.",
  },
  {
    id: "cotizacion",
    pregunta: "¿Qué cotización del dólar utilizan?",
    respuesta:
      "Usamos el dólar oficial de una API pública. Lo refrescamos cada 12 horas, a las 4:20 y a las 16:20 (hora Argentina).",
  },
];
