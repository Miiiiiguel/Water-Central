# Seguridad — estado real, punto por punto

Cada ítem del checklist con lo que **ya está en el código**, lo que
**depende de tu cuenta/hosting** (5 minutos cada uno) y lo que **no
aplica** y por qué. Nada acá es aspiracional: si dice "hecho", está en
el repo y se puede verificar con `pnpm security:smoke <url>`.

Leyenda: ✅ hecho · ⚙️ necesita tu acción · ➖ no aplica

---

## 1. Autenticación robusta (sesiones/JWT, expiración, rotación, MFA)

- ✅ **Sesiones = JWT de Supabase Auth**. Access token de 1 hora; refresh
  token con **rotación y detección de reuso** (si un refresh token robado
  se usa dos veces, Supabase invalida toda la familia de tokens).
- ✅ **Cerrar sesión revoca en todos los dispositivos** (`scope: 'global'`).
- ✅ **MFA (TOTP)**: cualquier usuario puede activarla desde *Seguridad de
  la cuenta* en el dashboard (QR + código). Al entrar con contraseña o
  Google, si la cuenta tiene 2FA, la app exige el código y **no muestra
  nada** hasta pasarlo. El servidor lee el nivel de garantía del JWT
  (`aal2`) y puede exigirlo en rutas sensibles (`requireRole('vendedor',
  { mfa: true })` en `server/auth.ts`).
- ✅ **Contraseña mínima de 8 caracteres con letras y números**;
  mensajes de error idénticos para "email inexistente" y "contraseña
  incorrecta" (sin enumeración de cuentas).
- ✅ **Recuperación de contraseña** (`¿La olvidaste?` → email → `/restablecer`),
  con el mismo mensaje exista o no la cuenta; el link vence en 1 hora.
- ⚙️ En Supabase → Authentication → Settings: **Confirm email** ON,
  **Leaked password protection** ON (compara contra HaveIBeenPwned),
  **Minimum password length** 8. Opcional: bajar el JWT expiry a 30 min.
- ⚙️ Recomendado: exigir MFA a todo el equipo (`vendedor`). Está el
  mecanismo; falta que cada persona lo active desde su dashboard.

## 2. Autorización en el servidor (no solo ocultar botones)

- ✅ **Row Level Security en cada tabla** (`supabase/schema.sql`): la base
  de datos misma rechaza leer/escribir lo ajeno, aunque el frontend se
  manipule. `payments` no tiene política de escritura para clientes: solo
  el servidor con la service-role key puede marcar algo como pagado.
- ✅ **Middlewares `requireUser` / `requireRole`** (`server/auth.ts`):
  verifican el JWT con Supabase y cargan el rol **desde la base de datos**
  antes de ejecutar la ruta. `/api/health` devuelve la configuración solo
  a un `vendedor` verificado; a cualquier otro, `{ ok: true }`.
- ✅ El checkout de Stripe ata el pago al usuario que el **servidor**
  verificó por su token — nunca a un id enviado por el navegador.
- ✅ El rol no se puede auto-asignar: la política de `profiles` bloquea
  cambiar `role` incluso al dueño; solo SQL directo lo cambia.

## 3. Rate limiting

- ✅ Por IP, con registro de cada bloqueo en el log de seguridad:
  `/api/*` 100/15 min · chatbot 30 · checkout 20 · voz 40 · **formularios
  de contacto y flete 8** · reportes CSP 60 · webhook push 300.
- ✅ Los formularios públicos ahora pasan por el servidor (`/api/leads`,
  `/api/quotes`) justamente para poder limitarlos; antes iban directo
  a Supabase.
- ⚙️ Login, registro y recuperación de contraseña los limita **Supabase
  Auth** (Authentication → Rate Limits: valores por defecto razonables;
  podés bajarlos). Sumá **Captcha** (hCaptcha/Turnstile) en la misma
  pantalla y avisame para agregar el widget.

## 4. Gestión de secretos

- ✅ `.env` está en `.gitignore`; el repo solo tiene `.env.example` con
  valores vacíos. Ningún secreto está en el código.
- ✅ Separación estricta: solo variables `VITE_*` llegan al navegador. El
  servidor **avisa al arrancar** si detecta un secreto con prefijo
  `VITE_` (que lo haría público) o una key live de Stripe fuera de
  producción (`server/env.ts`).
- ✅ **Escaneo de secretos en CI** con gitleaks en cada push
  (`.github/workflows/security.yml`).
- ⚙️ Secretos solo en el panel del hosting (Render → Environment).
  Rotá cualquier key que alguna vez haya pasado por un chat, captura o
  email.

## 5. Validación / sanitización de entradas

- ✅ **SQL injection**: no hay SQL construido a mano; todo va por el
  cliente de Supabase (consultas parametrizadas) y RLS.
- ✅ **XSS**: React escapa todo por defecto; no hay `innerHTML` con datos
  de usuario. CSP estricta sin `unsafe-inline` para scripts como segunda
  capa.
- ✅ **Command injection**: el servidor no ejecuta comandos del sistema.
- ✅ **Cada body** se valida con `zod`: tipos, enums, longitudes máximas,
  emails, y rechazo de caracteres de control. Cuerpos > 16 KB → 413.
  Solo GET/POST → 405.
- ✅ Honeypot en formularios públicos, verificado **en el servidor**.

## 6. Cookies (Secure, HttpOnly, SameSite)

- ➖ **La app no usa cookies de sesión.** La sesión de Supabase viaja
  como Bearer token (`Authorization` header) desde el almacenamiento del
  navegador, y las rutas del servidor solo aceptan ese header. No hay
  cookie que endurecer. Si algún día se agregan cookies, `helmet` ya
  está y la regla es `Secure; HttpOnly; SameSite=Lax` como mínimo.

