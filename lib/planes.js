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
        "Hasta 24 plantas",
        "Registros diarios",
        "Seguimiento básico",
        "Métricas básicas",
        "Fotografías limitadas",
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
      titulo: "ENFLORA Plus",
      precioUsd: 4.2,
      precioEtiqueta: "US$ 4,20",
      periodicidad: "por mes",
      frase: "Todo tu cultivo.",
      beneficios: [
        "Cultivos ilimitados",
        "Registros completos",
        "Parámetros personalizados",
        "Estadísticas avanzadas",
        "Historial y fotografías",
        "Acceso completo a las herramientas del plan",
      ],
      cta: "Quiero ENFLORA Plus",
      ctaVariante: "principal",
      ctaSecundario: "¿Cuánto son 4,20 dólares hoy?",
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
      frase: "Un cultivo completo.",
      beneficios: [
        "Licencia para un único cultivo",
        "Registros completos",
        "Historial permanente",
        "Sin límite de duración",
        "Estadísticas avanzadas",
        "Sin renovación automática",
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
    "Medio fertilizante de 250 ml",
    "3 clippers",
    "Algún accesorio básico de cultivo",
  ],
  aclaracion: "Ejemplos ilustrativos. Los precios reales pueden variar.",
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
