# Diagnóstico del camino crítico del hero

Fase 7. No se modificó la aplicación, ni la cotización, ni el streaming.

La imagen LCP sigue siendo Flora (`figure.tilted-card img`). El preload está en el byte 548 del HTML de producción, dentro del primer bloque (2,4 KiB). En cuanto ese bloque existe, el navegador pide la imagen. Lo que mueve el puntaje es el tiempo hasta que el hilo principal puede pintarla.

## Corridas que sostienen esto

| | Corrida del puntaje 80 | Traza de esta fase |
|---|---:|---:|
| Cuándo | 2026-11-05 19:19 UTC | 2026-11-05 20:09 UTC |
| Método | Lighthouse 12.8.2, móvil, `simulate` | Igual, con traza guardada |
| Performance | 80 | 58 |
| LCP puntuado | 4,0 s | 7,7 s |
| LCP observado | 1,6 s | 2,5 s |
| FCP observado | 1,6 s | 2,5 s |
| TTFB observado del LCP | 140 ms | 129 ms |
| Demora hasta pedir la imagen | 1.052 ms | 324 ms |
| Descarga de la imagen | 74 ms | 73 ms |
| Demora hasta pintarla | 309 ms | 1.981 ms |
| CLS | 0 | 0 |

`simulate` no estrangula la red ni la CPU mientras graba. La traza es de un equipo rápido (BenchmarkIndex 3392), viewport 412×823, densidad 1,75. Lantern después aplica Slow 4G (latencia de pedido 562,5 ms, bajada ~1,6 Mbps) y CPU 4×. Por eso el LCP puntuado no es el reloj de la traza.

La traza está en `mediciones/lh-fase7/lhr-0.trace.json`. El informe, en `mediciones/lh-fase7/lhr.json`.

## 1. Línea temporal

Reloj de la traza, desde el inicio de la navegación. Flora es el único candidato a imagen y coincide con el primer pintado.

| Tiempo | Qué pasa |
|---:|---|
| 129 ms | Primer byte que Lighthouse cuenta como TTFB del LCP. El audit clásico de servidor marca 34 ms: las cabeceras salen antes que el HTML útil. |
| 341 ms | El navegador pide los dos SVG del logo. Están en el `<head>`, antes del preload de Flora. |
| 451 ms | Llega el cuerpo del documento: 22,9 KiB transferidos, 205 KiB ya descomprimidos, en un solo trozo de la traza. |
| 453 ms | Empieza la solicitud de Flora (`w=640`, prioridad de preload) y, en el mismo instante, el CSS y unos veinte scripts. |
| 506–528 ms | Termina el CSS. La hoja grande pesa 45 KiB transferidos y 243 KiB descomprimidos. |
| 526 ms | Termina Flora: 82 KiB, 73 ms de descarga. |
| 528–536 ms | El parser recorre el HTML. El parseo dura 8 ms. |
| 536–2.506 ms | El hilo principal no tiene ningún hueco. 277 tareas de primer nivel cubren 2.128 ms de ese intervalo. La más larga dura 135 ms. |
| 2.506 ms | Primer paint, primer paint con contenido, primer paint de imagen y LCP. Es el mismo instante. El nodo es el `<img>` de Flora, 272×272 px en pantalla. |
| 2.520 ms | Aparece el texto del hero. Es más chico que la imagen, así que no reemplaza al LCP. |

Un pedido aparte, sin Lighthouse, contra `https://enflora.com.ar/` (`x-vercel-cache: MISS`, función `iad1`):

- Cabeceras a los 581 ms.
- Flora en el primer bloque, 8 ms después, en el byte 548 de un bloque de 2.366 bytes.
- El HTML completo (205 KiB) termina a los 1.443 ms. Esa cola es el resto del documento, no la disponibilidad del preload.

No hay un script antes del preload. El enlace lleva `fetchpriority` alto y Lighthouse lo marca como descubierto en el documento inicial, sin lazy load. Hay un solo preload de Flora.

## 2. Qué ocupa el hilo antes del pintado

Entre el fin de la descarga (526 ms) y el LCP (2.506 ms) el hilo no devuelve el control. El máximo hueco entre tareas de primer nivel es 0 ms. El navegador ya tiene la imagen, el CSS y el HTML, y no pinta hasta que esa ráfaga termina.

La hidratación sí retrasa el LCP: el primer pintado es el LCP, y ocurre al final de esa ráfaga.

