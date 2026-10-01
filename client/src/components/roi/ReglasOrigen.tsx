import { AlertTriangle, CheckCircle2, CircleHelp, Plus, X, XCircle } from 'lucide-react';
import {
  DE_MINIMIS,
  FIBRAS,
  NOMBRE_GRUPO,
  esCapituloTextil,
  sumaFibras,
  type FilaFibra,
  type RespuestasOrigen,
  type Veredicto,
} from '@/lib/reglasOrigen';

// Las preguntas de reglas de origen del paso 2. Reemplazan al "¿cumple
// las reglas de origen? Sí / No": la persona dice de qué está hecho su
// producto y la página estima si califica para el acuerdo (la lógica está
// en lib/reglasOrigen, con sus pruebas).

interface Props {
  es: boolean;
  /** Nombre del acuerdo que se está evaluando, p. ej. "TPA Colombia – EE. UU.". */
  acuerdo: string;
  paisNombre: string;
  /** La región cuyos hilos e insumos cuentan como del acuerdo. */
  region: string;
  /** Capítulo de la partida elegida; null si todavía no hay partida. */
  capitulo: number | null;
  valor: RespuestasOrigen;
  onChange: (r: RespuestasOrigen) => void;
  veredicto: Veredicto;
  /** La partida nombra otra fibra que la que más pesa. */
  choque: { predominante: keyof typeof NOMBRE_GRUPO; partida: Array<keyof typeof NOMBRE_GRUPO> } | null;
}

const boton = (activo: boolean) =>
  `tap-scale-sm flex-1 cursor-pointer rounded-xl border-[1.5px] px-3 py-2 text-sm font-bold transition-colors ${
    activo ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-muted-foreground hover:border-gray-300'
  }`;

function SiNo({ es, valor, onChange }: { es: boolean; valor: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2 sm:w-56">
      <button type="button" aria-pressed={valor === true} onClick={() => onChange(true)} className={boton(valor === true)}>
        {es ? 'Sí' : 'Yes'}
      </button>
      <button type="button" aria-pressed={valor === false} onClick={() => onChange(false)} className={boton(valor === false)}>
        No
      </button>
    </div>
  );
}

const campo =
  'rounded-xl border-[1.5px] border-gray-200 bg-white px-3 py-2 text-sm font-bold text-primary outline-none focus:border-accent';

function texto(v: Veredicto, es: boolean, region: string, paisNombre: string): string {
  const imp = v.importado ?? 0;
  switch (v.razon) {
    case 'certificado':
      return es ? 'Tienes certificación de origen: aplica la tarifa del acuerdo.' : 'You have origin certification: the agreement rate applies.';
    case 'falta_tipo':
      return es ? 'Dinos qué vendes para revisar las reglas de origen.' : 'Tell us what you sell to check the rules of origin.';
    case 'faltan_fibras':
      return es ? 'Agrega la composición de la tela (como dice la etiqueta).' : 'Add the fabric composition (as the label says).';
    case 'suma':
      return es ? 'La composición tiene que sumar 100 %.' : 'The composition must add up to 100%.';
    case 'falta_confeccion':
    case 'falta_transformacion':
    case 'falta_importado':
      return es ? 'Responde las preguntas para saber si aplica la tarifa del acuerdo.' : 'Answer the questions to see if the agreement rate applies.';
    case 'sin_confeccion':
      return es ? `No califica: la prenda tiene que cortarse y coserse en ${paisNombre}.` : `Does not qualify: the garment must be cut and sewn in ${paisNombre}.`;
    case 'elastano':
      return es
        ? `No califica: el elastano tiene que ser de ${region}, aunque sea poco.`
        : `Does not qualify: the elastane must come from ${region}, however little there is.`;
    case 'tela_importada':
      return es
        ? `No califica: el ${imp} % de la tela viene de fuera del acuerdo (se tolera hasta ${DE_MINIMIS} %). Algunas telas que no se consiguen en la región sí se aceptan: pregúntanos.`
        : `Does not qualify: ${imp}% of the fabric comes from outside the agreement (up to ${DE_MINIMIS}% is tolerated). Some fabrics not available in the region are accepted: ask us.`;
    case 'textil_regional':
      return es ? `Califica: hilo y tela de ${region}, cosida en ${paisNombre}.` : `Qualifies: yarn and fabric from ${region}, sewn in ${paisNombre}.`;
    case 'textil_de_minimis':
      return es
        ? `Califica: lo de fuera del acuerdo es el ${imp} % del peso, dentro del ${DE_MINIMIS} % que se tolera.`
        : `Qualifies: outside material is ${imp}% of the weight, within the ${DE_MINIMIS}% tolerated.`;
    case 'sin_transformacion':
      return es
        ? `No califica: el producto tiene que fabricarse o transformarse en ${paisNombre}, no sólo empacarse o revenderse.`
        : `Does not qualify: the product must be made or transformed in ${paisNombre}, not just packed or resold.`;
    case 'totalmente':
      return es ? `Califica: todo es de ${region}.` : `Qualifies: everything is from ${region}.`;
    case 'de_minimis':
      return es
        ? `Califica: los insumos de fuera son el ${imp} % del costo, dentro del ${DE_MINIMIS} % que se tolera.`
        : `Qualifies: outside inputs are ${imp}% of the cost, within the ${DE_MINIMIS}% tolerated.`;
    case 'valor':
      return es
        ? `Probablemente califica: los insumos de fuera son el ${imp} % del costo (el tope habitual es ${v.tope} %). La regla exacta depende de la partida: confírmala al pedir el certificado de origen.`
        : `Likely qualifies: outside inputs are ${imp}% of the cost (the usual cap is ${v.tope}%). The exact rule depends on the code: confirm it when you request the certificate of origin.`;
    case 'exceso':
      return es
        ? `No califica: los insumos de fuera son el ${imp} % del costo, más del ${v.tope} % que suelen permitir las reglas.`
        : `Does not qualify: outside inputs are ${imp}% of the cost, above the ${v.tope}% the rules usually allow.`;
  }
}

