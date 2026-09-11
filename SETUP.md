# Activar login y pagos

Esta app ya tiene el código de login/registro (Supabase) y pagos (Stripe)
listo. Falta conectar tus propias cuentas — ningún dato ni clave real vive
en este repo.

## 1. Login y registro (Supabase)

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. En el proyecto, abre **SQL Editor** y ejecuta todo el contenido de
   [`supabase/schema.sql`](./supabase/schema.sql). Esto crea la tabla
   `profiles` (con roles `cliente` / `vendedor`), las políticas de
   seguridad (RLS) y el trigger que crea un perfil automáticamente cada
   vez que alguien se registra.
3. Ve a **Project Settings -> API** y copia:
   - `Project URL` -> pégalo en `VITE_SUPABASE_URL`
   - `anon public` key -> pégalo en `VITE_SUPABASE_ANON_KEY`
4. Todo el que se registre desde `/registro` entra con rol `cliente`. No
   hay forma pública de crear un `vendedor` (por seguridad) — para dar
   acceso de equipo interno a alguien, corre en el SQL Editor:
   ```sql
   update public.profiles set role = 'vendedor' where email = 'persona@easycomex.com';
   ```

Con eso, `/login`, `/registro` y `/dashboard` ya funcionan de verdad:
`/dashboard` muestra una vista distinta si el usuario es `cliente` o
`vendedor`.

## 2. Pagos (Stripe)

1. Crea una cuenta en [stripe.com](https://stripe.com) (modo test para
   probar, sin necesidad de datos reales de tu empresa todavía).
2. En el dashboard de Stripe, crea dos **Products** con su **Price**:
   - "Diagnóstico de madurez" — USD 6.90, pago único
   - "Análisis de mercado y competencia" — USD 499, pago único
3. Copia el `price_...` de cada uno en:
   - `STRIPE_PRICE_DIAGNOSTICO_MADUREZ`
   - `STRIPE_PRICE_ANALISIS_MERCADO`
4. En **Developers -> API keys**, copia la **Secret key** (`sk_test_...`
   mientras pruebas) en `STRIPE_SECRET_KEY`.
5. Para los webhooks (confirmar que un pago realmente se completó):
   usa `stripe listen --forward-to localhost:3000/api/stripe-webhook`
   con el Stripe CLI mientras desarrollas, y copia el `whsec_...` que te
   da en `STRIPE_WEBHOOK_SECRET`. En producción, crea el webhook endpoint
   real desde el dashboard de Stripe apuntando a
   `https://tu-dominio.com/api/stripe-webhook`.

**Importante sobre dónde hostear:** las rutas de pago (`/api/...`) viven
en el servidor Express (`server/index.ts` y `server/stripe.ts`), no en
el sitio estático. Si publicas solo el build estático (por ejemplo a un
hosting que solo sirve archivos, como Netlify o GitHub Pages sin
funciones), esas rutas no van a existir. Necesitas correr el servidor
Node (`pnpm build && pnpm start`) en un host que ejecute Node — Render,
Railway, Fly.io, un VPS, etc.

De momento solo el plan de **Análisis de mercado (USD 499)** tiene botón
de pago conectado, porque es el único con precio fijo — el "Plan de
crecimiento" es a medida (cotización) y el diagnóstico básico es
gratuito. Si quieres cobrar también el diagnóstico de madurez (USD 6.90),
avísame y conecto ese botón también.

## 3. Variables de entorno

Copia `.env.example` a `.env` y llena los valores de arriba. Las que
empiezan con `VITE_` son públicas (van al navegador); las de Stripe NO
llevan ese prefijo porque deben quedarse solo en el servidor.
