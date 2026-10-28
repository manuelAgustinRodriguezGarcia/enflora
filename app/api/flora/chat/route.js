import {
  geminiConfigurado,
  modeloFloraGeminiPublico,
  resumenConfigGemini,
} from "@/lib/flora-chat-config";
import { conversarConFlora } from "@/lib/flora-gemini";
import { parsearAdjuntoImagenCliente } from "@/lib/flora-imagen-chat";
import { verificarCuotaUsuario } from "@/lib/flora-chat-limites";
import { motorGuiaFlora } from "@/lib/flora-rag-config";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerUsuario } from "@/lib/supabase/servidor";

/** Vercel Pro (o superior): hasta 60s. En Hobby el límite real sigue siendo ~10s. */
export const maxDuration = 60;

function json(body, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request) {
  if (!configuracionLista()) {
    return json({ ok: false, error: "Falta la configuración de Supabase." }, 503);
  }

  if (!geminiConfigurado()) {
    return json(
      {
        ok: false,
        error:
          "Flora no está disponible: configurá GEMINI_API_KEY en el servidor (Vercel → Environment Variables).",
      },
      503,
    );
  }

  const usuario = await obtenerUsuario();
  if (!usuario?.id) {
    return json({ ok: false, error: "Tenés que iniciar sesión para hablar con Flora." }, 401);
  }

  const cuota = verificarCuotaUsuario(usuario.id);
  if (!cuota.ok) {
    return json(
      { ok: false, error: cuota.error, reintentarEnSegundos: cuota.reintentarEnSegundos },
      429,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "El mensaje no es válido." }, 400);
  }

  const mensaje = body?.mensaje;
  const historial = body?.historial;
  const contextoSolucionId = body?.contextoSolucionId;

  const adjuntoParse = parsearAdjuntoImagenCliente(body);
  if (!adjuntoParse.ok) {
    return json({ ok: false, error: adjuntoParse.error }, 400);
  }

  const supabase = await crearClienteServidor();
  const resultado = await conversarConFlora(supabase, {
    mensaje,
    historial,
    contextoSolucionId,
    adjuntosImagen: adjuntoParse.adjuntos,
  });

  if (!resultado.ok) {
    const status = resultado.error?.includes("demasiado largo") ? 400 : 502;
    if (status === 502 && resultado.diagnostico) {
      console.error(
        "[flora/chat]",
        JSON.stringify({
          ...resultado.diagnostico,
          config: resumenConfigGemini(),
        }),
      );
    }
    return json(
      {
        ok: false,
        error: resultado.error,
        ...(resultado.diagnostico?.codigo
          ? { codigo: resultado.diagnostico.codigo, httpGemini: resultado.diagnostico.httpStatus }
          : {}),
      },
      status,
    );
  }

  return json({
    ok: true,
    respuesta: resultado.texto,
    meta: resultado.meta,
  });
}

export function GET() {
  return json({
    ok: true,
    servicio: "flora-chat",
    supabase: configuracionLista(),
    gemini: geminiConfigurado(),
    modelo: modeloFloraGeminiPublico(),
    motorGuia: motorGuiaFlora(),
  });
}
