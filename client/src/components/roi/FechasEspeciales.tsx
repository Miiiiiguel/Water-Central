import { FECHAS_ESPECIALES, MESES, MESES_EN, type Promociones } from '@/lib/temporadas';
import { fmtInt, fmtMoney } from '@/lib/roiFormat';

// La casilla de descuentos en fechas especiales (Black Friday, Prime
// Day...): el cliente dice cuándo empieza a vender y qué fechas hace, con
// cuánto descuento. La proyección baja el precio y sube las ventas en esos
// meses del calendario.

export interface EstadoFechas {
  activo: boolean;
  inicioMes: number;
  /** Por fecha: si la hace y con qué descuento (fracción). */
  fechas: Record<string, { on: boolean; descuento: number }>;
}

export function estadoInicial(hoy = new Date()): EstadoFechas {
  return {
    activo: false,
    // Por defecto, empieza a vender el mes que viene.
    inicioMes: ((hoy.getMonth() + 1) % 12) + 1,
    fechas: Object.fromEntries(FECHAS_ESPECIALES.map((f) => [f.id, { on: f.recomendada, descuento: f.descuento }])),
  };
}

/** Lo que va al servidor; null si la casilla está apagada o no hay fechas. */
export function aPromociones(e: EstadoFechas): Promociones | null {
  if (!e.activo) return null;
  const fechas = FECHAS_ESPECIALES.filter((f) => e.fechas[f.id]?.on).map((f) => ({ mes: f.mes, descuento: e.fechas[f.id].descuento, alza: f.alza }));
  return fechas.length ? { inicioMes: e.inicioMes, fechas } : null;
}

export default function FechasEspeciales({
  es,
  estado,
  onChange,
  efecto,
}: {
  es: boolean;
  estado: EstadoFechas;
  onChange: (e: EstadoFechas) => void;
  /** Lo que cambian las fechas en el año 1 (escenario del resultado), frente a no hacerlas. */
  efecto?: { unidades: number; ventas: number; utilidad: number } | null;
}) {
  const meses = es ? MESES : MESES_EN;
  const cambiarFecha = (id: string, cambio: Partial<{ on: boolean; descuento: number }>) =>
    onChange({ ...estado, fechas: { ...estado.fechas, [id]: { ...estado.fechas[id], ...cambio } } });

  return (
    <div className="mt-3.5 rounded-2xl border border-gray-100 bg-secondary/30 p-3.5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={estado.activo}
          onChange={(e) => onChange({ ...estado, activo: e.target.checked })}
          className="mt-0.5 h-5 w-5 flex-none cursor-pointer accent-accent"
        />
        <span>
          <span className="block text-sm font-bold text-primary">
            {es ? 'Haré descuentos en fechas especiales' : 'I will run discounts on special dates'}
          </span>
          <span className="block text-sm text-muted-foreground">
            {es
              ? 'Black Friday, Prime Day, Navidad… Ese mes baja el precio y se vende más: la proyección lo cuenta en el mes que cae.'
              : 'Black Friday, Prime Day, the holidays… That month the price drops and more units sell: the projection counts it in the month it falls.'}
          </span>
        </span>
      </label>

      {estado.activo && (
        <div className="mt-3.5 space-y-3">
          <label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
            <span>{es ? 'Empiezo a vender en' : 'I start selling in'}</span>
            <select
              value={estado.inicioMes}
              onChange={(e) => onChange({ ...estado, inicioMes: Number(e.target.value) })}
              className="rounded-lg border-[1.5px] border-gray-200 bg-white px-2 py-1.5 text-sm font-bold text-primary outline-none focus:border-accent"
            >
              {meses.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {es ? 'Fechas recomendadas para vender en EE. UU.' : 'Recommended dates for selling in the US'}
          </p>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {FECHAS_ESPECIALES.map((f) => {
              const v = estado.fechas[f.id];
              return (
                <li key={f.id} className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={v.on}
                      onChange={(e) => cambiarFecha(f.id, { on: e.target.checked })}
                      className="mt-0.5 h-4 w-4 flex-none cursor-pointer accent-accent"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-primary">
                        {es ? f.nombre : f.nombreEn}
                        {f.recomendada && <span className="ml-1.5 inline-block whitespace-nowrap rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">{es ? 'Clave' : 'Key'}</span>}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {es ? f.cuando : f.cuandoEn} · {es ? 'ventas' : 'sales'} ×{f.alza.toString().replace('.', es ? ',' : '.')}
                      </span>
                    </span>
                  </label>
                  {v.on && (
                    <label className="ml-6.5 flex flex-none items-center gap-1.5 text-xs font-semibold text-muted-foreground sm:ml-0">
                      {es ? 'Descuento' : 'Discount'}
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={90}
                        step={5}
                        value={Math.round(v.descuento * 100)}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n)) cambiarFecha(f.id, { descuento: Math.min(90, Math.max(0, n)) / 100 });
                        }}
                        className="w-16 rounded-lg border-[1.5px] border-gray-200 bg-white px-2 py-1 text-right text-sm font-bold text-primary outline-none focus:border-accent"
                      />
                      %
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
          {efecto && (
            <p className={`rounded-xl px-3.5 py-2.5 text-sm font-bold ${efecto.utilidad >= 0 ? 'bg-green-50 text-green-800' : 'bg-amber-100 text-amber-950'}`}>
              {efecto.utilidad >= 0
                ? es
                  ? `Con estas fechas vendes ${fmtInt(efecto.unidades)} unidades más en el año 1 y tu ganancia sube ${fmtMoney(efecto.utilidad)}.`
                  : `With these dates you sell ${fmtInt(efecto.unidades)} more units in year 1 and your profit rises ${fmtMoney(efecto.utilidad)}.`
                : es
                  ? `Con estas fechas vendes ${fmtInt(efecto.unidades)} unidades más en el año 1, pero tu ganancia baja ${fmtMoney(-efecto.utilidad)}: con tu margen, el descuento se come lo que dejan esas ventas. Prueba con menos descuento o un precio más alto.`
                  : `With these dates you sell ${fmtInt(efecto.unidades)} more units in year 1, but your profit drops ${fmtMoney(-efecto.utilidad)}: at your margin, the discount eats what those sales leave. Try a smaller discount or a higher price.`}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {es
              ? '"Ventas ×1,8" quiere decir que ese mes se vende 1,8 veces lo de un mes normal: es un supuesto de partida, según lo que suele pasar en esas fechas. Los descuentos bajan también la comisión de la plataforma, que se cobra sobre el precio.'
              : '"Sales ×1.8" means that month sells 1.8 times a regular month: a starting assumption based on what usually happens on those dates. Discounts also lower the platform commission, charged on the price.'}
          </p>
        </div>
      )}
    </div>
  );
}