Llamadas de script dentro de la ventana, por archivo:

| Archivo | Qué es | Tiempo en `FunctionCall` / evaluación |
|---|---|---:|
| `3z48wtu91nj8v.js` (230 KiB) | `react-dom` | 243 ms |
| `0e9lk0ky0cx_i.js` (114 KiB) | GSAP, `ScrollTrigger`, `useGSAP`, `registerPlugin` | 8 ms de llamada; el audit de arranque le atribuye 1.685 ms en total, 256 ms de scripting |
| `1_57sjogp6gp0.js` (118 KiB) | Código de la landing que importa `useGSAP`, `ScrollTrigger` y Motion | 7 ms |
| `14857v6yh1ogx.js` (145 KiB) | Motion | 8 ms |
| `3z-698bbiwzal.js` (129 KiB) | Runtime que viaja con la página | 9 ms |

Esos milisegundos de llamada no cubren los 2,1 s de ocupación. El resto es trabajo nativo asociado a esa ejecución (estilo, layout, compilado), no una tarea larga aislada. El audit de arranque pone a `react-dom` en 1.883 ms totales (1.341 ms de scripting) y al chunk de GSAP justo detrás.

En el viewport móvil, el `ScrollTrigger` del hero no llega a usarse: el parallax está detrás de `(min-width: 64rem)`. Igual se registra al importar `componentes/landing/gsap.js`, y ese módulo lo importan el hero, el encabezado, `Revelar`, las tarjetas de precio y Con Enflora.

Layout forzado: un solo `Layout` con pila, 5 ms, en `0pu8utjyppf-g.js`. No está asociado al hero. No explica la espera.

El parseo del HTML (8 ms) y la descarga del CSS (termina 2 s antes del paint) tampoco la explican.

## 3. Observado contra simulado

Lantern no mide otro sitio. Toma esta traza y le aplica Slow 4G y CPU 4×.

En esta traza el LCP observado es 2,5 s y el puntuado es 7,7 s. Casi todo el salto sale de la demora de pintado: 1.981 ms reales, estirados por la CPU 4×. La descarga puntuada de la imagen sigue siendo chica (en la corrida de 80 fue 188 ms).

En la corrida de 80 la relación era la inversa. La demora para pedir la imagen era 1.052 ms reales y 2.411 ms puntuados. La demora de pintado era 309 ms reales y 792 ms puntuados. El LCP puntuado de 4,0 s salía sobre todo de ese pedido tardío, más el TTFB simulado de 641 ms.

El pedido tardío no es el byte 548. En producción el preload viaja en el primer bloque, junto con las cabeceras o a unos milisegundos. La variación entre 324 ms y 1.052 ms es el momento en que ese bloque sale de la función en `iad1`. Cuando el cuerpo tarda, Lantern suma además la latencia de 562,5 ms del modelo Slow 4G y la bajada del documento. El fin del stream (1,4–2,8 s) es la cola posterior al preload. No es el instante en que Flora se puede pedir.

El puntaje 80 y el puntaje 58 son la misma página con distinta ocupación del hilo y distinto momento del primer bloque. Una sola corrida no alcanza para declarar una mejora.

## 4. Componentes responsables

- `componentes/landing/hero.js`. El `<Image>` ya se renderiza en el servidor, con `preload` y `fetchPriority="high"`, sin `loading="lazy"`. El costo está en el módulo de cliente: `useGSAP` anima el texto desde `opacity: 0` y mueve `.hero__flora`. El `ScrollTrigger` del parallax solo corre desde 64 rem.
- `componentes/landing/gsap.js`. Al importarse ejecuta `gsap.registerPlugin(ScrollTrigger, useGSAP)`. Eso mete el plugin en el grafo inicial aunque el móvil no lo use.
- `componentes/landing/tilted-card.js`. Envuelve la imagen. El LCP es el `<img>` que ya está en el HTML.
- `componentes/landing/revelar.js`, `encabezado-publico.js`, `tarjeta-plan.js`, `con-enflora.js`. Importan el mismo módulo de GSAP, así que no se puede cargar el hero sin arrastrar el registro del plugin.
- `app/layout.js` y `componentes/marca-encabezado.js`. Los dos SVG del logo se prefetchean antes que Flora. En esta traza salen 110 ms antes. Pesan unos 5 KiB cada uno y no ocupan la ventana de 2 s.
- La cotización y el `Suspense` de precios no están en esta ventana. El cuerpo útil ya había llegado cuando empezó la ejecución.

