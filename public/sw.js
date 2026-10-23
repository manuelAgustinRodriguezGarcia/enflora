self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function rutaSegura(valor) {
  try {
    const url = new URL(typeof valor === "string" && valor ? valor : "/", self.location.origin);
    if (url.origin !== self.location.origin) return `${self.location.origin}/`;
    return url.href;
  } catch {
    return `${self.location.origin}/`;
  }
}

function leerAviso(event) {
  let datos = {};
  if (event.data) {
    try {
      const json = event.data.json();
      if (json && typeof json === "object") datos = json;
    } catch {
      const texto = event.data.text();
      datos = { mensaje: typeof texto === "string" ? texto : "" };
    }
  }

  const titulo = typeof datos.titulo === "string" && datos.titulo.trim()
    ? datos.titulo.trim().slice(0, 120)
    : "Enflora";
  const mensaje = typeof datos.mensaje === "string" ? datos.mensaje.trim().slice(0, 280) : "";
  const etiqueta = typeof datos.etiqueta === "string" && /^[a-z0-9-]{1,32}$/.test(datos.etiqueta)
    ? datos.etiqueta
    : "enflora";

  const prueba = typeof datos.prueba === "string" && /^[0-9a-f-]{36}$/i.test(datos.prueba)
    ? datos.prueba
    : null;
  const recibo = typeof datos.recibo === "string" && /^[A-Za-z0-9_-]{43}$/.test(datos.recibo)
    ? datos.recibo
    : null;

  return { titulo, mensaje, url: rutaSegura(datos.url), etiqueta, prueba, recibo };
}

async function avisarPestanas(prueba) {
  try {
    const clientes = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const cliente of clientes) {
      cliente.postMessage({ tipo: "enflora-push-recibido", prueba });
    }
  } catch {
    return;
  }
}

async function confirmarPrueba(prueba, recibo) {
  await avisarPestanas(prueba);
  if (!recibo) return;
  try {
    await fetch(new URL("/api/push/recibido", self.location.origin).href, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prueba, recibo }),
      credentials: "omit",
      cache: "no-store",
    });
  } catch {
    return;
  }
}

async function mostrarAviso(aviso) {
  await self.registration.showNotification(aviso.titulo, {
    body: aviso.mensaje,
    icon: "/icons/enflora-isotipo-192.png",
    badge: "/icons/enflora-isotipo-192.png",
    lang: "es-AR",
    tag: aviso.etiqueta,
    data: { url: aviso.url },
  });
  if (aviso.prueba) await confirmarPrueba(aviso.prueba, aviso.recibo);
}

self.addEventListener("push", (event) => {
  event.waitUntil(mostrarAviso(leerAviso(event)));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = rutaSegura(event.notification.data && event.notification.data.url);
  event.waitUntil(enfocar(destino));
});

async function enfocar(destino) {
  const clientes = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const cliente of clientes) {
    let mismo = false;
    try {
      mismo = new URL(cliente.url).origin === self.location.origin;
    } catch {
      mismo = false;
    }
    if (!mismo) continue;
    if (typeof cliente.navigate === "function") {
      try {
        await cliente.navigate(destino);
      } catch {
        if (self.clients.openWindow) return self.clients.openWindow(destino);
      }
    }
    if (typeof cliente.focus === "function") return cliente.focus();
  }
  if (self.clients.openWindow) return self.clients.openWindow(destino);
}
