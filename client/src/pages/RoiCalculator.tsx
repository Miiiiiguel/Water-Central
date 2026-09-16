import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, MessageCircle, Phone, Sparkles, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase, type Payment } from '@/lib/supabase';
import { whatsappUrl } from '@/lib/contact';
import { openExternal } from '@/lib/native';
import {
  DEFAULT_INPUTS, findMonth, project, type RoiInputs, type Scenario, type YearOne, type YearTwo,
} from '@/lib/roiModel';
import { MONTH_LABELS, MONTH_LABELS_EN, fmtInt, fmtMoney, pctOf, setRoiLocale, xOf } from '@/lib/roiFormat';
import RoiTable, { type RoiRow } from '@/components/roi/RoiTable';
import RoiPaywall from '@/components/roi/RoiPaywall';
import CashChart from '@/components/roi/CashChart';

// The ROI calculator: the client types their own numbers and sees the
// same month-by-month model the team uses in a real engagement.
//
// The arithmetic lives in lib/roiModel.ts (pure, unit-tested). This file
// is only inputs, layout and the two paid reports.

const REPORTS = {
  detalle: { plan: 'reporte_detalle', priceCents: 3990, oldPriceCents: 6990 },
  pronostico: { plan: 'reporte_pronostico', priceCents: 9990, oldPriceCents: 12090 },
};

