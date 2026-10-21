import type { Food } from "./types";

/*
 * Open Food Facts: free, open database of packaged foods (no key
 * needed). Used for barcode lookups and for anything the built-in list
 * does not have. Values are per 100 g.
 */

const BASE = "https://world.openfoodfacts.org";
const FIELDS = "code,product_name,product_name_es,brands,nutriments,serving_quantity,serving_size";

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  serving_quantity?: number | string;
  serving_size?: string;
  nutriments?: Record<string, number | string | undefined>;
}

const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
};

function toFood(p: OffProduct): Food | null {
  const n = p.nutriments ?? {};
  const kcal = num(n["energy-kcal_100g"]) || num(n["energy_100g"]) / 4.184;
  const name = (p.product_name_es || p.product_name || "").trim();
  if (!name || !kcal) return null;
  const grams = num(p.serving_quantity) || 100;
  return {
    id: `off:${p.code}`,
    name,
    brand: p.brands?.split(",")[0]?.trim(),
    kcal: Math.round(kcal),
    protein: Math.round(num(n.proteins_100g) * 10) / 10,
    carbs: Math.round(num(n.carbohydrates_100g) * 10) / 10,
    fat: Math.round(num(n.fat_100g) * 10) / 10,
    fiber: num(n.fiber_100g) || undefined,
    serving: { label: p.serving_size || `${grams} g`, grams },
  };
}

export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<Food | null> {
  const res = await fetch(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as { status?: number; product?: OffProduct };
  return data.status === 1 && data.product ? toFood({ ...data.product, code }) : null;
}

export async function searchFoods(query: string, signal?: AbortSignal): Promise<Food[]> {
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { products?: OffProduct[] };
  return (data.products ?? []).map(toFood).filter((f): f is Food => !!f);
}
