import { Check } from 'lucide-react';
import { cn } from './ui';
import { fechaHora } from './format';

export const PASOS_PAQUETE = [
  { estado: 'prealertado', titulo: 'Prealertado', ayuda: 'Avisaste que viene en camino' },
  { estado: 'recibido', titulo: 'En bodega', ayuda: 'Llegó a Miami' },
  { estado: 'alistamiento', titulo: 'Alistamiento', ayuda: 'Preparando tu envío' },
  { estado: 'despachado', titulo: 'Despachado', ayuda: 'Va hacia tu destino' },
  { estado: 'entregado', titulo: 'Entregado', ayuda: 'En tus manos' },
] as const;

/** Línea de tiempo del paquete: lo ya ocurrido (con fecha), el paso actual y lo que falta. */
export default function Stepper({ estado, fechas, compacto = false }: { estado: string; fechas?: Record<string, string>; compacto?: boolean }) {
  const actual = Math.max(0, PASOS_PAQUETE.findIndex((p) => p.estado === estado));
  return (
    <ol className={cn('relative', compacto ? 'flex items-start' : 'space-y-0')} aria-label="Estado del paquete">
      {PASOS_PAQUETE.map((p, i) => {
        const hecho = i < actual || estado === 'entregado';
        const aqui = i === actual && estado !== 'entregado';
        return (
          <li key={p.estado} className={cn(compacto ? 'flex-1' : 'flex gap-3 pb-5 last:pb-0', 'relative')} aria-current={aqui ? 'step' : undefined}>
            {compacto ? (
              <div className="flex flex-col items-center text-center">
                <Punto hecho={hecho} aqui={aqui} />
                <span className={cn('mt-1.5 text-[11px] font-bold leading-tight', hecho || aqui ? 'text-primary' : 'text-gray-400')}>{p.titulo}</span>
                {i < PASOS_PAQUETE.length - 1 && <span className={cn('absolute left-1/2 top-3 -z-0 h-0.5 w-full', i < actual ? 'bg-accent' : 'bg-gray-200')} aria-hidden="true" />}
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center">
                  <Punto hecho={hecho} aqui={aqui} />
                  {i < PASOS_PAQUETE.length - 1 && <span className={cn('mt-1 w-0.5 flex-1', i < actual ? 'bg-accent' : 'bg-gray-200')} aria-hidden="true" />}
                </div>
                <div className="-mt-0.5 min-w-0">
                  <p className={cn('text-sm font-bold', hecho || aqui ? 'text-primary' : 'text-gray-400')}>{p.titulo}</p>
                  <p className="text-xs text-muted-foreground">{fechas?.[p.estado] ? fechaHora(fechas[p.estado]) : aqui ? 'Ahora' : p.ayuda}</p>
                </div>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Punto({ hecho, aqui }: { hecho: boolean; aqui: boolean }) {
  return (
    <span className={cn('relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-white transition-colors', hecho ? 'border-accent bg-accent' : aqui ? 'border-accent bg-white' : 'border-gray-200 bg-white')}>
      {hecho ? <Check size={13} strokeWidth={3} /> : aqui ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" /> : null}
    </span>
  );
}
