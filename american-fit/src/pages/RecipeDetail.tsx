import { Check, ChefHat, Clock, Heart, Plus, Users } from "lucide-react";
import { useState } from "react";
import { useParams } from "wouter";
import { Button, PageHeader } from "@/components/ui";
import { RECIPE_BY_ID } from "@/data/recipes";
import { MEALS } from "@/lib/nutrition";
import { actions, useApp } from "@/lib/store";
import { cn, dayKey } from "@/lib/utils";
import NotFound from "./NotFound";

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const r = RECIPE_BY_ID[id];
  const fav = useApp(s => s.favorites.recipes.includes(id));
  const [added, setAdded] = useState(false);
  const [checked, setChecked] = useState<number[]>([]);
  if (!r) return <NotFound />;

  const log = () => {
    actions.addFood(dayKey(), r.meal, { name: r.name, grams: 0, kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat });
    setAdded(true);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={MEALS.find(m => m.id === r.meal)?.label} title={r.name} back="/nutricion/recetas" />
      <div className="grain relative mb-5 grid h-48 place-items-center overflow-hidden rounded-3xl border border-line" style={{ background: `radial-gradient(90% 90% at 30% 20%, hsl(${r.hue} 85% 55% / 0.55), hsl(${r.hue} 40% 10%))` }}>
        <ChefHat className="size-16 text-white/85" strokeWidth={1.2} />
        <div className="absolute bottom-3 left-3 flex gap-2 text-xs">
          <span className="flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1">
            <Clock className="size-3.5" /> {r.minutes} min
          </span>
          <span className="flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1">
            <Users className="size-3.5" /> {r.servings} {r.servings > 1 ? "porciones" : "porción"}
          </span>
        </div>
      </div>
      <div className="mb-5 grid grid-cols-4 gap-2 text-center">
        {[
          ["kcal", r.kcal, ""],
          ["Proteína", r.protein, "var(--color-protein)"],
          ["Carbos", r.carbs, "var(--color-carbs)"],
          ["Grasa", r.fat, "var(--color-fat)"],
        ].map(([l, v, c]) => (
          <div key={l as string} className="card p-3">
            <div className="tabular text-xl font-bold">
              {v as number}
              {l !== "kcal" && <span className="text-sm text-muted">g</span>}
            </div>
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted">
              {c && <span className="size-2 rounded-full" style={{ background: c as string }} />}
              {l}
            </div>
          </div>
        ))}
      </div>
      <p className="-mt-3 mb-5 text-center text-xs text-faint">Valores por porción</p>
      <div className="mb-6 flex gap-2">
        <Button className="flex-1" onClick={log} disabled={added}>
          {added ? <Check className="size-4" /> : <Plus className="size-4" />} {added ? "Añadido a hoy" : "Registrar en mi diario"}
        </Button>
        <Button variant="secondary" onClick={() => actions.toggleFavorite("recipes", r.id)} aria-label="Guardar receta">
          <Heart className={cn("size-4", fav && "text-brand")} fill={fav ? "currentColor" : "none"} />
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_1.3fr]">
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Ingredientes</h2>
          <ul className="space-y-2">
            {r.ingredients.map((ing, i) => {
              const on = checked.includes(i);
              return (
                <li key={ing}>
                  <button onClick={() => setChecked(c => (on ? c.filter(x => x !== i) : [...c, i]))} className="flex w-full gap-3 text-left text-sm">
                    <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-success bg-success text-ink-950" : "border-line-strong")}>
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className={cn(on && "text-muted line-through")}>{ing}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Preparación</h2>
          <ol className="space-y-3">
            {r.steps.map((s, i) => (
              <li key={s} className="flex gap-3 text-sm">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/8 text-xs font-bold">{i + 1}</span>
                <span className="pt-1 text-fg/85">{s}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