## 5. Tres optimizaciones, por impacto

### 1. Sacar `ScrollTrigger` y el grafo de animación del camino al primer pintado

Evidencia: hueco máximo de 0 ms entre el HTML listo y el LCP. El chunk de GSAP se atribuye 1.685 ms de arranque y se registra al importar, también en un móvil que no ejecuta el parallax. El otro chunk de la landing importa `useGSAP` y Motion en el mismo arranque. Si el primer pintado ocurriera cerca del fin de la imagen (526 ms) y no a los 2.506 ms, la parte que Lantern multiplica por cuatro se achicaría. En la corrida de 80, bajar la demora de pintado de 309 ms ya valía 792 ms del LCP puntuado.

Impacto probable: alto sobre LCP y FCP. Es la palanca que diferencia un 4 s de un 7 s.

Riesgo: el timeline del hero pone el texto en `opacity: 0` cuando corre. Si eso pasa después de que el texto ya se vio, hay un parpadeo. La imagen no se oculta: la animación solo la desplaza y la escala. El parallax de escritorio y los revelados tienen que seguir existiendo, un frame más tarde.

### 2. Dejar el `<img>` de Flora pintable sin hidratar `TiltedCard`

Evidencia: el nodo LCP ya está en el HTML de servidor, con tamaño y `srcset`. El primer paint de la traza no ocurre hasta que termina la hidratación de ese árbol. `TiltedCard` aporta tilt, brillo y el caption. No aporta los bytes de la imagen.

Impacto probable: medio, y solo si el módulo deja de importar `gsap.js` en el arranque. Si el hero sigue importando ese módulo, partir el componente no adelanta el paint.

Riesgo: un instante sin tilt ni brillo. La foto en reposo tiene que verse igual. No sirve si la separación vuelve a cargar GSAP antes del paint.

### 3. No recortar el HTML ni agregar otro preload

Evidencia en contra de usarlo como experimento: el preload ya está en los primeros 2,4 KiB y se pide 1,6 ms después del cuerpo en esta traza. El parseo dura 8 ms. La descarga de Flora dura 73 ms. Los logos prefetcheados no mueven ese número. Achicar el HTML de debajo del pliegue no adelanta un preload que ya viaja en el primer bloque. Sí agrandaría el riesgo de perder texto SSR, que es lo que el buscador y el primer pintado usan.

Impacto probable sobre el LCP: bajo. Riesgo: alto para SEO y para el contenido si se saca SSR de más.

## 6. Riesgos si se toca esto

- El texto del hero puede parpadear si `gsap.from` lo oculta después del primer paint.
- El parallax de escritorio y los revelados no pueden desaparecer. Solo pueden empezar después de que Flora ya se pintó.
- Una hidratación partida puede desalinear el árbol si el HTML de servidor y el primer cliente no describen la misma imagen.
- CLS está en 0. Reservar el recuadro de 272×272 ya lo hace el CSS (`.hero__flora` con `aspect-ratio: 1`). No hay que cambiar esas medidas.
- No hace falta tocar Banco Nación, autenticación, pagos, PWA ni cultivo.

## 7. Experimento para la opción 1

Dos builds iguales, salvo el momento en que se registra `ScrollTrigger`.

Control: el import actual de `componentes/landing/gsap.js`, que registra el plugin al cargar el módulo.

Tratamiento: el hero importa solo el núcleo de GSAP que necesita el timeline de entrada. `ScrollTrigger` se carga desde el encabezado, `Revelar` y Con Enflora después del primer frame pintado. Motion de las tarjetas no entra en ese primer módulo. No se cambia la apariencia final ni se elimina ninguna animación.

Medición: cinco Lighthouse Mobile `simulate` por build, en el mismo equipo, contra el mismo despliegue o contra dos `next start` equivalentes. Comparar la mediana, no una corrida, de:

- demora de pintado observada
- LCP observado y puntuado
- FCP
- CLS
- que el texto del hero no quede en blanco y después aparezca
- que el parallax de escritorio y el revelado sigan corriendo después de la carga

Se considera mejor si la mediana de la demora de pintado baja de forma clara (el objetivo es acercarla a los ~300 ms de la mejor corrida, no a cero) y el LCP puntuado baja con ella, con CLS en 0.

Se aborta si el texto parpadea, si Flora cambia de encuadre, o si el LCP puntuado no se mueve porque el hilo sigue ocupado por `react-dom` y Motion.
