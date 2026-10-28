import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Etiqueta } from '@/components/CasilleroShell';
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
    <div className="min-h-screen bg-neutral-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow">
        <img src="/dmatrix/logo.png" alt="DMatrixUSA" className="mx-auto mb-4 h-11" />
        <h1 className="mb-4 text-2xl font-semibold">Rastrea tu paquete</h1>
        <div className="flex gap-2">
          <Input placeholder="Número de guía" value={guia} onChange={(e) => setGuia(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void buscar()} />
          <Button className="bg-[#b01c2e] hover:bg-[#8e1523]" onClick={() => void buscar()}>Buscar</Button>
        </div>
        {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {eventos && !eventos.length && <p className="mt-4 rounded bg-amber-50 p-3 text-sm">No encontramos esa guía.</p>}
        {eventos && eventos.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {eventos.map((e, i) => <li key={i}><Etiqueta valor={e.estado} /> <span className="text-neutral-500">{fecha(e.created_at)}</span></li>)}
          </ul>
        )}
        <p className="mt-6 text-sm"><Link href="/login?next=/casillero" className="text-[#b01c2e] underline">Ingresar al casillero</Link></p>
      </div>
    </div>
  );
}
