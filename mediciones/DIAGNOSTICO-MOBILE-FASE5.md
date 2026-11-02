# Diagnóstico Mobile — Fase 5

Fecha de medición: 29 de octubre de 2026, 22:35–22:44 (ART).  
URL: `https://enflora.com.ar/`  
Código local de referencia: `0fd84bf` (`correcciones de performance`), alineado con `origin/main`.

No se modificó código de la aplicación.

## Cómo se midió

El laboratorio local no pudo abrir producción. FortiGuard responde **Web Filter Violation** (categoría Unrated) para `https://enflora.com.ar/`. Node falla el TLS con `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Por eso no hay traza cruda de Chrome Performance en esta máquina ni JSON de Lighthouse CLI.

Las tres corridas salieron de **PageSpeed Insights**, que descarga el sitio desde la red de Google:

- Lighthouse **13.6.0**
- HeadlessChromium **153.0.8010.36** (lr)
- Mobile: Moto G Power, **Slow 4G**, sesión de una página, carga inicial
- Desktop: el mismo análisis, form factor desktop

Informes:

| Corrida | Captura | Informe |
|---------|---------|---------|
| 1 | 22:35 | https://pagespeed.web.dev/analysis/https-enflora-com-ar/7nv00u9dxt?form_factor=mobile |
| 2 | 22:41 | https://pagespeed.web.dev/analysis/https-enflora-com-ar/qucotv9bta?form_factor=mobile |
| 3 | 22:44 | https://pagespeed.web.dev/analysis/https-enflora-com-ar/2zyi8m8r9b?form_factor=mobile |

Números compactos: `mediciones/fase5-prod/resumen-psi.json`.

Una respuesta HEAD directa, anterior al bloqueo, sí llegó a Vercel (`server: Vercel`, `x-vercel-cache: MISS`). Los ocho CSS de ese `Link` son los mismos hashes que el laboratorio marca como bloqueantes. El sitio medido y esa respuesta son el mismo deploy.

El puntaje de escritorio **90** citado al inicio **no apareció** en estas tres corridas. Desktop quedó en **60** las tres veces. Mobile quedó entre **34 y 50**. El protocolo de PSI (Lighthouse 13.6, throttling simulado) no es el mismo que las corridas locales de las fases 1–4 (Lighthouse 12.8.2, `preset=perf`, throttling aplicado en Chrome).

## 1. Métricas de producción

### Mobile

| Corrida | Perf | FCP | LCP | TBT | Speed Index | CLS | JS eval | Style + layout |
|---------|------|-----|-----|-----|-------------|-----|---------|----------------|
| 1 | 34 | 2,3 s | 7,6 s | 18 160 ms | 13,2 s | 0 | 1 770 ms | 638 ms |
| 2 | 50 | 0,9 s | 3,7 s | 16 890 ms | 13,2 s | 0 | 1 347 ms | 499 ms |
| 3 | 47 | 1,0 s | 4,1 s | 9 050 ms | 10,8 s | 0 | 1 775 ms | 715 ms |
| **Mediana** | **47** | **1,0 s** | **4,1 s** | **16 890 ms** | **13,2 s** | **0** | **1 770 ms** | **638 ms** |

Hilo principal (mediana de las tres, categoría Lighthouse):

| Categoría | Corrida 1 | Corrida 2 | Corrida 3 |
|-----------|-----------|-----------|-----------|
| Other | 37,2 s | 37,2 s | 38,1 s |
| Script evaluation | 1,8 s | 1,3 s | 1,8 s |
| Style & layout | 0,64 s | 0,50 s | 0,72 s |
| Rendering | 0,46 s | 0,34 s | 0,52 s |
| Parse JS | 0,12 s | 0,09 s | 0,10 s |
| **Total declarado** | **40,3 s** | **39,5 s** | **41,4 s** |

### Desktop (mismo análisis, otro form factor)

| Corrida | Perf | FCP | LCP | TBT | Speed Index | CLS | JS eval | Style + layout |
|---------|------|-----|-----|-----|-------------|-----|---------|----------------|
| 1 | 60 | 0,3 s | 0,7 s | 16 000 ms | 9,2 s | 0 | 1 260 ms | 503 ms |
| 2 | 60 | 0,3 s | 0,7 s | 15 930 ms | 9,0 s | 0 | — | — |
| 3 | 60 | 0,4 s | 0,5 s | 13 410 ms | 9,7 s | 0 | 2 008 ms | 782 ms |
| **Mediana** | **60** | **0,3 s** | **0,7 s** | **15 930 ms** | **9,2 s** | **0** | — | — |

Accesibilidad 97, Best Practices 100 y SEO 100 se leyeron en la corrida 1 (mobile). No se re-auditaron en las otras dos.

CLS se mantuvo en 0 en las seis vistas.

## 2. Elemento LCP y desglose

En las tres corridas mobile y en las tres desktop el elemento es el mismo:

`img` dentro de `figure.tilted-card`, alt **«Flora, la mascota de Enflora, tomando sol en una reposera»**.

Origen: `/_next/image?url=/images/flora-landing.png&w=640&q=75`, deploy `dpl_AC45YzkRp`. En el snippet del laboratorio el `img` lleva `decoding="async"`, `data-nimg="1"` y `sizes` del hero. No muestra `fetchpriority`.

Checklist de descubrimiento (mobile, corrida 1, repetido en la 2):

| Chequeo | Resultado |
|---------|-----------|
| No usa `loading=lazy` | Pasa |
| `fetchpriority=high` en el preload de la imagen | **Falla** |
| El pedido es descubrible en el HTML inicial | Pasa |

El `priority` de `next/image` en `componentes/landing/hero.js` no está produciendo `fetchpriority=high` en el elemento que Lighthouse toma como LCP.

### Subpartes que muestra el laboratorio

Mobile:

| Subparte | Corrida 1 | Corrida 2 | Corrida 3 |
|----------|-----------|-----------|-----------|
| TTFB | 20 ms | 10 ms | 10 ms |
| Demora de carga | 280 ms | 270 ms | 200 ms |
| Duración de carga | 180 ms | 90 ms | 40 ms |
| Demora de render | 1 970 ms | 2 050 ms | 1 080 ms |
| Suma | 2 450 ms | 2 420 ms | 1 330 ms |
| LCP puntuado | 7 600 ms | 3 700 ms | 4 100 ms |

Desktop:

| Subparte | Corrida 1 | Corrida 2 | Corrida 3 |
|----------|-----------|-----------|-----------|
| TTFB | 20 ms | 20 ms | 0 ms |
| Demora de carga | 330 ms | 190 ms | 190 ms |
| Duración de carga | 260 ms | 60 ms | 110 ms |
| Demora de render | 190 ms | 200 ms | 470 ms |
| Suma | 800 ms | 470 ms | 770 ms |
| LCP puntuado | 700 ms | 700 ms | 500 ms |

En desktop la suma y el LCP puntuado están en el mismo orden (alrededor de 0,5–0,8 s). En mobile la suma de las cuatro subpartes queda **por debajo** del LCP puntuado: 2,5 s contra 7,6 s en la corrida 1, 2,4 s contra 3,7 s en la 2, 1,3 s contra 4,1 s en la 3. El informe deja esa diferencia explícita. No se reasignó el hueco a una causa que el laboratorio no etiquetó.

Lo que sí es estable en mobile:

- El servidor responde en **10–20 ms**.
- La imagen de Flora, una vez pedida, termina en **40–180 ms**.
- La subparte etiquetada más grande es la **demora de render** (1,1–2,1 s).
- El LCP puntuado se mueve entre 3,7 s y 7,6 s. Esa variación es mayor que la variación de la descarga.

En la corrida 1 el laboratorio describe la imagen de Flora como archivo **640×653** mostrada a **267×272**, unos **80 KiB**, con un ahorro estimado de **66 KiB** si se sirviera al tamaño visible. La descarga corta y el archivo más grande que el hueco conviven: el peso sobra, y aun así no es la subparte larga del desglose.

## 3. Tareas largas

El laboratorio lista **20 tareas largas** en cada vista. Las más largas que muestra la tabla duran **115–171 ms**. No hay una tarea de varios segundos en ese listado.

Mobile, corrida 1, las cinco de mayor duración publicada:

| Inicio | Duración | URL |
|--------|----------|-----|
| 3 944 ms | 171 ms | `/_next/static/immutable/chunks/2a1dw7183561n.js` |
| 4 268 ms | 169 ms | `/_next/static/immutable/chunks/0_d-42otvhvr5.js` |
| 32 701 ms | 163 ms | `/_next/static/immutable/chunks/0uez3daj5t235.js` |
| 35 519 ms | 146 ms | `0uez3daj5t235.js` |
| 25 645 ms | 140 ms | `0uez3daj5t235.js` |

Mobile, corrida 2, las que empiezan antes del LCP de 3,7 s o justo encima de las más largas:

| Inicio | Duración | URL |
|--------|----------|-----|
| 3 928 ms | 156 ms | `2a1dw7183561n.js` |
| 4 153 ms | 130 ms | `0_d-42otvhvr5.js` |
| 4 345 ms | 130 ms | `2a1dw7183561n.js` |
| 4 857 ms | 129 ms | `14857v6yh1ogx.js` |
| 4 602 ms | 128 ms | `2a1dw7183561n.js` |

Antes del LCP mobile, el grupo que se repite es **React DOM** (`2a1dw…`) alrededor de los **4 s**, con duraciones de **127–171 ms**, y una tarea de **GSAP core** (`0_d…`) en la misma ventana. Las tareas del chunk de ScrollTrigger (`0uez…`) siguen apareciendo **después** del LCP, hasta los 28–36 s.

No hay stack de llamadas. PageSpeed no entrega la traza. La atribución disponible es la URL del script y, en bootup, el reparto entre evaluación y parse.

Esas 20 tareas de ~150 ms no alcanzan para explicar un TBT de 9–18 s. Veinte excesos de ~100 ms suman cerca de 2 s. El TBT publicado es varias veces mayor. El dato que sí cierra con la duración del hilo es el **CPU total por script** (sección siguiente), concentrado en un chunk cuya evaluación de JS es pequeña.

## 4. Archivos y componentes, con evidencia

### El costo grande no es la evaluación de JS

En las tres corridas mobile, **Other** es ~37–38 s de un hilo de ~40 s. La evaluación de scripts es **1,3–1,8 s**. Style y layout, **0,5–0,7 s**.

Bootup, CPU total contra evaluación (mobile):

| Chunk | Qué es | CPU total (rango) | Evaluación (rango) |
|-------|--------|-------------------|--------------------|
| `0uez3daj5t235.js` | GSAP **ScrollTrigger 3.15.0** + `useGSAP`. El módulo termina en `ScrollTrigger.config({ ignoreMobileResize: true })`, el mismo llamado que `componentes/landing/gsap.js`. | 32,6–35,2 s | 65–105 ms |
| `2a1dw7183561n.js` | **react-dom 19.3.0** (`createRoot`, `hydrateRoot`, `rendererPackageName: "react-dom"`). | 3,2–4,3 s | 845–1 190 ms |
| `0_d-42otvhvr5.js` | Núcleo **gsap** (31 apariciones de `gsap` en el archivo publicado). | 1,2–1,9 s | 18–26 ms |
| documento `/` | HTML | 0,5–0,7 s | ~3–22 ms |
| `0vht_e-yijy16.js` | Bundle con `MotionConfig`, `useGSAP` y un `requestIdleCallback` con `timeout: 900`. | 0,19–0,27 s | 150–225 ms |

El chunk de ScrollTrigger concentra el CPU y casi no evalúa JavaScript. Sus tareas largas siguen mucho después de que la imagen ya podría haber pintado. El mismo patrón está en desktop: ese chunk suma **28–33 s** de CPU con ~100 ms de evaluación, y el TBT de escritorio queda en **13–16 s**.

`componentes/landing/gsap.js` registra ScrollTrigger al importarse. Entran en el grafo inicial porque el hero, el encabezado público y `revelar.js` lo importan de forma estática (`landing.js` no los pone detrás de `dynamic()`). También lo usan, en secciones diferidas, `con-enflora.js`, `cierre.js`, `historial.js`, `tarjeta-plan.js` y `desplazar-seccion.js`.

### React, al inicio

La evaluación de JS que sí aparece antes del LCP es la de **react-dom**. Es el segundo CPU total y el primero en milisegundos de scripting. Sus tareas largas arrancan cerca de los 4 s, en la ventana en la que el LCP puntuado todavía no cerró.

`0vht_e-yijy16.js` (Motion + algo de GSAP de la app) se queda en ~200 ms. No explica el TBT.

### SideRays / WebGL

Los tres chunks de mayor CPU no contienen `webgl`, `webgl2` ni `FF00AA`. En estas corridas el tiempo dominante no está atribuido al canvas de `side-rays.js`. El diferido con `requestIdleCallback` de `escena-solar.js` (timeout 2500) sigue en el fuente; el string `timeout:2500` no está en los chunks pesados que se pudieron bajar.

### Imagen de Flora y recursos de más abajo

La imagen LCP se descubre en el HTML y no es lazy. Falta `fetchpriority=high`. Su duración de red, en el desglose, es la subparte corta.

En mobile el laboratorio estima **559 KiB** de ahorro en imágenes. La mayor es de una sección inferior:

- `flora-gangster.png` (galería, clase `flora-galeria__img`), con `loading="lazy"` y `fetchpriority="low"`, igual se descarga: **95 KiB**, archivo 640×800 para un hueco de 257×322.
- `flora-landing-produccion.png` y `flora-landing-conoce.png` (`para-que-sirve__img`, lazy) también entran en ese ahorro.

### CSS y fuentes bloqueantes

Ocho CSS bloquean el primer render. Transferencia total **50,6 KiB**. El grande es `0h5x0hk8u9qn3.css`, **39,9 KiB**. En mobile la corrida 1 les asigna hasta **1 800 ms** de bloqueo a ese archivo y **430 ms** de ahorro estimado al conjunto. En desktop el mismo conjunto baja a **170 ms** de ahorro estimado.

Esos ocho nombres coinciden con el `Link: rel=preload; as=style` de la respuesta Vercel. Esa misma respuesta precarga dos woff2 (Fredoka e Inter) y dos SVG de logo. **No** precarga `flora-landing.png` en el header HTTP.

### Qué hay de las fases 1–4 en este deploy

| Fase | En el fuente de `0fd84bf` | Señal en producción |
|------|----------------------------|---------------------|
| 1 | `hero.js` con `priority`. `escena-solar.js` monta SideRays tras `requestIdleCallback` (timeout 2500). | El LCP es la foto de Flora, descubrible y sin lazy. `fetchpriority=high` falla. |
| 2 | Imágenes vía `next/image`. | Las URLs son `/_next/image?url=/images/flora-landing.png&w=640`. |
| 3 | `landing.js` carga con `dynamic()` las secciones bajo el pliegue. | El CPU inicial está en ScrollTrigger, react-dom y gsap, no en un único bundle de toda la landing. |
| 4 | El parche de viewport (`cancelAnimationFrame` al salir de vista en `side-rays.js`, `particles.js` y `magic-bento.js`) **no está** en esos archivos en `main`. La validación A/B se hizo en worktrees. | No hay un marcador de ese parche que buscar en los chunks pesados. |

La home publicada ya no muestra la playlist de Spotify que `0fd84bf` sacó de `lib/flora-landing.js` (el texto no está en el contenido servido). El deploy medido es posterior a ese corte, con el id `dpl_AC45YzkRp`. No se pudo leer un SHA de git en los headers: el filtro cortó las lecturas directas siguientes.

## 5. Desktop frente a mobile

Las dos columnas son el mismo HTML y los mismos chunks. Cambia el form factor y la red/CPU que aplica el laboratorio.

| | Mobile (mediana) | Desktop (mediana) |
|--|------------------|-------------------|
| Performance | 47 | 60 |
| FCP | 1,0 s | 0,3 s |
| LCP | 4,1 s | 0,7 s |
| TBT | 16,9 s | 15,9 s |
| Speed Index | 13,2 s | 9,2 s |
| CLS | 0 | 0 |
| Demora de render del LCP | 1,1–2,1 s | 0,19–0,47 s |
| Duración de carga de la imagen | 40–180 ms | 60–260 ms |
| CPU del chunk ScrollTrigger | 33–35 s | 28–33 s |
| Evaluación de react-dom | 0,8–1,2 s | 0,9–1,2 s |

El TBT alto está en las dos. Con CPU de escritorio el puntaje se queda en 60, no en 90. La brecha de puntaje mobile/desktop de estas corridas (47 contra 60) es chica al lado del TBT compartido.

Lo que sí se estira en mobile es el **LCP** y, dentro de lo etiquetado, la **demora de render** (pasa de unas pocas centenas de milisegundos a 1–2 s) más FCP y Speed Index. La descarga de la foto de Flora sigue siendo corta en las dos. Slow 4G no es, en estos números, el tramo largo del LCP.

El ahorro de imágenes es distinto: **559 KiB** en mobile y **104 KiB** en desktop. En mobile entra la galería (`flora-gangster.png`); en desktop el laboratorio se queja sobre todo del tamaño de la propia Flora (640 px para un hueco de ~533×544).

## 6. Tres optimizaciones, por impacto

El objetivo de 80 y después 90 choca primero con el TBT. Con 9–18 s de blocking time el peso de esa métrica (30 % del puntaje) deja el resultado por debajo de 80 aunque el LCP baje a ~2,5 s. El LCP de escritorio ya está en 0,5–0,7 s y el puntaje igual es 60.

### 1. Sacar el ticker de ScrollTrigger del arranque

**Impacto esperado:** el mayor. Es el único script con decenas de segundos de CPU en mobile y en desktop, y sus tareas siguen después del LCP. Bajar ese residuo es lo que puede mover el TBT. Sin eso, mobile no llega a 80 y desktop se queda lejos de 90.

**Dónde:** `componentes/landing/gsap.js` (registro global al importar) y los callers del grafo inicial: `hero.js`, `encabezado-publico.js`, `revelar.js`.

**Límite:** no hace falta apagar las animaciones. Hace falta que el plugin no ocupe el hilo durante toda la ventana que mide Lighthouse.

### 2. Acortar la demora de render de Flora

**Impacto esperado:** el segundo, y es el que mueve el LCP mobile. La red de esa imagen ya es corta (40–180 ms) y el TTFB es de 10–20 ms. La subparte etiquetada más grande es la demora de render (1,1–2,1 s). En la misma ventana, react-dom tiene tareas desde los ~4 s.

Además, el laboratorio marca como fallo la ausencia de `fetchpriority=high` en el preload. La demora de carga es 200–280 ms: real, y más chica que la demora de render.

**Dónde:** `hero.js` / `tilted-card.js` (el `img` de Next no recibe `fetchpriority` en el DOM medido) y el trabajo de hidratación que corre antes de pintar esa imagen.

### 3. No bajar todavía las imágenes de secciones inferiores

**Impacto esperado:** menor para el puntaje que las dos anteriores. El LCP no espera a `flora-gangster.png`. Sí hay **559 KiB** de más en mobile, con la galería marcada lazy y descargada igual, y eso empuja el Speed Index (mediana 13,2 s).

**Dónde:** `galeria-flora.js` y las imágenes de `para-que-sirve` que ya declaran lazy y aun así entran en la corrida.

El CSS bloqueante (40 KiB el archivo grande, ~50 KiB en total) es visible y acotado: 430 ms de ahorro estimado en mobile. Queda detrás del hilo principal.

## 7. Riesgos visuales y funcionales

- Tocar ScrollTrigger afecta el parallax del hero (solo desde 64 rem), el revelado, el encabezado y, cuando carga, el pin de Con Enflora. El riesgo es un scroll que salta o una sección que no entra. La animación puede seguir; el cambio peligroso es el momento en que el plugin se registra y refresca.
- Cambiar el orden de la entrada GSAP de Flora, o el árbol de `TiltedCard`, puede mover el LCP o dejar la mascota invisible un instante. `fetchpriority` en el preload no cambia el dibujo.
- Retrasar de verdad la galería y las fotos de «para qué sirve» puede mostrar huecos un momento al hacer scroll. Esas imágenes ya están marcadas lazy; el fallo actual es que igual se piden durante la carga.
- El parche de Fase 4 (pausar WebGL y partículas fuera del viewport) no está en `main`. No es un candidato a revertir en producción. SideRays no aparece en los chunks que concentran el CPU de estas corridas.
- CLS está en 0. Cualquier reserva de tamaño distinta en la imagen del hero puede romperlo.

## Qué falta para cerrar el hueco del LCP

La suma de TTFB + demora de carga + duración de carga + demora de render no llega al LCP puntuado en mobile. Hace falta una traza de Chrome (Performance) tomada donde el firewall no intercepte `enflora.com.ar`, para ver qué corre entre el fin de la descarga de Flora y el paint que Lighthouse puntúa. Hasta entonces, el objetivo de implementación sigue siendo el que estos tres informes repiten: el CPU de ScrollTrigger en el hilo, y la demora de render de la imagen de Flora.
