export async function desvincularInstalacionActual() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const registro = await navigator.serviceWorker.getRegistration("/");
    const suscripcion = registro ? await registro.pushManager.getSubscription() : null;
    if (!suscripcion?.endpoint) return;
    await fetch("/api/push/desvincular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: suscripcion.endpoint }),
      keepalive: true,
      cache: "no-store",
    });
  } catch {
    return;
  }
}
