import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Clock, PackageCheck, PackagePlus, ScanLine, Scale, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Aparece, Boton, Campo, Card, Entrada, Etiqueta, Seccion, Stat, useAsync } from '@/portal/ui';
import { transportista, hace } from '@/portal/format';
import { leerTodo, useAdmin, type Dueno } from '@/portal/admin';
import { api, db, type Paquete } from '@/lib/casillero';

// Recepción en bodega pensada para el lector de códigos: la guía se escanea
// (o se escribe) y Enter; si el cliente la prealertó, solo falta el peso y
// Enter otra vez. Si no la prealertó, se registra por su código de casillero.

type Hallado = (Paquete & { profiles: Dueno | null }) | 'ninguno' | null;
interface Registro { guia: string; cliente: string; peso: number | null; hora: string; nuevo: boolean }

export default function Recepcion() {
  const { getAccessToken } = useAuth();
  const { recargar: recargarStats, stats } = useAdmin();
  const clientes = useAsync(async () => {
    const s = await db();
    return leerTodo<{ id: string; full_name: string | null; casillero_codigo: string }>((a, b) => s.from('profiles').select('id, full_name, casillero_codigo').not('casillero_codigo', 'is', null).order('casillero_codigo').range(a, b));
  }, []);
  const [guia, setGuia] = useState('');
  const [hallado, setHallado] = useState<Hallado>(null);
  const [peso, setPeso] = useState('');
  const [codigo, setCodigo] = useState('');
  const [contenido, setContenido] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [sesion, setSesion] = useState<Registro[]>([]);
  const guiaRef = useRef<HTMLInputElement>(null);
  const pesoRef = useRef<HTMLInputElement>(null);
  const codigoRef = useRef<HTMLInputElement>(null);

  const limpiar = () => { setGuia(''); setHallado(null); setPeso(''); setCodigo(''); setContenido(''); setError(null); setTimeout(() => guiaRef.current?.focus(), 0); };

  const buscar = async () => {
    const g = guia.trim();
    if (g.length < 4) return setError('Escanea o escribe la guía completa.');
    setError(null); setOcupado(true);
    const esc = g.replace(/[\\%_]/g, (m) => `\\${m}`);
    const { data, error: e } = await (await db()).from('casillero_paquetes').select('*, profiles(full_name, casillero_codigo, email)').ilike('guia', esc).limit(5);
    setOcupado(false);
    if (e) return setError(e.message);
    const lista = (data ?? []) as (Paquete & { profiles: Dueno | null })[];
    const h = lista.find((p) => p.estado === 'prealertado') ?? lista[0];
    if (!h) { setHallado('ninguno'); setTimeout(() => codigoRef.current?.focus(), 0); return; }
    setHallado(h);
    setPeso(h.peso_lb != null ? String(h.peso_lb) : '');
    setTimeout(() => pesoRef.current?.focus(), 0);
  };

  const avisar = async (id: string) => { const r = await api<{ enviado: boolean }>(`/casillero/paquetes/${id}/avisar`, getAccessToken()); return r.ok && r.data.enviado; };

  const confirmar = async () => {
    const lb = peso.trim() === '' ? null : Number(peso);
    if (lb !== null && (!Number.isFinite(lb) || lb <= 0 || lb > 500)) return setError('El peso debe ser un número en libras (por ejemplo 2.4).');
    const s = await db();
    setError(null); setOcupado(true);
    try {
      if (hallado && hallado !== 'ninguno') {
        const cambioEstado = hallado.estado === 'prealertado';
        const { error: e } = await s.from('casillero_paquetes').update({ peso_lb: lb, ...(cambioEstado ? { estado: 'recibido' } : {}) }).eq('id', hallado.id);
        if (e) return setError(e.message);
        const mail = cambioEstado && (await avisar(hallado.id));
        toast.success(cambioEstado ? 'Recibido' : 'Peso actualizado', { description: `${hallado.guia}${lb ? ` · ${lb} lb` : ''}${mail ? ' · cliente avisado por correo' : ''}` });
        setSesion((x) => [{ guia: hallado.guia, cliente: `${hallado.profiles?.casillero_codigo ?? ''} · ${hallado.profiles?.full_name ?? ''}`, peso: lb, hora: new Date().toISOString(), nuevo: false }, ...x]);
      } else {
        const c = (clientes.datos ?? []).find((x) => x.casillero_codigo.toLowerCase() === codigo.trim().toLowerCase().split(/\s|·/)[0]);
        if (!c) return setError('No existe un cliente con ese código. Elige uno de la lista.');
        const { data, error: e } = await s.from('casillero_paquetes').insert({ user_id: c.id, guia: guia.trim(), descripcion: contenido.trim() || null, peso_lb: lb, estado: 'recibido' }).select('id').single();
        if (e) return setError(e.message);
        const mail = await avisar(data.id);
        toast.success('Paquete registrado', { description: `${guia.trim()} para ${c.casillero_codigo}${mail ? ' · cliente avisado' : ''}` });
        setSesion((x) => [{ guia: guia.trim(), cliente: `${c.casillero_codigo} · ${c.full_name ?? ''}`, peso: lb, hora: new Date().toISOString(), nuevo: true }, ...x]);
      }
      void recargarStats();
      limpiar();
    } finally { setOcupado(false); }
  };

  const totalLb = useMemo(() => sesion.reduce((a, r) => a + (r.peso ?? 0), 0), [sesion]);
  const carrier = transportista(guia);
  const enter = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } };

  return (
    <div className="space-y-6">
      <div><h1 className="font-heading text-2xl font-black text-primary md:text-3xl">Recepción</h1><p className="mt-1 text-sm text-muted-foreground">Escanea la guía, escribe el peso y Enter. Así de rápido.</p></div>

      <Aparece>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat etiqueta="Recibidos en esta sesión" valor={sesion.length} icono={<PackageCheck size={18} />} tono="oscuro" />
          <Stat etiqueta="Libras pesadas" valor={totalLb} formato={(n) => n.toFixed(1)} icono={<Scale size={18} />} tono="neutro" />
          <Stat etiqueta="Por recibir (prealertados)" valor={stats?.cola.por_recibir ?? 0} icono={<Clock size={18} />} tono="naranja" pista="en todo el sistema" />
        </div>
      </Aparece>

      <Aparece retraso={0.05}>
        <Card className="border-2 border-primary/10">
          <Campo etiqueta="Guía del paquete" id="rec-guia" ayuda="El lector de códigos escribe la guía y envía Enter automáticamente.">
            <div className="relative">
              <ScanLine size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" />
              <Entrada id="rec-guia" ref={guiaRef} autoFocus autoComplete="off" spellCheck={false} value={guia} disabled={ocupado} onChange={(e) => { setGuia(e.target.value); if (hallado) { setHallado(null); setError(null); } }} onKeyDown={enter(() => void buscar())} placeholder="Escanea o escribe la guía…" className="py-4 pl-12 font-mono text-lg" />
              {carrier && <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-0.5 text-[11px] font-black text-white" style={{ background: carrier.color }}>{carrier.nombre}</span>}
            </div>
          </Campo>

          {error && <p role="alert" className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3.5 text-sm font-semibold text-red-700">{error}</p>}

          {hallado && hallado !== 'ninguno' && (
            <div className="mt-5 rounded-3xl bg-gray-50 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-primary shadow-sm"><UserRound size={20} /></span>
                <div className="min-w-0 flex-1"><p className="font-heading text-xl font-black text-primary">{hallado.profiles?.full_name}</p><p className="text-sm text-muted-foreground">{hallado.profiles?.casillero_codigo} · {hallado.proveedor ?? 'sin tienda'} · {hallado.descripcion ?? 'sin descripción'}</p></div>
                <Etiqueta estado={hallado.estado} />
              </div>
              {hallado.estado === 'prealertado' || hallado.estado === 'recibido' ? (
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <Campo etiqueta="Peso (libras)" id="rec-peso" className="w-44"><Entrada id="rec-peso" ref={pesoRef} type="number" inputMode="decimal" min="0" step="0.01" value={peso} onChange={(e) => setPeso(e.target.value)} onKeyDown={enter(() => void confirmar())} className="py-3 text-lg font-bold" /></Campo>
                  <Boton variante="primario" cargando={ocupado} onClick={() => void confirmar()} icono={<CheckCircle2 size={17} />} className="py-3">{hallado.estado === 'prealertado' ? 'Marcar como recibido' : 'Guardar peso'}</Boton>
                  <Boton onClick={limpiar}>Cancelar</Boton>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-3"><p className="text-sm text-muted-foreground">Este paquete ya está en <b>{hallado.estado}</b>; no necesita recepción.</p><Boton onClick={limpiar}>Siguiente paquete</Boton></div>
              )}
            </div>
          )}

          {hallado === 'ninguno' && (
            <div className="mt-5 rounded-3xl border border-orange-200 bg-orange-50 p-5">
              <p className="flex items-center gap-2 font-bold text-orange-900"><PackagePlus size={18} />Esta guía no tiene prealerta. Regístrala a nombre del cliente.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_1.2fr_150px]">
                <Campo etiqueta="Cliente (código)" id="rec-cod"><Entrada id="rec-cod" ref={codigoRef} list="rec-clientes" autoComplete="off" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="DM1001" /><datalist id="rec-clientes">{(clientes.datos ?? []).map((c) => <option key={c.id} value={c.casillero_codigo}>{c.full_name}</option>)}</datalist></Campo>
                <Campo etiqueta="Contenido (opcional)" id="rec-cont"><Entrada id="rec-cont" value={contenido} onChange={(e) => setContenido(e.target.value)} /></Campo>
                <Campo etiqueta="Peso (lb)" id="rec-peso2"><Entrada id="rec-peso2" ref={pesoRef} type="number" inputMode="decimal" min="0" step="0.01" value={peso} onChange={(e) => setPeso(e.target.value)} onKeyDown={enter(() => void confirmar())} /></Campo>
              </div>
              <div className="mt-4 flex gap-2"><Boton variante="primario" cargando={ocupado} onClick={() => void confirmar()} icono={<CheckCircle2 size={16} />}>Registrar y marcar recibido</Boton><Boton onClick={limpiar}>Cancelar</Boton></div>
            </div>
          )}
        </Card>
      </Aparece>

      {sesion.length > 0 && (
        <Aparece retraso={0.08}>
          <Seccion titulo="Recibidos en esta sesión" ayuda="Se pierde al recargar la página; todo ya quedó guardado.">
            <ul className="divide-y divide-gray-100 text-sm">
              {sesion.map((r, i) => (
                <li key={`${r.guia}-${i}`} className="flex flex-wrap items-center gap-3 py-2.5"><CheckCircle2 size={17} className="shrink-0 text-green-500" /><b className="font-mono text-primary">{r.guia}</b><span className="text-muted-foreground">{r.cliente}</span>{r.nuevo && <Etiqueta tono="naranja">sin prealerta</Etiqueta>}<span className="ml-auto text-xs text-muted-foreground">{r.peso ? `${r.peso} lb · ` : ''}{hace(r.hora)}</span></li>
              ))}
            </ul>
          </Seccion>
        </Aparece>
      )}
    </div>
  );
}
