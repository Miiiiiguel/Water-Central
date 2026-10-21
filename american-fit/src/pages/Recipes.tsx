import { ChefHat, Clock, Heart } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { Chip, PageHeader } from "@/components/ui";
import { RECIPES } from "@/data/recipes";
import { MEALS } from "@/lib/nutrition";
import { useApp } from "@/lib/store";
import type { MealId } from "@/lib/types";

export default function Recipes() {
  const favs = useApp(s => s.favorites.recipes);
  const [meal, setMeal] = useState<MealId | "fav" | null>(null);
  const list = RECIPES.filter(r => (meal === "fav" ? favs.includes(r.id) : !meal || r.meal === meal));
  return (
    <div>
      <PageHeader eyebrow="Nutrición" title="Recetas fit" back="/nutricion" />
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
        <Chip active={!meal} onClick={() => setMeal(null)}>
          Todas
        </Chip>
        <Chip active={meal === "fav"} onClick={() => setMeal("fav")}>
          <Heart className="size-3.5" /> Guardadas
        </Chip>
        {MEALS.map(m => (
          <Chip key={m.id} active={meal === m.id} onClick={() => setMeal(m.id)}>
            {m.emoji} {m.label}
          </Chip>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(r => (
          <Link key={r.id} href={`/nutricion/recetas/${r.id}`} className="card card-hover overflow-hidden">
            <div className="grain relative grid h-36 place-items-center" style={{ background: `radial-gradient(90% 90% at 30% 20%, hsl(${r.hue} 85% 55% / 0.5), hsl(${r.hue} 40% 10%))` }}>
              <ChefHat className="size-12 text-white/80" strokeWidth={1.3} />
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-0.5 text-xs font-semibold">
                <Clock className="size-3" /> {r.minutes} min
              </span>
            </div>
            <div className="p-4">
              <div className="font-semibold">{r.name}</div>
              <div className="mt-2 grid grid-cols-4 gap-1 text-center">
                {[
                  ["kcal", r.kcal],
                  ["Prot", `${r.protein}g`],
                  ["Carb", `${r.carbs}g`],
                  ["Grasa", `${r.fat}g`],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-fg/5 py-1.5">
                    <div className="tabular text-sm font-bold">{v}</div>
                    <div className="text-xs text-muted">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {r.tags.map(t => (
                  <span key={t} className="rounded-full bg-fg/6 px-2 py-0.5 text-xs text-muted">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