export default function ReglasOrigen({ es, acuerdo, paisNombre, region, capitulo, valor, onChange, veredicto, choque }: Props) {
  const set = <K extends keyof RespuestasOrigen>(k: K, v: RespuestasOrigen[K]) => onChange({ ...valor, [k]: v });
  const tipo = capitulo !== null ? (esCapituloTextil(capitulo) ? 'textil' : 'otro') : valor.tipo;
  const setFila = (i: number, fila: Partial<FilaFibra>) => set('fibras', valor.fibras.map((f, j) => (j === i ? { ...f, ...fila } : f)));
  const suma = sumaFibras(valor.fibras);
  const usadas = new Set(valor.fibras.map((f) => f.fibra));
  const siguiente = FIBRAS.find((f) => !usadas.has(f.id))?.id;

  const tono =
    veredicto.estado === 'califica'
      ? { caja: 'border-green-200 bg-green-50 text-green-800', Icono: CheckCircle2 }
      : veredicto.estado === 'probable'
        ? { caja: 'border-amber-200 bg-amber-50 text-amber-900', Icono: CheckCircle2 }
        : veredicto.estado === 'no'
          ? { caja: 'border-red-200 bg-red-50 text-red-800', Icono: XCircle }
          : { caja: 'border-gray-200 bg-white text-muted-foreground', Icono: CircleHelp };

  return (
    <div data-reglas-origen className="mb-5 rounded-2xl border border-gray-100 bg-secondary/40 p-4 md:p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{es ? 'Reglas de origen' : 'Rules of origin'}</p>
      <p className="mt-1 text-sm font-bold text-primary">
        {es ? `¿Tu producto califica para ${acuerdo}?` : `Does your product qualify under ${acuerdo}?`}
      </p>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-semibold text-muted-foreground">
        <input type="checkbox" checked={valor.certificado} onChange={(e) => set('certificado', e.target.checked)} className="h-4 w-4 accent-primary" />
        {es ? 'Ya tengo certificación de origen para este producto' : 'I already have origin certification for this product'}
      </label>

      {!valor.certificado && (
        <div className="mt-4 space-y-4">
          {capitulo === null && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-muted-foreground">{es ? '¿Qué vendes?' : 'What do you sell?'}</p>
              <div className="flex gap-2 sm:w-96">
                <button type="button" aria-pressed={valor.tipo === 'textil'} onClick={() => set('tipo', 'textil')} className={boton(valor.tipo === 'textil')}>
                  {es ? 'Ropa o textiles' : 'Clothing or textiles'}
                </button>
                <button type="button" aria-pressed={valor.tipo === 'otro'} onClick={() => set('tipo', 'otro')} className={boton(valor.tipo === 'otro')}>
                  {es ? 'Otro producto' : 'Another product'}
                </button>
              </div>
            </div>
          )}

          {tipo === 'textil' && (
            <>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">{es ? 'Composición de la tela (% del peso, como en la etiqueta)' : 'Fabric composition (% of weight, as on the label)'}</p>
                <p className="mb-2 text-xs text-muted-foreground">
                  {es ? `Marca de dónde viene el hilo o la tela de cada fibra: de ${region} o de otro país.` : `Mark where each fiber’s yarn or fabric comes from: ${region} or another country.`}
                </p>
                <div className="space-y-3 sm:space-y-2">
                  {valor.fibras.map((f, i) => (
                    <div key={i} className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] items-center gap-2 sm:grid-cols-[11rem_6.5rem_minmax(0,1fr)_auto]">
                      <select aria-label={es ? 'Fibra' : 'Fiber'} value={f.fibra} onChange={(e) => setFila(i, { fibra: e.target.value as FilaFibra['fibra'] })} className={`${campo} min-w-0`}>
                        {FIBRAS.filter((o) => o.id === f.fibra || !usadas.has(o.id)).map((o) => (
                          <option key={o.id} value={o.id}>{es ? o.es : o.en}</option>
                        ))}
                      </select>
                      <div className="flex items-center rounded-xl border-[1.5px] border-gray-200 bg-white pr-3 focus-within:border-accent">
                        <input
                          type="number"
                          inputMode="decimal"
                          aria-label={es ? 'Porcentaje' : 'Percent'}
                          min={0}
                          max={100}
                          value={Number.isFinite(f.pct) ? f.pct : ''}
                          onChange={(e) => setFila(i, { pct: e.target.value === '' ? NaN : Number(e.target.value) })}
                          className="w-full min-w-0 rounded-xl bg-transparent px-3 py-2 text-sm font-bold text-primary outline-none"
                        />
                        <span className="text-sm font-bold text-muted-foreground">%</span>
                      </div>
                      <select
                        aria-label={es ? 'Origen del hilo o la tela' : 'Origin of the yarn or fabric'}
                        value={f.importada ? 'fuera' : 'region'}
                        onChange={(e) => setFila(i, { importada: e.target.value === 'fuera' })}
                        className={`${campo} order-4 col-span-3 min-w-0 sm:order-none sm:col-span-1`}
                      >
                        <option value="region">{es ? `De ${region}` : `From ${region}`}</option>
                        <option value="fuera">{es ? 'De otro país' : 'From another country'}</option>
                      </select>
                      <button
                        type="button"
                        aria-label={es ? 'Quitar fibra' : 'Remove fiber'}
                        onClick={() => set('fibras', valor.fibras.filter((_, j) => j !== i))}
                        className="tap-scale-sm order-3 rounded-lg p-2 text-muted-foreground hover:bg-white hover:text-primary sm:order-none"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  {siguiente && (
                    <button
                      type="button"
                      onClick={() => set('fibras', [...valor.fibras, { fibra: siguiente, pct: valor.fibras.length === 0 ? 100 : Math.max(0, 100 - suma), importada: false }])}
                      className="tap-scale-sm inline-flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-primary hover:border-accent"
                    >
                      <Plus size={14} />
                      {es ? 'Agregar fibra' : 'Add fiber'}
                    </button>
                  )}
                  {valor.fibras.length > 0 && (
                    <span className={`text-xs font-bold ${Math.abs(suma - 100) > 0.5 ? 'text-red-600' : 'text-green-700'}`}>
                      {es ? 'Suma' : 'Total'}: {Number.isFinite(suma) ? Math.round(suma * 10) / 10 : 0} %
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-muted-foreground">{es ? `¿Se corta y se cose en ${paisNombre}?` : `Is it cut and sewn in ${paisNombre}?`}</p>
                <SiNo es={es} valor={valor.cosidoEnOrigen} onChange={(v) => set('cosidoEnOrigen', v)} />
              </div>
            </>
          )}

          {tipo === 'otro' && (
            <>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-muted-foreground">{es ? `¿Lo fabricas o transformas en ${paisNombre}?` : `Do you make or transform it in ${paisNombre}?`}</p>
                <SiNo es={es} valor={valor.transformado} onChange={(v) => set('transformado', v)} />
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">{es ? 'Insumos importados de fuera del acuerdo' : 'Inputs imported from outside the agreement'}</p>
                  <p className="text-xs text-muted-foreground">{es ? `Qué parte del costo de producirlo no viene de ${region}.` : `What share of the production cost does not come from ${region}.`}</p>
                </div>
                <div className="flex items-center rounded-xl border-[1.5px] border-gray-200 bg-white pr-3 focus-within:border-accent sm:w-56">
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label={es ? 'Porcentaje del costo' : 'Percent of cost'}
                    min={0}
                    max={100}
                    placeholder="0"
                    value={valor.importadoPct ?? ''}
                    onChange={(e) => set('importadoPct', e.target.value === '' ? null : Number(e.target.value))}
                    className="w-full rounded-xl bg-transparent px-3 py-2 text-sm font-bold text-primary outline-none"
                  />
                  <span className="text-sm font-bold text-muted-foreground">%</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {choque && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 flex-none" />
          <span>
            {es
              ? `Tu tela es mayormente de ${NOMBRE_GRUPO[choque.predominante].es}, pero la partida elegida es de ${choque.partida.map((g) => NOMBRE_GRUPO[g].es).join(' / ')}. En ropa manda la fibra que más pesa: revisa la partida.`
              : `Your fabric is mostly ${NOMBRE_GRUPO[choque.predominante].en}, but the chosen code is for ${choque.partida.map((g) => NOMBRE_GRUPO[g].en).join(' / ')}. In clothing the heaviest fiber decides: check the code.`}
          </span>
        </p>
      )}

      <p className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${tono.caja}`}>
        <tono.Icono size={17} className="mt-0.5 flex-none" />
        <span>{texto(veredicto, es, region, paisNombre)}</span>
      </p>
    </div>
  );
}
