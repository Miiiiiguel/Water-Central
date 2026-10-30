-- Datos de ejemplo para mostrar el casillero (opcional).
--
-- Correr DESPUÉS de registrarte en /casillero/registro. Cambia el correo de
-- abajo por el de tu cuenta. Crea productos, inventario, paquetes, un despacho
-- y movimientos de wallet para ESA cuenta. Todo lleva "Ejemplo" en la
-- referencia, para poder borrarlo:
--
--   delete from public.casillero_wallet where referencia like 'Ejemplo%';
--   delete from public.casillero_despachos where destino like 'Ejemplo%';
--   delete from public.casillero_paquetes where descripcion like 'Ejemplo%' or guia like 'EJ-%';
--   delete from public.casillero_productos where descripcion like 'Ejemplo%';

do $$
declare
  v_email text := 'CAMBIA@TUCORREO.COM';
  u uuid;
  p uuid;
  d uuid;
begin
  select id into u from public.profiles where lower(email) = lower(v_email);
  if u is null then raise exception 'No hay una cuenta con el correo %', v_email; end if;

  -- Productos con su inventario
  for p in
    insert into public.casillero_productos (user_id, sku, nombre, descripcion) values
      (u, 'CAM-01', 'Camiseta algodón negra', 'Ejemplo · camiseta 100% algodón'),
      (u, 'GOR-02', 'Gorra snapback roja', 'Ejemplo · gorra ajustable'),
      (u, 'TAZ-03', 'Taza cerámica 11oz', 'Ejemplo · taza blanca'),
      (u, 'BUZ-04', 'Buzo con capota gris', 'Ejemplo · buzo unisex'),
      (u, 'LLA-05', 'Llavero metálico', 'Ejemplo · llavero')
    on conflict (user_id, sku) do nothing
    returning id
  loop null; end loop;

  insert into public.casillero_inv_mov (producto_id, user_id, tipo, cantidad, origen, referencia, ref_externa)
  select pr.id, u, m.tipo, m.cant, m.origen, m.ref, 'ejemplo:' || pr.sku || ':' || m.n
  from public.casillero_productos pr
  join (values
    ('CAM-01', 1, 'ingreso',   120, 'bodega',   'Ejemplo · caja 1'),
    ('CAM-01', 2, 'venta',     -30, 'shopify',  'Ejemplo · pedidos Shopify'),
    ('CAM-01', 3, 'venta',      -6, 'woocommerce', 'Ejemplo · pedidos WooCommerce'),
    ('GOR-02', 1, 'ingreso',    60, 'bodega',   'Ejemplo · caja 2'),
    ('GOR-02', 2, 'venta',     -48, 'shopify',  'Ejemplo · pedidos Shopify'),
    ('TAZ-03', 1, 'ingreso',   200, 'bodega',   'Ejemplo · caja 3'),
    ('BUZ-04', 1, 'ingreso',    40, 'bodega',   'Ejemplo · caja 4'),
    ('BUZ-04', 2, 'venta',     -40, 'shopify',  'Ejemplo · agotado'),
    ('LLA-05', 1, 'ingreso',   300, 'bodega',   'Ejemplo · caja 5'),
    ('LLA-05', 2, 'venta',     -50, 'api',      'Ejemplo · ERP')
  ) as m(sku, n, tipo, cant, origen, ref) on m.sku = pr.sku
  where pr.user_id = u
  on conflict (ref_externa) do nothing;

  -- Paquetes en distintos estados
  insert into public.casillero_paquetes (user_id, guia, proveedor, descripcion, valor_declarado, peso_lb, estado) values
    (u, 'EJ-1Z999AA10123456784', 'Amazon', 'Ejemplo · audífonos', 60, 1.4, 'recibido'),
    (u, 'EJ-9400111899223', 'Nike', 'Ejemplo · zapatillas', 120, 2.8, 'recibido'),
    (u, 'EJ-TBA3141592', 'Shein', 'Ejemplo · ropa', 45, null, 'prealertado'),
    (u, 'EJ-7712345678', 'eBay', 'Ejemplo · cámara', 90, 4.1, 'despachado')
  on conflict do nothing;

  -- Wallet y un despacho ya cobrado
  if not exists (select 1 from public.casillero_wallet where user_id = u and referencia like 'Ejemplo%') then
    insert into public.casillero_wallet (user_id, tipo, monto, estado, metodo, referencia) values
      (u, 'recarga', 100, 'aprobado', 'Wompi', 'Ejemplo · recarga'),
      (u, 'recarga', 30, 'pendiente', 'Zelle', 'Ejemplo · Zelle 88231');
    insert into public.casillero_despachos (user_id, modalidad, destino, peso_total, costo, estado, guia_despacho)
      values (u, 'nacional', 'Ejemplo · Calle 68 Sur # 64-76, Bogotá', 4.1, 16.67, 'despachado', 'SV-88231') returning id into d;
    insert into public.casillero_wallet (user_id, tipo, monto, estado, referencia, despacho_id)
      values (u, 'cargo', -16.67, 'aprobado', 'Ejemplo · despacho SV-88231', d);
    update public.casillero_paquetes set despacho_id = d where user_id = u and guia = 'EJ-7712345678';
  end if;
end $$;
