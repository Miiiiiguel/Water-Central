import { ArrowLeft, Barcode, Clock, Globe, Loader2, Search, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Segmented, Sheet, Stepper } from "@/components/ui";
import { FOOD_BY_ID, FOODS } from "@/data/foods";
import { MEALS, portion } from "@/lib/nutrition";
import { lookupBarcode, searchFoods } from "@/lib/openfoodfacts";
import { actions, useApp } from "@/lib/store";
import type { Food, MealId } from "@/lib/types";
import { cn, normalize } from "@/lib/utils";
import { BarcodeScanner } from "./BarcodeScanner";

type Tab = "buscar" | "recientes" | "escanear" | "rapido";

export function AddFoodSheet({
  open,
  onClose,
  date,
  meal: initialMeal,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  meal: MealId;
}) {
  const custom = useApp(s => s.customFoods);
  const recent = useApp(s => s.recentFoods);
  const [tab, setTab] = useState<Tab>("buscar");
  const [meal, setMeal] = useState<MealId>(initialMeal);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Food | null>(null);
  const [online, setOnline] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMeal(initialMeal);
      setPicked(null);
      setQ("");
      setOnline([]);
      setScanMsg(null);
    }
  }, [open, initialMeal]);

  const local = useMemo(() => {
    const nq = normalize(q.trim());
    const all = [...custom, ...FOODS];
    if (!nq) return all.slice(0, 30);
    return all.filter(f => normalize(`${f.name} ${f.brand ?? ""} ${(f.tags ?? []).join(" ")}`).includes(nq));
  }, [q, custom]);

  const searchOnline = async () => {
    if (q.trim().length < 2) return;
    setLoading(true);
    try {
      setOnline(await searchFoods(q.trim()));
    } catch {
      setOnline([]);
    } finally {
      setLoading(false);
    }
  };

  const onCode = useCallback(async (code: string) => {
    setScanMsg("Buscando producto…");
    try {
      const f = await lookupBarcode(code);
      if (f) {
        actions.saveCustomFood(f);
        setPicked(f);
        setScanMsg(null);
      } else setScanMsg(`No encontramos el código ${code}. Prueba la búsqueda o el registro rápido.`);
    } catch {
      setScanMsg("Sin conexión. Prueba el registro rápido.");
    }
  }, []);

  const recentFoods = recent.map(id => FOOD_BY_ID[id] ?? custom.find(f => f.id === id)).filter((f): f is Food => !!f);

  return (
    <Sheet open={open} onClose={onClose} title={picked ? undefined : "Añadir alimento"} className="sm:max-w-xl">
      {picked ? (
        <Portion
          food={picked}
          meal={meal}
          setMeal={setMeal}
          onBack={() => setPicked(null)}
          onAdd={(grams, m) => {
            actions.addFood(date, m, { foodId: picked.id, name: picked.name, grams, ...portion(picked, grams) });
            onClose();
          }}
        />
      ) : (
        <div className="space-y-4 pb-2">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "buscar", label: "Buscar" },
              { value: "recientes", label: "Recientes" },
              { value: "escanear", label: "Escanear" },
              { value: "rapido", label: "Rápido" },
            ]}
          />

          {tab === "buscar" && (
            <>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  searchOnline();
                }}
                className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-ink-850 px-4"
              >
                <Search className="size-4 text-muted" />
                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Arepa, pollo, yogur…" className="flex-1 bg-transparent outline-none" />
              </form>
              <FoodList foods={local} onPick={setPicked} />
              {q.trim().length >= 2 && (
                <div>
                  <button
                    onClick={searchOnline}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong py-3 text-sm font-semibold text-muted hover:text-fg"
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
                    Buscar “{q.trim()}” en Open Food Facts
                  </button>
                  {online.length > 0 && (
                    <div className="mt-3">
                      <div className="eyebrow mb-2">Productos de Open Food Facts</div>
                      <FoodList foods={online} onPick={f => { actions.saveCustomFood(f); setPicked(f); }} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === "recientes" &&
            (recentFoods.length ? (
              <FoodList foods={recentFoods} onPick={setPicked} />
            ) : (
              <p className="flex items-center gap-2 py-8 text-sm text-muted">
                <Clock className="size-4" /> Lo que registres aparecerá aquí para añadirlo con un toque.
              </p>
            ))}

          {tab === "escanear" && (
            <div className="space-y-3">
              <BarcodeScanner onCode={onCode} />
              {scanMsg && <p className="text-center text-sm text-muted">{scanMsg}</p>}
              <p className="flex items-center justify-center gap-1.5 text-xs text-faint">
                <Barcode className="size-3.5" /> Datos de Open Food Facts, base de datos abierta.
              </p>
            </div>
          )}

          {tab === "rapido" && <QuickAdd meal={meal} setMeal={setMeal} onAdd={(m, entry) => { actions.addFood(date, m, entry); onClose(); }} />}
        </div>
      )}
    </Sheet>
  );
}

