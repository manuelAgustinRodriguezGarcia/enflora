/** Catálogo de frases de espera de Flora (solo UI; no van al historial ni a Gemini). */

import { normalizarPersonalidadFlora, PERSONALIDAD_FLORA_DEFAULT } from "@/lib/flora-personalidad";

export const MIN_FRASES_ESPERA_POR_PERSONALIDAD = 25;

/** Operaciones futuras (backend); no usar hasta tener señal fiable. */
export const MENSAJES_ESPERA_OPERACION_FUTURA = [
  "Leyendo tus registros...",
  "Buscando entre tus plantas...",
  "Comparando parámetros...",
  "Revisando el historial...",
  "Consultando la biblioteca de Flora...",
];

const CERCANA_NATURAL = [
  "A ver qué tenemos por acá...",
  "Dame un segundito...",
  "Poniendo en orden las ideas...",
  "A ver que dicen estas plantitas...",
  "Conectando cabos sueltos...",
  "Mirando esto un poquito más de cerca...",
  "Ya te cuento qué encontré...",
  "Un momentito, que ordeno la info...",
  "Estoy con vos, ya te doy una respuesta...",
  "Revisando bien todo para no hacer macana...",
  "Dame un toque que lo miro bien...",
  "Voy armando la respuesta...",
  "Pensando con calma...",
  "Acomodando todo para responderte...",
  "Estoy en eso todavía, no me fui...",
  "Un segundo, quiero responderte bien...",
  "Voy armando el rompecabezas...",
  "Entendido, dame un cachito...",
  "Dame un toque y te explico...",
  "Estoy dándole vueltas, pero las justas...",
  "Aguardame un cachito...",
  "Ya casi, lo estoy puliendo...",
  "Ordenando la respuesta...",
  "Dame un segundito y te respondo...",
  "Un momentito más y te respondo...",
];

const CERCANA_DIVERTIDA = [
  "Yo busco, vos fumá...",
  "Después dicen que no quema neuronas...",
  "Un segundo, estoy filosofando...",
  "Consultando al consejo intercannábico...",
  "Que no se me escape ninguna semillita...",
  "Activando mi sentido cannábico...",
  "Un momento, no me quiero quemar la cabeza...",
  "Tranqui, no me quedé dormida en la reposera...", 
  "Dándole más vueltas que a una rama entrenada...",
  "Procesando más que una planta bajo LED...",
  "Estoy en modo foco, como en floración...",
  "Revisando el grow como quien mira el termohigrómetro...",
  "No paniquees, no me colgué con Netflix...",
  "Ordenando data como macetas en la carpa...",
  "Un toque, que estoy en plena genética mental...",
  "Escuchando lo que susurran las hojas...",
  "Casi, casi, como waiting la cosecha...",
  "No soy lenta, soy planta perenne pensando...",
  "Activando protocolo Flora mental...",
  "Buscando sin prender la carpa de más...",
  "Mis pistilos digitales están analizando...",
  "Calmá, no me fui a buscar merch...",
  "Procesando a velocidad de auto cannábico...",
  "Un sec, que le estoy dando love a la consulta...",
  "Como regando con paciencia, pero con datos...",
  "En plena siesta productiva...",
  "Pensando fuerte, sin quemar puntas...",
];

const TECNICA_PROFESIONAL = [
  "Procesando tu consulta...",
  "Organizando la información disponible...",
  "Evaluando los datos relevantes...",
  "Preparando una respuesta fundamentada...",
  "Comprobando los detalles...",
  "Elaborando la respuesta...",
  "Analizando la información...",
  "Consolidando criterios técnicos...",
  "Verificando coherencia de los datos...",
  "Sintetizando resultados...",
  "Revisando parámetros aplicables...",
  "Generando respuesta estructurada...",
  "Aplicando criterio técnico...",
  "Consultando referencias internas...",
  "Validando información...",
  "Formulando conclusión...",
  "Procesamiento en curso...",
  "Evaluación en progreso...",
  "Ordenando datos de entrada...",
  "Preparando informe breve...",
  "Análisis en curso...",
  "Revisión técnica activa...",
  "Compilando respuesta...",
  "Tratamiento de consulta en curso...",
  "Finalizando análisis...",
  "Estructurando respuesta...",
];

