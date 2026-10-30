import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, CircleAlert, CreditCard, Database, Globe, KeyRound, Mail, MapPin, RefreshCw, ShieldCheck, Webhook } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Aparece, AreaTexto, BarraCambios, Boton, BotonCopiar, Campo, Entrada, Etiqueta, PageHeader, Seccion, Skeleton, useAsync } from '@/portal/ui';
import { cop } from '@/portal/format';
import { api, db } from '@/lib/casillero';

// Lo que el equipo puede cambiar sin tocar código (y lo que el servidor
// necesita para que cada pieza funcione de verdad: solo dice si está o no,
// nunca muestra una llave).

interface Estado {
  registro: boolean; wompi: boolean; wompiEventos: boolean; wompiLectura: boolean; wompiEntorno: 'sandbox' | 'production';
  correo: boolean; cifrado: boolean; urlPublica: string | null; usdCop: number;
}

const CLAVES = ['direccion_bodega', 'valor_declarado_max', 'recarga_min_usd'] as const;
type Clave = (typeof CLAVES)[number];

function Fila({ ok, icono, titulo, detalle, falta }: { ok: boolean; icono: React.ReactNode; titulo: string; detalle: React.ReactNode; falta?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-3.5">
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ok ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>{icono}</span>
      <div className="min-w-0 flex-1"><p className="font-bold text-primary">{titulo}</p><p className="text-sm text-muted-foreground">{detalle}</p>{!ok && falta && <p className="mt-1 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{falta}</p>}</div>
      {ok ? <CheckCircle2 size={20} className="mt-1 shrink-0 text-green-600" aria-label="Listo" /> : <CircleAlert size={20} className="mt-1 shrink-0 text-amber-500" aria-label="Falta configurar" />}
    </li>
  );
}

export default function Configuracion() {
  const { getAccessToken } = useAuth();
  const cfg = useAsync(async () => {
    const { data, error } = await (await db()).from('casillero_config').select('clave,valor');
    if (error) throw error;
    return Object.fromEntries(((data ?? []) as { clave: string; valor: string }[]).map((x) => [x.clave, x.valor])) as Record<string, string>;
  }, []);
  const sis = useAsync(async () => { const r = await api<Estado>('/casillero/estado', getAccessToken()); if (!r.ok) throw new Error(r.message ?? 'No pudimos leer el estado del servidor'); return r.data; }, []);

  const [v, setV] = useState<Record<Clave, string>>({ direccion_bodega: '', valor_declarado_max: '', recarga_min_usd: '' });
  const [guardando, setGuardando] = useState(false);
  const [intento, setIntento] = useState(false);
  useEffect(() => { if (cfg.datos) setV(Object.fromEntries(CLAVES.map((k) => [k, cfg.datos![k] ?? ''])) as Record<Clave, string>); }, [cfg.datos]);

  const cambiadas = CLAVES.filter((k) => v[k].trim() !== (cfg.datos?.[k] ?? '').trim());
  const errores: Partial<Record<Clave, string>> = {};
  if (v.direccion_bodega.trim().length < 10) errores.direccion_bodega = 'Escribe la dirección completa de la bodega.';
  if (!(Number(v.valor_declarado_max) >= 1 && Number(v.valor_declarado_max) <= 10000)) errores.valor_declarado_max = 'Un valor entre 1 y 10,000 USD.';
  if (!(Number(v.recarga_min_usd) >= 1 && Number(v.recarga_min_usd) <= 1000)) errores.recarga_min_usd = 'Un valor entre 1 y 1,000 USD.';

  const guardar = async () => {
    setIntento(true);
    const mal = cambiadas.find((k) => errores[k]);
    if (mal) return toast.error(errores[mal]!);
    setGuardando(true);
    const s = await db();
    const fallos: string[] = [];
    for (const k of cambiadas) { const r = await s.from('casillero_config').upsert({ clave: k, valor: v[k].trim() }, { onConflict: 'clave' }); if (r.error) fallos.push(r.error.message); }
    setGuardando(false);
    if (fallos.length) toast.error('No se guardó todo', { description: fallos[0] }); else toast.success('Configuración guardada', { description: 'Los clientes ven el cambio la próxima vez que abran su casillero.' });
    setIntento(false);
    await cfg.recargar();
  };

  const e = sis.datos;
  const base = e?.urlPublica ?? (typeof window === 'undefined' ? '' : window.location.origin);

  return (
    <div className="space-y-6 pb-24">
      <PageHeader titulo="Configuración" subtitulo="Los datos que ven los clientes y el estado real de cada conexión del sistema." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Aparece>
          <Seccion titulo="Casillero" ayuda="Se aplican al instante en el portal de los clientes.">
            {cfg.cargando ? <Skeleton className="h-60 w-full" /> : (
              <div className="space-y-4">
                <Campo etiqueta="Dirección de la bodega en Miami" id="cf-dir" error={intento ? errores.direccion_bodega : null} ayuda="La ven los clientes en su inicio y en cada prealerta; la copian para sus compras."><AreaTexto id="cf-dir" rows={3} value={v.direccion_bodega} onChange={(x) => setV({ ...v, direccion_bodega: x.target.value })} aria-invalid={intento && !!errores.direccion_bodega} /></Campo>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo etiqueta="Valor declarado máximo (USD)" id="cf-vd" error={intento ? errores.valor_declarado_max : null} ayuda="Hasta este valor aplican las tarifas mínimas; sobre él, el cliente debe consultar."><Entrada id="cf-vd" inputMode="decimal" value={v.valor_declarado_max} onChange={(x) => setV({ ...v, valor_declarado_max: x.target.value })} aria-invalid={intento && !!errores.valor_declarado_max} /></Campo>
                  <Campo etiqueta="Recarga mínima del wallet (USD)" id="cf-rm" error={intento ? errores.recarga_min_usd : null} ayuda="Vale para Wompi y para transferencias reportadas."><Entrada id="cf-rm" inputMode="decimal" value={v.recarga_min_usd} onChange={(x) => setV({ ...v, recarga_min_usd: x.target.value })} aria-invalid={intento && !!errores.recarga_min_usd} /></Campo>
                </div>
                <p className="flex items-start gap-2 rounded-2xl bg-gray-50 p-3.5 text-xs text-muted-foreground"><MapPin size={14} className="mt-0.5 shrink-0" /><span>Las tarifas y el precio por libra extra se editan en <b>Tarifas</b>; el aviso fijo y los anuncios, en <b>Anuncios</b>.</span></p>
              </div>
            )}
          </Seccion>
        </Aparece>

        <Aparece retraso={0.06}>
          <Seccion titulo="Estado del sistema" ayuda="Qué está conectado de verdad en el servidor." acciones={<Boton chico onClick={() => void sis.recargar()} icono={<RefreshCw size={13} />}>Revisar</Boton>}>
            {sis.cargando ? <Skeleton className="h-72 w-full" /> : !e ? <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{sis.error}</p> : (
              <ul className="divide-y divide-gray-100">
                <Fila ok={e.registro} icono={<Database size={18} />} titulo="Base de datos del servidor" detalle={e.registro ? 'El servidor puede registrar recargas, avisos y ventas de las tiendas.' : 'Sin ella no se registran recargas de Wompi ni ventas de tiendas.'} falta={<>Falta la variable <code>SUPABASE_SERVICE_ROLE_KEY</code> en el servidor.</>} />
                <Fila ok={e.wompi && e.wompiEventos} icono={<CreditCard size={18} />} titulo={`Pasarela Wompi${e.wompi ? ` · ${e.wompiEntorno === 'production' ? 'producción' : 'pruebas'}` : ''}`}
                  detalle={e.wompi ? <>Recargas con tarjeta, PSE y Nequi{e.wompiEntorno === 'sandbox' && ' (en modo de pruebas: no mueve dinero real)'}. Tasa: <b>{cop(e.usdCop)}</b> por USD.</> : 'Los clientes solo podrán recargar reportando una transferencia.'}
                  falta={<>{!e.wompi ? <>Faltan <code>WOMPI_PUBLIC_KEY</code> y <code>WOMPI_INTEGRITY_SECRET</code>. </> : null}{!e.wompiEventos ? <>Falta <code>WOMPI_EVENTS_SECRET</code>: sin él Wompi no puede avisar los pagos. </> : null}</>} />
                <Fila ok={e.wompiLectura || !e.wompi} icono={<ShieldCheck size={18} />} titulo="Confirmación del pago al volver de Wompi" detalle="Al volver del pago, el servidor consulta la transacción en Wompi antes de acreditar." falta={<>Falta <code>WOMPI_PRIVATE_KEY</code>: el saldo se acreditaría solo por el aviso de Wompi (webhook).</>} />
                <Fila ok={e.correo} icono={<Mail size={18} />} titulo="Correo a clientes" detalle={e.correo ? 'Avisos de paquete recibido, despachado y entregado.' : 'Los clientes verán los cambios en su casillero, pero no recibirán correo.'} falta={<>Faltan <code>RESEND_API_KEY</code> y <code>EMAIL_FROM</code>.</>} />
                <Fila ok={e.cifrado} icono={<KeyRound size={18} />} titulo="Cifrado de llaves de tiendas" detalle={e.cifrado ? 'Las llaves de Shopify y WooCommerce se guardan cifradas (AES-256).' : 'Sin esto ningún cliente puede conectar su tienda.'} falta={<>Falta <code>INTEGRATIONS_ENC_KEY</code> (32 bytes en base64).</>} />
                <Fila ok={!!e.urlPublica} icono={<Globe size={18} />} titulo="Dirección pública (https)" detalle={e.urlPublica ?? 'Shopify y WooCommerce solo envían ventas a una dirección https pública.'} falta={<>Falta <code>PUBLIC_APP_URL</code> con https.</>} />
              </ul>
            )}
          </Seccion>
        </Aparece>
      </div>

      {e?.wompi && (
        <Aparece retraso={0.1}>
          <Seccion titulo="Aviso de pagos de Wompi" ayuda="En el panel de Wompi → Desarrolladores → Eventos, pega esta dirección. Con ella Wompi acredita las recargas aunque el cliente cierre la ventana.">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-gray-50 p-3.5"><Webhook size={18} className="shrink-0 text-accent" /><code className="min-w-0 flex-1 break-all text-sm text-primary">{base}/api/wompi-events</code><BotonCopiar texto={`${base}/api/wompi-events`} /></div>
            {!e.urlPublica && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-700"><Etiqueta tono="naranja">Ojo</Etiqueta><span>Esta dirección no es la pública definitiva: configura <code>PUBLIC_APP_URL</code>.</span></p>}
          </Seccion>
        </Aparece>
      )}

      <BarraCambios visible={cambiadas.length > 0} detalle={`${cambiadas.length} ${cambiadas.length === 1 ? 'ajuste' : 'ajustes'}`} onDescartar={() => { if (cfg.datos) setV(Object.fromEntries(CLAVES.map((k) => [k, cfg.datos![k] ?? ''])) as Record<Clave, string>); setIntento(false); }} onGuardar={() => void guardar()} guardando={guardando} etiqueta="Guardar configuración" />
    </div>
  );
}
