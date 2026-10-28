/** Configuración pública del chat (sin dependencias de filesystem ni Gemini). */

export function geminiConfigurado() {
  return Boolean(String(process.env.GEMINI_API_KEY || "").trim());
}

export function modeloFloraGeminiPublico() {
  const configurado = String(process.env.GEMINI_MODEL || "").trim();
  return configurado || "gemini-2.5-flash";
}

/** Nombre efectivo del modelo (para logs de diagnóstico, sin secretos). */
export function resumenConfigGemini() {
  return {
    modelo: modeloFloraGeminiPublico(),
    claveConfigurada: geminiConfigurado(),
  };
}
