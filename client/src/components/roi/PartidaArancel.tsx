import { useEffect, useRef, useState } from 'react';
import { ChevronRight, FolderOpen, Search, X } from 'lucide-react';
import { buscarPartidas, detallePartida, listarCapitulos, ramas, type DetallePartida, type ItemPartida, type Nodo } from '@/lib/hts';
import { PAISES_DE_ORIGEN, paisDeOrigen } from '@/lib/tasaArancel';

// Elegir la partida arancelaria del producto, entre todas las del
// arancel de EE. UU. cargado. Dos caminos: buscar (en español, en inglés
// o por código) o recorrer el arancel capítulo por capítulo, que es el
// que garantiza que cualquier código se puede alcanzar aunque la
// búsqueda no lo encuentre.

interface Props {
  es: boolean;
  detalle: DetallePartida | null;
  onDetalle: (d: DetallePartida | null) => void;
  pais: string;
  onPais: (iso: string) => void;
  cumple: boolean;
  /** Arancel por unidad que resulta, para mostrarlo junto a la partida. */
  derecho: { usd: number; texto: string; calculable: boolean; preferencial: boolean } | null;
}

const fmt = (n: number) => (n === 0 ? '$0' : `$${n.toFixed(n < 1 ? 3 : 2)}`);

export default function PartidaArancel({ es, detalle, onDetalle, pais, onPais, cumple, derecho }: Props) {
  const [modo, setModo] = useState<'buscar' | 'explorar'>('buscar');
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<ItemPartida[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [sinServicio, setSinServicio] = useState(false);
  const [eligiendo, setEligiendo] = useState<string | null>(null);

  // Búsqueda mientras se escribe, con una pausa para no pedir por cada letra.
  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2) {
      setResultados(null);
      return;
    }
    const control = new AbortController();
    const reloj = window.setTimeout(async () => {
      setBuscando(true);
      const r = await buscarPartidas(texto, control.signal);
      if (control.signal.aborted) return;
      setBuscando(false);
      setSinServicio(r === null);
      setResultados(r ?? []);
    }, 280);
    return () => {
      control.abort();
      window.clearTimeout(reloj);
    };
  }, [q]);

  const elegir = async (codigo: string) => {
    setEligiendo(codigo);
    const d = await detallePartida(codigo);
    setEligiendo(null);
    if (d) onDetalle(d);
    else setSinServicio(true);
  };

  const pref = detalle ? detalle.preferencial[pais] : undefined;
  const origen = paisDeOrigen(pais);

  return (
    <div className="mb-6 rounded-2xl border border-gray-100 bg-secondary/40 p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {es ? 'Partida arancelaria (HTS de EE. UU.)' : 'Tariff code (US HTS)'}
        </p>
        <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <span className="whitespace-nowrap">{es ? 'País de origen' : 'Country of origin'}</span>
          <select
            value={pais}
            onChange={(e) => onPais(e.target.value)}
            className="w-40 max-w-full rounded-lg border-[1.5px] border-gray-200 bg-white px-2 py-1.5 text-sm font-bold text-primary outline-none focus:border-accent"
          >
            {PAISES_DE_ORIGEN.map((p) => (
              <option key={p.iso} value={p.iso}>{p.nombre}</option>
            ))}
          </select>
        </label>
      </div>

      {detalle ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-lg font-black text-primary">{detalle.codigo}</p>
              <p className="mt-1 text-sm text-muted-foreground">{detalle.descripcion.slice(-3).join(' › ')}</p>
              {detalle.capitulo.nombre && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {es ? 'Capítulo' : 'Chapter'} {detalle.capitulo.codigo} · {detalle.capitulo.nombre}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDetalle(null)}
              className="tap-scale-sm flex-none cursor-pointer rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-muted-foreground hover:border-gray-300"
            >
              {es ? 'Cambiar' : 'Change'}
            </button>
          </div>

          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-secondary/60 p-3">
              <dt className="text-xs font-semibold text-muted-foreground">{es ? 'Arancel general' : 'General rate'}</dt>
              <dd className="font-bold text-primary">
                {detalle.general?.texto ?? (es ? 'sin tarifa publicada' : 'no published rate')}
                {detalle.general?.heredado && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">({es ? 'según' : 'per'} {detalle.general.segun})</span>
                )}
              </dd>
            </div>
            <div className="rounded-lg bg-secondary/60 p-3">
              <dt className="text-xs font-semibold text-muted-foreground">
                {origen?.acuerdo ? `${es ? 'Con' : 'Under'} ${origen.acuerdo}` : `${es ? 'Desde' : 'From'} ${origen?.nombre ?? pais}`}
              </dt>
              <dd className="font-bold text-primary">
                {pref
                  ? `${pref.texto}${cumple ? '' : es ? ' — si cumple origen' : ' — if origin rules are met'}`
                  : origen?.acuerdo
                    ? es ? 'Este código no tiene preferencia: paga la general' : 'No preference on this code: general rate applies'
                    : es ? 'Sin acuerdo con EE. UU.: paga la general' : 'No agreement with the US: general rate applies'}
              </dd>
            </div>
          </dl>

          {derecho && (
            <p className="mt-3 rounded-lg border border-accent/20 bg-orange-50 p-3 text-sm text-primary">
              {derecho.calculable ? (
                <>
                  {es ? 'El cálculo usa' : 'The projection uses'} <b>{derecho.texto}</b>
                  {derecho.preferencial ? (es ? ' (tarifa preferencial)' : ' (preferential rate)') : ''}:{' '}
                  <b>{fmt(derecho.usd)}</b> {es ? 'de arancel por unidad.' : 'of duty per unit.'}
                </>
              ) : (
                <>{es ? 'Esta tarifa no se puede calcular con un solo precio' : 'This rate cannot be computed from a single price'} (<b>{derecho.texto}</b>). {es ? 'El cálculo no la suma: confírmala con tu agente de aduanas.' : 'The projection leaves it out: confirm it with your customs broker.'}</>
              )}
            </p>
          )}

          {detalle.avisos.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-amber-800">
              {detalle.avisos.map((a) => <li key={a}>⚠ {a}</li>)}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            {es ? 'Fuente' : 'Source'}: {detalle.fuente.nombre} · {es ? 'cargado el' : 'loaded on'} {detalle.fuente.cargadoEl}.{' '}
            {es
              ? 'No incluye sobretasas especiales (232, 301) ni el arancel recíproco, que va aparte abajo.'
              : 'Special surcharges (232, 301) are not included; the reciprocal tariff is set separately below.'}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 inline-flex gap-1 rounded-full border border-gray-200 bg-white p-1" role="group">
            {(['buscar', 'explorar'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                onClick={() => setModo(m)}
                className={`tap-scale-sm inline-flex cursor-pointer items-center gap-1.5 rounded-full border-0 px-3.5 py-1.5 text-sm font-bold transition-colors ${
                  modo === m ? 'bg-accent text-white' : 'bg-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'buscar' ? <Search size={14} /> : <FolderOpen size={14} />}
                {m === 'buscar' ? (es ? 'Buscar' : 'Search') : es ? 'Explorar por capítulo' : 'Browse by chapter'}
              </button>
            ))}
          </div>

          {modo === 'buscar' ? (
            <div>
              <label htmlFor="hts_q" className="sr-only">{es ? 'Buscar partida' : 'Search tariff code'}</label>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="hts_q"
                  type="text"
                  inputMode="search"
                  enterKeyHint="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={es ? 'Ej.: camiseta de algodón, café tostado, 6109…' : 'E.g.: cotton t-shirt, roasted coffee, 6109…'}
                  className="w-full rounded-xl border-[1.5px] border-gray-200 bg-white py-2.5 pl-9 pr-9 font-semibold text-primary outline-none focus:border-accent"
                  autoComplete="off"
                />
                {q && (
                  <button type="button" aria-label={es ? 'Borrar' : 'Clear'} onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-1 text-muted-foreground">
                    <X size={16} />
                  </button>
                )}
              </div>
              {sinServicio && (
                <p className="mt-2 text-sm text-amber-800">
                  {es ? 'El buscador de partidas no respondió. Mientras tanto, el cálculo usa el supuesto del equipo.' : 'The tariff search did not respond. Meanwhile the projection uses the team’s assumption.'}
                </p>
              )}
              {buscando && <p className="mt-2 text-sm text-muted-foreground">{es ? 'Buscando…' : 'Searching…'}</p>}
              {resultados && !buscando && (
                resultados.length ? (
                  <ul className="mt-2 max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                    {resultados.map((r) => (
                      <li key={r.digitos}>
                        <button
                          type="button"
                          onClick={() => elegir(r.codigo)}
                          disabled={eligiendo !== null}
                          className="block w-full cursor-pointer border-0 bg-transparent px-3 py-2.5 text-left hover:bg-secondary/60 disabled:opacity-60"
                        >
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="font-mono text-sm font-bold text-primary">{r.codigo}</span>
                            <span className="text-sm font-bold text-primary">{eligiendo === r.codigo ? '…' : r.tarifa ?? ''}</span>
                          </span>
                          <span className="mt-0.5 block text-sm text-muted-foreground">{r.descripcion}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {es ? 'No encontramos esa partida. Probá con otra palabra, en inglés, o explorá por capítulo.' : 'No match. Try another word, or browse by chapter.'}
                  </p>
                )
              )}
            </div>
          ) : (
            <Explorador es={es} onElegir={elegir} eligiendo={eligiendo} />
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {es
              ? 'Mientras no elijas una partida, el cálculo usa el supuesto del equipo: 8 % si el producto no cumple un acuerdo comercial.'
              : 'Until you pick a code, the projection uses the team’s assumption: 8% when the product does not qualify under a trade agreement.'}
          </p>
        </>
      )}
    </div>
  );
}

/** Capítulo → partida → subpartida → línea de 10 dígitos. */
function Explorador({ es, onElegir, eligiendo }: { es: boolean; onElegir: (codigo: string) => void; eligiendo: string | null }) {
  const [capitulos, setCapitulos] = useState<Array<{ codigo: string; nombre: string }> | null>(null);
  const [pila, setPila] = useState<Array<{ titulo: string; nodos: Nodo[] }>>([]);
  const [cargando, setCargando] = useState(false);
  const pedido = useRef(0);

  useEffect(() => {
    listarCapitulos().then((c) => setCapitulos(c ?? []));
  }, []);

  const abrir = async (titulo: string, opciones: { capitulo?: string; linea?: number }) => {
    const n = ++pedido.current;
    setCargando(true);
    const nodos = await ramas(opciones);
    if (n !== pedido.current) return;
    setCargando(false);
    if (nodos) setPila((p) => [...p, { titulo, nodos }]);
  };

  const actual = pila[pila.length - 1];
  // Se elige una línea con tarifa (8 o 10 dígitos) que ya no se abre más.
  const esFinal = (n: Nodo) => Boolean(n.codigo) && !n.tieneHijos && n.codigo!.replace(/\D/g, '').length >= 8;

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {pila.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1 border-b border-gray-100 px-3 py-2 text-xs">
          <button type="button" onClick={() => setPila([])} className="cursor-pointer border-0 bg-transparent p-0 font-bold text-accent">
            {es ? 'Capítulos' : 'Chapters'}
          </button>
          {pila.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <ChevronRight size={12} className="text-muted-foreground" />
              <button type="button" onClick={() => setPila((s) => s.slice(0, i + 1))} className="max-w-[16rem] cursor-pointer truncate border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground">
                {p.titulo}
              </button>
            </span>
          ))}
        </nav>
      )}
      <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
        {!actual &&
          (capitulos ?? []).map((c) => (
            <li key={c.codigo}>
              <button type="button" onClick={() => abrir(`${c.codigo} ${c.nombre}`, { capitulo: c.codigo })} className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-3 py-2.5 text-left hover:bg-secondary/60">
                <span className="w-8 flex-none font-mono text-sm font-bold text-primary">{c.codigo}</span>
                <span className="flex-1 text-sm text-foreground">{c.nombre}</span>
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>
            </li>
          ))}
        {actual &&
          actual.nodos.map((n) => (
            <li key={n.linea}>
              <button
                type="button"
                disabled={eligiendo !== null}
                onClick={() => (esFinal(n) ? onElegir(n.codigo!) : abrir(n.codigo ?? n.descripcion.slice(0, 40), { linea: n.linea }))}
                className="block w-full cursor-pointer border-0 bg-transparent px-3 py-2.5 text-left hover:bg-secondary/60 disabled:opacity-60"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-sm font-bold text-primary">{n.codigo ?? ''}</span>
                  <span className="flex items-center gap-1 text-sm font-bold text-primary">
                    {eligiendo && eligiendo === n.codigo ? '…' : n.tarifa ?? ''}
                    {n.tieneHijos ? <ChevronRight size={14} className="text-muted-foreground" /> : null}
                  </span>
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{n.descripcion}</span>
              </button>
              {n.codigo && n.tieneHijos && n.codigo.replace(/\D/g, '').length >= 8 && (
                <button type="button" onClick={() => onElegir(n.codigo!)} className="mb-2 ml-3 cursor-pointer border-0 bg-transparent p-0 text-xs font-bold text-accent">
                  {es ? `Usar ${n.codigo}` : `Use ${n.codigo}`}
                </button>
              )}
            </li>
          ))}
        {cargando && <li className="px-3 py-2.5 text-sm text-muted-foreground">{es ? 'Cargando…' : 'Loading…'}</li>}
      </ul>
    </div>
  );
}