## 7. Content-Security-Policy

- ✅ CSP completa en `server/security.ts`: `default-src 'self'`,
  `script-src` sin `unsafe-inline`/`unsafe-eval` con lista blanca por
  dominio (Calendly, pixels), `object-src 'none'`, `base-uri 'self'`,
  `form-action` solo a Stripe, `frame-ancestors`, `upgrade-insecure-requests`.
- ✅ **Violaciones reportadas** a `/api/csp-report` y registradas como
  evento de seguridad — si alguien intenta inyectar un script, lo ves.
- ℹ️ `style-src` permite `unsafe-inline` porque framer-motion/Radix/sonner
  aplican estilos en runtime; la inyección de CSS no ejecuta código y
  los scripts siguen estrictos.
- ✅ Además: HSTS 1 año + preload, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy` (cámara/GPS/USB/Bluetooth off).

## 8. CSRF

- ➖ **No aplica**: sin cookies de sesión no hay CSRF clásico (el
  navegador no adjunta el Bearer token solo). Refuerzos igual presentes:
  CORS con lista blanca (tu dominio + app nativa), `form-action` en CSP,
  y los webhooks entrantes verifican firma (Stripe) o secreto (Supabase).

## 9. Dependencias y auditoría

- ✅ `pnpm audit --prod`: **0 vulnerabilidades** (se eliminaron paquetes
  muertos de la plantilla que traían 65+, y se forzaron parches
  transitivos vía `pnpm.overrides`).
- ✅ **CI en cada push y semanal**: typecheck, build, audit (falla en
  high/critical), smoke test de seguridad contra el servidor recién
  compilado, gitleaks.
- ✅ **Dependabot** semanal (npm) y mensual (GitHub Actions).
- ⚙️ Revisar y mergear los PRs de Dependabot.

## 10. Logging y monitoreo de eventos de seguridad

- ✅ **Log estructurado JSON** (`server/log.ts`) con `kind:"security"`
  para: rate limit alcanzado, origen CORS rechazado, método rechazado,
  no autenticado, prohibido (rol/MFA), input inválido, honeypot, firma
  de webhook inválida, violación CSP, error de servidor. Incluye IP,
  ruta, user-agent; **nunca** bodies, tokens ni keys.
- ✅ **Sentry opcional** para servidor y cliente (`SENTRY_DSN`,
  `VITE_SENTRY_DSN`): errores con stack + los eventos de arriba. El SDK
  del cliente solo se descarga si hay DSN.
- ⚙️ Crear proyecto en sentry.io (plan gratis alcanza) y configurar una
  alerta para `security:*`. En Render, los logs se buscan con
  `kind:"security"`.

## 11. Backups y recuperación

- ⚙️ **Base de datos**: en Supabase, el plan Pro incluye backups diarios
  (7 días) y opcionalmente **PITR** (recuperación a cualquier punto en el
  tiempo). El plan Free **no tiene backups** — para producción, Pro.
- ✅ `pnpm backup:db` (`scripts/backup-db.sh`) hace un dump completo
  (`public` + `auth`) comprimido, para guardar fuera de Supabase; incluye
  el comando de restore. Corrélo semanal y guardá el archivo cifrado.
- ✅ **Código**: git (GitHub). **Configuración**: `.env.example` documenta
  cada variable; guardá los valores reales en un gestor de contraseñas.
- ⚙️ **Plan de recuperación** (probalo una vez): 1) nuevo proyecto
  Supabase → correr `schema.sql` → restaurar dump; 2) Render → Blueprint
  desde el repo → pegar variables; 3) actualizar DNS y webhooks (Stripe,
  Supabase). Tiempo estimado: < 1 hora.

## 12. Manejo seguro de errores

- ✅ Manejador global en Express: errores de cliente → estado preciso
  (400/403/405/413/429) con mensaje genérico; cualquier otro → `500
  "Internal error"`. El stack va al log del servidor y a Sentry, **nunca
  a la respuesta**. `/api/*` inexistente → 404 JSON, no la página.
- ✅ Frontend: el `ErrorBoundary` de la plantilla mostraba el **stack
  trace al usuario**; ahora muestra un mensaje amable y reporta a Sentry.
  El stack solo se ve en desarrollo local.
- ✅ `X-Powered-By` desactivado.

## 13. Escaneo de vulnerabilidades / pentesting

- ✅ `pnpm security:smoke https://tu-dominio` — 14 comprobaciones de
  cabeceras, CORS, métodos, tamaños, inyección, autorización y rate
  limiting, sin tocar datos. Corre también en CI contra cada build.
- ⚙️ Antes de producción, un escaneo externo real:
  - [OWASP ZAP baseline](https://www.zaproxy.org/docs/docker/baseline-scan/):
    `docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://tu-dominio`
  - [Mozilla Observatory](https://observatory.mozilla.org) y
    [securityheaders.com](https://securityheaders.com) para las cabeceras.
  - Para pagos y datos de clientes reales, un pentest manual por un
    tercero antes de campañas grandes.

---

## Reportar un problema

`/.well-known/security.txt` → `info@easycomex.com`.


## Excepciones del escaneo de secretos

`.gitleaks.toml` mantiene el conjunto de reglas por defecto completo y
añade **una sola** excepción: el secreto de integridad del ejemplo
resuelto que Wompi publica en su documentación, usado en
`server/wompi.test.ts` para comprobar que nuestra firma da el mismo hash
que ellos. Es público por diseño y no pertenece a ninguna cuenta nuestra.

La excepción es la **cadena exacta**, no la ruta del archivo: un secreto
nuevo en ese mismo archivo sigue tumbando el escaneo. Cualquier
excepción futura se escribe igual — valor literal y razón escrita —
porque el día que una de estas tape una llave real, el daño es real.
