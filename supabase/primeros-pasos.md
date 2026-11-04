# Primeros pasos con un Supabase nuevo

1. **SQL Editor → New query**: pega `schema.sql` y dale Run. Luego pega `casillero.sql` y Run.
   (Los dos se pueden correr más de una vez sin problema. Si prefieres un solo pegado,
   pega `schema.sql` y `casillero.sql` uno detrás del otro en la misma consulta.)
   Si alguien ya se había registrado antes de instalarlo, el instalador le crea su ficha
   (sin ficha, el portal muestra «No pudimos cargar tu perfil»).
2. **Authentication → Providers → Email**: para una demo, desactiva "Confirm email"
   así el registro entra directo sin esperar un correo.
3. **Authentication → URL Configuration**: en "Site URL" y "Redirect URLs" agrega la
   dirección de la app (https://easycomex-casillero.onrender.com y `/**`).
4. **Project Settings → API**: copia `Project URL`, la llave `anon`/publishable y la
   `service_role`/secret. En Render → Environment pon:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`
   (la service_role va solo ahí, nunca en el navegador).
   Las `VITE_` se incorporan al compilar: al guardar, Render vuelve a compilar y publicar
   solo (2 a 3 minutos). Espera a que diga **Live** antes de probar.
5. Regístrate en `/casillero/registro` y hazte administrador:
   ```sql
   update public.profiles set role = 'vendedor' where email = 'tu@correo.com';
   ```
   Cierra sesión y vuelve a entrar; ahora `/admin/casillero` abre.
6. (Opcional) Para la demo, pega `demo-datos.sql` tal cual: usa tu cuenta de administrador.
   Para borrarlo después, las instrucciones están al inicio del archivo.
7. (Para conectar tiendas) En Render agrega `INTEGRATIONS_ENC_KEY` (genera una con
   `openssl rand -base64 32`) y `PUBLIC_APP_URL=https://easycomex-casillero.onrender.com`.
   En el portal del administrador, Configuración muestra qué piezas están conectadas.
