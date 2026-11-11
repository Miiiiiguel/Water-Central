import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, MapPin, PackageCheck, Sparkles, Truck, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Aparece, Boton, Campo, Card, Entrada, EstadoVacio, Etiqueta, Segmentos, cn } from '@/portal/ui';
import DataTable, { type Columna } from '@/portal/DataTable';
import { fecha, hace, usd } from '@/portal/format';
import { useDatos } from '@/portal/datos';
import { recargarConWompi } from '@/portal/wompi';
import { MODALIDADES, cotizarTodas, db, type Despacho, type Modalidad } from '@/lib/casillero';

const PASOS = ['Paquetes', 'Envío', 'Confirmar'] as const;

function Cabecera({ paso }: { paso: number }) {
  return (
    <ol className="mb-6 flex items-center gap-2" aria-label="Pasos del despacho">
      {PASOS.map((t, i) => (
        <li key={t} className="flex flex-1 items-center gap-2" aria-current={i === paso ? 'step' : undefined}>
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black transition-colors', i < paso ? 'bg-accent text-white' : i === paso ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400')}>{i < paso ? <Check size={15} strokeWidth={3} /> : i + 1}</span>
          <span className={cn('hidden text-sm font-bold sm:block', i <= paso ? 'text-primary' : 'text-gray-400')}>{t}</span>
          {i < PASOS.length - 1 && <span className={cn('h-0.5 flex-1 rounded-full', i < paso ? 'bg-accent' : 'bg-gray-200')} />}
        </li>
      ))}
    </ol>
  );
}

