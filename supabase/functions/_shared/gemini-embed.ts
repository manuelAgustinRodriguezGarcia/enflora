import { EMBEDDING_DIMENSION, EMBEDDING_MODEL } from "./flora-rag-constantes.ts";

export async function generarEmbeddingGemini(texto: string): Promise<number[]> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("embedding_no_configurado");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;
  const respuesta = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: texto }] },
      outputDimensionality: EMBEDDING_DIMENSION,
    }),
  });

  if (!respuesta.ok) {
    throw new Error("embedding_fallo");
  }

  const cuerpo = await respuesta.json();
  const valores = cuerpo?.embedding?.values;
  if (!Array.isArray(valores) || valores.length !== EMBEDDING_DIMENSION) {
    throw new Error("embedding_formato_invalido");
  }
  return valores.map((v: unknown) => Number(v));
}
