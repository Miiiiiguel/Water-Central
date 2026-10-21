import { Check, Crown, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { Badge, Button, PageHeader, Segmented } from "@/components/ui";
import { formatMoney, PRICES } from "@/lib/payments";
import { useApp, type Plan } from "@/lib/store";
import { cn } from "@/lib/utils";

/*
 * Plans and pricing. Paying goes through /pago/:plan/:period (Wompi in
 * COP or Stripe in USD, see lib/payments.ts); prices live in PRICES.
 */

const PLANS: {
  id: Plan;
  name: string;
  tagline: string;
  icon: typeof Zap;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Para empezar con buena técnica",
    icon: Zap,
    features: ["Biblioteca de técnica completa", "Registro de entrenos ilimitado", "Diario de nutrición", "1 clase en vivo por semana"],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Todo para entrenar en serio",
    icon: Sparkles,
    highlight: true,
    features: [
      "Clases en vivo ilimitadas",
      "Todos los programas y videos",
      "Entreno inteligente y mapa de recuperación",
      "Coach adaptativo de calorías",
      "Escáner de código de barras",
      "Repeticiones de clases en vivo",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    tagline: "Con un coach humano a tu lado",
    icon: Crown,
    features: ["Todo lo de Pro", "Revisión de técnica por video (48 h)", "Plan de nutrición personalizado", "Chat directo con tu coach", "Sesión 1:1 mensual en video"],
  },
];

export default function Plans() {
  const [, navigate] = useLocation();
  const current = useApp(s => s.plan);
  const sub = useApp(s => s.subscription);
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Membresía"
        title={
          <>
            Entrena <span className="text-gradient-brand">sin límites</span>
          </>
        }
      />
      <div className="flex justify-center">
        <Segmented
          value={period}
          onChange={setPeriod}
          className="w-72"
          options={[
            { value: "monthly", label: "Mensual" },
            { value: "yearly", label: "Anual · −35%" },
          ]}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map(p => {
          const price = p.id === "free" ? null : PRICES[p.id][period];
          const isCurrent = current === p.id;
          return (
            <section
              key={p.id}
              className={cn(
                "card relative flex flex-col overflow-hidden p-6",
                p.highlight && "border-brand/50 shadow-[0_20px_60px_-25px_rgb(255_59_78/0.6)]"
              )}
            >
              {p.highlight && <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_0%,rgb(255_59_78/0.18),transparent_70%)]" />}
              <div className="relative flex flex-1 flex-col">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-lg font-bold">
                    <p.icon className={cn("size-5", p.highlight ? "text-brand" : "text-muted")} /> {p.name}
                  </span>
                  {p.highlight && <Badge tone="brand">Más popular</Badge>}
                </div>
                <p className="mt-1 text-[15px] text-fg/90">{p.tagline}</p>
                <div className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
                  <span className="title-display text-5xl">{price ? formatMoney(price.COP, "COP").replace(" COP", "") : "Gratis"}</span>
                  {price && <span className="text-[15px] font-medium text-fg/90">COP/{period === "monthly" ? "mes" : "año"}</span>}
                </div>
                {price && (
                  <div className="mt-1 text-sm text-fg/85">
                    o {formatMoney(price.USD, "USD")} con tarjeta internacional
                    {period === "yearly" && <span className="block font-semibold text-success">Equivale a {formatMoney(Math.round(price.COP / 12), "COP")} al mes</span>}
                  </div>
                )}
                <ul className="my-6 flex-1 space-y-2.5">
                  {p.features.map(f => (
                    <li key={f} className="flex gap-2.5 text-[15px]">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" /> {f}
                    </li>
                  ))}
                </ul>
                {p.id === "free" ? (
                  <Button variant="secondary" size="lg" disabled>
                    {isCurrent ? "Tu plan actual" : "Incluido siempre"}
                  </Button>
                ) : (
                  <Button variant={p.highlight ? "primary" : "secondary"} size="lg" onClick={() => navigate(`/pago/${p.id}/${period}`)}>
                    {isCurrent ? `Renovar ${p.name}` : `Elegir ${p.name}`}
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {sub && (
        <p className="text-center text-[15px] text-fg/90">
          Tu plan {sub.plan === "pro" ? "Pro" : "Elite"} {sub.status === "canceled" ? "termina" : "se renueva"} el{" "}
          <strong>{new Date(sub.renewsAt).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}</strong>.
        </p>
      )}
      <p className="flex items-center justify-center gap-2 text-center text-sm text-fg/85">
        <ShieldCheck className="size-4 shrink-0 text-success" /> Pagos seguros con Wompi (PSE, Nequi, tarjetas) y Stripe. Cancela cuando quieras.
      </p>
    </div>
  );
}
