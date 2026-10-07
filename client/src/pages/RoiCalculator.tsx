import { useCallback, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Check, Info, MessageCircle, Phone, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappUrl } from '@/lib/contact';
import { openExternal } from '@/lib/native';
import {
  ENTRADA_INICIAL, mesEnQue, pedirProyeccion, relleno,
  type AnioUnoResumen, type FilaDesglose, type Pronostico, type Proyeccion, type RoiEntrada, type Scenario,
} from '@/lib/roi';
import { MONTH_LABELS, MONTH_LABELS_EN, fmtInt, fmtMoney, fmtMoney2, pctOf, setRoiLocale, xOf } from '@/lib/roiFormat';
import RoiTable, { type RoiRow } from '@/components/roi/RoiTable';
import PartidaArancel from '@/components/roi/PartidaArancel';
import EnvioEEUU from '@/components/roi/EnvioEEUU';
import LineaDestino from '@/components/roi/LineaDestino';
import { DESTINOS, DESTINOS_PRINCIPALES, destino as destinoDe, type ArancelDestino } from '@/lib/destinos';
import type { DetallePartida } from '@/lib/hts';
import { paisDeOrigen, parseTasa } from '@/lib/tasaArancel';
import ReglasOrigen from '@/components/roi/ReglasOrigen';
import { sugerenciaArancel, tarifaInicial } from '@/lib/sugerenciasArancel';
import FabricantesSugeridos from '@/components/FabricantesPatrocinados';
import {
  RESPUESTAS_INICIALES, aplicaAcuerdo, capituloDe, choqueConPartida, esCapituloTextil, evaluarOrigen, regionDelAcuerdo, type RespuestasOrigen,
} from '@/lib/reglasOrigen';
import RoiPaywall from '@/components/roi/RoiPaywall';
import CashChart from '@/components/roi/CashChart';

// The ROI calculator: the client types their own numbers and sees the
// same month-by-month model the team uses in a real engagement.
//
// The arithmetic runs on the server (server/roi): this page sends the
// client's numbers and draws what comes back. The model's assumptions —
// sales ramps, fixed costs, the surcharges by origin — never reach the
// browser, and the two paid reports only arrive for whoever bought them.

const REPORTS = {
  detalle: { plan: 'reporte_detalle', priceCents: 3990, oldPriceCents: 6990 },
  pronostico: { plan: 'reporte_pronostico', priceCents: 9990, oldPriceCents: 12090 },
};

/**
 * Un número del cliente. Mientras no lo escriba, `sugerido`: la casilla
 * queda vacía y el valor de un producto típico se ve en gris claro, como
 * sugerencia (el cálculo sí lo usa). Al escribir, queda el suyo en oscuro;
 * si la borra, vuelve la sugerencia (`onChange(null)`).
 */
