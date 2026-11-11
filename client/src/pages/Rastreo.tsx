import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, PackageSearch, Search } from 'lucide-react';
import { Boton, Entrada, Etiqueta, Logo } from '@/portal/ui';
import Stepper, { PASOS_PAQUETE } from '@/portal/Stepper';
import { fechaHora, transportista } from '@/portal/format';
import { rastrear } from '@/lib/casillero';

// Rastreo público por número de guía: solo estados y fechas, ningún dato del cliente.
export default function Rastreo() {
  const [guia, setGuia] = useState(() => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('guia') ?? ''));
  const [eventos, setEventos] = useState<{ estado: string; created_at: string }[] | null>(null);
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);

  const buscar = async () => {
    setError(''); setEventos(null);
    if (guia.trim().length < 4) return setError('Escribe el número de guía completo.');
    setBuscando(true);
    try { setEventos(await rastrear(guia.trim())); } catch { setError('No pudimos consultar la guía. Intenta de nuevo en un momento.'); }
    setBuscando(false);
  };

  const ultimo = eventos?.length ? eventos[eventos.length - 1].estado : null;
  const fechas: Record<string, string> = {};
  for (const e of eventos ?? []) fechas[e.estado] ??= e.created_at;
  const c = transportista(guia);

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-gray-50 to-white px-4 py-12">
      <Link href="/" className="mb-8"><Logo className="text-3xl" /></Link>
      <div className="w-full max-w-lg rounded-[2rem] border border-gray-100 bg-white p-7 app-shadow md:p-9">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-accent"><PackageSearch size={24} /></span>
        <h1 className="font-heading text-3xl font-black text-primary">Rastrea tu paquete</h1>
        <p className="mt-1 text-sm text-muted-foreground">Escribe el número de guía y mira en qué estado está.</p>
        <form onSubmit={(e) => { e.preventDefault(); void buscar(); }} className="mt-6 flex gap-2">
          <div className="relative flex-1"><Entrada aria-label="Número de guía" autoFocus placeholder="Número de guía" value={guia} onChange={(e) => setGuia(e.target.value)} className={c ? 'pr-28' : ''} />{c && <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-0.5 text-[11px] font-black text-white" style={{ background: c.color }}>{c.nombre}</span>}</div>
          <Boton type="submit" variante="primario" cargando={buscando} icono={<Search size={16} />} aria-label="Buscar">Buscar</Boton>
        </form>
        {error && <p role="alert" className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3.5 text-sm text-red-700">{error}</p>}
        {eventos && !eventos.length && <p className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 p-3.5 text-sm text-orange-900">No encontramos esa guía. Revisa que esté completa; si acabas de comprar, el cliente debe prealertarla primero.</p>}
        {eventos && eventos.length > 0 && ultimo && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Estado actual</p><Etiqueta estado={ultimo} /></div>
            <Stepper estado={ultimo} fechas={fechas} />
            <p className="mt-4 text-xs text-muted-foreground">Última novedad: {fechaHora(eventos[eventos.length - 1].created_at)} · paso {Math.max(1, PASOS_PAQUETE.findIndex((p) => p.estado === ultimo) + 1)} de {PASOS_PAQUETE.length}</p>
          </div>
        )}
        <p className="mt-8 text-center text-sm text-muted-foreground">¿Tienes casillero? <Link href="/login?next=/casillero" className="inline-flex items-center gap-1 font-bold text-accent hover:underline">Ingresa <ArrowRight size={14} /></Link></p>
      </div>
    </div>
  );
}
