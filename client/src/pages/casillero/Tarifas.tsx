import { useState } from 'react';
import { Calculator, Info, Sparkles } from 'lucide-react';
import { Aparece, Campo, Card, Entrada, Etiqueta, Seccion, cn } from '@/portal/ui';
import { usd } from '@/portal/format';
import { useDatos } from '@/portal/datos';
import { MODALIDADES, cotizarTodas, type Modalidad } from '@/lib/casillero';

export default function Tarifas() {
  const { tarifas, config, cargando } = useDatos();
  const [peso, setPeso] = useState('2');
  const p = Number(peso);
  const libras = Number.isFinite(p) && p > 0 ? Math.ceil(p) : 0;
  const precios = libras ? cotizarTodas(tarifas, p, config) : null;
  const validos = precios ? Object.values(precios).filter((x): x is number => x !== null) : [];
  const barato = validos.length ? Math.min(...validos) : null;
  const filaActiva = libras ? tarifas.find((t) => libras >= t.libras_desde && libras <= t.libras_hasta)?.id : undefined;
  const maxDeclarado = config.valor_declarado_max || '100';
  const ultimo = tarifas.length ? Math.max(...tarifas.map((t) => t.libras_hasta)) : 0;

  return (
    <div className="space-y-6">
      <div><h1 className="font-heading text-2xl font-black text-primary md:text-3xl">Tarifas</h1><p className="mt-1 text-sm text-muted-foreground">Calcula cuánto cuesta despachar según el peso.</p></div>

      <Aparece>
        <Card>
          <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
            <Campo etiqueta="Peso total (libras)" id="peso" ayuda="Se redondea hacia arriba a la libra siguiente.">
              <div className="relative"><Calculator size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><Entrada id="peso" type="number" inputMode="decimal" min="0" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} className="pl-10" /></div>
              {libras > 0 && <p className="mt-2 text-sm font-semibold text-primary">Se cobra como {libras} lb</p>}
            </Campo>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(Object.keys(MODALIDADES) as Modalidad[]).map((m) => {
                const v = precios?.[m] ?? null;
                const mejor = v !== null && v === barato && validos.length > 1;
                return (
                  <div key={m} className={cn('rounded-2xl border p-4', mejor ? 'border-accent bg-secondary/50' : 'border-gray-100 bg-white')}>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{MODALIDADES[m]}</p>
                    <p className="mt-1 font-heading text-2xl font-black text-primary">{!libras ? '—' : v !== null ? usd(v) : <span className="text-sm font-bold text-gray-400">Consulta</span>}</p>
                    {mejor && <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-accent"><Sparkles size={11} />Más económica</p>}
                    {libras > 0 && v === null && <p className="mt-1 text-[11px] text-muted-foreground">Fuera de la tabla: pide cotización a un asesor.</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </Aparece>

      <Aparece retraso={0.06}>
        <Seccion titulo="Tarifas mínimas por modalidad" ayuda="Precios en USD por envío, según el peso total.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground"><th className="py-3 pr-4">Libras</th>{(Object.keys(MODALIDADES) as Modalidad[]).map((m) => <th key={m} className="px-4 py-3">{MODALIDADES[m]}</th>)}</tr></thead>
              <tbody>
                {tarifas.map((t) => (
                  <tr key={t.id} className={cn('border-b border-gray-50 transition-colors', filaActiva === t.id && 'bg-secondary/60')}>
                    <td className="py-3.5 pr-4 font-bold text-primary">{t.libras_desde} a {t.libras_hasta} {filaActiva === t.id && <Etiqueta tono="naranja">tu peso</Etiqueta>}</td>
                    {(Object.keys(MODALIDADES) as Modalidad[]).map((m) => <td key={m} className="px-4 py-3.5 tabular-nums">{usd(t[m])}</td>)}
                  </tr>
                ))}
                {!tarifas.length && !cargando && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Aún no hay tarifas publicadas.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground"><Info size={16} className="mt-0.5 shrink-0" />Aplican con valor declarado igual o menor a USD {maxDeclarado}. Si la ciudad destino aplica para reexpedición, el sistema generará un cobro adicional por ese trayecto.{ultimo ? ` Para más de ${ultimo} lb, ${Object.keys(config).some((k) => k.startsWith('libra_extra_') && config[k]) ? 'se suma un valor por cada libra adicional.' : 'escríbenos para cotizarte.'}` : ''}</p>
        </Seccion>
      </Aparece>
    </div>
  );
}
