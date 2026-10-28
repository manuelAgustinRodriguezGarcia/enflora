const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function idsAdministradoresFloraRag(): string[] {
  return String(Deno.env.get("FLORA_RAG_ADMIN_IDS") || "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter((id) => UUID_RE.test(id));
}

export function correosAdministradoresFloraRag(): string[] {
  return String(Deno.env.get("FLORA_RAG_ADMIN_EMAILS") || "")
    .split(",")
    .map((correo) => correo.trim().toLowerCase())
    .filter((correo) => correo.includes("@"));
}

export function esAdministradorFloraRag(usuario: { id?: string; email?: string } | null): boolean {
  if (!usuario?.id) return false;
  const id = String(usuario.id).trim().toLowerCase();
  if (idsAdministradoresFloraRag().includes(id)) return true;
  const correo = String(usuario.email || "").trim().toLowerCase();
  return Boolean(correo && correosAdministradoresFloraRag().includes(correo));
}