const IMAGEN_CERCANA_NATURAL = [
  "Analizando tu fotografía...",
  "Mirando la foto que mandaste...",
  "Revisando la imagen con cuidado...",
];

const IMAGEN_CERCANA_DIVERTIDA = [
  "Analizando tu fotografía...",
  "Zoom botánico activado en tu foto...",
  "Un toque, que leo la planta de la imagen...",
];

const IMAGEN_TECNICA_PROFESIONAL = [
  "Analizando la imagen adjunta...",
  "Procesando fotografía de consulta...",
  "Evaluando contenido visual...",
];

export const MENSAJES_ESPERA_FLORA = {
  cercana_natural: CERCANA_NATURAL,
  cercana_divertida: CERCANA_DIVERTIDA,
  tecnica_profesional: TECNICA_PROFESIONAL,
};

const MENSAJES_ESPERA_IMAGEN = {
  cercana_natural: IMAGEN_CERCANA_NATURAL,
  cercana_divertida: IMAGEN_CERCANA_DIVERTIDA,
  tecnica_profesional: IMAGEN_TECNICA_PROFESIONAL,
};

export function mensajesEsperaImagen(personalidadRaw) {
  const { valor } = normalizarPersonalidadFlora(personalidadRaw);
  return MENSAJES_ESPERA_IMAGEN[valor] || MENSAJES_ESPERA_IMAGEN[PERSONALIDAD_FLORA_DEFAULT];
}

export function mensajesEsperaGenerales(personalidadRaw) {
  const { valor } = normalizarPersonalidadFlora(personalidadRaw);
  return MENSAJES_ESPERA_FLORA[valor] || MENSAJES_ESPERA_FLORA[PERSONALIDAD_FLORA_DEFAULT];
}

/** Frases para la rotación actual (generales + imagen si el cliente adjuntó foto). */
export function frasesEsperaActivas(personalidadRaw, { conImagen = false } = {}) {
  const generales = mensajesEsperaGenerales(personalidadRaw);
  if (!conImagen) return [...generales];
  const imagen = mensajesEsperaImagen(personalidadRaw);
  return [...generales, ...imagen];
}

function barajar(array) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function evitarRepetirInicio(baraja, anterior) {
  if (!anterior || baraja.length < 2 || baraja[0] !== anterior) return baraja;
  const intercambio = 1 + Math.floor(Math.random() * (baraja.length - 1));
  [baraja[0], baraja[intercambio]] = [baraja[intercambio], baraja[0]];
  return baraja;
}

/**
 * Rotador sin repetir hasta agotar el mazo; al rebarajar evita repetir la última frase.
 */
export function crearRotadorMensajesEspera(frases) {
  const pool = frases.filter(Boolean);
  if (!pool.length) {
    return {
      actual: () => "…",
      avanzar: () => "…",
    };
  }

  let baraja = barajar(pool);
  let indice = Math.floor(Math.random() * baraja.length);
  let ultima = baraja[indice];

  return {
    actual: () => baraja[indice] ?? ultima,
    avanzar: () => {
      indice += 1;
      if (indice >= baraja.length) {
        baraja = evitarRepetirInicio(barajar(pool), ultima);
        indice = 0;
      }
      ultima = baraja[indice];
      return ultima;
    },
  };
}

export const ESPERA_FLORA_INTERVALO_MIN_MS = 5000;
export const ESPERA_FLORA_INTERVALO_MAX_MS = 8000;

export function intervaloEsperaFloraMs() {
  const rango = ESPERA_FLORA_INTERVALO_MAX_MS - ESPERA_FLORA_INTERVALO_MIN_MS;
  return ESPERA_FLORA_INTERVALO_MIN_MS + Math.floor(Math.random() * (rango + 1));
}

export function conteoMensajesEsperaPorPersonalidad() {
  return Object.fromEntries(
    Object.entries(MENSAJES_ESPERA_FLORA).map(([id, lista]) => [id, lista.length]),
  );
}
