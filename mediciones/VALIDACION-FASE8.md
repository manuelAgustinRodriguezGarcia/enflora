# Validación Fase 8 — ScrollTrigger fuera del primer pintado

El tratamiento B no se conserva. Separar ScrollTrigger del núcleo de GSAP achica un chunk, pero no adelanta el primer pintado de Flora de forma consistente. La dispersión de las diez corridas es más grande que cualquier diferencia entre A y B.

El código de la landing volvió al de la Fase 7 (`HEAD`). No hubo deploy.

## Cómo se midió

A es el commit `8160d1e` (Fase 7). B es ese mismo árbol más los ocho archivos del experimento. Cada versión se compiló una vez en su worktree (`mediciones/worktrees/ab-fase8-a` y `ab-fase8-b`) y se sirvió con `next start` en `127.0.0.1:3468`. No se recompiló entre corridas.

Lighthouse 12.8.2, móvil, `simulate`, solo Performance, headless. Diez corridas intercaladas: a1 b1 a2 b2 a3 b3 a4 b4 a5 b5. Host: 12 CPU, 32 GB. Builds: A `2vK-45gTEdL2pPdiCUhOC`, B `OUkvR5f9WpLJ1Um4BCK9t`.

`simulate` graba la traza sin estrangular red ni CPU. Lantern aplica después Slow 4G y CPU 4×. Los números de esta máquina no se comparan con el Performance 80 / LCP 4,0 s de producción. La pregunta del experimento es A contra B, en el mismo host, con builds fijos.

Corridas, informe y traza de b5: `mediciones/ab-fase8-runs/2026-11-06T20-47-50/`.

El repo no tiene `@next/bundle-analyzer` ni un script `analyze`. El grafo sale de los module ids de Turbopack en `.next/static/chunks` y de la traza de b5.

## 1. Cambios aplicados

B, y solo B, tocó:

- `componentes/landing/gsap.js`: dejó de importar ScrollTrigger. Sigue exportando `gsap` y `useGSAP`, y registra `useGSAP`.
- `componentes/landing/scroll-trigger.js` (nuevo): `asegurarScrollTrigger()` hace `import("gsap/ScrollTrigger")` una sola vez, registra el plugin y aplica `ignoreMobileResize` antes de devolverlo.
- `hero.js`: la entrada ya no usa `opacity: 0`. Conserva el desplazamiento y la escala. El parallax de escritorio (`min-width: 64rem`, sin movimiento reducido) espera al plugin y mata el tween en el cleanup. `useGSAP` sigue siendo síncrono.
- `revelar.js`, `con-enflora.js`, `cierre.js`, `historial.js`, `desplazar-seccion.js`: crean sus tweens de scroll después de la misma promesa. Si un revelado ya está en pantalla cuando llega el plugin, anima solo `y`, sin bajar la opacidad.

No se tocó Motion, `ProveedorMotion`, el encabezado, `tarjeta-plan.js`, Banco Nación, pagos, autenticación, PWA ni cultivo. El HTML de `/` sigue incluyendo el `h1` del hero y la imagen de Flora con preload. No se desactivó SSR ni se difirió la landing.

Después de leer las corridas, esos archivos se revirtieron. `scroll-trigger.js` se eliminó.

## 2. Grafo de dependencias

Antes (A). Un import estático de `gsap.js` arrastra núcleo y plugin al mismo chunk:

```text
hero, revelar, encabezado, tarjeta-plan, con-enflora, cierre, historial
  -> gsap.js
       -> gsap
       -> gsap/ScrollTrigger
       -> @gsap/react
proveedor-motion.js -> motion/react   (sin cambios)
```

Chunk de A `1w--f6q7hakzv.js` (114.413 bytes) contiene el núcleo (módulo `906597`) y el plugin (módulo `543340`). En a4, Lighthouse le atribuye 357 ms de scripting y 2.263 ms de bootup total. Ese total del chunk no es el costo de `registerPlugin`.

Después (B). El plugin quedó en otro archivo:

```text
hero, revelar, con-enflora, cierre, historial, desplazar-seccion
  -> gsap.js -> gsap + useGSAP
  -> scroll-trigger.js -> import("gsap/ScrollTrigger")   // chunk aparte
```

| Pieza | A | B |
|---|---|---|
| Núcleo GSAP | dentro de `1w--f6q7hakzv.js`, 114 KiB, junto al plugin | `23st8uynd9im8.js`, 71 KiB, sin el módulo `543340` |
| Plugin ScrollTrigger | el mismo chunk | `0polnukrgbvxk.js`, 43 KiB, solo el módulo `543340` |
| Motion | `3amkgicj9l829.js`, 145 KiB | el mismo archivo y el mismo tamaño |
| react-dom | `08m0mlft-m_ma.js`, 229 KiB | el mismo |

