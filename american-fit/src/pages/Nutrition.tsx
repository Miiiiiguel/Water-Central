import { BookOpen, BrainCircuit, ChefHat, ChevronLeft, ChevronRight, Droplets, GlassWater, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { MacroRings } from "@/components/charts";
import { AddFoodSheet } from "@/components/nutrition/AddFoodSheet";
import { Badge, Bar, PageHeader, SectionHeader } from "@/components/ui";
import { ARTICLES } from "@/data/articles";
import { RECIPES } from "@/data/recipes";
import { adaptiveTdee, dayTotals, MEALS, sumEntries, targetsFor, tdee } from "@/lib/nutrition";
import { actions, useApp } from "@/lib/store";
import type { MealId } from "@/lib/types";
import { addDays, cn, dayKey, fmtLongDate, fromDayKey } from "@/lib/utils";

export default function Nutrition() {
  const profile = useApp(s => s.profile)!;
  const nutrition = useApp(s => s.nutrition);
  const weights = useApp(s => s.weights);
  const [date, setDate] = useState(dayKey());
  const [adding, setAdding] = useState<MealId | null>(null);

  const day = nutrition[date];
  const totals = dayTotals(day);
  const targets = targetsFor(profile);
  const water = day?.waterMl ?? 0;
  const remaining = targets.kcal - totals.kcal;
  const isToday = date === dayKey();

  const adaptive = useMemo(() => {
    const intake = Array.from({ length: 14 }, (_, i) => dayTotals(nutrition[dayKey(addDays(new Date(), -i - 1))]).kcal);
    return adaptiveTdee(intake, weights);
  }, [nutrition, weights]);
  const formula = tdee(profile);

  const shift = (n: number) => {
    const next = dayKey(addDays(fromDayKey(date), n));
    if (next <= dayKey()) setDate(next);
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Diario de alimentación" title="Nutrición" />

      <div className="flex items-center justify-between rounded-2xl border border-line bg-ink-900 p-1.5">
        <button onClick={() => shift(-1)} className="grid size-10 place-items-center rounded-xl hover:bg-white/6" aria-label="Día anterior">
          <ChevronLeft className="size-5" />
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold">{isToday ? "Hoy" : fmtLongDate(fromDayKey(date))}</div>
          {isToday && <div className="text-[11px] text-muted">{fmtLongDate(fromDayKey(date))}</div>}
        </div>
        <button onClick={() => shift(1)} disabled={isToday} className="grid size-10 place-items-center rounded-xl hover:bg-white/6 disabled:opacity-30" aria-label="Día siguiente">
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="card p-5">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <div className="eyebrow">{remaining >= 0 ? "Te quedan" : "Te pasaste"}</div>
              <div className={cn("tabular title-display text-6xl", remaining < 0 && "text-warn")}>{Math.abs(remaining).toLocaleString("es")}</div>
              <div className="text-sm text-muted">kcal de {targets.kcal.toLocaleString("es")}</div>
            </div>
            <div className="text-right text-sm">
              <div className="tabular font-semibold">{totals.kcal.toLocaleString("es")}</div>
              <div className="text-xs text-muted">consumidas</div>
            </div>
          </div>
          <Bar value={totals.kcal / targets.kcal} color={remaining < 0 ? "var(--color-warn)" : "var(--color-brand)"} className="mb-6 h-2" />
          <MacroRings
            items={[
              { label: "Proteína", value: totals.protein, target: targets.protein, color: "var(--color-protein)" },
              { label: "Carbohidratos", value: totals.carbs, target: targets.carbs, color: "var(--color-carbs)" },
              { label: "Grasa", value: totals.fat, target: targets.fat, color: "var(--color-fat)" },
            ]}
            center={
              <div>
                <div className="tabular text-lg font-bold">{Math.round((totals.protein / targets.protein) * 100) || 0}%</div>
                <div className="text-[10px] text-muted">proteína</div>
              </div>
            }
          />
        </section>

        <div className="space-y-4">
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold">
                <Droplets className="size-5 text-sky" /> Agua
              </h2>
              <span className="tabular text-sm text-muted">
                {(water / 1000).toLocaleString("es", { maximumFractionDigits: 2 })} / {(targets.waterMl / 1000).toLocaleString("es")} L
              </span>
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {Array.from({ length: Math.ceil(targets.waterMl / 250) }, (_, i) => {
                const filled = water >= (i + 1) * 250;
                return (
                  <button
                    key={i}
                    onClick={() => actions.addWater(date, filled ? -250 : (i + 1) * 250 - water)}
                    className={cn("grid h-11 place-items-center rounded-xl transition", filled ? "bg-sky/20 text-sky" : "bg-white/5 text-faint hover:text-muted")}
                    aria-label={`${(i + 1) * 250} ml`}
                  >
                    <GlassWater className="size-5" />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-1 flex items-center gap-2 font-bold">
              <BrainCircuit className="size-5 text-violet" /> Coach adaptativo
            </h2>
            {adaptive ? (
              <>
                <p className="text-sm text-muted">
                  Según tu ingesta y la tendencia de tu peso en las últimas 2 semanas, tu mantenimiento real es de{" "}
                  <span className="font-semibold text-fg">{adaptive.toLocaleString("es")} kcal</span> (la fórmula estimaba {formula.toLocaleString("es")}).
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Badge tone={Math.abs(adaptive - formula) < 150 ? "success" : "warn"}>
                    {Math.abs(adaptive - formula) < 150 ? "Objetivo bien calibrado" : adaptive > formula ? "Puedes comer un poco más" : "Ajusta un poco a la baja"}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">
                Registra comidas y peso durante 2 semanas y calcularemos tu gasto real a partir de tus datos, no de una fórmula. Hoy usamos {formula.toLocaleString("es")} kcal de mantenimiento.
              </p>
            )}
          </section>
        </div>
      </div>

      <section className="space-y-3">
        {MEALS.map(m => {
          const entries = day?.meals[m.id] ?? [];
          const t = sumEntries(entries);
          return (
            <div key={m.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <span className="text-xl" aria-hidden>
                  {m.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{m.label}</div>
                  <div className="tabular text-xs text-muted">
                    {entries.length ? `${t.kcal} kcal · P ${Math.round(t.protein)} · C ${Math.round(t.carbs)} · G ${Math.round(t.fat)}` : "Sin registros"}
                  </div>
                </div>
                <button onClick={() => setAdding(m.id)} className="grid size-10 place-items-center rounded-full bg-gradient-brand text-white" aria-label={`Añadir a ${m.label}`}>
                  <Plus className="size-5" />
                </button>
              </div>
              {entries.length > 0 && (
                <ul className="divide-y divide-line border-t border-line">
                  {entries.map(e => (
                    <li key={e.id} className="group flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{e.name}</div>
                        <div className="tabular text-xs text-faint">
                          {e.grams ? `${e.grams} g · ` : ""}P {e.protein} · C {e.carbs} · G {e.fat}
                        </div>
                      </div>
                      <span className="tabular text-sm font-semibold">{e.kcal}</span>
                      <button onClick={() => actions.removeFood(date, m.id, e.id)} className="grid size-8 place-items-center rounded-full text-faint hover:bg-white/6 hover:text-brand" aria-label="Eliminar">
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <section>
        <SectionHeader title="Recetas fit" subtitle="Con macros calculados" href="/nutricion/recetas" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {RECIPES.slice(0, 4).map(r => (
            <Link key={r.id} href={`/nutricion/recetas/${r.id}`} className="card card-hover overflow-hidden">
              <div className="relative grid h-24 place-items-center" style={{ background: `radial-gradient(90% 90% at 30% 20%, hsl(${r.hue} 85% 55% / 0.45), hsl(${r.hue} 40% 12%))` }}>
                <ChefHat className="size-9 text-white/80" strokeWidth={1.5} />
              </div>
              <div className="p-3">
                <div className="line-clamp-2 text-sm font-semibold">{r.name}</div>
                <div className="tabular mt-1 text-xs text-muted">
                  {r.kcal} kcal · {r.protein} g prot
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Guías de nutrición" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ARTICLES.map(a => (
            <Link key={a.id} href={`/nutricion/guias/${a.id}`} className="card card-hover flex gap-3 p-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: `hsl(${a.hue} 70% 50% / 0.16)` }}>
                <BookOpen className="size-5" style={{ color: `hsl(${a.hue} 90% 66%)` }} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{a.title}</div>
                <div className="mt-0.5 text-xs text-muted">{a.minutes} min · {a.category}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <AddFoodSheet open={adding !== null} onClose={() => setAdding(null)} date={date} meal={adding ?? "desayuno"} />
    </div>
  );
}
