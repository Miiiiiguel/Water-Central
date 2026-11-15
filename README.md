# USACARGOS SHOP

Tienda en línea con despacho desde bodega propia, panel de administración tipo Shopify y programa de vendedores (referidos).

## Qué incluye
- **Tienda** (`/`): catálogo, búsqueda inteligente, carrito, checkout exprés, pago **contra entrega** y/o **Mercado Pago**, seguimiento del pedido con transportadora y guía (`/pedido/:id`), "Mis pedidos", app instalable (PWA).
- **Administración** (`/admin`, con contraseña):
  - Inicio: ventas de hoy/7/30 días, ticket promedio, pedidos por despachar, contra entrega por cobrar, comisiones por pagar, gráfica de 30 días, más vendidos e inventario bajo.
  - Pedidos: toda venta en línea queda reportada. Flujo **Por despachar → Empacado → Enviado (transportadora + guía) → Entregado**, con impresión de la orden de despacho (indica "COBRAR AL ENTREGAR" en contra entrega), aviso al cliente por WhatsApp, cancelación con devolución de inventario, nota interna e historial.
  - Productos: precio, inventario y visibilidad editables; el inventario se descuenta solo con cada venta.
  - Vendedores: ventas, conversión, comisiones por pagar/pagadas, registrar pagos y ver el **panel de cada vendedor** tal como lo ve él.
- **Vendedores** (`/afiliados.html`): registro, link personal, panel con nivel (Bronce/Plata/Oro/Diamante), ganancias por mes, estado de cada venta y productos listos para compartir.

## Reglas del negocio
- Contra entrega: el inventario se reserva al crear el pedido; el pago (y la comisión del vendedor) se confirma al marcarlo **Entregado y cobrado**.
- Mercado Pago: el inventario se descuenta y la comisión se genera cuando el pago queda aprobado (webhook o regreso del cliente).
- Comisión: `COMMISSION_PCT` % sobre el valor de los productos (sin envío). Si el pedido se cancela, la comisión se anula.

## Datos
Supabase, en un esquema aislado `shop` que **no** está expuesto por la API. El servidor accede solo mediante la función `public.shop_api(secret, action, args)`, que valida `SHOP_API_SECRET` (guardado en `shop_private.config`). Esquema: `supabase/schema.sql`. Sin variables de Supabase, la app usa `data/db.json` (modo local).

## Local
    npm install
    npm start            # http://localhost:3000 · admin: /admin (contraseña "admin" en local)

## Despliegue (Render)
`render.yaml` define el servicio. Variables: ver `.env.example`. Para activar Mercado Pago agrega `MP_ACCESS_TOKEN` (y `MP_WEBHOOK_SECRET`) y configura el webhook `https://TU-DOMINIO/api/mp/webhook`.
