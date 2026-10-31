import { visitanteExpo } from "@/lib/expo-cannabis/visitante";
import { atenderRuleta } from "@/lib/ruleta-420/servidor";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let cuerpo = null;
  try {
    cuerpo = await request.json();
  } catch {
    cuerpo = null;
  }

  try {
    const visitor = await visitanteExpo();
    const resultado = await atenderRuleta(visitor, cuerpo);
    const estado = resultado.estado || (resultado.ok ? 200 : 400);
    return Response.json(resultado, { status: estado });
  } catch {
    return Response.json({ ok: false, error: "No se pudo continuar la partida." }, { status: 500 });
  }
}

export function GET() {
  return Response.json({ ok: false }, { status: 405 });
}
