import { useEffect, useState } from 'react';
import { arancelDelDestino, lineasDelDestino, type ArancelDestino, type Destino, type LineaDestino as Linea } from '@/lib/destinos';
import { paisDeOrigen } from '@/lib/tasaArancel';

// La línea del arancel del país de destino. Los primeros 6 dígitos son
// los del producto que la persona ya eligió; de ahí en adelante cada país
// divide a su manera, así que se listan las líneas de ese destino y se
// elige una. El arancel sale de la fuente oficial de ese destino.

interface Props {
  es: boolean;
  destino: Destino;
  hs6: string;
  origen: string;
  cumple: boolean;
  arancel: ArancelDestino | null;
  onArancel: (a: ArancelDestino | null) => void;
  derecho: { usd: number; texto: string; calculable: boolean; preferencial: boolean } | null;
  /**
   * La fuente en vivo no respondió (true) o volvió (false). La página
   * ofrece entonces escribir la tarifa a mano, para no quedar trabada.
   */
  onFallo?: (fallo: boolean) => void;
}

const fmt = (n: number) => (n === 0 ? '$0' : `$${n.toFixed(n < 1 ? 3 : 2)}`);
const codigo10 = (c: string) => `${c.slice(0, 4)}.${c.slice(4, 6)}.${c.slice(6, 8)}.${c.slice(8, 10)}`;

export default function LineaDestino({ es, destino, hs6, origen, cumple, arancel, onArancel, derecho, onFallo }: Props) {
  const [lineas, setLineas] = useState<Linea[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [elegida, setElegida] = useState<string | null>(null);
  // Reintentos: de la lista de líneas y de la tarifa de la línea elegida.
  const [intento, setIntento] = useState(0);
  const [intentoLinea, setIntentoLinea] = useState(0);

  // Otra subpartida u otro destino: la línea anterior ya no vale.
  useEffect(() => {
    let vivo = true;
    setLineas(null);
    setError(null);
    setElegida(null);
    onArancel(null);
    setCargando(true);
    void lineasDelDestino(destino.iso, hs6).then((r) => {
      if (!vivo) return;
      setCargando(false);
      if (r.ok) setLineas(r.datos.lineas);
      else setError(r.mensaje);
      onFallo?.(!r.ok);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino.iso, hs6, intento]);

  // La preferencial depende del origen: al cambiarlo se vuelve a consultar.
  useEffect(() => {
    if (!elegida) return;
    let vivo = true;
    setError(null);
    void arancelDelDestino(destino.iso, elegida, origen).then((r) => {
      if (!vivo) return;
      if (r.ok) onArancel(r.datos);
      else {
        onArancel(null);
        setError(r.mensaje);
      }
      onFallo?.(!r.ok);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegida, origen, destino.iso, intentoLinea]);

  const pais = paisDeOrigen(origen);

  return (
    <div className="mb-6 rounded-2xl border border-gray-100 bg-secondary/40 p-4 md:p-5">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {es ? `Línea arancelaria en ${destino.nombre}` : `Tariff line in ${destino.nombreEn}`}
      </p>

      {arancel && elegida ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-lg font-black text-primary">{codigo10(arancel.codigo || elegida)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{arancel.descripcion}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setElegida(null);
                onArancel(null);
              }}
              className="tap-scale-sm flex-none cursor-pointer rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-muted-foreground hover:border-gray-300"
            >
              {es ? 'Cambiar' : 'Change'}
            </button>
          </div>

          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-secondary/60 p-3">
              <dt className="text-xs font-semibold text-muted-foreground">{es ? 'Arancel general' : 'General rate'}</dt>
              <dd className="font-bold text-primary">{arancel.general?.texto || (es ? 'sin tarifa publicada' : 'no published rate')}</dd>
            </div>
            <div className="rounded-lg bg-secondary/60 p-3">
              <dt className="text-xs font-semibold text-muted-foreground">
                {es ? 'Desde' : 'From'} {pais?.nombre ?? origen}
              </dt>
              <dd className="font-bold text-primary">
                {arancel.preferencial
                  ? `${arancel.preferencial.tasa.texto}${cumple ? '' : es ? ' — si cumple origen' : ' — if origin rules are met'}`
                  : es ? 'Sin preferencia para este origen: paga la general' : 'No preference for this origin: general rate applies'}
              </dd>
              {arancel.preferencial && <p className="mt-0.5 text-xs text-muted-foreground">{arancel.preferencial.acuerdo}</p>}
            </div>
          </dl>

          {derecho && (
            <p className="mt-3 rounded-lg border border-accent/20 bg-orange-50 p-3 text-sm text-primary">
              {derecho.calculable ? (
                <>
                  {es ? 'El cálculo usa' : 'The projection uses'} <b>{derecho.texto}</b>
                  {derecho.preferencial ? (es ? ' (tarifa preferencial)' : ' (preferential rate)') : ''}{' '}
                  {es ? 'sobre producto + flete' : 'on product + freight'}: <b>{fmt(derecho.usd)}</b> {es ? 'de arancel por unidad.' : 'of duty per unit.'}
                </>
              ) : (
                <>
                  {es ? 'Esta tarifa no se puede calcular con un solo precio' : 'This rate cannot be computed from a single price'} (<b>{derecho.texto || '—'}</b>).{' '}
                  {es ? 'Mientras la confirmas con tu agente de aduanas, el cálculo usa un 8 % estimado' : 'Until your customs broker confirms it, the projection uses an 8% estimate'}: <b>{fmt(derecho.usd)}</b> {es ? 'por unidad.' : 'per unit.'}
                </>
              )}
            </p>
          )}

          {arancel.avisos.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-amber-800">
              {arancel.avisos.map((a) => <li key={a}>⚠ {a}</li>)}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">{es ? 'Fuente' : 'Source'}: {arancel.fuente}, {es ? 'consultada en vivo' : 'queried live'}.</p>
        </div>
      ) : cargando ? (
        <p className="text-sm text-muted-foreground">{es ? 'Consultando el arancel del destino…' : 'Querying the destination tariff…'}</p>
      ) : lineas && lineas.length > 0 ? (
        <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 bg-white">
          {lineas.map((l) => (
            <li key={l.codigo}>
              <button
                type="button"
                onClick={() => setElegida(l.codigo)}
                disabled={elegida === l.codigo}
                className="flex w-full cursor-pointer flex-col items-start gap-0.5 border-0 bg-transparent px-3 py-2.5 text-left hover:bg-secondary/60 disabled:opacity-60"
              >
                <span className="font-mono text-sm font-bold text-primary">{codigo10(l.codigo)}</span>
                <span className="text-sm text-muted-foreground">{l.descripcion}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : lineas ? (
        <p className="text-sm text-muted-foreground">
          {es ? 'El arancel del destino no tiene líneas para esta subpartida.' : 'The destination tariff has no lines for this subheading.'}
        </p>
      ) : null}

      {error && (
        <div role="alert" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <p className="font-semibold text-accent">{error}</p>
          <button
            type="button"
            onClick={() => (lineas ? setIntentoLinea((n) => n + 1) : setIntento((n) => n + 1))}
            className="tap-scale-sm cursor-pointer rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-bold text-primary"
          >
            {es ? 'Reintentar' : 'Retry'}
          </button>
          <p className="w-full text-xs text-muted-foreground">
            {es ? 'Mientras tanto, escribe la tarifa a mano en la casilla de arriba.' : 'Meanwhile, type the rate by hand in the box above.'}
          </p>
        </div>
      )}
    </div>
  );
}
