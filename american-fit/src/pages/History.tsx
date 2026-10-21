import { ChevronRight, CreditCard, Dumbbell, LogIn, PlayCircle, Scale, Trophy, Utensils } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Chip, Empty, PageHeader } from "@/components/ui";
import { dayTotals } from "@/lib/nutrition";
import { PRODUCT_BY_ID } from "@/data/shop";
import { formatMoney, PLAN_NAME } from "@/lib/payments";
import { useApp } from "@/lib/store";
import { cn, fmtDuration, fmtLongDate, fmtTime, fromDayKey } from "@/lib/utils";

type Kind = "entreno" | "clase" | "nutricion" | "peso" | "pago" | "acceso";

interface Event {
  at: number;
  kind: Kind;
  title: string;
  detail: string;
  href?: string;
  badge?: { text: string; tone: "warn" | "success" | "brand" };
}

const META: Record<Kind, { label: string; icon: ReactNode; color: string }> = {
  entreno: { label: "Entrenos", icon: <Dumbbell className="size-5" />, color: "bg-brand/20 text-brand-300" },
  clase: { label: "Clases", icon: <PlayCircle className="size-5" />, color: "bg-violet/25 text-[#b9a8ff]" },
  nutricion: { label: "Nutrición", icon: <Utensils className="size-5" />, color: "bg-success/18 text-success" },
  peso: { label: "Peso", icon: <Scale className="size-5" />, color: "bg-sky/22 text-sky-300" },
  pago: { label: "Pagos", icon: <CreditCard className="size-5" />, color: "bg-warn/20 text-warn" },
  acceso: { label: "Accesos", icon: <LogIn className="size-5" />, color: "bg-fg/12 text-fg" },
};

const LOGIN_LABEL = { password: "Inicio de sesión", google: "Inicio de sesión con Google", signup: "Cuenta creada" };

