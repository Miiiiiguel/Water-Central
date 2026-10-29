import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Entrada, Etiqueta, Logo } from '@/components/CasilleroShell';
import { fecha, rastrear } from '@/lib/casillero';

// Rastreo público por número de guía: solo estados y fechas, ningún dato del cliente.
export default function Rastreo() {
  const [guia, setGuia] = useState('');
  const [eventos, setEventos] = useState<{ estado: string; created_at: string }[] | null>(null);
  const [error, setError] = useState('');

  const buscar = async () => {
    setError('');
    setEventos(null);
    if (!guia.trim()) return;
    try {
      setEventos(await rastrear(guia.trim()));
    } catch {
      setError('No pudimos consultar la guía. Intenta de nuevo.');
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="flex justify-center mb-8"><Logo className="text-3xl" /></Link>
        <div className="bg-white rounded-3xl border border-gray-100 app-shadow p-8">
          <h1 className="text-2xl font-black text-primary mb-1">Rastrea tu paquete</h1>
          <p className="text-muted-foreground text-sm mb-6">Escribe el número de guía y mira en qué estado está.</p>
          <div className="flex gap-2">
            <Entrada placeholder="Número de guía" value={guia} onChange={(e) => setGuia(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void buscar()} />
            <Button className="tap-scale rounded-full bg-accent hover:bg-accent/90 text-white font-bold h-auto px-5" onClick={() => void buscar()}><Search size={18} /></Button>
          </div>
          {error && <p className="mt-4 rounded-2xl bg-red-50 border border-red-100 p-3 text-xs text-red-700">{error}</p>}
          {eventos && !eventos.length && <p className="mt-4 rounded-2xl bg-orange-50 border border-orange-100 p-3 text-xs text-orange-800">No encontramos esa guía.</p>}
          {eventos && eventos.length > 0 && (
            <ul className="mt-5 space-y-2 text-sm">
              {eventos.map((e, i) => <li key={i} className="flex items-center gap-2"><Etiqueta valor={e.estado} /><span className="text-muted-foreground">{fecha(e.created_at)}</span></li>)}
            </ul>
          )}
          <p className="text-center text-sm text-muted-foreground mt-6">
            ¿Tienes casillero? <Link href="/login?next=/casillero" className="text-accent font-bold hover:underline inline-flex items-center gap-1">Ingresa <ArrowRight size={14} /></Link>
          </p>
        </div>
      </div>
    </div>
  );
}
