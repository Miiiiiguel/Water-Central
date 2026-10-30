# Primeros pasos con un Supabase nuevo

1. **SQL Editor → New query**: pega `schema.sql`, Run. Luego pega `casillero.sql`, Run.
   (Los dos se pueden correr más de una vez sin problema.)
2. **Authentication → Providers → Email**: para una demo, desactiva "Confirm email"
   así el registro entra directo sin esperar un correo.
3. **Authentication → URL Configuration**: en "Site URL" y "Redirect URLs" agrega la
   dirección de la app (https://easycomex-casillero.onrender.com y `/**`).
4. **Project Settings → API**: copia `Project URL`, la llave `anon`/publishable y la
   `service_role`/secret. En Render → Environment pon:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`
   (la service_role va solo ahí, nunca en el navegador) y redespliega.
5. Regístrate en `/casillero/registro` y hazte administrador:
   ```sql
   update public.profiles set role = 'vendedor' where email = 'tu@correo.com';
   ```
6. (Opcional) Para la demo, pega `demo-datos.sql` con tu correo.
