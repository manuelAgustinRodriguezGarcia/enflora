export const ESTADOS_BENEFICIO_PLAN = {
  disponible: "disponible",
  plan_pago: "plan_pago",
  proximamente: "proximamente",
  pendiente: "pendiente",
};

/** @typedef {{ texto: string, estado?: keyof typeof ESTADOS_BENEFICIO_PLAN }} BeneficioPlan */

/** @param {BeneficioPlan | string} item */
export function textoBeneficioPlan(item) {
  return typeof item === "string" ? item : item.texto;
}

/** @param {BeneficioPlan | string} item */
export function etiquetaEstadoBeneficioPlan(item) {
  if (typeof item === "string") return "";
  switch (item.estado) {
    case ESTADOS_BENEFICIO_PLAN.plan_pago:
      return "Con plan pago";
    case ESTADOS_BENEFICIO_PLAN.proximamente:
      return "Próximamente";
    case ESTADOS_BENEFICIO_PLAN.pendiente:
      return "En definición";
    default:
      return "";
  }
}

export const planesEnflora = {
  titulo: "Elegí tu mejor plan",
  encabezadoPago: "Todos nuestros planes se pagan en pesos argentinos sin impuestos.",
  leyendaArs:
    "Referencia en ARS según dólar billete vendedor del Banco Nación. El importe del checkout se confirma al pagar.",
  modalCotizacion: {
    titulo: "Qué cotización de dólar?",
    sinDatos:
      "No pudimos leer el billete vendedor del Banco Nación. La referencia en pesos aparecerá cuando esté disponible; el cobro siempre usa la cotización vigente al confirmar la compra.",
    etiquetaPill: "Dólar billete vendedor (Banco Nación)",
  },
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
        {
          texto: "Hasta 9 plantas por unidad de cultivo",
          estado: ESTADOS_BENEFICIO_PLAN.disponible,
        },
        { texto: "Registros diarios", estado: ESTADOS_BENEFICIO_PLAN.disponible },
        {
          texto: "Galería Flora: 12 fotos por tanda (36 en unidad con licencia)",
          estado: ESTADOS_BENEFICIO_PLAN.disponible,
        },
        {
          texto: "Flora IA con límites operativos de seguridad",
          estado: ESTADOS_BENEFICIO_PLAN.disponible,
        },
        {
          texto: "Cuota comercial de IA: pendiente de definición",
          estado: ESTADOS_BENEFICIO_PLAN.pendiente,
        },
        { texto: "Estadísticas básicas", estado: ESTADOS_BENEFICIO_PLAN.disponible },
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
      notaComercial:
        "Suscripción mensual en pesos (BNA billete vendedor). Mismos beneficios funcionales que el pago único, en toda tu cuenta cuando esté activa.",
      beneficios: [
        {
          texto: "Sin tope comercial de 9 plantas por unidad de cultivo",
          estado: ESTADOS_BENEFICIO_PLAN.plan_pago,
        },
        {
          texto: "Galería Flora: 36 fotos por tanda en unidades incluidas",
          estado: ESTADOS_BENEFICIO_PLAN.plan_pago,
        },
        {
          texto: "Sugerencias de Flora en cada cultivo",
          estado: ESTADOS_BENEFICIO_PLAN.pendiente,
        },
        {
          texto: "Recordatorios de eventos y tareas",
          estado: ESTADOS_BENEFICIO_PLAN.disponible,
        },
        {
          texto: "IA Flora ampliada (cuota comercial en definición)",
          estado: ESTADOS_BENEFICIO_PLAN.pendiente,
        },
        {
          texto: "Avisos meteorológicos para cultivos de exterior",
          estado: ESTADOS_BENEFICIO_PLAN.proximamente,
        },
        {
          texto: "Esquejes y ADN cannábico",
          estado: ESTADOS_BENEFICIO_PLAN.proximamente,
        },
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
        {
          texto: "Mismos beneficios funcionales que el PLAN 420 en ese ciclo",
          estado: ESTADOS_BENEFICIO_PLAN.plan_pago,
        },
        {
          texto: "Más de 9 plantas en la unidad del ciclo (sin tope comercial de 9)",
          estado: ESTADOS_BENEFICIO_PLAN.plan_pago,
        },
        {
          texto: "Galería ampliada (36 fotos por tanda) en la unidad licenciada",
          estado: ESTADOS_BENEFICIO_PLAN.plan_pago,
        },
        {
          texto: "Válido solo mientras dure el ciclo comprado",
          estado: ESTADOS_BENEFICIO_PLAN.disponible,
        },
        {
          texto: "No reutilizable para otro ciclo ni otra unidad",
          estado: ESTADOS_BENEFICIO_PLAN.disponible,
        },
      ],
      aclaracion:
        "La licencia corresponde a un único ciclo de cultivo en una unidad de ancla. Conservás el historial cuando termina; la licencia no se transfiere.",
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
    pregunta: "¿Puedo cancelar el PLAN 420?",
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
    respuesta: "Todo lo que dure ese ciclo. No tiene vencimiento temporal.",
  },
  {
    id: "plantas-gratis",
    pregunta: "¿Cómo funciona el límite de plantas en el plan gratuito?",
    respuesta:
      "Podés registrar hasta 9 plantas en cada unidad de cultivo. Otras unidades tienen su propio cupo. Con licencia de pago único o PLAN 420 activo, ese tope comercial no aplica en las unidades incluidas.",
  },
  {
    id: "cotizacion",
    pregunta: "¿Qué cotización del dólar utilizan?",
    respuesta:
      "Usamos el dólar billete vendedor publicado por el Banco Nación, el mismo criterio del checkout. En fines de semana y feriados vale la última publicación. Si tiene más de siete días, no se puede cobrar hasta que el Banco publique una nueva.",
  },
];