En la traza de b5 el núcleo y Motion salen en la primera oleada, a 71 ms. El plugin no: se pide a los 539 ms, cuando `useGSAP` (`useLayoutEffect`) llama a `asegurarScrollTrigger()` durante la hidratación. Sigue ocurriendo antes del primer pintado. Buscar la cadena `ScrollTrigger` en otros chunks de B (`2q9agmqdlct5e.js`, `0-4rzs25i0-0o.js`) da falsos positivos: tienen el identificador en el código de la landing, no el cuerpo del plugin (`pinReparent` solo está en `0polnukrgbvxk.js`).

Costo real del plugin, traza b5, reloj desde `navigationStart` del frame principal:

| Hito | Tiempo |
|---|---:|
| `EvaluateScript` del núcleo GSAP | 350 ms, duración 0,9 ms |
| Pedido del plugin | 539 ms |
| `EvaluateScript` del plugin | 628 ms, duración 7,7 ms |
| Primer pintado, FCP e imagen | 1.188 ms |
| Candidato LCP de la imagen | 1.348 ms |

Registrar el plugin ocupa unos 8 ms y termina 560 ms antes del primer pintado. No explica la demora de 1,1–2,1 s. En b4 el bootup de react-dom sigue en 2.756 ms de scripting. Motion, sin cambios, suma 428 ms de scripting y viaja en la primera oleada.

## 3. Resultados individuales

Todas las corridas. Tiempos en milisegundos. CLS fue 0 en las diez.

| Corrida | Perf | FCP sim. | LCP obs. | LCP sim. | Render delay | TBT | SI | Eval. JS | Tareas largas antes del pintado |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| a1 | 48 | 2.952 | 2.354 | 7.058 | 1.633 | 774 | 5.739 | 3.878 | 1 tarea, 366 ms |
| b1 | 46 | 3.706 | 2.423 | 7.300 | 1.804 | 734 | 6.115 | 3.852 | 1 tarea, 249 ms |
| a2 | 44 | 2.885 | 2.413 | 6.996 | 2.089 | 1.110 | 5.827 | 3.831 | 2 tareas, 298 ms |
| b2 | 41 | 3.539 | 2.392 | 7.211 | 2.078 | 1.122 | 6.103 | 3.710 | 1 tarea, 249 ms |
| a3 | 61 | 1.535 | 1.404 | 6.355 | 1.133 | 565 | 4.088 | 3.137 | 1 tarea, 274 ms |
| b3 | 57 | 1.535 | 1.361 | 6.726 | 1.099 | 680 | 4.031 | 3.528 | 1 tarea, 257 ms |
| a4 | 54 | 1.541 | 1.387 | 6.318 | 1.116 | 940 | 4.035 | 3.476 | 1 tarea, 298 ms |
| b4 | 54 | 1.542 | 1.383 | 6.822 | 1.105 | 831 | 4.243 | 3.978 | 1 tarea, 292 ms |
| a5 | 46 | 2.864 | 2.352 | 6.977 | 2.060 | 902 | 5.704 | 3.489 | 2 tareas, 297 ms |
| b5 | 62 | 1.531 | 1.348 | 6.420 | 1.100 | 521 | 3.970 | 3.064 | 1 tarea, 246 ms |

Scripts de red: 17 en A, 18 en B. El script de más es el chunk del plugin, pedido durante la hidratación.

## 4. Comparación estadística

Medianas de las cinco corridas:

| | A | B | B − A |
|---|---:|---:|---:|
| Performance | 48 | 54 | +6 |
| FCP simulado | 2.864 | 1.542 | −1.322 |
| LCP observado | 2.352 | 1.383 | −969 |
| LCP simulado | 6.977 | 6.822 | −155 |
| Render delay | 1.633 | 1.105 | −528 |
| TBT | 902 | 734 | −168 |
| Speed Index | 5.704 | 4.243 | −1.461 |
| Eval. JS | 3.489 | 3.710 | +221 |
| CLS | 0 | 0 | 0 |

Esas medianas no se pueden leer solas. Las diez corridas caen en dos grupos, y los dos grupos aparecen en A y en B:

- Lento, LCP observado 2,3–2,4 s: a1, a2, a5, b1, b2. Render delay 1,6–2,1 s.
- Rápido, LCP observado 1,35–1,40 s: a3, a4, b3, b4, b5. Render delay 1,10–1,13 s.

A tuvo tres corridas lentas y dos rápidas. B tuvo dos lentas y tres rápidas. La mediana de B queda en el grupo rápido y la de A en el lento por ese desbalance, no porque el tratamiento mueva el reloj. El rango de LCP simulado de A (6.318–7.058) y el de B (6.420–7.300) se solapan por completo. El rango dentro de una misma versión (~700–900 ms) es mayor que la diferencia de medianas (155 ms).

