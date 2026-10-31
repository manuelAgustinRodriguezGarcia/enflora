# Admin Sprint 1 — autorización central (con correcciones de seguridad)

Estado: implementado en la rama `admin/sprint1-autorizacion` (worktree `enflora-admin-sprint1`), **sin commit, push ni deploy**.
No se ejecutó SQL ni se agregaron migraciones.

## Arquitectura

```
lib/admin/reglas.js         puro: módulos, análisis de listas de UUID, evaluarAdmin(), diagnóstico de config
lib/admin/nucleo.js         puro (sin server-only): crearNucleoAdmin({leerUsuario, env, respaldos, ahora, ttlMs, advertir})
                            → obtenerAdmin / requerirAdmin / verificar. Es el punto de inyección de PRUEBAS.
lib/admin/respaldos.js      respaldo transitorio por módulo (hoy solo `expo` → mecanismo anterior)
lib/admin/autorizacion.js   server-only: instancia ÚNICA del núcleo, atada a Supabase Auth y process.env.
                            Exporta solo obtenerAdmin(modulo), requerirAdmin(modulo), verificarCredencial(cred, modulo).
lib/admin/politica.js       puro: ACCESO_DATOS_ADMIN (qué tablas/columnas/embebidos/RPC) + evaluarSolicitudAdmin()
lib/admin/servicio.js       server-only: crearClienteRestringido(credencial, modulo) con transporte HTTP restrictivo
lib/expo-cannabis/admin.js            funciones del panel; TODAS exigen credencial de módulo `expo`
lib/expo-cannabis/contactos-admin.js  operaciones de contactos; el cliente nunca sale de este módulo
lib/expo-cannabis/admin-legado.js     mecanismo anterior (a retirar)
lib/expo-cannabis/visitante.js        parte PÚBLICA de Expo (sin privilegios administrativos)
```

### C1 — Credenciales

- La credencial es un objeto **opaco** (prototipo nulo, congelado, sin campos) cuya autenticidad es su **identidad en un
  `WeakMap` privado** del núcleo. Un objeto con la misma forma, un `Proxy`, un clon o una credencial de otro núcleo no se
  reconocen. No se usa `Symbol.for` ni ninguna marca reproducible; `Object.freeze` no es parte de la garantía.
- Datos asociados (solo dentro del registro): id, módulo, vía de acceso y vencimiento. **TTL de 60 s.**
- `verificar(credencial, modulo)` exige un módulo válido y explícito, que la credencial exista, que sea de **ese** módulo y
  que no haya vencido. No hay estado global compartido entre solicitudes: cada `obtenerAdmin` emite su credencial.
- La identidad sigue saliendo **solo** de `getUser()` (verificado contra Supabase Auth).
- Verificado en el build real: ver "Verificación en build real".

### C2 — Cliente privilegiado

`crearClienteRestringido(credencial, modulo)` verifica la credencial y devuelve un objeto congelado con **solo**
`from(tabla)` y `rpc(nombre, args)`; no expone `auth`, `storage`, `functions`, `url`, `fetch` ni las opciones.
Todo el tráfico pasa por un `fetch` propio (`global.fetch` de supabase-js) que valida **cada solicitud HTTP real**, al
último momento (cuando supabase-js ya agregó la clave de servicio). Por eso mutar `builder.url`, usar `builder.fetch`
o tocar `builder.headers` no sirve para saltear la política. Una solicitud bloqueada devuelve un `403` sintético (no un
rechazo: postgrest-js reintenta los GET rechazados) y deja un aviso en el log con el **motivo**, nunca con datos.

La política (`lib/admin/politica.js`) valida: origen y prefijo de la URL configurada; ruta (`/rest/v1/<tabla>` o
`/rest/v1/rpc/<nombre>`); método por tabla; `select` con columnas explícitas (nada de `*`); embebidos declarados y sus
columnas; filtros y operadores permitidos; `order`, `limit`, `offset`, `or`; PATCH/DELETE solo con un único
`id=eq.<uuid>`; columnas de escritura; cabeceras `Accept` y `Accept-Profile`/`Content-Profile` (solo `public`); tamaño de
cuerpo; RPC solo POST y solo de la lista.

### I1 — Parámetros de prueba