function NumberField({
  id, label, value, onChange, prefix, suffix, step = 1, min = 0,
}: {
  id: string; label: string; value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; step?: number; min?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-muted-foreground">{label}</label>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">{prefix}</span>}
        <input
          id={id}
          name={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          step={step}
          min={min}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            onChange(Number.isFinite(parsed) ? Math.max(min, parsed) : min);
          }}
          className={`w-full rounded-xl border-[1.5px] border-gray-200 bg-secondary/60 py-2.5 font-bold text-primary outline-none transition-colors focus:border-accent focus:bg-white ${
            prefix ? 'pl-7' : 'pl-3'
          } ${suffix ? 'pr-9' : 'pr-3'}`}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">{children}</div>
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
  const { user } = useAuth();
  const es = language === 'es';
  const months = es ? MONTH_LABELS : MONTH_LABELS_EN;
  // Thousands separators differ between the two languages; set it before
  // anything below formats a figure.
  setRoiLocale(language);

  const [inputs, setInputs] = useState<RoiInputs>(DEFAULT_INPUTS);
  const [heroScenario, setHeroScenario] = useState<Scenario>('conservador');
  const [detailScenario, setDetailScenario] = useState<Scenario>('conservador');
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());

  // What this account has already paid for. Written only by the Stripe
  // webhook, read here through RLS as the user themselves.
  useEffect(() => {
    if (!user) return;
    void getSupabase().then((sb) =>
      sb
        .from('payments')
        .select('plan,status')
        .eq('user_id', user.id)
        .eq('status', 'paid')
        .then(({ data }) => setUnlocked(new Set(((data as Payment[]) ?? []).map((p) => p.plan)))));
  }, [user]);

  const set = <K extends keyof RoiInputs>(key: K, value: RoiInputs[K]) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const p = useMemo(() => project(inputs), [inputs]);
  const hero: YearOne = heroScenario === 'optimista' ? p.opt1 : p.cons1;
  const detail1: YearOne = detailScenario === 'optimista' ? p.opt1 : p.cons1;
  const detail2: YearTwo = detailScenario === 'optimista' ? p.opt2 : p.cons2;

  const breakevenMonth = findMonth(hero.saldo, 0);
  const paybackMonth = findMonth(hero.saldo, p.investment.total);
  const consBreak = findMonth(p.cons1.saldo, 0);
  const optBreak = findMonth(p.opt1.saldo, 0);

  const scenarioLabels = {
    conservador: es ? 'Conservador' : 'Conservative',
    optimista: es ? 'Optimista' : 'Optimistic',
  };

  const freeRows = (d: YearOne): RoiRow[] => [
    { label: es ? 'Unidades vendidas' : 'Units sold', values: d.units, fmt: 'int' },
    { label: es ? 'Costo total por unidad vendida' : 'Total cost per unit sold', values: d.costUnit, fmt: 'currency2' },
    { label: es ? 'Utilidad o pérdida antes de impuestos por unidad' : 'Pre-tax profit or loss per unit', values: d.profitUnit, fmt: 'currency2', colorize: true },
    { label: es ? 'Utilidad o pérdida del mes' : 'Profit or loss for the month', values: d.profitMonth, fmt: 'currency1', colorize: true },
    { label: es ? 'Retorno por unidad antes de impuestos' : 'Pre-tax return per unit', values: d.roiUnit, fmt: 'pct', colorize: true },
  ];

  const breakdownRows = (d: YearOne): RoiRow[] => {
    const pick = (key: keyof (typeof d.breakdown)[number]) => d.breakdown.map((bd) => bd[key] as number);
    return [
      { label: es ? 'Precio de venta en USA' : 'US selling price', values: pick('price'), fmt: 'currency2' },
      { label: es ? 'Costo del producto en Latinoamérica' : 'Production cost in Latin America', values: pick('product'), fmt: 'currency2' },
      { label: es ? 'Arancel recíproco' : 'Reciprocal tariff', values: pick('reciprocalTariff'), fmt: 'currency2' },
      { label: es ? 'Flete internacional por unidad' : 'International freight per unit', values: pick('freight'), fmt: 'currency2' },
      { label: es ? 'Flete doméstico USA' : 'US domestic shipping', values: pick('domesticShip'), fmt: 'currency2' },
      { label: es ? 'Arancel de acuerdo comercial' : 'Trade-agreement tariff', values: pick('tradeTariff'), fmt: 'currency2' },
      { label: es ? 'Devoluciones' : 'Returns', values: pick('returns'), fmt: 'currency2' },
      { label: es ? 'Comisión plataformas' : 'Marketplace commission', values: pick('platform'), fmt: 'currency2' },
      { label: es ? 'Administración de inventario y alistamiento' : 'Inventory handling and prep', values: pick('warehousing'), fmt: 'currency2' },
      { label: es ? 'Administración de canal por unidad' : 'Channel management per unit', values: pick('channel'), fmt: 'currency2' },
      { label: es ? 'Publicidad (ADS) por unidad' : 'Advertising per unit', values: pick('ads'), fmt: 'currency2' },
      { label: es ? 'Generación de contenido propio' : 'Own content production', values: pick('content'), fmt: 'currency2' },
      { label: es ? 'Comisión red comercial por unidad' : 'Sales-network commission per unit', values: pick('ugc'), fmt: 'currency2' },
      { label: es ? 'Costo total por unidad vendida' : 'Total cost per unit sold', values: d.costUnit, fmt: 'currency2', bold: true },
    ];
  };

  const forecastRows = (d: YearOne | YearTwo): RoiRow[] => [
    { label: es ? 'Total ventas canal digital' : 'Total digital-channel sales', values: d.revenueArr, fmt: 'currency' },
    { label: es ? 'Unidades vendidas' : 'Units sold', values: d.units, fmt: 'int' },
    { label: es ? 'Ticket promedio' : 'Average ticket', values: d.ticket, fmt: 'currency2' },
    { label: es ? 'Costo de producto' : 'Product cost', values: d.cogsArr, fmt: 'currency' },
    { label: es ? 'Incremento en ADS' : 'Additional ad spend', values: d.adsIncrArr, fmt: 'currency' },
    { label: es ? 'Imprevistos' : 'Contingency', values: d.imprevArr, fmt: 'currency' },
    { label: es ? 'Total egresos' : 'Total outflows', values: d.egresosArr, fmt: 'currency', bold: true },
    { label: es ? 'Utilidad / pérdida' : 'Profit / loss', values: d.profitMonth, fmt: 'currency', colorize: true, bold: true },
    { label: es ? 'Saldo acumulado' : 'Cumulative balance', values: d.saldo, fmt: 'currency', colorize: true, bold: true },
  ];

  const invPct = (part: number) => (p.investment.total > 0 ? (part / p.investment.total) * 100 : 0);

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

        {/* Inputs */}
        <section className="my-8 rounded-3xl border border-gray-100 bg-white p-6 app-shadow md:p-8">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-primary">{es ? 'Tus números' : 'Your numbers'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {es ? 'Cambia cualquier campo — los resultados de abajo se actualizan solos.' : 'Change any field — the results below update on their own.'}
              </p>
            </div>
            <span className="inline-flex flex-none items-center gap-2 rounded-full bg-green-50 px-3.5 py-1.5 text-xs font-bold text-green-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              {es ? 'Cálculo en vivo' : 'Live calculation'}
            </span>
          </div>

          <FieldGroup title={es ? 'Producto' : 'Product'}>
            <NumberField id="in_price" label={es ? 'Precio de venta en USA' : 'US selling price'} value={inputs.price} onChange={(v) => set('price', v)} prefix="$" step={0.1} />
            <NumberField id="in_cost" label={es ? 'Costo de producción (Latinoamérica)' : 'Production cost (Latin America)'} value={inputs.cost} onChange={(v) => set('cost', v)} prefix="$" step={0.1} />
            <NumberField id="in_weight" label={es ? 'Peso empacado por producto' : 'Packed weight per product'} value={inputs.weightG} onChange={(v) => set('weightG', v)} suffix="g" step={10} min={1} />
            <NumberField id="in_lot" label={es ? 'Inventario inicial (unidades)' : 'Initial inventory (units)'} value={inputs.lot} onChange={(v) => set('lot', v)} step={50} min={1} />
          </FieldGroup>

          <FieldGroup title={es ? 'Operación y aranceles' : 'Operations and tariffs'}>
            <NumberField id="in_returns" label={es ? 'Devoluciones' : 'Returns'} value={inputs.returnsPct * 100} onChange={(v) => set('returnsPct', v / 100)} suffix="%" step={0.5} />
            <NumberField id="in_ugc" label={es ? 'Comisión red comercial' : 'Sales-network commission'} value={inputs.ugcPct * 100} onChange={(v) => set('ugcPct', v / 100)} suffix="%" step={1} />
            <div>
              <p className="mb-1.5 text-sm font-semibold text-muted-foreground">
                {es ? '¿Tu producto cumple acuerdo comercial?' : 'Does your product qualify under a trade agreement?'}
              </p>
              <div className="flex gap-2">
                {[
                  { value: false, label: 'No' },
                  { value: true, label: es ? 'Sí' : 'Yes' },
                ].map((opt) => {
                  const active = inputs.meetsAgreement === opt.value;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set('meetsAgreement', opt.value)}
                      className={`tap-scale-sm flex-1 cursor-pointer rounded-xl border-[1.5px] px-3 py-2.5 text-sm font-bold transition-colors ${
                        active ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-secondary/60 text-muted-foreground hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </FieldGroup>

          <FieldGroup title={es ? 'Marketing y operación (presupuesto mensual)' : 'Marketing and operations (monthly budget)'}>
            <NumberField id="in_ads" label={es ? 'Publicidad (ADS)' : 'Advertising (ads)'} value={inputs.adsBudget} onChange={(v) => set('adsBudget', v)} prefix="$" step={50} />
            <NumberField id="in_content" label={es ? 'Generación de contenido' : 'Content production'} value={inputs.contentBudget} onChange={(v) => set('contentBudget', v)} prefix="$" step={50} />
            <NumberField id="in_channel" label={es ? 'Administración de canal' : 'Channel management'} value={inputs.channelBudget} onChange={(v) => set('channelBudget', v)} prefix="$" step={50} />
          </FieldGroup>

          <p className="mt-5 rounded-xl border border-gray-100 bg-secondary/60 p-4 text-sm leading-relaxed text-muted-foreground">
            <b className="text-foreground">{es ? 'Supuestos fijos de Easycomex' : 'Easycomex fixed assumptions'}</b>{' '}
            {es
              ? '(no editables aquí): flete internacional · arancel recíproco (siempre aplica) · envío doméstico por pedido si el precio supera el mínimo. Ajustables internamente en el modelo financiero completo.'
              : '(not editable here): international freight · reciprocal tariff (always applies) · domestic shipping per order when the price is above the threshold. Adjustable internally in the full financial model.'}
          </p>
        </section>

        {/* Headline stats */}
        <section className="my-9 rounded-3xl bg-gradient-to-br from-[#130B2E] via-primary to-[#1F2E73] p-8 md:p-10">
          <div className="grid grid-cols-1 gap-7 md:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-indigo-200">
                {es ? 'RETORNO SOBRE LA INVERSIÓN · AÑO 1' : 'RETURN ON INVESTMENT · YEAR 1'}
              </p>
              <p className="text-4xl font-black text-white md:text-5xl">
                {(p.investment.total > 0 ? hero.utilidad / p.investment.total : 0).toFixed(1)}
                <span className="text-accent">x</span>
              </p>
              <p className="mt-1.5 text-sm text-indigo-300">
                {es ? 'Sobre inversión inicial de ' : 'On an initial investment of '}{fmtMoney(p.investment.total)}
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-indigo-200">
                {es ? 'UTILIDAD NETA · AÑO 1' : 'NET PROFIT · YEAR 1'}
              </p>
              <p className="text-4xl font-black text-white md:text-5xl">{fmtMoney(hero.utilidad)}</p>
              <p className="mt-1.5 text-sm text-indigo-300">
                {es ? 'Margen ' : 'Margin '}{pctOf(hero.utilidad, hero.revenue)}
                {es ? ' sobre ' : ' on '}{fmtMoney(hero.revenue)}{es ? ' en ventas' : ' in sales'}
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-indigo-200">
                {es ? 'RECUPERACIÓN DE LA INVERSIÓN' : 'PAYBACK'}
              </p>
              <p className="text-4xl font-black text-white md:text-5xl">
                {paybackMonth ? `${es ? 'Mes' : 'Month'} ${paybackMonth}` : es ? '12+ meses' : '12+ months'}
              </p>
              <p className="mt-1.5 text-sm text-indigo-300">
                {es ? 'Caja acumulada positiva desde ' : 'Cash balance turns positive from '}
                {breakevenMonth ? `${es ? 'el mes' : 'month'} ${breakevenMonth}` : es ? 'no en 12 meses' : 'not within 12 months'}
              </p>
            </div>
          </div>
          <div className="mt-7 flex justify-center">
            <ScenarioToggle value={heroScenario} onChange={setHeroScenario} labels={scenarioLabels} dark />
          </div>
        </section>

        {/* Scenario comparison */}
        <section className="my-12">
          <SectionHead
            kicker={es ? 'Comparativo' : 'Comparison'}
            title={es ? 'Conservador vs. optimista, con tus propios números' : 'Conservative vs. optimistic, with your own numbers'}
            body={es
              ? 'Misma estructura de costos que escribiste arriba — la diferencia entre columnas es solo el ritmo de crecimiento en ventas: de 100 a 1,200 unidades/mes en el conservador, hasta 3,000 unidades/mes en el optimista.'
              : 'The same cost structure you typed above — the only difference between columns is the sales ramp: 100 to 1,200 units/month in the conservative case, up to 3,000 units/month in the optimistic one.'}
          />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {[
              { key: 'cons' as const, y1: p.cons1, y2: p.cons2, accent: 'bg-accent', pill: 'bg-orange-50 text-accent', range: '100 → 1,200 u./mes', name: scenarioLabels.conservador, sub: es ? 'Crecimiento lineal y sostenido durante el año 1' : 'Linear, sustained growth through year 1' },
              { key: 'opt' as const, y1: p.opt1, y2: p.opt2, accent: 'bg-[#4A63D6]', pill: 'bg-indigo-50 text-[#1F2E73]', range: '100 → 3,000 u./mes', name: scenarioLabels.optimista, sub: es ? 'Picos de campaña (Black Friday, temporada alta) en el segundo semestre' : 'Campaign peaks (Black Friday, high season) in the second half' },
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
                    {xOf(card.y1.utilidad + card.y2.utilidad, p.investment.total)}
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
              ? 'Unidades, costo total, utilidad antes de impuestos y retorno por unidad — los 12 meses del Año 1, calculados con tus números de arriba.'
              : 'Units, total cost, pre-tax profit and return per unit — all 12 months of year 1, from the numbers you typed above.'}
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
            unlocked={unlocked.has(REPORTS.detalle.plan)}
            title={es ? 'Desglose de costos mes a mes' : 'Month-by-month cost breakdown'}
            blurb={es
              ? `Cada componente del costo, mes a mes, para tu escenario ${scenarioLabels[detailScenario].toLowerCase()} — con estos mismos números que ya escribiste arriba.`
              : `Every cost component, month by month, for your ${scenarioLabels[detailScenario].toLowerCase()} scenario — using the very numbers you typed above.`}
            priceCents={REPORTS.detalle.priceCents}
            oldPriceCents={REPORTS.detalle.oldPriceCents}
          >
            <RoiTable months={months} rows={breakdownRows(detail1)} />
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
            unlocked={unlocked.has(REPORTS.pronostico.plan)}
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
              <RoiTable months={months} rows={forecastRows(detail1)} />
              <p className="px-4 pb-1 pt-5 text-sm font-bold text-primary">
                {es ? `Año 2 — ${scenarioLabels[detailScenario]}` : `Year 2 — ${scenarioLabels[detailScenario]}`}
              </p>
              <RoiTable months={months} rows={forecastRows(detail2)} />
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

        {/* Cash-flow chart */}
        <section className="my-12">
          <SectionHead
            kicker={es ? 'Flujo de caja' : 'Cash flow'}
            title={es ? 'Saldo acumulado — primeros 12 meses' : 'Cumulative balance — first 12 months'}
            body={es
              ? `El conservador ${consBreak ? `encuentra equilibrio en el mes ${consBreak}` : 'no llega a equilibrio en 12 meses'}; el optimista ${optBreak ? `lo alcanza en el mes ${optBreak}` : 'no llega a equilibrio en 12 meses'}.`
              : `The conservative case ${consBreak ? `breaks even in month ${consBreak}` : 'does not break even within 12 months'}; the optimistic one ${optBreak ? `gets there in month ${optBreak}` : 'does not break even within 12 months'}.`}
          />
          <CashChart
            conservative={p.cons1.saldo}
            optimistic={p.opt1.saldo}
            labels={{
              conservative: scenarioLabels.conservador,
              optimistic: scenarioLabels.optimista,
              month: (n) => (es ? `Mes ${n}` : `Month ${n}`),
              title: es
                ? 'Saldo de caja acumulado durante los 12 meses del año 1, comparando escenario conservador y optimista'
                : 'Cumulative cash balance across the 12 months of year 1, comparing the conservative and optimistic scenarios',
            }}
          />
          <p className="mt-2.5 text-sm text-muted-foreground">
            {es
              ? 'Saldo de caja acumulado (utilidad mensual menos egresos), sin financiamiento externo.'
              : 'Cumulative cash balance (monthly profit less outflows), with no external financing.'}
          </p>
        </section>

        {/* Investment */}
        <section className="my-12">
          <SectionHead
            kicker={es ? 'Capital de arranque' : 'Start-up capital'}
            title={es ? 'Inversión inicial recomendada' : 'Recommended initial investment'}
            body={es
              ? 'Cubre tu inventario inicial, la logística de salida y tres meses de operación y marketing del canal digital — se recalcula con los mismos números que escribiste arriba.'
              : 'Covers your initial inventory, outbound logistics and three months of digital-channel operations and marketing — recalculated from the numbers you typed above.'}
          />
          <div className="grid grid-cols-1 items-center gap-8 rounded-3xl border border-gray-100 bg-white p-7 app-shadow lg:grid-cols-[1fr_1.15fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {es ? 'Total recomendado' : 'Recommended total'}
              </p>
              <p className="mt-1.5 font-heading text-4xl font-black text-primary md:text-5xl">{fmtMoney(p.investment.total)}</p>
              <p className="mt-2.5 text-sm text-muted-foreground">
                {fmtInt(inputs.lot)} {es ? 'unidades iniciales + logística de salida + 3 meses de marketing y operación del canal digital.' : 'initial units + outbound logistics + 3 months of digital-channel marketing and operations.'}
              </p>
            </div>
            <div>
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-secondary">
                <span className="h-full bg-accent transition-all duration-200" style={{ width: `${invPct(p.investment.productCost)}%` }} />
                <span className="h-full bg-[#4A63D6] transition-all duration-200" style={{ width: `${invPct(p.investment.logistics)}%` }} />
                <span className="h-full bg-primary transition-all duration-200" style={{ width: `${invPct(p.investment.marketing3)}%` }} />
              </div>
              <div className="mt-4 flex flex-col gap-2.5">
                {[
                  { color: 'bg-accent', label: es ? 'Inventario inicial' : 'Initial inventory', value: p.investment.productCost },
                  { color: 'bg-[#4A63D6]', label: es ? 'Logística de salida' : 'Outbound logistics', value: p.investment.logistics },
                  { color: 'bg-primary', label: es ? 'Marketing y operación (3 meses)' : 'Marketing and operations (3 months)', value: p.investment.marketing3 },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-2.5 text-sm">
                    <span className={`h-2.5 w-2.5 flex-none rounded ${row.color}`} />
                    <span className="text-muted-foreground">{row.label}</span>
                    <b className="ml-auto tabular-nums text-foreground">{fmtMoney(row.value)}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Method note */}
        <p className="rounded-2xl border border-gray-100 bg-secondary/60 p-5 text-sm leading-relaxed text-muted-foreground">
          <strong className="text-foreground">{es ? 'Nota metodológica.' : 'Method note.'}</strong>{' '}
          {es
            ? 'Cifras en USD, antes de impuestos. El arancel recíproco siempre aplica sobre el costo de producción; el arancel de acuerdo comercial es opcional y solo se suma si lo activas arriba. El Año 2 asume un incremento de precio y de costo frente al Año 1 (madurado desde el mes 7), más una inversión adicional en ADS sobre ventas. El incremento de ADS en el Año 1 (desde el mes 4) y los imprevistos mensuales usan los mismos supuestos del modelo financiero completo. Es una proyección, no una promesa de resultados.'
            : 'Figures in USD, before taxes. The reciprocal tariff always applies to the production cost; the trade-agreement tariff is optional and only added when you switch it on above. Year 2 assumes a price and cost increase over year 1 (matured from month 7), plus additional ad spend as a share of sales. The year-1 ad increment (from month 4) and the monthly contingency use the same assumptions as the full financial model. This is a projection, not a promise of results.'}
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