function FoodList({ foods, onPick }: { foods: Food[]; onPick: (f: Food) => void }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
      {foods.map(f => (
        <li key={f.id}>
          <button onClick={() => onPick(f)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/4">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{f.name}</div>
              <div className="truncate text-xs text-muted">
                {f.brand ? `${f.brand} · ` : ""}
                {f.serving.label} ({f.serving.grams} g)
              </div>
            </div>
            <div className="text-right">
              <div className="tabular text-sm font-semibold">{portion(f, f.serving.grams).kcal} kcal</div>
              <div className="tabular text-xs text-muted">
                P{portion(f, f.serving.grams).protein} · C{portion(f, f.serving.grams).carbs} · G{portion(f, f.serving.grams).fat}
              </div>
            </div>
          </button>
        </li>
      ))}
      {foods.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Sin resultados en la base local.</li>}
    </ul>
  );
}

function MealPicker({ meal, setMeal }: { meal: MealId; setMeal: (m: MealId) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {MEALS.map(m => (
        <button
          key={m.id}
          onClick={() => setMeal(m.id)}
          className={cn("rounded-2xl border py-2 text-xs font-semibold", meal === m.id ? "border-fg bg-fg text-ink-950" : "border-line text-muted")}
        >
          <div className="text-base">{m.emoji}</div>
          {m.label}
        </button>
      ))}
    </div>
  );
}

function Portion({
  food,
  meal,
  setMeal,
  onBack,
  onAdd,
}: {
  food: Food;
  meal: MealId;
  setMeal: (m: MealId) => void;
  onBack: () => void;
  onAdd: (grams: number, meal: MealId) => void;
}) {
  const [grams, setGrams] = useState(food.serving.grams);
  const p = portion(food, grams);
  const macroKcal = p.protein * 4 + p.carbs * 4 + p.fat * 9 || 1;
  return (
    <div className="space-y-5 pb-2 pt-3">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Volver
      </button>
      <div>
        <h3 className="text-xl font-bold">{food.name}</h3>
        {food.brand && <p className="text-sm text-muted">{food.brand}</p>}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="tabular title-display text-6xl">{p.kcal}</div>
          <div className="text-sm text-muted">kcal</div>
        </div>
        <Stepper value={grams} step={food.serving.grams >= 100 ? 10 : 5} onChange={setGrams} suffix="g" />
      </div>
      <div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-white/8">
          <div style={{ width: `${((p.protein * 4) / macroKcal) * 100}%`, background: "var(--color-protein)" }} />
          <div className="ml-0.5" style={{ width: `${((p.carbs * 4) / macroKcal) * 100}%`, background: "var(--color-carbs)" }} />
          <div className="ml-0.5" style={{ width: `${((p.fat * 9) / macroKcal) * 100}%`, background: "var(--color-fat)" }} />
        </div>
        <div className="mt-2 grid grid-cols-3 text-center text-sm">
          {[
            ["Proteína", p.protein, "var(--color-protein)"],
            ["Carbos", p.carbs, "var(--color-carbs)"],
            ["Grasa", p.fat, "var(--color-fat)"],
          ].map(([l, v, c]) => (
            <div key={l as string}>
              <div className="tabular font-bold">{v as number} g</div>
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted">
                <span className="size-2 rounded-full" style={{ background: c as string }} />
                {l}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[0.5, 1, 1.5, 2].map(k => (
          <button
            key={k}
            onClick={() => setGrams(Math.round(food.serving.grams * k))}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", grams === Math.round(food.serving.grams * k) ? "border-fg bg-fg text-ink-950" : "border-line text-muted")}
          >
            {k === 1 ? food.serving.label : `${k}× ${food.serving.label}`}
          </button>
        ))}
      </div>
      <MealPicker meal={meal} setMeal={setMeal} />
      <Button size="lg" className="w-full" onClick={() => onAdd(grams, meal)} disabled={grams <= 0}>
        Añadir a {MEALS.find(m => m.id === meal)?.label.toLowerCase()}
      </Button>
    </div>
  );
}

function QuickAdd({
  meal,
  setMeal,
  onAdd,
}: {
  meal: MealId;
  setMeal: (m: MealId) => void;
  onAdd: (m: MealId, entry: { name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number }) => void;
}) {
  const [name, setName] = useState("");
  const [v, setV] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const fromMacros = Math.round(v.protein * 4 + v.carbs * 4 + v.fat * 9);
  return (
    <div className="space-y-3">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre (ej. Almuerzo en restaurante)" className="h-12 w-full rounded-2xl border border-line bg-ink-850 px-4 outline-none" />
      <div className="grid grid-cols-2 gap-2">
        {(["kcal", "protein", "carbs", "fat"] as const).map(k => (
          <label key={k} className="rounded-2xl border border-line bg-ink-850 px-4 py-2">
            <span className="text-xs uppercase text-muted">{{ kcal: "Calorías", protein: "Proteína (g)", carbs: "Carbos (g)", fat: "Grasa (g)" }[k]}</span>
            <input
              inputMode="decimal"
              value={v[k] || ""}
              placeholder={k === "kcal" && fromMacros ? String(fromMacros) : "0"}
              onChange={e => setV(x => ({ ...x, [k]: Number(e.target.value.replace(",", ".")) || 0 }))}
              className="tabular block w-full bg-transparent text-lg font-semibold outline-none"
            />
          </label>
        ))}
      </div>
      <MealPicker meal={meal} setMeal={setMeal} />
      <Button
        size="lg"
        className="w-full"
        disabled={!(v.kcal || fromMacros)}
        onClick={() => onAdd(meal, { name: name.trim() || "Registro rápido", grams: 0, ...v, kcal: v.kcal || fromMacros })}
      >
        <Zap className="size-4" /> Añadir
      </Button>
    </div>
  );
}
