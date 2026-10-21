import { registrarPartidaExpo, visitanteExpo } from "@/lib/expo-cannabis/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const visitor = await visitanteExpo();
    await registrarPartidaExpo(visitor);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false });
  }
}

export function GET() {
  return Response.json({ ok: false }, { status: 405 });
}