La API de producción no recibe `env`, `respaldo` ni `leerUsuario`: la identidad sale únicamente de Supabase Auth. Las pruebas
usan fábricas (`crearNucleoAdmin`, `crearServicioDatosAdmin`) y funciones puras. Un test estático asegura que **ningún
código de la aplicación** importe esas fábricas (`nucleo.js` solo lo importa `autorizacion.js`).

### I4 — Permisos explícitos de Expo

Cada función de `lib/expo-cannabis/admin.js` y de `contactos-admin.js` llama a `verificarAdminExpo` (credencial de módulo
`expo`) antes de crear el cliente. Una credencial de `planes`, `usuarios` o `dashboard` falla con `modulo_incorrecto` y no
produce ninguna solicitud a Supabase. `lib/push/admin.js` usa la misma credencial.

### I3 — Configuración de `ADMIN_IDS`

`analizarListaIds` detecta, **sin imprimir valores**: UUID truncados o malformados, separadores equivocados (`;`, `|`,
espacios internos), comillas accidentales, saltos de línea, entradas vacías y duplicados. Las entradas inválidas se descartan
(fail-closed); el servidor emite un aviso por mensaje distinto con **solo conteos y categorías**. `npm run admin:verificar`
imprime el mismo diagnóstico (sale con código 1 si falta el reemplazo o hay problemas).

## I2 — Acceso legado: sigue ACTIVO

El admin de Expo todavía acepta, además de `ADMIN_IDS`, el **correo fijo del código**, `EXPO_ADMIN_EMAILS` y `EXPO_ADMIN_IDS`
(siempre con cuenta no anónima y correo confirmado). Consecuencias:

- **Quitar un UUID de `ADMIN_IDS` no revoca el acceso** de quien entre por el mecanismo anterior.
- Un ingreso real no distingue por cuál de los dos pasó; por eso la prueba de UUID debe hacerse con una **segunda cuenta de
  prueba cuyo correo no sea el legado**.

Estado pendiente por decisión: no se retira hasta comprobar el acceso por UUID en un entorno real.

### Procedimiento de retiro (NO ejecutado)

1. Configurar `ADMIN_IDS_EXPO` (o `ADMIN_IDS`) en Preview y Production; `npm run admin:verificar` debe salir con código 0.
2. Entrar con la cuenta de prueba (correo no legado) en Preview: debe acceder.
3. Borrar `lib/expo-cannabis/admin-legado.js` y `lib/admin/respaldos.js`; en `autorizacion.js` quitar el import y el argumento `respaldos`.
4. Quitar `EXPO_ADMIN_IDS` / `EXPO_ADMIN_EMAILS` de Vercel y de `.env.example`; ajustar `scripts/verificar-admin.mjs` y los tests "respaldo"/"legado".
5. Verificar en Preview que la cuenta legada (correo fijo) **ya no** entra, y recién después promover a Production.

## Configurar y validar `ADMIN_IDS`

1. Supabase → Authentication → Users: copiar el *User UID* de la cuenta administradora y comprobar que tiene el correo confirmado.
2. Vercel (Preview primero, luego Production): `ADMIN_IDS_EXPO=<uuid>` (o `ADMIN_IDS` para todos los módulos). Formato: UUID completos
   separados por coma; sin comillas, sin `;`, sin saltos de línea. Redeploy.
3. Local: `vercel env pull .env.vercel --environment=preview` y `node --env-file=.env.vercel scripts/verificar-admin.mjs <uuid>`
   (el archivo trae secretos: no se commitea y se borra al terminar). Debe decir que el UUID accede al módulo `expo` y salir con código 0.
4. Revisar el log del servidor tras el primer ingreso: no debe haber avisos `[admin]`.
5. Probar `/expo-cannabis/admin` con la cuenta de prueba: panel, sumar una entrega, abrir contactos, editar y exportar.
6. Probar que otra cuenta (sin UUID listado) recibe 404 y que sin sesión redirige a ingreso.

## Límites de seguridad (leer antes de confiar)

- La política vive **en JavaScript** y es una barrera contra errores y contra código que reciba el cliente por canales
  normales. **No sustituye controles de base de datos**: la clave de servicio (service role) **omite RLS** y, a nivel de
  Postgres, sigue pudiendo todo. Código con ejecución arbitraria en el servidor puede leer `process.env` y usar la clave directamente.