export default function History() {
  const workouts = useApp(s => s.workouts);
  const nutrition = useApp(s => s.nutrition);
  const weights = useApp(s => s.weights);
  const payments = useApp(s => s.payments);
  const logins = useApp(s => s.logins);
  const [filter, setFilter] = useState<Kind | "todo">("todo");
  const [limit, setLimit] = useState(40);

  const events = useMemo(() => {
    const list: Event[] = [];
    for (const w of workouts) {
      const isClass = w.exercises.length === 0;
      list.push({
        at: w.startedAt,
        kind: isClass ? "clase" : "entreno",
        title: w.name,
        detail: isClass
          ? `${Math.round(w.durationSec / 60)} min de clase`
          : `${fmtDuration(w.durationSec)} · ${w.exercises.reduce((a, e) => a + e.sets.length, 0)} series · ${Math.round(w.volume).toLocaleString("es")} kg`,
        href: isClass ? undefined : `/entrenar/resumen/${w.id}`,
        badge: w.prs.length ? { text: `${w.prs.length} récord${w.prs.length > 1 ? "s" : ""}`, tone: "warn" } : undefined,
      });
    }
    for (const [date, day] of Object.entries(nutrition)) {
      const t = dayTotals(day);
      const meals = Object.values(day.meals).filter(m => m.length).length;
      if (!t.kcal && !day.waterMl) continue;
      const at = fromDayKey(date).getTime() + 21 * 3_600_000;
      list.push({
        at,
        kind: "nutricion",
        title: `${t.kcal.toLocaleString("es")} kcal registradas`,
        detail: `${meals} comida${meals === 1 ? "" : "s"} · P ${Math.round(t.protein)} g · C ${Math.round(t.carbs)} g · G ${Math.round(t.fat)} g · agua ${(day.waterMl / 1000).toLocaleString("es")} L`,
        href: "/nutricion",
      });
    }
    weights.forEach((w, i) => {
      const prev = weights[i - 1];
      const diff = prev ? Math.round((w.kg - prev.kg) * 10) / 10 : 0;
      list.push({
        at: fromDayKey(w.date).getTime() + 7 * 3_600_000,
        kind: "peso",
        title: `${w.kg.toLocaleString("es")} kg`,
        detail: prev ? `${diff > 0 ? "+" : ""}${diff.toLocaleString("es")} kg desde el registro anterior` : "Primer registro",
        href: "/progreso",
      });
    });
    for (const p of payments) {
      list.push({
        at: p.at,
        kind: "pago",
        title: p.productId ? PRODUCT_BY_ID[p.productId]?.name ?? "Compra" : `Plan ${PLAN_NAME[p.plan]} ${p.period === "monthly" ? "mensual" : "anual"}`,
        detail: `${formatMoney(p.amount, p.currency)} · ${p.provider === "demo" ? "pago simulado" : p.provider === "wompi" ? "Wompi" : "Stripe"} · ref. ${p.reference.slice(0, 14)}`,
        badge:
          p.status === "approved"
            ? { text: "Aprobado", tone: "success" }
            : p.status === "pending"
              ? { text: "Pendiente", tone: "warn" }
              : { text: "Rechazado", tone: "brand" },
      });
    }
    for (const l of logins) {
      list.push({ at: l.at, kind: "acceso", title: LOGIN_LABEL[l.method], detail: l.device });
    }
    return list.sort((a, b) => b.at - a.at);
  }, [workouts, nutrition, weights, payments, logins]);

  const shown = events.filter(e => filter === "todo" || e.kind === filter);
  const groups: { day: string; items: Event[] }[] = [];
  for (const e of shown.slice(0, limit)) {
    const d = new Date(e.at);
    const key = d.toDateString();
    const g = groups[groups.length - 1];
    if (g && g.day === key) g.items.push(e);
    else groups.push({ day: key, items: [e] });
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const month = workouts.filter(w => w.startedAt >= monthStart.getTime());
  const counts = Object.fromEntries((Object.keys(META) as Kind[]).map(k => [k, events.filter(e => e.kind === k).length])) as Record<Kind, number>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Tu actividad" title="Historial" />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Entrenos este mes", month.filter(w => w.exercises.length).length.toString(), <Dumbbell key="d" className="size-5 text-brand-300" />],
          ["Minutos este mes", Math.round(month.reduce((a, w) => a + w.durationSec, 0) / 60).toLocaleString("es"), <PlayCircle key="p" className="size-5 text-[#b9a8ff]" />],
          ["Kg levantados (mes)", Math.round(month.reduce((a, w) => a + w.volume, 0)).toLocaleString("es"), <Trophy key="t" className="size-5 text-warn" />],
          ["Días con comidas", Object.values(nutrition).filter(d => dayTotals(d).kcal > 0).length.toString(), <Utensils key="u" className="size-5 text-success" />],
        ].map(([label, value, icon]) => (
          <div key={label as string} className="card p-4">
            {icon}
            <div className="tabular mt-2 text-2xl font-bold">{value}</div>
            <div className="text-sm text-fg/85">{label}</div>
          </div>
        ))}
      </section>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip active={filter === "todo"} onClick={() => setFilter("todo")}>
          Todo · {events.length}
        </Chip>
        {(Object.keys(META) as Kind[]).map(k => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
            {META[k].label} · {counts[k]}
          </Chip>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty icon={<Dumbbell className="size-5" />} title="Aún no hay actividad aquí" text="Tus entrenos, comidas, registros de peso y pagos aparecerán en esta línea de tiempo." />
      ) : (
        <div className="space-y-6">
          {groups.map(g => (
            <section key={g.day}>
              <h2 className="sticky top-14 z-10 -mx-1 mb-2 bg-ink-950/95 px-1 py-2 text-[15px] font-bold backdrop-blur lg:top-0">{fmtLongDate(new Date(g.items[0]!.at))}</h2>
              <ol className="card divide-y divide-line">
                {g.items.map((e, i) => {
                  const body = (
                    <>
                      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", META[e.kind].color)}>{META[e.kind].icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[15px] font-semibold">{e.title}</span>
                          {e.badge && (
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
                                e.badge.tone === "success" ? "bg-success/18 text-success" : e.badge.tone === "warn" ? "bg-warn/20 text-warn" : "bg-brand/20 text-brand-300"
                              )}
                            >
                              {e.badge.text}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-sm text-fg/85">{e.detail}</span>
                      </span>
                      <span className="tabular shrink-0 text-sm text-muted">{e.kind === "nutricion" || e.kind === "peso" ? "" : fmtTime(new Date(e.at))}</span>
                      {e.href && <ChevronRight className="size-4 shrink-0 text-muted" />}
                    </>
                  );
                  return (
                    <li key={i}>
                      {e.href ? (
                        <Link href={e.href} className="flex items-center gap-3 p-4 hover:bg-fg/[0.04]">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 p-4">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {shown.length > limit && (
            <button onClick={() => setLimit(l => l + 40)} className="mx-auto block rounded-full border border-line-strong px-5 py-2.5 text-sm font-semibold hover:bg-fg/5">
              Ver más actividad
            </button>
          )}
        </div>
      )}
    </div>
  );
}