function Nuevo({ onListo }: { onListo: () => void }) {
  const { profile, getAccessToken } = useAuth();
  const { paquetes, tarifas, config, saldo, servidor, recargar } = useDatos();
  const [paso, setPaso] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [modalidad, setModalidad] = useState<Modalidad | null>(null);
  const [destino, setDestino] = useState([profile?.direccion, profile?.ciudad].filter(Boolean).join(', '));
  const [errorDestino, setErrorDestino] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<{ costo: number } | null>(null);

  const listos = paquetes.filter((p) => p.estado === 'recibido' && p.peso_lb != null);
  const sinPeso = paquetes.filter((p) => p.estado === 'recibido' && p.peso_lb == null);
  const elegidos = listos.filter((p) => sel.includes(p.id));
  const peso = elegidos.reduce((a, p) => a + Number(p.peso_lb), 0);
  const precios = useMemo(() => cotizarTodas(tarifas, peso, config), [tarifas, peso, config]);
  const disponibles = (Object.keys(precios) as Modalidad[]).filter((m) => precios[m] !== null);
  const masBarata = disponibles.length ? disponibles.reduce((a, b) => ((precios[a] as number) <= (precios[b] as number) ? a : b)) : null;
  const costo = modalidad ? precios[modalidad] : null;
  const falta = costo !== null ? Math.max(0, costo - saldo) : 0;

  const siguiente = () => {
    if (paso === 0) { if (!elegidos.length) return toast.error('Elige al menos un paquete'); if (!modalidad || precios[modalidad] === null) setModalidad(masBarata); return setPaso(1); }
    if (paso === 1) {
      if (!modalidad || costo === null) return toast.error('Elige una modalidad de envío');
      if (destino.trim().length < 8) return setErrorDestino('Escribe la dirección completa de entrega (calle, número y ciudad).');
      setErrorDestino(null); return setPaso(2);
    }
  };

  const confirmar = async () => {
    if (!modalidad) return;
    setEnviando(true);
    const { error } = await (await db()).rpc('casillero_solicitar_despacho', { p_paquetes: sel, p_modalidad: modalidad, p_destino: destino.trim() });
    setEnviando(false);
    if (error) return toast.error('No se pudo solicitar el despacho', { description: error.message });
    setHecho({ costo: costo ?? 0 });
    await recargar();
  };

  const recargarFalta = async () => {
    const err = await recargarConWompi(getAccessToken(), Math.max(servidor?.minUsd ?? 5, Math.ceil(falta)));
    if (err) toast.error(err);
  };

  if (hecho) {
    return (
      <Aparece>
        <Card className="mx-auto max-w-xl text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600"><CheckCircle2 size={34} /></span>
          <h2 className="font-heading text-2xl font-black text-primary">¡Despacho solicitado!</h2>
          <p className="mt-2 text-sm text-muted-foreground">Cobramos {usd(hecho.costo)} de tu wallet. El equipo alista tu envío y te avisa apenas salga.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3"><Boton variante="oscuro" onClick={onListo}>Ver mis despachos</Boton><Link href="/casillero/paquetes"><Boton>Ver mis paquetes</Boton></Link></div>
        </Card>
      </Aparece>
    );
  }

  if (!listos.length) {
    return (
      <Card>
        <EstadoVacio icono={<PackageCheck size={26} />} titulo="No tienes paquetes listos para despachar"
          texto={sinPeso.length ? `Tienes ${sinPeso.length} ${sinPeso.length === 1 ? 'paquete' : 'paquetes'} en bodega esperando que el equipo lo pese. Apenas esté listo podrás despacharlo.` : 'Cuando un paquete llegue a la bodega y lo pesemos, podrás despacharlo desde aquí.'}
          accion={<Link href="/casillero/prealerta"><Boton variante="primario">Prealertar un envío</Boton></Link>} />
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Cabecera paso={paso} />

      {paso === 0 && (
        <Aparece>
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="font-heading text-xl font-black text-primary">¿Qué quieres enviar?</h2><p className="text-sm text-muted-foreground">Junta varios paquetes en un solo envío para ahorrar.</p></div>
              <Boton chico onClick={() => setSel(sel.length === listos.length ? [] : listos.map((p) => p.id))}>{sel.length === listos.length ? 'Quitar todos' : 'Elegir todos'}</Boton>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {listos.map((p) => {
                const on = sel.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className={cn('tap-scale flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition-colors', on ? 'border-accent bg-secondary/50' : 'border-gray-100 hover:border-gray-200')}>
                      <input type="checkbox" className="h-4 w-4 accent-[#FF5A36]" checked={on} onChange={(e) => setSel(e.target.checked ? [...sel, p.id] : sel.filter((x) => x !== p.id))} />
                      <div className="min-w-0 flex-1"><p className="truncate font-bold text-primary">{p.descripcion ?? p.proveedor ?? 'Paquete'}</p><p className="truncate font-mono text-xs text-muted-foreground">{p.guia}</p></div>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black text-primary">{p.peso_lb} lb</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {sinPeso.length > 0 && <p className="mt-4 flex items-start gap-2 rounded-2xl bg-gray-50 p-3 text-xs text-muted-foreground"><Clock size={14} className="mt-0.5 shrink-0" />{sinPeso.length} {sinPeso.length === 1 ? 'paquete llegó' : 'paquetes llegaron'} a la bodega y {sinPeso.length === 1 ? 'espera' : 'esperan'} el pesaje; aparecerán aquí cuando estén listos.</p>}
          </Card>
        </Aparece>
      )}

      {paso === 1 && (
        <Aparece>
          <Card>
            <h2 className="font-heading text-xl font-black text-primary">¿Cómo quieres recibirlo?</h2>
            <p className="mb-4 text-sm text-muted-foreground">{elegidos.length} {elegidos.length === 1 ? 'paquete' : 'paquetes'} · {peso.toFixed(2)} lb (se cobra como {Math.ceil(peso)} lb)</p>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Modalidad de envío">
              {(Object.keys(MODALIDADES) as Modalidad[]).map((m) => {
                const v = precios[m];
                const on = modalidad === m;
                return (
                  <button key={m} type="button" role="radio" aria-checked={on} disabled={v === null} onClick={() => setModalidad(m)}
                    className={cn('tap-scale relative cursor-pointer rounded-2xl border-2 p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50', on ? 'border-accent bg-secondary/50' : 'border-gray-100 bg-white hover:border-gray-200')}>
                    {m === masBarata && disponibles.length > 1 && <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-black text-white"><Sparkles size={10} />Más económica</span>}
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{MODALIDADES[m]}</p>
                    <p className="mt-1 font-heading text-3xl font-black text-primary">{v !== null ? usd(v) : '—'}</p>
                    {v === null && <p className="mt-1 text-xs text-muted-foreground">Para este peso, pide cotización a un asesor.</p>}
                  </button>
                );
              })}
            </div>
            <Campo className="mt-5" etiqueta="Dirección de entrega" id="destino" error={errorDestino} ayuda="Calle, número, barrio y ciudad.">
              <div className="relative"><MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><Entrada id="destino" value={destino} onChange={(e) => { setDestino(e.target.value); setErrorDestino(null); }} aria-invalid={!!errorDestino} className="pl-10" placeholder="Calle 68 Sur # 64-76, Bogotá" /></div>
            </Campo>
          </Card>
        </Aparece>
      )}

      {paso === 2 && modalidad && costo !== null && (
        <Aparece>
          <Card>
            <h2 className="font-heading text-xl font-black text-primary">Revisa y confirma</h2>
            <ul className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-100">
              {elegidos.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span className="min-w-0 truncate"><b className="text-primary">{p.descripcion ?? p.proveedor ?? 'Paquete'}</b> <span className="font-mono text-xs text-muted-foreground">{p.guia}</span></span><span className="shrink-0 text-muted-foreground">{p.peso_lb} lb</span></li>)}
            </ul>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-4"><dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Envío</dt><dd className="mt-1 font-bold text-primary">{MODALIDADES[modalidad]} · {peso.toFixed(2)} lb</dd></div>
              <div className="rounded-2xl bg-gray-50 p-4"><dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Entrega en</dt><dd className="mt-1 font-bold text-primary">{destino}</dd></div>
            </dl>
            <div className="mt-4 space-y-2 rounded-2xl border border-gray-100 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Costo del envío</span><b className="text-primary">{usd(costo)}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tu saldo</span><span>{usd(saldo)}</span></div>
              <div className="flex justify-between border-t border-gray-100 pt-2"><span className="font-bold text-primary">Saldo después</span><b className={falta > 0 ? 'text-red-600' : 'text-green-600'}>{usd(saldo - costo)}</b></div>
            </div>
            {falta > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
                <Wallet size={18} className="shrink-0" /><p className="min-w-0 flex-1 font-semibold">Te faltan {usd(falta)} para pagar este envío.</p>
                {servidor?.wompi ? <Boton variante="primario" chico onClick={() => void recargarFalta()}>Recargar {usd(Math.max(servidor.minUsd, Math.ceil(falta)))} ahora</Boton> : <Link href="/casillero/wallet"><Boton variante="primario" chico>Ir al wallet</Boton></Link>}
              </div>
            )}
          </Card>
        </Aparece>
      )}

      {/* Barra de acciones */}
      <div className="sticky bottom-20 z-10 mt-5 flex items-center justify-between gap-3 rounded-3xl border border-gray-100 bg-white/95 p-3 pl-5 backdrop-blur app-shadow lg:bottom-4">
        <div className="min-w-0 text-sm"><b className="text-primary">{elegidos.length}</b> <span className="text-muted-foreground">{elegidos.length === 1 ? 'paquete' : 'paquetes'} · {peso.toFixed(1)} lb</span>{costo !== null && paso > 0 && <span className="ml-2 font-black text-primary">{usd(costo)}</span>}</div>
        <div className="flex gap-2">
          {paso > 0 && <Boton onClick={() => setPaso(paso - 1)} icono={<ArrowLeft size={15} />}>Atrás</Boton>}
          {paso < 2 ? <Boton variante="primario" onClick={siguiente} disabled={!elegidos.length}>Siguiente<ArrowRight size={15} /></Boton>
            : <Boton variante="primario" cargando={enviando} disabled={falta > 0} onClick={() => void confirmar()} icono={<Truck size={15} />}>Confirmar y pagar</Boton>}
        </div>
      </div>
    </div>
  );
}

function Historial() {
  const { despachos, paquetes, cargando } = useDatos();
  const columnas: Columna<Despacho>[] = [
    { clave: 'fecha', titulo: 'Solicitado', movil: 'titulo', orden: (d) => d.created_at, celda: (d) => <span title={fecha(d.created_at)} className="font-bold text-primary">{hace(d.created_at)}</span> },
    { clave: 'mod', titulo: 'Modalidad', celda: (d) => MODALIDADES[d.modalidad] },
    { clave: 'destino', titulo: 'Destino', celda: (d) => <span className="line-clamp-1">{d.destino}</span> },
    { clave: 'peso', titulo: 'Peso', alinear: 'der', orden: (d) => Number(d.peso_total), celda: (d) => `${d.peso_total} lb` },
    { clave: 'costo', titulo: 'Costo', alinear: 'der', orden: (d) => Number(d.costo), celda: (d) => <b>{usd(d.costo)}</b> },
    { clave: 'estado', titulo: 'Estado', celda: (d) => <Etiqueta estado={d.estado} /> },
  ];
  return (
    <DataTable
      columnas={columnas} filas={despachos} id={(d) => d.id} cargando={cargando} buscar={(d) => `${d.destino ?? ''} ${d.guia_despacho ?? ''} ${d.estado}`} textoBuscar="Buscar por destino o guía"
      ordenInicial={{ clave: 'fecha', asc: false }}
      exportar={{ nombre: 'mis-despachos', fila: (d) => ({ fecha: d.created_at, modalidad: MODALIDADES[d.modalidad], destino: d.destino, peso_lb: d.peso_total, costo_usd: d.costo, guia_despacho: d.guia_despacho, estado: d.estado }) }}
      expandida={(d) => (
        <div className="grid gap-4 md:grid-cols-2">
          <div><p className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Guía de despacho</p><p className="font-mono text-lg font-bold text-primary">{d.guia_despacho ?? 'Se asigna cuando salga'}</p><p className="mt-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Entrega en</p><p className="text-sm font-semibold">{d.destino}</p></div>
          <div><p className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Paquetes incluidos</p><ul className="space-y-1.5 text-sm">{paquetes.filter((p) => p.despacho_id === d.id).map((p) => <li key={p.id} className="flex justify-between gap-3"><span className="truncate">{p.descripcion ?? p.proveedor ?? p.guia}</span><span className="shrink-0 text-muted-foreground">{p.peso_lb} lb</span></li>)}</ul></div>
        </div>
      )}
      vacio={<EstadoVacio icono={<Truck size={26} />} titulo="Aún no has despachado nada" texto="Cuando solicites tu primer envío, aparecerá aquí con su seguimiento." />}
    />
  );
}

export default function DespachoPagina() {
  const [vista, setVista] = useState<'nuevo' | 'historial'>('nuevo');
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-black text-primary md:text-3xl">Despachar</h1><p className="mt-1 text-sm text-muted-foreground">Envía tus paquetes a donde estés, pagando con tu wallet.</p></div>
        <Segmentos valor={vista} onCambio={setVista} opciones={[{ valor: 'nuevo', etiqueta: 'Nuevo envío' }, { valor: 'historial', etiqueta: 'Mis despachos' }]} />
      </div>
      {vista === 'nuevo' ? <Nuevo onListo={() => setVista('historial')} /> : <Historial />}
    </div>
  );
}