- El control efectivo y definitivo requiere un **rol de Postgres dedicado** (o funciones `SECURITY DEFINER` por operación,
  concedidas solo a ese rol) con permisos mínimos por tabla/columna/RPC, y usar su credencial en lugar de la service role para el admin.
  Eso exige una migración SQL: **no se hizo en este sprint; queda pendiente y recomendado**.
- Lo que sí existe en base: las tablas privadas están revocadas a `anon`/`authenticated` y las RPC administrativas se conceden solo a `service_role`.
- Los clientes con service role de flujos públicos o de pagos (`lib/contactos/datos.js`, `lib/push/datos.js`, `lib/ruleta-420/servidor.js`,
  `lib/pagos/*`, `lib/expo-cannabis/visitante.js`) no pasan por esta capa; un test fija la lista exacta de archivos que mencionan la clave.

## Inventario de autorizaciones

| Sistema | Mecanismo | Reutiliza la central |
| --- | --- | --- |
| Admin Expo (`/expo-cannabis/admin`) | Central (`expo`) + respaldo legado transitorio | **Sí** |
| Pruebas push de sesión (`/api/push/probar`) | `lib/push/admin.js` → credencial `expo` | **Sí** |
| Prueba push por secreto (`/api/push/prueba`) | `PUSH_PRUEBA_SECRETO` | No (secreto de máquina) |
| Gate de prelanzamiento | Correo fijo en `lib/acceso-prelanzamiento.js` | No (no se tocó) |
| Admin RAG de Flora (Edge) | Secretos de la Edge Function | No (no se tocó) |
| Crons / pagos | `CRON_SECRET`, `PLUS_MONITOR_SECRET`, firmas | No (no se tocó) |

## Para empezar la migración a `/admin`

- Mover la ruta y la constante `RUTA` de `acciones.js`; actualizar `proxy.js`, `app/layout.js`, `lib/navegacion.js`,
  `componentes/clase-cuerpo.js`, `lib/pagos/rutas.js`, `componentes/landing/footer.js`, `componentes/expo-cannabis/redirigir-admin.js` y los tests que fijen la ruta.
- Declarar en `ACCESO_DATOS_ADMIN` las tablas/RPC de cada módulo nuevo; para datos de usuarios reales, vistas o RPC específicas (agregados), nunca `from()` genérico.
- Resolver el rol de base de datos dedicado (arriba) antes de sumar escrituras sobre usuarios, planes o licencias, y auditar quién hizo qué.

## Verificación

- `npm test`: **494 pruebas, 0 fallas** (incluye `admin-autorizacion` 33, `admin-transporte` 20 y `admin-expo` 18).
- `eslint lib app scripts tests proxy.js`: 0 errores (3 advertencias previas de `<img>`, ajenas).
- `next build --webpack`: OK.
- `next build` (Turbopack) **falla en este worktree** por `Symlink [project]/node_modules is invalid, it points out of the filesystem root`:
  `node_modules` es un junction hacia el repo principal. Es un impedimento del entorno de trabajo, no del código; no se modificó el repo principal para evitarlo.
  Se resuelve instalando dependencias dentro del worktree o construyendo ya integrado en el repo principal.

### Verificación en build real

Con el build de producción (`next build --webpack` + `next start`) contra un Supabase falso local (Auth y REST) y una cookie de sesión de prueba:

- sin sesión → 307 a `/ingreso`, 0 solicitudes REST;
- UUID listado en `ADMIN_IDS_EXPO` → 200 y las 4 consultas esperadas pasan el transporte restrictivo (inventario, resumen de participantes, contactos con embebidos, resumen de contactos);
- UUID no listado → 404, 0 solicitudes REST;
- sin avisos `[admin]` en el log del servidor.

Esto confirma que la credencial emitida se reconoce en el módulo consumidor dentro del bundle compilado. Los archivos temporales se eliminaron.

## Integración

Desde el commit base (`d1e9a68`) `main` avanzó (`0ce2c78`: pagos piloto y "cambios en admin site"). El único archivo en común es `.env.example`,
en regiones distintas. No se probó el merge con los cambios (siguen sin commitear); re-correr tests y build tras integrar.
