import { useRef, useState } from 'react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { BellPlus, CheckCircle2, Info, MapPin, PackageSearch, ShoppingBag, Truck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Aparece, AreaTexto, Boton, BotonCopiar, Campo, Card, Entrada, Etiqueta, Seccion, Segmentos } from '@/portal/ui';
import { hace, transportista } from '@/portal/format';
import { useDatos } from '@/portal/datos';
import { DIRECCION_MIAMI, db } from '@/lib/casillero';

const TIENDAS = ['Amazon', 'Walmart', 'Nike', 'Shein', 'Temu', 'eBay', 'Target', 'Best Buy', 'AliExpress', 'Apple', 'Sephora'];

export default function Prealerta() {
  const { user, profile } = useAuth();
  const { paquetes, config, recargar } = useDatos();
  const [modo, setModo] = useState<'una' | 'varias'>('una');
  const [f, setF] = useState({ guia: '', proveedor: '', descripcion: '', valor: '' });
  const [multi, setMulti] = useState('');
  const [errores, setErrores] = useState<{ guia?: string; multi?: string; valor?: string }>({});
  const [ocupado, setOcupado] = useState(false);
  const guiaRef = useRef<HTMLInputElement>(null);

  const bloqueado = !!profile?.casillero_bloqueado;
  const maxDeclarado = Number(config.valor_declarado_max) || 100;
  const direccion = config.direccion_bodega || DIRECCION_MIAMI;
  const existente = (g: string) => paquetes.find((p) => p.guia.trim().toLowerCase() === g.trim().toLowerCase());
  const recientes = paquetes.filter((p) => p.estado === 'prealertado').slice(0, 5);
  const carrier = transportista(f.guia);

  const validarGuia = (g: string): string | undefined => {
    const t = g.trim();
    if (!t) return 'Escribe el número de guía.';
    if (t.length < 6) return 'Una guía tiene al menos 6 caracteres. Revisa que esté completa.';
    const ya = existente(t);
    if (ya) return ya.estado === 'prealertado' ? 'Ya prealertaste esta guía.' : `Esta guía ya está registrada (${ya.estado}).`;
    return undefined;
  };

  const enviarUna = async () => {
    if (!user) return;
    const eg = validarGuia(f.guia);
    const valor = f.valor === '' ? 0 : Number(f.valor);
    const ev = !Number.isFinite(valor) || valor < 0 ? 'Escribe un valor válido en dólares.' : undefined;
    setErrores({ guia: eg, valor: ev });
    if (eg || ev) { if (eg) guiaRef.current?.focus(); return; }
    setOcupado(true);
    const { error } = await (await db()).from('casillero_paquetes').insert({ user_id: user.id, guia: f.guia.trim(), proveedor: f.proveedor.trim() || null, descripcion: f.descripcion.trim() || null, valor_declarado: valor });
    setOcupado(false);
    if (error) return toast.error(error.message);
    toast.success('Prealerta registrada', { description: `Guía ${f.guia.trim()} · te avisamos cuando llegue a Miami.` });
    setF((x) => ({ ...x, guia: '', descripcion: '', valor: '' })); // se conserva la tienda: lo normal es prealertar varias seguidas
    setErrores({});
    await recargar();
    guiaRef.current?.focus();
  };

  const enviarVarias = async () => {
    if (!user) return;
    const lineas = multi.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lineas.length) return setErrores({ multi: 'Pega al menos una guía (una por línea).' });
    const vistas = new Set<string>();
    const nuevas: string[] = [];
    const problemas: string[] = [];
    for (const l of lineas) {
      const k = l.toLowerCase();
      const e = vistas.has(k) ? 'repetida en tu lista' : validarGuia(l);
      vistas.add(k);
      if (e) problemas.push(`${l}: ${e.replace(/\.$/, '').toLowerCase()}`); else nuevas.push(l);
    }
    if (!nuevas.length) return setErrores({ multi: `Ninguna guía se puede registrar. ${problemas.slice(0, 3).join(' · ')}` });
    setOcupado(true);
    const { error } = await (await db()).from('casillero_paquetes').insert(nuevas.map((guia) => ({ user_id: user.id, guia, proveedor: f.proveedor.trim() || null })));
    setOcupado(false);
    if (error) return toast.error(error.message);
    toast.success(`${nuevas.length} ${nuevas.length === 1 ? 'guía prealertada' : 'guías prealertadas'}`, { description: problemas.length ? `${problemas.length} no se registraron: ${problemas.slice(0, 2).join(' · ')}` : undefined });
    setMulti(''); setErrores({});
    await recargar();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Aparece>
          <Card>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h1 className="font-heading text-2xl font-black text-primary">Prealertar un envío</h1><p className="mt-1 text-sm text-muted-foreground">Avísanos qué viene a tu casillero para recibirlo y notificarte al instante.</p></div>
              <Segmentos valor={modo} onCambio={setModo} opciones={[{ valor: 'una', etiqueta: 'Una guía' }, { valor: 'varias', etiqueta: 'Varias guías' }]} />
            </div>

            {bloqueado && <p className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">Tu casillero está bloqueado y no puede crear prealertas. Escríbenos para resolverlo.</p>}

            <form onSubmit={(e) => { e.preventDefault(); void (modo === 'una' ? enviarUna() : enviarVarias()); }} className="space-y-4" noValidate>
              {modo === 'una' ? (
                <>
                  <Campo etiqueta="Número de guía" id="guia" error={errores.guia} ayuda="Lo encuentras en el correo de envío de la tienda.">
                    <div className="relative">
                      <Entrada id="guia" ref={guiaRef} autoFocus autoComplete="off" value={f.guia} onChange={(e) => { setF({ ...f, guia: e.target.value }); if (errores.guia) setErrores({ ...errores, guia: undefined }); }} aria-invalid={!!errores.guia} placeholder="1Z999AA10123456784" className="pr-32" />
                      {carrier && <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-0.5 text-[11px] font-black text-white" style={{ background: carrier.color }}>{carrier.nombre}</span>}
                    </div>
                  </Campo>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo etiqueta="Tienda o proveedor" id="proveedor"><Entrada id="proveedor" list="tiendas" value={f.proveedor} onChange={(e) => setF({ ...f, proveedor: e.target.value })} placeholder="Amazon, Nike, Shein…" /><datalist id="tiendas">{TIENDAS.map((t) => <option key={t} value={t} />)}</datalist></Campo>
                    <Campo etiqueta="Valor declarado (USD)" id="valor" error={errores.valor} ayuda={Number(f.valor) > maxDeclarado ? `Las tarifas mínimas aplican hasta $${maxDeclarado} declarados; el equipo revisará el cobro.` : undefined}><Entrada id="valor" type="number" inputMode="decimal" min="0" step="0.01" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} aria-invalid={!!errores.valor} placeholder="0.00" /></Campo>
                  </div>
                  <Campo etiqueta="¿Qué contiene?" id="descripcion"><Entrada id="descripcion" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Zapatillas, audífonos…" /></Campo>
                </>
              ) : (
                <>
                  <Campo etiqueta="Tienda o proveedor (opcional, aplica a todas)" id="proveedor2"><Entrada id="proveedor2" list="tiendas" value={f.proveedor} onChange={(e) => setF({ ...f, proveedor: e.target.value })} placeholder="Amazon" /></Campo>
                  <Campo etiqueta="Guías, una por línea" id="multi" error={errores.multi} ayuda="Pega todas las guías de golpe; revisamos repetidas y ya registradas.">
                    <AreaTexto id="multi" rows={7} value={multi} onChange={(e) => { setMulti(e.target.value); if (errores.multi) setErrores({}); }} aria-invalid={!!errores.multi} placeholder={'1Z999AA10123456784\n9400111899223344556677\nTBA314159265'} className="font-mono" />
                  </Campo>
                </>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Boton type="submit" variante="primario" cargando={ocupado} disabled={bloqueado} icono={<BellPlus size={16} />}>{modo === 'una' ? 'Registrar prealerta' : 'Registrar guías'}</Boton>
                {modo === 'una' && <span className="text-xs text-muted-foreground">Tras registrarla puedes seguir con la siguiente.</span>}
              </div>
            </form>
          </Card>
        </Aparece>

        <div className="space-y-6">
          <Aparece retraso={0.06}>
            <Seccion titulo="Cómo funciona">
              <ol className="space-y-4">
                {[
                  { i: ShoppingBag, t: 'Compra con tu dirección de Miami', d: `Usa tu código ${profile?.casillero_codigo ?? ''} en el nombre o la suite.` },
                  { i: BellPlus, t: 'Prealerta la guía', d: 'Así sabemos de quién es cuando llegue.' },
                  { i: PackageSearch, t: 'Lo recibimos y te avisamos', d: 'Lo pesamos y te llega la notificación.' },
                  { i: Truck, t: 'Despacha cuando quieras', d: 'Junta varios paquetes y paga con tu wallet.' },
                ].map(({ i: I, t, d }, n) => (
                  <li key={n} className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-accent"><I size={17} /></span><div><p className="text-sm font-bold text-primary">{t}</p><p className="text-xs text-muted-foreground">{d}</p></div></li>
                ))}
              </ol>
            </Seccion>
          </Aparece>
          <Aparece retraso={0.1}>
            <Card className="bg-gradient-to-br from-primary to-[#2c2a78] text-white">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/65"><MapPin size={14} />Tu dirección en Miami</p>
              <p className="mt-2 font-bold">{profile?.full_name} · {profile?.casillero_codigo}</p>
              <p className="text-sm text-white/80">{direccion}</p>
              <div className="mt-3"><BotonCopiar texto={`${profile?.full_name ?? ''} — ${profile?.casillero_codigo ?? ''}\n${direccion}`} etiqueta="Copiar dirección" className="border-0 bg-white/15 text-white hover:bg-white/25" /></div>
            </Card>
          </Aparece>
        </div>
      </div>

      {recientes.length > 0 && (
        <Aparece retraso={0.12}>
          <Seccion titulo="Tus prealertas pendientes" ayuda="Esperando llegar a la bodega." acciones={<Link href="/casillero/paquetes"><Boton chico>Ver todos mis paquetes</Boton></Link>}>
            <ul className="divide-y divide-gray-100">
              {recientes.map((p) => {
                const c = transportista(p.guia);
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <CheckCircle2 size={18} className="text-green-500" />
                    <b className="font-mono text-primary">{p.guia}</b>
                    {c && <span className="rounded-full px-2 py-0.5 text-[10px] font-black text-white" style={{ background: c.color }}>{c.nombre}</span>}
                    <span className="text-muted-foreground">{p.proveedor ?? '—'}</span>
                    <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground"><Etiqueta estado={p.estado} />{hace(p.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          </Seccion>
        </Aparece>
      )}
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Info size={14} />¿Te equivocaste en una guía? Puedes eliminar una prealerta desde Paquetes mientras siga en “Prealertado”.</p>
    </div>
  );
}