Pares intercalados, LCP simulado de B menos A: +242, +215, +371, +504, −557 ms. En cuatro de cinco pares B es peor. El único par a favor de B es a5 (lento) contra b5 (rápido): es el salto de grupo, no un efecto repetible.

Dentro del grupo rápido, el render delay de B y de A difiere unos 20 ms. Dentro del lento, b1 es peor que a1 (1.804 contra 1.633) y b2 empata con a2. La evaluación de JS no baja (mediana 3.710 contra 3.489).

La dispersión impide concluir que B mejore el primer pintado o el LCP.

## 5. Tiempos del primer pintado

En b5, que además guardó la traza, el primer pintado, el FCP y el primer pintado de imagen coinciden a 1.188 ms. Flora, como candidato de imagen, llega a 1.348 ms. El plugin ya se había evaluado a los 628 ms.

La demora de renderizado observada sigue entre 1,1 s (grupo rápido) y 2,1 s (grupo lento) en las dos versiones. Quitar `opacity: 0` de la entrada del hero no adelantó ese pintado: `useGSAP` corre en `useLayoutEffect`, así que el `from({ y, scale })` que quedó también se aplica antes de pintar. El texto ya estaba en el HTML.

Las tareas largas anteriores al FCP suman ~250–370 ms. El resto de la espera es trabajo del hilo principal por debajo del umbral de tarea larga, concentrado en react-dom.

## 6. Evaluación de animaciones

Revisión manual del build B en `127.0.0.1:3468`, el 6 de noviembre de 2026.

- El HTML inicial trae el `h1` («Tu cultivo, bajo control») y `hero__flora` con el preload de Flora. No dependen de JavaScript para existir.
- Mobile (~347 px de ancho): Flora 216×216, opacidad 1, texto del hero en opacidad 1 y sin transform pendiente. CLS medido en la página: 0. Magic Bento y SideRays están en el DOM. No apareció el diálogo de hidratación de Next.
- Desktop (1440×900): Flora 544×544, opacidad del título 1. El tamaño es el de la hoja de estilos, que este experimento no modificó.
- Parallax de escritorio: con scroll en 700 px, `.hero__visual` pasó de la matriz identidad a `translateY(14,6px)`.
- Orden: el `EvaluateScript` del plugin es anterior al primer pintado (628 ms contra 1.188 ms). El tween de parallax existe cuando el usuario puede desplazar.
- Revelados de «Para qué sirve»: arrancan en opacidad 0 por debajo del pliegue y pasan a 1 al entrar en vista después de un scroll de ~500 px. Los `data-revelar` de la sección de instalación no los envuelve `Revelar`; quedan en opacidad 1. Eso ya era así: no están dentro del componente.
- `prefers-reduced-motion: reduce` emulado: el título sigue visible, ningún `[data-revelar]` queda en opacidad 0, y a 800 px de scroll `.hero__visual` sigue sin transform. El parallax no corre.
- Pin de «Con Enflora»: al llevar `#con-enflora` al borde superior hay un `.pin-spacer`. El timeline de scroll se creó.
- No revisé fotograma a fotograma un flash del encabezado. El encabezado no formaba parte del diff y sigue haciendo `from({ opacity: 0 })` en `useLayoutEffect`, antes del pintado, igual que en A.

## 7. Regresiones detectadas

No hay una regresión de LCP atribuible al tratamiento: las diferencias cambian de signo según el grupo de la corrida. CLS se mantuvo en 0. Esta pasada de Lighthouse no midió accesibilidad ni SEO; el HTML del hero no cambió de contenido.

En B el LCP simulado empeora en los cuatro pares que caen en el mismo grupo. No alcanza para declarar una regresión estable, y sí alcanza para no adoptar el cambio.

ESLint sobre los archivos de B: 0 errores. Queda el aviso previo `@next/next/no-img-element` en `cierre.js` (línea 42), ajeno a este experimento. Tests del árbol B, antes de revertir: 787 pasaron, 0 fallaron. Los dos `pnpm build` de los worktrees terminaron y publicaron `BUILD_ID`.

## 8. Decisión

No conservar B.

El plugin ya no está en el chunk del núcleo, y registrarlo cuesta ~8 ms. El primer pintado sigue esperando la hidratación. El chunk más caro de scripting sigue siendo react-dom (cerca de 2–2,8 s atribuidos). Motion sigue en la primera oleada, con 300–500 ms de scripting, y este experimento no lo tocó.

Un segundo tratamiento, independiente y sin implementar: medir aparte si aplazar la evaluación de `motion/react` (el proveedor y los componentes que no hacen falta para pintar Flora) reduce el render delay. No diferir toda la landing ni apagar el SSR. Si esa medición tampoco mueve el LCP, el cuello que queda es la hidratación de React, no GSAP.

El árbol de trabajo de la landing quedó como en la Fase 7. No se desplegó.
