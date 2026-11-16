# Guías de Enflora

Recorridos interactivos sobre las pantallas reales. El asistente de cultivo sigue creando el espacio, las unidades y las plantas en una sola operación: las guías lo explican y solo marcan la creación como completa cuando ese guardado sale bien.

## Dependencia

`driver.js` 1.14, instalada con pnpm. No había otra librería de spotlight en el proyecto. GSAP y Motion siguen para la animación propia; no reemplazan el overlay, el anclaje ni el scroll al objetivo.

Se usa un paso de Driver.js por vez. El avance lo decide la app (ruta, paso del asistente o guardado), no una secuencia rígida de la librería.

## Archivos

Creados:

- `lib/guias/catalogo.js` — definición de las guías y sus pasos.
- `lib/guias/maquina.js` — estados, avance, pausa, salto y finalización.
- `lib/guias/posicion.js` — el popover no queda fuera de la pantalla ni debajo de la navegación.
- `lib/guias/persistencia.js` — copia local por usuario y fusión con Supabase.
- `lib/guias/eventos.js` — eventos de la app hacia la guía.
- `lib/guias/tienda.js` — estado compartido con Perfil.
- `componentes/guias/anfitrion-guias.js` — bienvenida, carga y efectos de navegación.
- `componentes/guias/spotlight-guia.js` — Driver.js, foco, teclado y limpieza.
- `componentes/guias/panel-guias.js` — “Guías de Enflora” en Perfil.
- `estilos/componentes/_recorrido-guias.scss` — lo importa el anfitrión. No entra por `@use` en `sitio-publico.scss`: Turbopack resuelve `componentes/` contra la carpeta de JavaScript y no encuentra el parcial.
- `supabase/guias-enflora.sql`
- `tests/guias.test.js`

Modificados para enganchar `data-tour` y eventos, sin cambiar la lógica de negocio del asistente:

- `app/layout.js`
- `app/cultivos/page.js`
- `componentes/asistente-espacio.js`
- `componentes/bottom-nav.js`
- `componentes/inicio/panel-inicio.js`
- `componentes/espacios/contenido-lista-espacios.js`
- `componentes/flora/fab-nuevo-chat-flora.js`
- `componentes/flora/chat-flora.js`
- `componentes/selector-metodo.js`
- `componentes/perfil-vista.js`
- `componentes/cerrar-sesion.js`
- `estilos/componentes/_formularios.scss`
- `package.json`

## Rutas

- La bienvenida aparece en la app autenticada si la persona no tiene espacios y no la pospuso ni la aceptó.
- “Crear un espacio” señala “Creá tu cultivo” en Inicio o el botón de crear en Cultivos, y sigue en `/cultivos/nuevo`.
- “Configurar unidades y plantas” acompaña el mismo asistente: tipo de unidad, cantidad y nombre, plantas, método, sustrato si el método lo muestra, etapa y confirmación.
- “Conocer a Flora” señala el botón Flora de la barra inferior, abre `/flora` cuando la persona lo toca y explica el campo de mensaje. El ejemplo “¿Cómo vienen mis plantas?” se puede copiar al campo. No se envía solo.

## Controlador

Estados por guía: `no_iniciado`, `en_progreso`, `pausado`, `completado`, `omitido`.

- Empezar, pausar (Cerrar o Escape), continuar, saltar, repetir y volver.
- Si el asistente rechaza un dato, el paso no cambia.
- Si el guardado devuelve error, la guía sigue en la confirmación.
- Si el guardado redirige a `/cultivos/[id]`, se completan las guías de creación que estaban en curso y, en el recorrido de una cuenta nueva, se presenta Flora.
- Si el objetivo no está, a los 2,5 s la tarjeta queda centrada con Saltar o Seguir. Un paso opcional (sustrato, replicar) se saltea. No queda un overlay eterno: Cerrar pausa y devuelve la interfaz.
- Al salir de `/cultivos/nuevo` a otra pantalla durante la creación, la guía se pausa en el último paso válido.
- Con cultivos ya creados, el modo es explicativo: se puede terminar la guía sin guardar otro cultivo. Si la persona crea uno, usa el asistente normal.

Para sumar una guía: agregá un objeto en `GUIAS` con `id`, `version`, textos y pasos (`objetivos` con `data-tour`, `avance` de tipo `manual`, `ruta`, `wizard` o `guardado`). Subí `version` si cambia el recorrido de una guía ya publicada. Incluí el `id` en el `check` de `supabase/guias-enflora.sql`.

## Persistencia

Tabla `public.progreso_guias`: usuario, id de guía, versión, estado, id de paso y fecha. RLS con `auth.uid() = usuario_id`. Sin anon. Sin datos del cultivo.

En el navegador hay una copia `enflora.guias.v1.<usuario>`. Al cerrar sesión se borra. Si la tabla todavía no existe, la guía sigue en ese dispositivo y no rompe la app. Entre dispositivos hace falta la tabla.

**Hay que ejecutar `supabase/guias-enflora.sql` en Supabase.** Este cambio no lo corre solo.

## Pruebas

`tests/guias.test.js` cubre usuario nuevo, usuario con cultivos, inicio y cierre, pausa y reanudación, cambio de ruta, objetivo ausente, validación fallida, error de guardado, pantalla baja, repetición, recarga y aislamiento entre usuarios. El SQL se revisa por el texto de las políticas.

No hay un recorrido visual automatizado con sesión real. La verificación en el navegador depende de estar autenticado.

## Límites

- Hasta correr el SQL, el progreso no viaja a otro dispositivo.
- El sustrato solo se señala si el método elegido lo muestra.
- Con varias unidades, el asistente puede volver a pedir plantas; la guía acompaña ese paso.
- Driver.js sigue en el paquete del cliente autenticado. No se carga en la landing como dependencia de esas páginas más allá del layout compartido de la app.
- El ejemplo de Flora no se manda a Gemini.
