import { useEffect, useState } from 'react';
import { Truck, X } from 'lucide-react';
import { cotizarEnvioEEUU, type CotizacionEnvio } from '@/lib/envios';

// El envío de cada pedido dentro de EE. UU., cotizado con la tarifa real
// desde el código postal del depósito de la marca. Sin cotizar, la
// calculadora usa el valor fijo del modelo del equipo.
//
// Se cotiza al apretar el botón, no mientras se escribe: cada cotización
// nueva gasta cuota del servicio de envíos.

interface Props {
  es: boolean;
  /** Peso empacado por unidad, gramos (el mismo campo del producto). */
  pesoG: number;
  /** El precio supera el mínimo del envío gratis: la marca lo paga. */
  aplica: boolean;
  fijoUsd: number;
  valor: number | null;
  onValor: (usd: number | null) => void;
}

const inputCls =
  'w-full rounded-xl border-[1.5px] border-gray-200 bg-white py-2.5 px-3 font-bold text-primary outline-none transition-colors focus:border-accent';

export default function EnvioEEUU({ es, pesoG, aplica, fijoUsd, valor, onValor }: Props) {
  const [zip, setZip] = useState('');
  const [caja, setCaja] = useState({ largo: 23, ancho: 15, alto: 8 });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cotizacion, setCotizacion] = useState<(CotizacionEnvio & { pesoG: number }) | null>(null);

  // Una tarifa es de un peso: si el peso cambia, la cotización deja de
  // valer y el cálculo vuelve al valor fijo hasta cotizar de nuevo.
  const vencida = Boolean(cotizacion && cotizacion.pesoG !== pesoG);
  useEffect(() => {
    if (vencida && valor !== null) onValor(null);
  }, [vencida, valor, onValor]);

  const zipValido = /^\d{5}$/.test(zip);

  const cotizar = async () => {
    if (!zipValido || cargando) return;
    setCargando(true);
    setError(null);
    const r = await cotizarEnvioEEUU({ origen: zip, pesoG, largoCm: caja.largo, anchoCm: caja.ancho, altoCm: caja.alto });
    setCargando(false);
    if (r.ok) {
      setCotizacion({ ...r.cotizacion, pesoG });
      onValor(r.cotizacion.promedio);
    } else {
      setError(r.mensaje);
    }
  };

  const quitar = () => {
    setCotizacion(null);
    onValor(null);
  };

  const medida = (clave: 'largo' | 'ancho' | 'alto', etiqueta: string) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-muted-foreground">{etiqueta}</span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          min={1}
          value={caja[clave]}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            setCaja((c) => ({ ...c, [clave]: Number.isFinite(v) && v > 0 ? v : 1 }));
          }}
          className={`${inputCls} pr-9`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">cm</span>
      </div>
    </label>
  );

  return (
    <div className="mb-6 rounded-2xl border border-gray-100 bg-secondary/40 p-4 md:p-5">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {es ? 'Envío de cada pedido dentro de EE. UU.' : 'Shipping each order within the US'}
      </p>
      <p className="mb-3 text-sm text-muted-foreground">
        {aplica
          ? es
            ? `Tu precio supera el mínimo del envío gratis: el envío lo pagas tú. Sin cotizar se usan USD ${fijoUsd} por pedido.`
            : `Your price is above the free-shipping threshold, so you pay shipping. Without a quote, USD ${fijoUsd} per order is used.`
          : es
            ? 'Con este precio el envío lo paga el comprador, así que no entra en tu costo. Puedes cotizarlo igual.'
            : 'At this price the buyer pays shipping, so it is not part of your cost. You can still get a quote.'}
      </p>

      {cotizacion && !vencida ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-black text-primary">
                ${cotizacion.promedio.toFixed(2)}
                <span className="ml-1.5 text-sm font-bold text-muted-foreground">{es ? 'por pedido, promedio' : 'per order, average'}</span>
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {cotizacion.servicio} · {es ? 'desde' : 'from'} {cotizacion.origen} · {cotizacion.pesoFacturable.onzas} oz
              </p>
            </div>
            <button
              type="button"
              onClick={quitar}
              aria-label={es ? 'Quitar la cotización' : 'Remove the quote'}
              className="tap-scale-sm flex-none cursor-pointer rounded-full border-0 bg-secondary p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {cotizacion.destinos.map((d) => (
              <li key={d.zip} className="flex justify-between gap-2 border-b border-dashed border-gray-100 py-1">
                <span className="truncate text-muted-foreground">{d.ciudad}</span>
                <span className="font-bold tabular-nums text-foreground">${d.usd.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            {es
              ? 'Tarifa comercial (la de quien imprime la guía en línea), hacia cuatro ciudades de zonas distintas. Tu costo real depende de dónde esté cada comprador.'
              : 'Commercial rate (what you pay printing labels online), to four cities in different zones. Your real cost depends on where each buyer is.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="col-span-2 block sm:col-span-1">
              <span className="mb-1.5 block text-sm font-semibold text-muted-foreground">
                {es ? 'ZIP de tu bodega' : 'Your warehouse ZIP'}
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                placeholder="33166"
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void cotizar();
                }}
                className={inputCls}
              />
            </label>
            {medida('largo', es ? 'Largo caja' : 'Box length')}
            {medida('ancho', es ? 'Ancho' : 'Width')}
            {medida('alto', es ? 'Alto' : 'Height')}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void cotizar()}
              disabled={!zipValido || cargando}
              className="tap-scale-sm inline-flex cursor-pointer items-center gap-2 rounded-full border-0 bg-primary px-5 py-2.5 text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Truck size={16} />
              {cargando ? (es ? 'Cotizando…' : 'Quoting…') : es ? 'Cotizar envío real' : 'Get real shipping rate'}
            </button>
            {vencida && (
              <span className="text-sm text-muted-foreground">
                {es ? 'Cambiaste el peso: vuelve a cotizar.' : 'You changed the weight: quote again.'}
              </span>
            )}
          </div>
          {error && <p role="alert" className="mt-2 text-sm font-semibold text-accent">{error}</p>}
        </>
      )}
    </div>
  );
}
