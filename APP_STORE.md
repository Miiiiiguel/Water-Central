# Publicar en App Store y Google Play

## Lo que ya está listo en el código

- **Capacitor configurado** (`capacitor.config.ts`, appId `com.easycomex.app`) —
  envuelve el sitio web en un proyecto nativo real.
- **Proyectos nativos generados**: carpetas `android/` y `ios/` en el repo,
  listas para abrir en Android Studio / Xcode.
- **Íconos y splash screens reales** generados para ambas plataformas
  (todas las densidades de Android, todos los tamaños de iOS, modo claro
  y oscuro) a partir de `resources/icon.png`.
- **Manifest PWA** con nombre, colores de marca y los mismos íconos.
- **Política de privacidad** (`/privacidad`) y **Términos y condiciones**
  (`/terminos`) — ambas tiendas exigen una URL de política de privacidad
  para aprobar la app, y hasta ahora esos links no llevaban a ningún
  lado. Revísalas con un abogado antes de publicar (lo dice también un
  aviso dentro de cada página).

## Lo que tenés que hacer vos (no lo puedo hacer yo de forma remota)

Publicar en las tiendas requiere tus propias cuentas, tu propio hardware
(Mac para iOS) y pasar por el proceso de revisión de cada tienda — nada
de esto se puede automatizar completamente desde este entorno.

### 1. Cuentas de desarrollador

- **Apple Developer Program** — USD 99/año. Se crea en
  [developer.apple.com](https://developer.apple.com). Necesitas un Mac
  con Xcode instalado (gratis desde la App Store de macOS).
- **Google Play Console** — USD 25, pago único. Se crea en
  [play.google.com/console](https://play.google.com/console). Necesitas
  Android Studio instalado (cualquier sistema operativo).

### 2. Compilar la app

```bash
# Después de cualquier cambio al sitio:
pnpm run cap:sync        # build + sincroniza con android/ e ios/

# Abrir cada proyecto en su IDE nativo:
pnpm run cap:android     # abre Android Studio
pnpm run cap:ios         # abre Xcode (solo en Mac)
```

Desde ahí, cada IDE te guía para firmar la app (crear un keystore en
Android Studio / un certificado de distribución en Xcode) y generar el
build de release (`.aab` para Android, archivo para App Store Connect
en iOS).

### 3. Antes de enviarla a revisión

- [ ] **Screenshots reales** de la app corriendo en un dispositivo o
      simulador (cada tienda pide tamaños específicos — Android
      Studio/Xcode te ayudan a capturarlos).
- [ ] **Ícono final aprobado** — el que generé es un placeholder
      funcional (fondo navy, "e" naranja). Si querés algo más elaborado,
      reemplaza `resources/icon.png` (1024×1024) y corre
      `npx capacitor-assets generate --android --ios` de nuevo.
- [ ] **Descripción de la app** en español (y opcionalmente inglés) para
      cada tienda — corta (para el listado) y larga (para la ficha).
- [ ] **Categoría**: probablemente "Negocios" / "Business".
- [ ] **Email y web de soporte**: ya tenés info@easycomex.com y
      easycomex.com.
- [ ] **Cuestionario de clasificación de contenido** (Google) y **Age
      Rating** (Apple) — para una app de negocios B2B, normalmente la
      calificación más baja aplica sin problema.
- [ ] **"Data safety" (Google) / "App Privacy" (Apple)** — declaración de
      qué datos recopila la app. Según lo que ya construimos, deberías
      declarar: email, nombre, teléfono (para contacto/cotizaciones);
      datos de uso si tenés píxeles de Meta/TikTok/GA activos. Usa la
      política de privacidad (`/privacidad`) como referencia exacta.

### 4. Una advertencia real sobre Apple

Apple rechaza apps que son "solo un sitio web envuelto" (guideline 4.2,
mínima funcionalidad). Esta app tiene a favor que **no es solo
marketing**: tiene login real, dashboard con datos en vivo,
notificaciones, chatbot — funcionalidad real de app, no solo páginas
estáticas. Aun así, si Apple la rechaza por esto, lo normal es agregar
alguna función nativa adicional (por ejemplo notificaciones push reales,
ver sección de push en `SETUP.md`) y volver a enviarla. Google Play es
notablemente más permisivo con apps de este tipo.

### 5. Tiempos esperados

- **Google Play**: revisión inicial típicamente unas horas a 1-2 días.
- **Apple App Store**: típicamente 24-48 horas, puede tomar más si piden
  información adicional.

Ninguno de estos tiempos depende de mí — son procesos de revisión humana
de cada tienda.
