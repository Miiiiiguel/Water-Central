# USACARGOS SHOP

Tienda en línea con despacho desde bodega propia, panel de administración tipo Shopify y programa de vendedores (referidos).

## Qué incluye
- **Tienda** (`/`): catálogo, búsqueda inteligente, carrito, checkout exprés, pago **contra entrega** y/o **Mercado Pago**, seguimiento del pedido con transportadora y guía (`/pedido/:id`), "Mis pedidos", app instalable (PWA).
- **Administración** (`/admin`, con contraseña):
  - Inicio: ventas de hoy/7/30 días, ticket promedio, pedidos por despachar, contra entrega por cobrar, comisiones por pagar, gráfica de 30 días, más vendidos e inventario bajo.
  - Pedidos: toda venta en línea queda reportada. Flujo **Por despachar → Empacado → Enviado (transportadora + guía) → Entregado**, con impresión de la orden de despacho (indica "COBRAR AL ENTREGAR" en contra entrega), aviso al cliente por WhatsApp, cancelación con devolución de inventario, nota interna e historial.
  - Productos: precio, inventario, visibilidad, nombre y descripción editables; el inventario se descuenta solo con cada venta.
  - Mensajes: bandeja de PQRS con estado (nuevo, en proceso, resuelto), nota interna y respuesta por correo o WhatsApp.
  - Vendedores: ventas, conversión, comisiones por pagar/pagadas, registrar pagos y ver el **panel de cada vendedor** tal como lo ve él.
- **Vendedores** (`/afiliados.html`): registro, link personal, panel con nivel (Bronce/Plata/Oro/Diamante), ganancias por mes, estado de cada venta y productos listos para compartir.
- **Información legal y PQRS**: Quiénes somos, Envíos, Cambios y garantías (retracto de 5 días hábiles, garantía legal y reversión del pago, Ley 1480 de 2011), Términos y condiciones, Privacidad (Ley 1581 de 2012) y formulario de Contacto/PQRS con número de radicado. Los mensajes llegan a **Administración → Mensajes**.

## Fotos
Las fotos salen del PDF del proveedor: se extrae la imagen original de cada producto (87 en alta resolución) y las 83 que solo existían en 122×94 px se amplían ×4 con Real-ESRGAN. Todas quedan cuadradas, con encuadre uniforme, en `public/fotos/` (900 px) y `public/fotos/s/` (400 px), más `public/og/` para compartir en redes.

## Reglas del negocio
- Contra entrega: el inventario se reserva al crear el pedido; el pago (y la comisión del vendedor) se confirma al marcarlo **Entregado y cobrado**.
- Mercado Pago: el inventario se descuenta y la comisión se genera cuando el pago queda aprobado (webhook o regreso del cliente).
- Comisión: `COMMISSION_PCT` % sobre el valor de los productos (sin envío). Si el pedido se cancela, la comisión se anula.

## Datos
Supabase, en un esquema aislado `shop` que **no** está expuesto por la API. El servidor accede solo mediante la función `public.shop_api(secret, action, args)`, que valida `SHOP_API_SECRET` (guardado en `shop_private.config`). Esquema: `supabase/schema.sql`. Sin variables de Supabase, la app usa `data/db.json` (modo local).

## Local
    npm install
    npm start            # http://localhost:3000 · admin: /admin (contraseña "admin" en local)
    npm test             # pruebas de punta a punta de la API (no tocan la base de datos real)

## Calidad
- Lighthouse (móvil): 99–100 en rendimiento, accesibilidad, buenas prácticas y SEO en las páginas públicas.
- axe-core: 0 fallas WCAG 2.1 AA en 68 vistas (tienda, checkout, pedido, referidos y administración; claro/oscuro; celular/escritorio).
- Fuentes propias precargadas, compresión, JS/CSS minificados al arrancar con versión en la URL y caché de un año, Content-Security-Policy estricta.

## Despliegue (Render)
`render.yaml` define el servicio. Variables: ver `.env.example`. Llena `LEGAL_NAME`, `LEGAL_ID` (NIT), `LEGAL_ADDRESS`, `LEGAL_CITY`, `CONTACT_EMAIL` y `CONTACT_PHONE` para que aparezcan los datos del responsable en las páginas legales. Para activar Mercado Pago agrega `MP_ACCESS_TOKEN` (y `MP_WEBHOOK_SECRET`) y configura el webhook `https://TU-DOMINIO/api/mp/webhook`.