function NumberField({
  id, label, value, onChange, prefix, suffix, step = 1, min = 0, sugerido = false, es = true, ayuda,
}: {
  id: string; label: string; value: number; onChange: (v: number | null) => void;
  prefix?: string; suffix?: string; step?: number; min?: number; sugerido?: boolean; es?: boolean; ayuda?: string;
}) {
  const texto = Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '';
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-muted-foreground">{label}</label>
        {sugerido && <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">{es ? 'sugerido' : 'suggested'}</span>}
      </div>
      <div className="relative">
        {prefix && (
          <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${sugerido ? 'text-gray-300' : 'text-muted-foreground'}`}>{prefix}</span>
        )}
        <input
          id={id}
          name={id}
          type="number"
          inputMode="decimal"
          value={sugerido ? '' : texto}
          placeholder={sugerido ? texto : undefined}
          step={step}
          min={min}
          onChange={(e) => {
            if (e.target.value === '') return onChange(null);
            const parsed = parseFloat(e.target.value);
            onChange(Number.isFinite(parsed) ? Math.max(min, parsed) : null);
          }}
          className={`w-full rounded-xl border-[1.5px] py-2.5 font-bold text-primary outline-none transition-colors placeholder:font-semibold placeholder:text-gray-400 focus:border-accent focus:bg-white ${
            sugerido ? 'border-dashed border-gray-200 bg-white' : 'border-gray-200 bg-secondary/60'
          } ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-9' : 'pr-3'}`}
        />
        {suffix && (
          <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold ${sugerido ? 'text-gray-300' : 'text-muted-foreground'}`}>{suffix}</span>
        )}
      </div>
      {ayuda && <p className="mt-1 text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

/** Un deslizador para un porcentaje (devoluciones, comisión), amarrado a su casilla. */
function Deslizador({
  label, value, max, step, onChange, sugerido, marcas,
}: {
  label: string; value: number; max: number; step: number; onChange: (v: number) => void; sugerido: boolean; marcas: [string, string];
}) {
  return (
    <div className="mt-2.5">
      <input
        type="range"
        aria-label={label}
        min={0}
        max={max}
        step={step}
        value={Math.min(value, max)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ background: `linear-gradient(to right, ${sugerido ? '#D1D5DB' : '#FF5A36'} ${(Math.min(value, max) / max) * 100}%, #EEF0F4 0)` }}
        className={`h-2 w-full cursor-pointer appearance-none rounded-full outline-none [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow ${
          sugerido ? '[&::-moz-range-thumb]:border-gray-300 [&::-webkit-slider-thumb]:border-gray-300' : '[&::-moz-range-thumb]:border-accent [&::-webkit-slider-thumb]:border-accent'
        }`}
      />
      <div className="mt-0.5 flex justify-between text-[10px] font-semibold text-muted-foreground">
        <span>{marcas[0]}</span>
        <span>{marcas[1]}</span>
      </div>
    </div>
  );
}

/** El saldo de caja del año 1 en miniatura, para la tarjeta del resultado. */
function MiniCaja({ saldo, payback, es }: { saldo: number[]; payback: number | null; es: boolean }) {
  const W = 300, H = 64, P = 4;
  const min = Math.min(0, ...saldo), max = Math.max(0, ...saldo);
  const rango = max - min || 1;
  const x = (i: number) => P + (i * (W - 2 * P)) / 11;
  const y = (v: number) => P + ((max - v) / rango) * (H - 2 * P);
  const d = saldo.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const cero = y(0);
  const fin = saldo[11] ?? 0;
  return (
    <div className="mt-5 rounded-2xl bg-white/[0.06] px-3.5 pb-2.5 pt-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-indigo-200">{es ? 'Tu caja, mes a mes' : 'Your cash, month by month'}</span>
        <span className={`font-black tabular-nums ${fin >= 0 ? 'text-green-300' : 'text-red-300'}`}>{fmtMoney(fin)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-1.5 block h-16 w-full" aria-hidden="true">
        <defs>
          <linearGradient id="mini-caja" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#FF5A36" stopOpacity="0.45" />
            <stop offset="1" stopColor="#FF5A36" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d}L${x(11)},${cero}L${x(0)},${cero}Z`} fill="url(#mini-caja)" />
        <line x1={0} x2={W} y1={cero} y2={cero} stroke="rgba(255,255,255,.3)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke="#FF8A6B" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {payback && <line x1={x(payback - 1)} x2={x(payback - 1)} y1={0} y2={H} stroke="#86EFAC" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-indigo-300">
        <span>{es ? 'Mes 1' : 'Month 1'}</span>
        {payback && <span className="text-green-300">{es ? `recuperas en el mes ${payback}` : `back in month ${payback}`}</span>}
        <span>{es ? 'Mes 12' : 'Month 12'}</span>
      </div>
    </div>
  );
}

function ScenarioToggle({
  value, onChange, labels, dark = false,
}: {
  value: Scenario; onChange: (s: Scenario) => void; labels: { conservador: string; optimista: string }; dark?: boolean;
}) {
  return (
    <div
      role="group"
      className={`inline-flex gap-1 rounded-full p-1 ${dark ? 'border border-white/15 bg-white/10' : 'border border-gray-200 bg-secondary/60'}`}
    >
      {(['conservador', 'optimista'] as Scenario[]).map((s) => {
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(s)}
            className={`tap-scale-sm cursor-pointer rounded-full border-0 px-4 py-2 text-sm font-bold transition-colors ${
              active ? 'bg-accent text-white' : dark ? 'bg-transparent text-white/70 hover:text-white' : 'bg-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {labels[s]}
          </button>
        );
      })}
    </div>
  );
}

function Paso({ n, title, help, children, listo = false }: { n: number; title: string; help: string; children: React.ReactNode; listo?: boolean }) {
  return (
    <div className="mb-7 border-b border-dashed border-gray-100 pb-7 last-of-type:border-0">
      <div className="mb-4 flex items-start gap-3">
        <span
          className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-black text-white transition-colors ${listo ? 'bg-green-500' : 'bg-primary'}`}
          aria-label={listo ? `${n} ✓` : undefined}
        >
          {listo ? <Check size={16} strokeWidth={3} /> : n}
        </span>
        <div>
          <h3 className="text-base font-bold leading-snug text-primary md:text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground">{help}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * El resultado, en palabras: qué tan bueno es el negocio, cuánto deja el
 * primer año, cuánto hay que poner y cuándo vuelve. Queda fijo al lado de
 * los datos para que se vea cambiar mientras se escribe.
 */
function ResultadoVivo({
  es, proy, sinRespuesta, hero, inversion, paybackMonth, escenario, onEscenario, labels, aviso = null, conSugeridos = false,
}: {
  es: boolean;
  /** Si el precio o el costo siguen siendo los sugeridos (en gris). */
  conSugeridos?: boolean;
  /** Algo que le falta al cálculo y cambia el resultado (p. ej. el arancel del destino). */
  aviso?: string | null;
  proy: Proyeccion | null;
  sinRespuesta: boolean;
  hero: AnioUnoResumen | null;
  inversion: Proyeccion['inversion'] | undefined;
  paybackMonth: number | null;
  escenario: Scenario;
  onEscenario: (s: Scenario) => void;
  labels: { conservador: string; optimista: string };
}) {
  if (!proy || !hero || !inversion) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-gray-100 bg-secondary/40 p-8 text-center text-muted-foreground">
        {sinRespuesta
          ? es ? 'No pudimos calcular tu proyección. Revisa tu conexión e intenta de nuevo.' : 'We could not run your projection. Check your connection and try again.'
          : es ? 'Calculando tu proyección…' : 'Running your projection…'}
      </div>
    );
  }

  const gana = hero.utilidad > 0;
  const veredicto = !gana
    ? { tono: 'bg-red-500/15 text-red-200', icono: '✕', texto: es ? 'Con estos números el primer año da pérdida. Prueba subir el precio o bajar costos.' : 'With these numbers year one loses money. Try a higher price or lower costs.' }
    : paybackMonth
      ? { tono: 'bg-green-500/15 text-green-200', icono: '✓', texto: es ? `Buen negocio: recuperas lo invertido en el mes ${paybackMonth}.` : `Good business: you get your investment back in month ${paybackMonth}.` }
      : { tono: 'bg-amber-500/15 text-amber-200', icono: '!', texto: es ? 'Ganas dinero, pero la inversión vuelve después del primer año.' : 'You make money, but the investment comes back after year one.' };
  const porDolar = inversion.total > 0 ? hero.utilidad / inversion.total : 0;
  const unidadMadura = hero.profitUnit[hero.profitUnit.length - 1] ?? 0;

  return (
    <div data-roi-resultado className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#130B2E] via-primary to-[#1F2E73] p-6 text-white shadow-glow-lg">
      <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">{es ? 'Tu resultado · Año 1' : 'Your result · Year 1'}</p>
      <div className="mt-3">
        <ScenarioToggle value={escenario} onChange={onEscenario} labels={labels} dark />
      </div>

      {aviso && (
        <p className="mt-4 rounded-2xl bg-amber-300 px-3.5 py-2.5 text-sm font-bold text-amber-950">⚠ {aviso}</p>
      )}

      {conSugeridos && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl border border-dashed border-white/25 px-3.5 py-2.5 text-xs text-indigo-100">
          <Info size={14} className="mt-px flex-none" />
          <span>
            {es
              ? 'Calculado con valores sugeridos (los grises). Escribe el precio y el costo de tu producto para ver tu número real.'
              : 'Calculated with suggested values (the grey ones). Type your product’s price and cost to see your real number.'}
          </span>
        </p>
      )}

      <p className={`mt-4 flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-semibold ${veredicto.tono}`}>
        <span aria-hidden="true" className="font-black">{veredicto.icono}</span>
        <span>{veredicto.texto}</span>
      </p>

      <p className="mt-5 text-sm text-indigo-200">{es ? 'Ganancia del primer año' : 'Year-one profit'}</p>
      <p className={`text-4xl font-black tabular-nums md:text-5xl ${gana ? 'text-white' : 'text-red-300'}`}>{fmtMoney(hero.utilidad)}</p>
      <p className="mt-1 text-sm text-indigo-300">
        {es ? 'de ' : 'from '}{fmtMoney(hero.revenue)}{es ? ' en ventas · margen ' : ' in sales · margin '}{pctOf(hero.utilidad, hero.revenue)}
      </p>

      <dl className="mt-6 space-y-3.5 border-t border-white/15 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <dt>
            <span className="block text-sm font-semibold">{es ? 'Para arrancar necesitas' : 'To start you need'}</span>
            <span className="block text-xs text-indigo-300">{es ? 'inventario, envío y 3 meses de marketing' : 'inventory, shipping and 3 months of marketing'}</span>
          </dt>
          <dd className="whitespace-nowrap text-lg font-black tabular-nums">{fmtMoney(inversion.total)}</dd>
        </div>
        {inversion.total > 0 && (
          <div className="-mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <span className="h-full bg-accent" style={{ width: `${(inversion.productCost / inversion.total) * 100}%` }} />
            <span className="h-full bg-[#7C8FF0]" style={{ width: `${(inversion.logistics / inversion.total) * 100}%` }} />
            <span className="h-full bg-white/70" style={{ width: `${(inversion.marketing3 / inversion.total) * 100}%` }} />
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <dt>
            <span className="block text-sm font-semibold">{es ? 'Por cada dólar que inviertes' : 'For every dollar you invest'}</span>
            <span className="block text-xs text-indigo-300">{es ? 'ganas en el primer año' : 'you earn in year one'}</span>
          </dt>
          <dd className={`whitespace-nowrap text-lg font-black tabular-nums ${porDolar >= 0 ? 'text-accent' : 'text-red-300'}`}>{fmtMoney2(porDolar)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>
            <span className="block text-sm font-semibold">{es ? 'Recuperas la inversión' : 'You get the investment back'}</span>
            <span className="block text-xs text-indigo-300">{es ? 'cuando la caja cubre lo que pusiste' : 'when cash covers what you put in'}</span>
          </dt>
          <dd className="whitespace-nowrap text-lg font-black">{paybackMonth ? `${es ? 'Mes' : 'Month'} ${paybackMonth}` : es ? 'Después del mes 12' : 'After month 12'}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>
            <span className="block text-sm font-semibold">{es ? 'Cada unidad te deja' : 'Each unit leaves you'}</span>
            <span className="block text-xs text-indigo-300">{es ? 'cuando ya vendes estable (mes 12)' : 'once sales are steady (month 12)'}</span>
          </dt>
          <dd className={`whitespace-nowrap text-lg font-black tabular-nums ${unidadMadura >= 0 ? '' : 'text-red-300'}`}>{fmtMoney2(unidadMadura)}</dd>
        </div>
      </dl>

      <MiniCaja saldo={hero.saldo} payback={paybackMonth} es={es} />
    </div>
  );
}

function SectionHead({ kicker, title, body }: { kicker: string; title: string; body?: string }) {
  return (
    <div className="mb-7 max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-wider text-accent">{kicker}</p>
      <h2 className="mt-2 text-2xl font-black text-primary md:text-3xl">{title}</h2>
      {body && <p className="mt-2.5 text-muted-foreground">{body}</p>}
    </div>
  );
}

export default function RoiCalculator() {
  const { language } = useLanguage();
  const { user, getAccessToken } = useAuth();
  const es = language === 'es';
  const months = es ? MONTH_LABELS : MONTH_LABELS_EN;
  // Thousands separators differ between the two languages; set it before
  // anything below formats a figure.
  setRoiLocale(language);

  const [inputs, setInputs] = useState<RoiEntrada>(ENTRADA_INICIAL);
  const [heroScenario, setHeroScenario] = useState<Scenario>('conservador');
  const [detailScenario, setDetailScenario] = useState<Scenario>('conservador');

  const set = <K extends keyof RoiEntrada>(key: K, value: RoiEntrada[K]) =>
    setInputs((prev) => ({ ...prev, [key]: value }));
  // Los números que el cliente ya escribió. Los demás son sugerencias (de
  // un producto típico) y se ven en gris; borrar uno lo devuelve a la
  // sugerencia.
  const [escritos, setEscritos] = useState<ReadonlySet<keyof RoiEntrada>>(() => new Set());
  const sugerido = (key: keyof RoiEntrada) => !escritos.has(key);
  const fijar = <K extends keyof RoiEntrada>(key: K, value: RoiEntrada[K] | null) => {
    set(key, value ?? ENTRADA_INICIAL[key]);
    setEscritos((prev) => {
      const next = new Set(prev);
      if (value === null) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  /** Las props de una casilla del modelo, con su sugerencia. */
  const campo = (key: 'price' | 'cost' | 'weightG' | 'lot' | 'adsBudget' | 'contentBudget' | 'channelBudget') => ({
    id: `in_${{ price: 'price', cost: 'cost', weightG: 'weight', lot: 'lot', adsBudget: 'ads', contentBudget: 'content', channelBudget: 'channel' }[key]}`,
    value: inputs[key],
    onChange: (v: number | null) => fijar(key, v),
    sugerido: sugerido(key),
    es,
  });
  const setEnvio = useCallback((usd: number | null) => setInputs((prev) => ({ ...prev, domesticShipUsd: usd })), []);

  // El destino, la partida y el país de origen. En EE. UU. el arancel sale
  // del HTS cargado; en otro destino, de la línea de su arancel oficial
  // (la partida del HTS sólo sirve para llegar a la subpartida de 6
  // dígitos, que es igual en todo el mundo). En los dos casos, la tarifa
  // preferencial entra sólo si el acuerdo existe, la línea lo lista y el
  // producto cumple las reglas de origen; si no, la general.
  const [destinoIso, setDestinoIso] = useState('US');
  const dest = destinoDe(destinoIso) ?? DESTINOS[0];
  const esUS = dest.fuente === 'hts';
  // Reino Unido y UE: arancel oficial en vivo. Los demás países: la
  // tarifa de la subpartida la escribe el cliente.
  const enVivo = dest.fuente === 'uk' || dest.fuente === 'xi';
  const manual = dest.fuente === 'manual';
  const [tarifaManual, setTarifaManual] = useState<number | null>(null);
  // Si la tarifa del destino la puso la norma (gris) o el cliente.
  const [tarifaSugerida, setTarifaSugerida] = useState(false);
  const escribirTarifa = (v: number | null) => {
    setTarifaManual(v);
    setTarifaSugerida(false);
  };
  const [partida, setPartida] = useState<DetallePartida | null>(null);
  const [pais, setPais] = useState('CO');
  const [arancelDestino, setArancelDestino] = useState<ArancelDestino | null>(null);
  const preferencial = partida ? partida.preferencial[pais] : undefined;

  // ¿Califica para el acuerdo? Lo estiman las preguntas de reglas de
  // origen (composición de la tela en ropa, insumos importados en lo
  // demás). Sin acuerdo entre el origen y el destino, no se pregunta.
  const [respOrigen, setRespOrigen] = useState<RespuestasOrigen>(RESPUESTAS_INICIALES);
  const origenInfo = paisDeOrigen(pais);
  const acuerdoNombre = esUS ? origenInfo?.acuerdo ?? null : arancelDestino?.preferencial?.acuerdo ?? null;
  // En EE. UU., con la partida elegida, preguntar sólo si cambia algo: la
  // tarifa preferencial de la línea o, en México y CAFTA-DR, el recargo.
  const preguntarOrigen = Boolean(
    acuerdoNombre && (!esUS || !partida || preferencial || ['MX', 'CA', 'JO', 'CR', 'DO', 'SV', 'GT', 'HN', 'NI'].includes(pais))
  );
  const capitulo = partida ? capituloDe(partida.codigo) : null;
  const veredicto = evaluarOrigen(respOrigen, { destinoUS: esUS, capitulo });
  const cumple = preguntarOrigen && aplicaAcuerdo(veredicto);
  const destinoRegion = dest.iso === 'GB' ? (es ? 'el Reino Unido' : 'the UK') : es ? 'la Unión Europea' : 'the EU';
  const region = regionDelAcuerdo(pais, origenInfo?.nombre ?? pais, esUS, es, destinoRegion);
  // Sin acuerdo que aplicar, en ropa y textiles igual se pregunta la
  // composición: decide la partida (y avisa si la elegida no cuadra).
  // Fuera de EE. UU. espera a la línea del destino, que dice si hay acuerdo.
  const composicionSola = !preguntarOrigen && (!enVivo || arancelDestino !== null) && (capitulo === null || esCapituloTextil(capitulo));
  const choque = partida ? choqueConPartida(respOrigen.fibras, { capitulo, descripcion: partida.descripcion }) : null;

  const aplicada = esUS
    ? partida
      ? cumple && preferencial
        ? { tasa: preferencial.tasa, preferencial: true }
        : { tasa: partida.general?.tasa ?? parseTasa(''), preferencial: false }
      : null
    : manual
      ? partida && tarifaManual !== null
        ? { tasa: parseTasa(`${tarifaManual}%`), preferencial: false }
        : null
      : arancelDestino
      ? cumple && arancelDestino.preferencial
        ? { tasa: arancelDestino.preferencial.tasa, preferencial: true }
        : { tasa: arancelDestino.general ?? parseTasa(''), preferencial: false }
      : null;
  const hs6 = partida ? `${partida.digitos.slice(0, 4)}.${partida.digitos.slice(4, 6)}` : null;

  // Lo que se sabe del arancel del destino por norma (Colombia, México,
  // Chile; ver lib/sugerenciasArancel). Se llena solo al elegir producto,
  // origen o precio; el cliente lo puede cambiar. Ante la duda (TLC sin
  // certificado) se pone la tarifa plena.
  const sugerencia = manual && partida ? sugerenciaArancel({ destino: destinoIso, origen: pais, codigo: partida.digitos, fobUnidad: inputs.cost }) : null;
  // La clave no incluye la nota (que menciona el precio): cambiar el
  // costo no debe pisar una tarifa escrita a mano, salvo que cambie la
  // regla que aplica (p. ej. el calzado cruza su umbral).
  const claveSugerencia = sugerencia ? `${destinoIso}|${pais}|${partida?.digitos}|${sugerencia.tipo}|${tarifaInicial(sugerencia)}` : null;
  useEffect(() => {
    if (!sugerencia) return;
    setTarifaManual(tarifaInicial(sugerencia));
    setTarifaSugerida(tarifaInicial(sugerencia) !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveSugerencia]);
  const codigoAplicado = esUS ? partida?.codigo : manual ? hs6 ?? undefined : arancelDestino?.codigo;
  const hts = aplicada && codigoAplicado ? { codigo: codigoAplicado, tasa: aplicada.tasa } : null;

  // La proyección la calcula el servidor. Se pide con una pausa corta
  // después de la última tecla, y una respuesta vieja nunca pisa a una
  // nueva (se cancela).
  const [proy, setProy] = useState<Proyeccion | null>(null);
  const [sinRespuesta, setSinRespuesta] = useState(false);
  const pedido = JSON.stringify({ ...inputs, meetsAgreement: cumple, destino: destinoIso, origen: pais, hts });
  useEffect(() => {
    const control = new AbortController();
    const reloj = window.setTimeout(() => {
      void pedirProyeccion(JSON.parse(pedido), getAccessToken(), control.signal).then((r) => {
        if (control.signal.aborted) return;
        if (r) setProy(r);
        setSinRespuesta(!r);
      });
    }, 250);
    return () => {
      window.clearTimeout(reloj);
      control.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, user?.id]);

  const derecho = aplicada && proy?.derecho
    ? { ...proy.derecho, texto: aplicada.tasa.texto || '—', preferencial: aplicada.preferencial }
    : null;
  const cambiarDestino = (iso: string) => {
    const nuevo = destinoDe(iso);
    if (!nuevo) return;
    setDestinoIso(iso);
    setArancelDestino(null);
    setTarifaManual(null);
    setTarifaSugerida(false);
  };
  const pideLitros = Boolean(aplicada?.tasa.necesita.includes('volumen'));

  const r = proy?.resumen;
  const hero: AnioUnoResumen | null = r ? (heroScenario === 'optimista' ? r.opt1 : r.cons1) : null;
  const detail1: AnioUnoResumen | null = r ? (detailScenario === 'optimista' ? r.opt1 : r.cons1) : null;
  const inversion = proy?.inversion;

  const paybackMonth = hero && inversion ? mesEnQue(hero.saldo, inversion.total) : null;
  const consBreak = r ? mesEnQue(r.cons1.saldo, 0) : null;
  const optBreak = r ? mesEnQue(r.opt1.saldo, 0) : null;

  const scenarioLabels = {
    conservador: es ? 'Conservador' : 'Conservative',
    optimista: es ? 'Optimista' : 'Optimistic',
  };

  const freeRows = (d: AnioUnoResumen): RoiRow[] => [
    { label: es ? 'Costo total por unidad vendida' : 'Total cost per unit sold', values: d.costUnit, fmt: 'currency2' },
    { label: es ? 'Utilidad o pérdida antes de impuestos por unidad' : 'Pre-tax profit or loss per unit', values: d.profitUnit, fmt: 'currency2', colorize: true },
    { label: es ? 'Utilidad o pérdida del mes' : 'Profit or loss for the month', values: d.profitMonth, fmt: 'currency1', colorize: true },
    { label: es ? 'Retorno por unidad antes de impuestos' : 'Pre-tax return per unit', values: d.roiUnit, fmt: 'pct', colorize: true },
  ];

  // Sin el reporte comprado no llegan datos: detrás del desenfoque van
  // números de relleno con la forma de la tabla.
  const breakdownRows = (filas: FilaDesglose[] | null): RoiRow[] => {
    const pick = (key: keyof FilaDesglose, base: number, paso: number) => (filas ? filas.map((f) => f[key]) : relleno(12, base, paso));
    return [
      { label: es ? `Precio de venta en ${esUS ? 'USA' : dest.nombre}` : esUS ? 'US selling price' : `Selling price in ${dest.nombreEn}`, values: pick('price', 50, 0), fmt: 'currency2' },
      { label: es ? 'Costo del producto en Latinoamérica' : 'Production cost in Latin America', values: pick('product', 12, 0), fmt: 'currency2' },
      { label: es ? 'Flete internacional por unidad' : 'International freight per unit', values: pick('freight', 2, 0.1), fmt: 'currency2' },
      {
        label: inputs.domesticShipUsd !== null
          ? es ? 'Envío en EE. UU. (tarifa cotizada)' : 'US shipping (quoted rate)'
          : es ? 'Envío de cada pedido en EE. UU.' : 'Shipping each order in the US',
        values: pick('domesticShip', 6, 0.2),
        fmt: 'currency2',
      },
      {
        label: codigoAplicado
          ? esUS
            ? `${es ? 'Aranceles de importación' : 'Import duties'} · ${codigoAplicado}`
            : `${es ? 'Aranceles' : 'Duties'} ${es ? dest.nombre : dest.nombreEn} · ${codigoAplicado}`
          : es ? 'Aranceles de importación' : 'Import duties',
        values: pick('aranceles', 2, 0.1),
        fmt: 'currency2',
      },
      { label: es ? 'Devoluciones' : 'Returns', values: pick('returns', 1, 0), fmt: 'currency2' },
      { label: es ? 'Comisión plataformas' : 'Marketplace commission', values: pick('platform', 4, 0), fmt: 'currency2' },
      { label: es ? 'Administración de inventario y alistamiento' : 'Inventory handling and prep', values: pick('warehousing', 3, 0), fmt: 'currency2' },
      { label: es ? 'Administración de canal por unidad' : 'Channel management per unit', values: pick('channel', 5, 1.5), fmt: 'currency2' },
      { label: es ? 'Publicidad (ADS) por unidad' : 'Advertising per unit', values: pick('ads', 5, 1.5), fmt: 'currency2' },
      { label: es ? 'Generación de contenido propio' : 'Own content production', values: pick('content', 3, 1), fmt: 'currency2' },
      { label: es ? 'Comisión red comercial por unidad' : 'Sales-network commission per unit', values: pick('ugc', 8, 0), fmt: 'currency2' },
      { label: es ? 'Costo total por unidad vendida' : 'Total cost per unit sold', values: pick('total', 40, 4), fmt: 'currency2', bold: true },
    ];
  };

  const forecastRows = (d: Pronostico | null): RoiRow[] => {
    const v = (key: keyof Pronostico, base: number, paso: number) => (d ? d[key] : relleno(12, base, paso));
    return [
      { label: es ? 'Total ventas canal digital' : 'Total digital-channel sales', values: v('revenueArr', 40000, 9000), fmt: 'currency' },
      { label: es ? 'Unidades vendidas' : 'Units sold', values: v('units', 800, 150), fmt: 'int' },
      { label: es ? 'Ticket promedio' : 'Average ticket', values: v('ticket', 55, 0), fmt: 'currency2' },
      { label: es ? 'Costo de producto' : 'Product cost', values: v('cogsArr', 25000, 6000), fmt: 'currency' },
      { label: es ? 'Incremento en ADS' : 'Additional ad spend', values: v('adsIncrArr', 2500, 600), fmt: 'currency' },
      { label: es ? 'Imprevistos' : 'Contingency', values: v('imprevArr', 600, 0), fmt: 'currency' },
      { label: es ? 'Total egresos' : 'Total outflows', values: v('egresosArr', 28000, 6000), fmt: 'currency', bold: true },
      { label: es ? 'Utilidad / pérdida' : 'Profit / loss', values: v('profitMonth', 9000, 3000), fmt: 'currency', colorize: true, bold: true },
      { label: es ? 'Saldo acumulado' : 'Cumulative balance', values: v('saldo', 30000, 12000), fmt: 'currency', colorize: true, bold: true },
    ];
  };

  const desglose = proy?.desglose ? (detailScenario === 'optimista' ? proy.desglose.opt : proy.desglose.cons) : null;
  const pron1 = proy?.pronostico ? (detailScenario === 'optimista' ? proy.pronostico.opt1 : proy.pronostico.cons1) : null;
  const pron2 = proy?.pronostico ? (detailScenario === 'optimista' ? proy.pronostico.opt2 : proy.pronostico.cons2) : null;

  const invPct = (part: number) => (inversion && inversion.total > 0 ? (part / inversion.total) * 100 : 0);

  return (
    <div className="min-h-screen bg-white pb-24 md:pb-0">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3 md:h-20">
          <Link href="/" className="tap-scale-sm flex items-center gap-2 py-2 font-logo text-xl tracking-tight md:text-2xl">
            <ArrowLeft size={18} className="text-muted-foreground" />
            <span><span className="text-accent">easy</span><span className="text-primary">comex</span></span>
          </Link>
          <span className="hidden rounded-full border border-gray-200 bg-secondary/60 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary sm:block">
            {es ? 'Calculadora ROI · Plan e-commerce' : 'ROI calculator · e-commerce plan'}
          </span>
        </div>
      </header>

      <div className="container">
        {/* Hero */}
        <section className="pb-2 pt-8 md:pt-10">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-accent">
            <Sparkles size={13} />
            {es ? 'Calculadora interactiva' : 'Interactive calculator'}
          </span>
          <h1 className="max-w-[18ch] text-3xl font-black leading-[1.08] text-primary sm:text-4xl md:text-5xl">
            {es ? 'Escribe los números de tu producto y mira tu retorno real.' : 'Type your product’s numbers and see your real return.'}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            {es
              ? 'Ajusta precio, costo, presupuesto de marketing y aranceles — todo se recalcula al instante con la misma lógica financiera del modelo mes a mes que usamos con nuestros clientes.'
              : 'Adjust price, cost, marketing budget and tariffs — everything recalculates instantly using the same month-by-month financial model we run with our clients.'}
          </p>
        </section>

        {/* Inputs + live result */}
        <div className="my-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="rounded-3xl border border-gray-100 bg-white p-5 app-shadow md:p-8">
            <div className="mb-7 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-primary">{es ? 'Tus números' : 'Your numbers'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {es ? 'Llena los 4 pasos. El resultado se actualiza solo mientras escribes.' : 'Fill in the 4 steps. The result updates as you type.'}
                </p>
                <p className="mt-2 inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-200 px-2.5 py-1 text-xs text-muted-foreground">
                  <span className="font-bold text-gray-400">$ 54.9</span>
                  {es ? 'En gris: sugerencias de un producto típico. Escribe encima las tuyas.' : 'In grey: suggestions from a typical product. Type yours over them.'}
                </p>
              </div>
              <span className="inline-flex flex-none items-center gap-2 rounded-full bg-green-50 px-3.5 py-1.5 text-xs font-bold text-green-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                {es ? 'Cálculo en vivo' : 'Live calculation'}
              </span>
            </div>

            <Paso n={1} listo={!sugerido('price') && !sugerido('cost')} title={es ? 'Tu producto' : 'Your product'} help={es ? 'Lo que cobras, lo que te cuesta hacerlo, cuánto mandas en el primer envío y cuántos pedidos vuelven.' : 'What you charge, what it costs you to make, how much you ship first and how many orders come back.'}>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <NumberField {...campo('price')} label={es ? `Precio de venta en ${esUS ? 'EE. UU.' : dest.nombre}` : esUS ? 'US selling price' : `Selling price in ${dest.nombreEn}`} prefix="$" step={0.1} />
                <NumberField {...campo('cost')} label={es ? 'Costo de producirlo' : 'Production cost'} prefix="$" step={0.1} />
                <NumberField {...campo('weightG')} label={es ? 'Peso con empaque' : 'Packed weight'} suffix="g" step={10} min={1} />
                <NumberField {...campo('lot')} label={es ? 'Unidades del primer envío' : 'Units in the first shipment'} step={50} min={1} />
                <div className="grid grid-cols-1 items-center gap-x-5 gap-y-1 rounded-2xl border border-gray-100 bg-secondary/30 p-3.5 sm:grid-cols-2 sm:col-span-2">
                  <div>
                    <NumberField
                      id="in_returns"
                      label={es ? 'Devoluciones' : 'Returns'}
                      value={inputs.returnsPct * 100}
                      onChange={(v) => fijar('returnsPct', v === null ? null : v / 100)}
                      sugerido={sugerido('returnsPct')}
                      es={es}
                      suffix="%"
                      step={0.5}
                      ayuda={es ? 'De cada 100 pedidos, cuántos vuelven. En belleza y alimentos suele ser 1–3 %; en ropa, 8–15 %.' : 'Out of 100 orders, how many come back. Beauty and food: 1–3%; apparel: 8–15%.'}
                    />
                  </div>
                  <div>
                    <Deslizador
                      label={es ? 'Devoluciones' : 'Returns'}
                      value={inputs.returnsPct * 100}
                      max={25}
                      step={0.5}
                      onChange={(v) => fijar('returnsPct', v / 100)}
                      sugerido={sugerido('returnsPct')}
                      marcas={['0 %', '25 %']}
                    />
                  </div>
                </div>
              </div>
            </Paso>

            <Paso n={2} listo={Boolean(partida && aplicada)} title={es ? 'Dónde vendes y su arancel' : 'Where you sell and its duty'} help={es ? 'Elige el país y busca tu producto: el arancel sale de la tarifa oficial de ese país.' : 'Pick the country and find your product: the duty comes from that country’s official tariff.'}>
              <label className="mb-4 block">
                <span className="mb-1.5 block text-sm font-semibold text-muted-foreground">{es ? 'País de destino' : 'Destination country'}</span>
                <select
                  value={destinoIso}
                  onChange={(e) => cambiarDestino(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-gray-200 bg-secondary/60 px-3 py-2.5 font-bold text-primary outline-none focus:border-accent focus:bg-white sm:w-64"
                >
                  <optgroup label={es ? 'Mercados principales' : 'Main markets'}>
                    {DESTINOS_PRINCIPALES.map((iso) => destinoDe(iso)).filter((d): d is NonNullable<typeof d> => d !== null).map((d) => (
                      <option key={d.iso} value={d.iso}>{es ? d.nombre : d.nombreEn}</option>
                    ))}
                  </optgroup>
                  <optgroup label={es ? 'Unión Europea' : 'European Union'}>
                    {DESTINOS.filter((d) => d.fuente === 'xi' && !DESTINOS_PRINCIPALES.includes(d.iso)).map((d) => (
                      <option key={d.iso} value={d.iso}>{es ? d.nombre : d.nombreEn}</option>
                    ))}
                  </optgroup>
                  <optgroup label={es ? 'Todos los demás países' : 'All other countries'}>
                    {DESTINOS.filter((d) => d.fuente === 'manual' && !DESTINOS_PRINCIPALES.includes(d.iso))
                      .map((d) => ({ iso: d.iso, nombre: es ? d.nombre : d.nombreEn }))
                      .sort((a, b) => a.nombre.localeCompare(b.nombre, es ? 'es' : 'en'))
                      .map((d) => (
                        <option key={d.iso} value={d.iso}>{d.nombre}</option>
                      ))}
                  </optgroup>
                </select>
              </label>

              <PartidaArancel
                soloSubpartida={!esUS}
                es={es}
                detalle={partida}
                onDetalle={setPartida}
                pais={pais}
                onPais={setPais}
                cumple={cumple}
                derecho={esUS ? derecho : null}
              />

              {manual && partida && (
                <div className="mb-6 rounded-2xl border border-gray-100 bg-secondary/40 p-4 md:p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {es ? `Arancel en ${dest.nombre}` : `Duty in ${dest.nombreEn}`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {es
                      ? `Busca la subpartida ${hs6} en el arancel de ${dest.nombre} (por ejemplo en macmap.org, gratis) y escribe la tarifa que paga tu producto desde tu país. Si hay acuerdo comercial y tu producto cumple, pon la preferencial.`
                      : `Look up subheading ${hs6} in ${dest.nombreEn}’s tariff (for example on macmap.org, free) and type the rate your product pays from your country. If there is a trade agreement and your product qualifies, use the preferential rate.`}
                  </p>
                  {sugerencia && (
                    <div className="mt-2 rounded-lg border border-accent/20 bg-orange-50 px-3 py-2 text-sm text-primary">
                      <p>
                        {sugerencia.tipo === 'fija'
                          ? es
                            ? `Por ${sugerencia.norma}, este producto paga ${sugerencia.pct} % desde ${origenInfo?.nombre ?? pais}${sugerencia.nota ? ` (${sugerencia.nota})` : ''}. Ya quedó escrito.`
                            : `Under ${sugerencia.norma}, this product pays ${sugerencia.pct}% from ${origenInfo?.nombreEn ?? origenInfo?.nombre ?? pais}${sugerencia.nota ? ` (${sugerencia.nota})` : ''}. Already filled in.`
                          : sugerencia.tipo === 'segun_origen'
                            ? es
                              ? `Con el ${sugerencia.acuerdo} entra con ${sugerencia.preferencial} % si trae certificado de origen; sin él paga ${sugerencia.sinCertificado} % (${sugerencia.norma}).`
                              : `Under the ${sugerencia.acuerdo} it enters at ${sugerencia.preferencial}% with a certificate of origin; without it, ${sugerencia.sinCertificado}% (${sugerencia.norma}).`
                            : sugerencia.tipo === 'opciones'
                              ? es
                                ? `Por ${sugerencia.norma}, depende del tipo de producto:`
                                : `Under ${sugerencia.norma}, it depends on the kind of product:`
                              : sugerencia.nota}
                      </p>
                      {(sugerencia.tipo === 'segun_origen' || sugerencia.tipo === 'opciones') && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(sugerencia.tipo === 'segun_origen'
                            ? [
                                { pct: sugerencia.preferencial, texto: es ? 'con certificado' : 'with certificate' },
                                { pct: sugerencia.sinCertificado, texto: es ? 'sin certificado' : 'without certificate' },
                              ]
                            : sugerencia.opciones
                          ).map((o) => (
                            <button
                              key={o.pct}
                              type="button"
                              aria-pressed={tarifaManual === o.pct}
                              onClick={() => escribirTarifa(o.pct)}
                              className={`tap-scale-sm rounded-full border px-3 py-1 text-xs font-bold ${tarifaManual === o.pct ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-primary'}`}
                            >
                              {o.pct} % · {o.texto}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className={`flex w-40 items-center rounded-xl border-[1.5px] border-gray-200 bg-white pr-3 focus-within:border-accent ${tarifaSugerida ? 'border-dashed' : ''}`}>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={1000}
                        step={0.1}
                        aria-label={es ? `Arancel en ${dest.nombre}` : `Duty in ${dest.nombreEn}`}
                        placeholder={es ? 'Ej.: 12' : 'E.g. 12'}
                        value={tarifaManual ?? ''}
                        onChange={(e) => escribirTarifa(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                        className={`w-full min-w-0 rounded-xl bg-transparent px-3 py-2.5 font-bold outline-none ${tarifaSugerida ? 'text-gray-400' : 'text-primary'}`}
                      />
                      <span className="font-bold text-muted-foreground">%</span>
                    </div>
                    <p className="text-sm text-primary">
                      {tarifaSugerida && (
                        <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">{es ? 'sugerido por norma' : 'suggested by rule'}</span>
                      )}
                      {derecho
                        ? <>{es ? 'Arancel por unidad' : 'Duty per unit'}: <b>${derecho.usd.toFixed(2)}</b> ({es ? `sobre el valor ${dest.base === 'fob' ? 'FOB' : 'CIF'}` : `on the ${dest.base === 'fob' ? 'FOB' : 'CIF'} value`})</>
                        : es ? 'Mientras no la escribas, el cálculo usa un arancel estimado.' : 'Until you type it, the projection uses an estimated duty.'}
                    </p>
                  </div>
                </div>
              )}

              {enVivo && partida && (
                <LineaDestino
                  es={es}
                  destino={dest}
                  hs6={partida.digitos.slice(0, 6)}
                  origen={pais}
                  cumple={cumple}
                  arancel={arancelDestino}
                  onArancel={setArancelDestino}
                  derecho={derecho}
                />
              )}

              {(preguntarOrigen || composicionSola) && (
                <ReglasOrigen
                  es={es}
                  acuerdo={preguntarOrigen ? acuerdoNombre : null}
                  paisNombre={origenInfo?.nombre ?? pais}
                  region={region}
                  capitulo={capitulo}
                  valor={respOrigen}
                  onChange={setRespOrigen}
                  veredicto={veredicto}
                  choque={choque}
                />
              )}

              {partida && (
                <div className="mb-5 empty:hidden">
                  <FabricantesSugeridos
                    codigo={partida.codigo}
                    contexto={`${partida.codigo} · ${partida.descripcion.slice(-1)[0] ?? ''}`.slice(0, 200)}
                    lugar="roi"
                    es={es}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {pideLitros && (
                  <NumberField
                    id="in_liters"
                    label={es ? 'Contenido por unidad' : 'Content per unit'}
                    value={Math.round(inputs.litersPerUnit * 1000)}
                    onChange={(v) => fijar('litersPerUnit', v === null ? null : v / 1000)}
                    sugerido={sugerido('litersPerUnit')}
                    es={es}
                    suffix="ml"
                    step={50}
                  />
                )}
              </div>
            </Paso>

            {esUS && (
              <Paso n={3} listo={inputs.domesticShipUsd !== null} title={es ? 'Envío de cada pedido' : 'Shipping each order'} help={es ? 'Opcional: cotiza el envío real desde tu bodega en EE. UU.' : 'Optional: quote the real shipping from your US warehouse.'}>
                <EnvioEEUU
                  es={es}
                  pesoG={inputs.weightG}
                  aplica={proy?.envioAplica ?? false}
                  valor={inputs.domesticShipUsd}
                  onValor={setEnvio}
                />
              </Paso>
            )}

            <Paso n={esUS ? 4 : 3} listo={!sugerido('adsBudget') || !sugerido('contentBudget') || !sugerido('channelBudget') || !sugerido('ugcPct')} title={es ? 'Tu mercadeo del mes' : 'Your monthly marketing'} help={es ? 'Lo que vas a invertir cada mes para vender y la comisión de quien te ayuda a vender.' : 'What you will invest every month to sell, and the commission of whoever helps you sell.'}>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <NumberField {...campo('adsBudget')} label={es ? 'Publicidad (ADS)' : 'Advertising (ads)'} prefix="$" step={50} />
                <NumberField {...campo('contentBudget')} label={es ? 'Contenido' : 'Content'} prefix="$" step={50} />
                <NumberField {...campo('channelBudget')} label={es ? 'Manejo del canal' : 'Channel management'} prefix="$" step={50} />
              </div>
              <p className="mt-3 flex items-center justify-between rounded-xl bg-secondary/50 px-3.5 py-2 text-sm">
                <span className="text-muted-foreground">{es ? 'Total de mercadeo al mes' : 'Total marketing per month'}</span>
                <b className="tabular-nums text-primary">{fmtMoney(inputs.adsBudget + inputs.contentBudget + inputs.channelBudget)}</b>
              </p>
                <div className="grid grid-cols-1 items-center gap-x-5 gap-y-1 mt-3.5 rounded-2xl border border-gray-100 bg-secondary/30 p-3.5 sm:grid-cols-2">
                  <div>
                    <NumberField
                      id="in_ugc"
                      label={es ? 'Comisión de la red comercial' : 'Sales-network commission'}
                      value={inputs.ugcPct * 100}
                      onChange={(v) => fijar('ugcPct', v === null ? null : v / 100)}
                      sugerido={sugerido('ugcPct')}
                      es={es}
                      suffix="%"
                      step={1}
                      ayuda={es ? 'Lo que se lleva por venta quien recomienda tu producto (creadores, afiliados).' : 'What whoever recommends your product (creators, affiliates) takes per sale.'}
                    />
                  </div>
                  <div>
                    <Deslizador
                      label={es ? 'Comisión de la red comercial' : 'Sales-network commission'}
                      value={inputs.ugcPct * 100}
                      max={40}
                      step={1}
                      onChange={(v) => fijar('ugcPct', v / 100)}
                      sugerido={sugerido('ugcPct')}
                      marcas={['0 %', '40 %']}
                    />
                  </div>
                </div>
            </Paso>
          </section>

          <aside className="lg:sticky lg:top-24">
            <ResultadoVivo
              es={es}
              proy={proy}
              sinRespuesta={sinRespuesta}
              hero={hero}
              inversion={inversion}
              paybackMonth={paybackMonth}
              escenario={heroScenario}
              onEscenario={setHeroScenario}
              labels={scenarioLabels}
              conSugeridos={sugerido('price') || sugerido('cost')}
              aviso={
                manual && tarifaManual === null
                  ? es
                    ? `Falta el arancel de ${dest.nombre}: el resultado usa un 8 % estimado. ${partida ? 'Escríbelo en el paso 2.' : 'Elige tu producto en el paso 2 y escríbelo.'}`
                    : `${dest.nombreEn}'s duty is missing: the result uses an estimated 8%. ${partida ? 'Type it in step 2.' : 'Pick your product in step 2 and type it.'}`
                  : null
              }
            />
          </aside>
        </div>

        {proy && r && hero && detail1 && inversion && (<>
        {/* Cash flow + suggested budget: right under the numbers */}
        <section className="my-10">
          <SectionHead
            kicker={es ? 'Tu plan de arranque' : 'Your launch plan'}
            title={es ? 'Cuándo vuelve tu plata y cuánto necesitas para arrancar' : 'When your money comes back and how much you need to start'}
            body={es
              ? `El conservador ${consBreak ? `encuentra equilibrio en el mes ${consBreak}` : 'no llega a equilibrio en 12 meses'}; el optimista ${optBreak ? `lo alcanza en el mes ${optBreak}` : 'no llega a equilibrio en 12 meses'}. Toca la gráfica para ver cada mes.`
              : `The conservative case ${consBreak ? `breaks even in month ${consBreak}` : 'does not break even within 12 months'}; the optimistic one ${optBreak ? `gets there in month ${optBreak}` : 'does not break even within 12 months'}. Tap the chart to see each month.`}
          />
          <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="rounded-3xl border border-gray-100 bg-white p-5 app-shadow md:p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-accent"><TrendingUp size={18} /></span>
                <div>
                  <h3 className="text-base font-bold text-primary">{es ? 'Saldo de caja acumulado' : 'Cumulative cash balance'}</h3>
                  <p className="text-xs text-muted-foreground">{es ? 'Primeros 12 meses, sin financiamiento externo' : 'First 12 months, no external financing'}</p>
                </div>
              </div>
              <CashChart
                conservative={r.cons1.saldo}
                optimistic={r.opt1.saldo}
                labels={{
                  conservative: scenarioLabels.conservador,
                  optimistic: scenarioLabels.optimista,
                  month: (n) => (es ? `Mes ${n}` : `Month ${n}`),
                  monthShort: (n) => `M${n}`,
                  breakEven: es ? 'Equilibrio' : 'Break-even',
                  lossZone: es ? 'Zona de pérdida' : 'Loss zone',
                  title: es
                    ? 'Saldo de caja acumulado durante los 12 meses del año 1, comparando escenario conservador y optimista'
                    : 'Cumulative cash balance across the 12 months of year 1, comparing the conservative and optimistic scenarios',
                }}
              />
            </div>

            <div className="flex flex-col rounded-3xl border border-gray-100 bg-white p-5 app-shadow md:p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-[#4A63D6]"><Wallet size={18} /></span>
                <div>
                  <h3 className="text-base font-bold text-primary">{es ? 'Presupuesto sugerido' : 'Suggested budget'}</h3>
                  <p className="text-xs text-muted-foreground">{es ? 'Capital para arrancar, con tus números' : 'Capital to start, from your numbers'}</p>
                </div>
              </div>
              <p className="font-heading text-4xl font-black tabular-nums text-primary md:text-5xl">{fmtMoney(inversion.total)}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {fmtInt(inputs.lot)} {es ? 'unidades + logística de salida + 3 meses de marketing y operación.' : 'units + outbound logistics + 3 months of marketing and operations.'}
              </p>

              <div className="mt-5 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-secondary">
                <span className="h-full rounded-l-full bg-accent transition-all duration-300" style={{ width: `${invPct(inversion.productCost)}%` }} />
                <span className="h-full bg-[#4A63D6] transition-all duration-300" style={{ width: `${invPct(inversion.logistics)}%` }} />
                <span className="h-full rounded-r-full bg-primary transition-all duration-300" style={{ width: `${invPct(inversion.marketing3)}%` }} />
              </div>
              <ul className="mb-4 mt-4 flex flex-col gap-2">
                {[
                  { color: 'bg-accent', label: es ? 'Inventario inicial' : 'Initial inventory', sub: `${fmtInt(inputs.lot)} × ${fmtMoney2(inputs.cost)}`, value: inversion.productCost },
                  { color: 'bg-[#4A63D6]', label: es ? 'Logística de salida' : 'Outbound logistics', sub: es ? 'flete y aduana del primer envío' : 'freight and customs, first shipment', value: inversion.logistics },
                  { color: 'bg-primary', label: es ? 'Marketing y operación' : 'Marketing and operations', sub: es ? '3 meses del canal digital' : '3 months of the digital channel', value: inversion.marketing3 },
                ].map((row) => (
                  <li key={row.label} className="flex items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2.5">
                    <span className={`h-8 w-1.5 flex-none rounded-full ${row.color}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-primary">{row.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{row.sub}</span>
                    </span>
                    <span className="text-right">
                      <b className="block text-sm tabular-nums text-foreground">{fmtMoney(row.value)}</b>
                      <span className="block text-[11px] font-semibold tabular-nums text-muted-foreground">{Math.round(invPct(row.value))}%</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className={`mt-4 rounded-xl px-3 py-2.5 text-sm font-semibold lg:mt-auto ${paybackMonth ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>
                {paybackMonth
                  ? es ? `En el escenario ${scenarioLabels[heroScenario].toLowerCase()} la recuperas en el mes ${paybackMonth}.` : `In the ${scenarioLabels[heroScenario].toLowerCase()} case you get it back in month ${paybackMonth}.`
                  : es ? `En el escenario ${scenarioLabels[heroScenario].toLowerCase()} vuelve después del primer año.` : `In the ${scenarioLabels[heroScenario].toLowerCase()} case it comes back after year one.`}
              </p>
            </div>
          </div>
        </section>

        {/* Scenario comparison */}
        <section className="my-12">
          <SectionHead
            kicker={es ? 'Comparativo' : 'Comparison'}
            title={es ? 'Conservador vs. optimista, con tus propios números' : 'Conservative vs. optimistic, with your own numbers'}
            body={es
              ? 'Misma estructura de costos que escribiste arriba — la diferencia entre columnas es solo el ritmo de crecimiento en ventas.'
              : 'The same cost structure you typed above — the only difference between columns is the sales ramp.'}
          />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {[
              { key: 'cons' as const, y1: r.cons1, y2: r.cons2, accent: 'bg-accent', pill: 'bg-orange-50 text-accent', range: es ? 'Sostenido' : 'Steady', name: scenarioLabels.conservador, sub: es ? 'Crecimiento sostenido durante el año 1' : 'Sustained growth through year 1' },
              { key: 'opt' as const, y1: r.opt1, y2: r.opt2, accent: 'bg-[#4A63D6]', pill: 'bg-indigo-50 text-[#1F2E73]', range: es ? 'Con campañas' : 'With campaigns', name: scenarioLabels.optimista, sub: es ? 'Picos de campaña (Black Friday, temporada alta) en el segundo semestre' : 'Campaign peaks (Black Friday, high season) in the second half' },
            ].map((card) => (
              <div key={card.key} className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 app-shadow md:p-7">
                <span className={`absolute inset-y-0 left-0 w-1.5 ${card.accent}`} />
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-primary">{card.name}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${card.pill}`}>{card.range}</span>
                </div>
                <p className="mb-4 text-sm text-muted-foreground">{card.sub}</p>

                {([['1', card.y1], ['2', card.y2]] as const).map(([year, data]) => (
                  <div key={year}>
                    <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {es ? `Año ${year}` : `Year ${year}`}
                    </p>
                    <div className="flex items-baseline justify-between border-b border-dashed border-gray-100 py-1.5">
                      <span className="text-sm text-muted-foreground">{es ? 'Ingresos' : 'Revenue'}</span>
                      <span className="text-sm font-bold tabular-nums text-foreground">{fmtMoney(data.revenue)}</span>
                    </div>
                    <div className="flex items-baseline justify-between border-b border-dashed border-gray-100 py-1.5">
                      <span className="text-sm text-muted-foreground">{es ? 'Costos totales' : 'Total costs'}</span>
                      <span className="text-sm font-bold tabular-nums text-foreground">{fmtMoney(data.egresos)}</span>
                    </div>
                    <div className="flex items-baseline justify-between py-1.5">
                      <span className="text-sm text-muted-foreground">{es ? 'Utilidad neta' : 'Net profit'}</span>
                      <span className={`text-sm font-bold tabular-nums ${data.utilidad >= 0 ? 'text-green-700' : 'text-accent'}`}>
                        {fmtMoney(data.utilidad)} · {pctOf(data.utilidad, data.revenue)}
                      </span>
                    </div>
                  </div>
                ))}

                <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                  <span className="text-sm text-muted-foreground">{es ? 'ROI acumulado a 2 años' : 'Cumulative 2-year ROI'}</span>
                  <span className={`font-heading text-2xl font-bold ${card.key === 'cons' ? 'text-accent' : 'text-[#1F2E73]'}`}>
                    {xOf(card.y1.utilidad + card.y2.utilidad, inversion.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Monthly detail (free) */}
        <section className="my-12">
          <SectionHead
            kicker={es ? 'Detalle mensual · Gratis' : 'Monthly detail · Free'}
            title={es ? 'Mes a mes, unidad por unidad' : 'Month by month, unit by unit'}
            body={es
              ? 'Costo total, utilidad antes de impuestos y retorno por unidad — los 12 meses del Año 1, calculados con tus números de arriba.'
              : 'Total cost, pre-tax profit and return per unit — all 12 months of year 1, from the numbers you typed above.'}
          />

          <div className="mb-6 flex justify-center">
            <ScenarioToggle value={detailScenario} onChange={setDetailScenario} labels={scenarioLabels} />
          </div>

          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white app-shadow">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <h3 className="font-bold text-primary">
                {scenarioLabels[detailScenario]} — {es ? 'resumen mes a mes' : 'month-by-month summary'}
              </h3>
              <span className="rounded-full bg-green-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-green-700">
                {es ? 'Gratis' : 'Free'}
              </span>
            </div>
            <div className="px-2 pb-2">
              <RoiTable months={months} rows={freeRows(detail1)} />
            </div>
          </div>
        </section>

        {/* Cost breakdown (paid) */}
        <section className="my-12">
          <SectionHead
            kicker={es ? 'Desglose completo · Plan de pago' : 'Full breakdown · Paid'}
            title={es ? 'De dónde sale cada dólar de costo' : 'Where every dollar of cost comes from'}
          />
          <RoiPaywall
            plan={REPORTS.detalle.plan}
            unlocked={proy.desbloqueado.detalle}
            title={es ? 'Desglose de costos mes a mes' : 'Month-by-month cost breakdown'}
            blurb={es
              ? `Cada componente del costo, mes a mes, para tu escenario ${scenarioLabels[detailScenario].toLowerCase()} — con estos mismos números que ya escribiste arriba.`
              : `Every cost component, month by month, for your ${scenarioLabels[detailScenario].toLowerCase()} scenario — using the very numbers you typed above.`}
            priceCents={REPORTS.detalle.priceCents}
            oldPriceCents={REPORTS.detalle.oldPriceCents}
          >
            <RoiTable months={months} rows={breakdownRows(desglose)} />
          </RoiPaywall>
        </section>

        {/* Two-year forecast (paid) */}
        <section className="my-12">
          <SectionHead
            kicker={es ? 'Pronóstico Año 1 y 2 · Plan completo' : 'Year 1 & 2 forecast · Full plan'}
            title={es ? 'El flujo de caja completo, mes a mes, dos años' : 'The full cash flow, month by month, two years'}
          />
          <RoiPaywall
            plan={REPORTS.pronostico.plan}
            unlocked={proy.desbloqueado.pronostico}
            title={es ? 'Pronóstico completo a 2 años' : 'Full 2-year forecast'}
            blurb={es
              ? 'Flujo de caja mes a mes de los dos años, más el desglose completo de costos — todo para el escenario que elijas.'
              : 'Month-by-month cash flow for both years, plus the full cost breakdown — for whichever scenario you pick.'}
            priceCents={REPORTS.pronostico.priceCents}
            oldPriceCents={REPORTS.pronostico.oldPriceCents}
          >
            <div>
              <p className="px-4 pb-1 pt-4 text-sm font-bold text-primary">
                {es ? `Año 1 — ${scenarioLabels[detailScenario]}` : `Year 1 — ${scenarioLabels[detailScenario]}`}
              </p>
              <RoiTable months={months} rows={forecastRows(pron1)} />
              <p className="px-4 pb-1 pt-5 text-sm font-bold text-primary">
                {es ? `Año 2 — ${scenarioLabels[detailScenario]}` : `Year 2 — ${scenarioLabels[detailScenario]}`}
              </p>
              <RoiTable months={months} rows={forecastRows(pron2)} />
            </div>
          </RoiPaywall>
        </section>

        {/* Advisory */}
        <section className="my-12">
          <div className="grid grid-cols-1 items-start gap-6 rounded-3xl border-[1.5px] border-orange-100 bg-gradient-to-br from-white to-orange-50/60 p-7 md:grid-cols-[auto_1fr] md:p-9">
            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-primary text-white">
              <Phone size={22} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-accent">
                {es ? '¿No quieres hacerlo solo?' : 'Rather not do it alone?'}
              </p>
              <h2 className="mt-2 text-xl font-black text-primary md:text-2xl">
                {es ? 'Habla 20 minutos con un asesor y sal con tu plan de 3 meses listo' : 'Talk to an advisor for 20 minutes and leave with your 3-month plan'}
              </h2>
              <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
                {es
                  ? 'Una llamada de 20 minutos, sin costo, y sales con un plan estructurado a 3 meses hecho a la medida de tu producto — no un reporte genérico.'
                  : 'A free 20-minute call, and you leave with a structured 3-month plan built around your product — not a generic report.'}
              </p>
              <button
                onClick={() => openExternal(whatsappUrl(es
                  ? 'Hola, usé la calculadora ROI y quiero agendar los 20 minutos con un asesor.'
                  : 'Hi, I used the ROI calculator and want to book the 20-minute call with an advisor.'))}
                className="tap-scale mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full border-0 bg-green-500 px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-green-600"
              >
                <MessageCircle size={16} />
                {es ? 'Agendar mi llamada' : 'Book my call'}
              </button>
            </div>
          </div>
        </section>

        </>)}

        {/* Method note */}
        <p className="flex gap-3 rounded-2xl border border-gray-100 bg-secondary/60 p-5 text-sm leading-relaxed text-muted-foreground">
          <Info size={18} className="mt-0.5 flex-none text-primary/60" />
          <span>
          <strong className="text-foreground">{es ? 'Nota.' : 'Note.'}</strong>{' '}
          {es
            ? 'Cifras en USD, antes de impuestos, calculadas con el modelo financiero de Easycomex a partir de tus números. Los aranceles salen de la partida que elegiste en el arancel oficial del país de destino; la partida definitiva la confirma tu agente de aduanas. Es una proyección, no una promesa de resultados.'
            : 'Figures in USD, before taxes, computed with Easycomex’s financial model from your numbers. Duties come from the code you picked in the destination’s official tariff; your customs broker confirms the final code. This is a projection, not a promise of results.'}
          </span>
        </p>

        {/* CTA */}
        <section className="my-12 rounded-3xl bg-[radial-gradient(circle_at_20%_15%,#2A2166_0%,#130B2E_60%)] px-8 py-11 text-center">
          <h2 className="text-2xl font-black text-white md:text-3xl">
            {es ? '¿Listo para poner este plan en marcha?' : 'Ready to put this plan in motion?'}
          </h2>
          <p className="mt-2.5 text-indigo-200">
            {es ? 'Revisemos juntos tu producto, tu margen y el escenario que mejor se ajusta a tu operación.' : 'Let’s review your product, your margin and the scenario that fits your operation.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3.5">
            <Link
              href="/#contacto"
              className="tap-scale btn-shine inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent/90"
            >
              <TrendingUp size={16} />
              {es ? 'Cotizar mi plan de exportación' : 'Quote my export plan'}
            </Link>
            <button
              onClick={() => openExternal(whatsappUrl())}
              className="tap-scale inline-flex cursor-pointer items-center gap-2 rounded-full border-0 bg-green-500 px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-green-600"
            >
              <MessageCircle size={16} />
              {es ? 'Hablar por WhatsApp' : 'Chat on WhatsApp'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
