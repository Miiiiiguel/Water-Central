import { Check, Crown, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { Badge, Button, PageHeader, Segmented } from "@/components/ui";
import { actions, useApp, type Plan } from "@/lib/store";
import { cn } from "@/lib/utils";

/*
 * Plans and pricing. Prices are placeholders in USD; checkout is not
 * wired yet (Stripe on the web, App Store / Google Play billing in the
 * native apps — see README). Choosing a plan here only unlocks the UI.
 */

const PLANS: {
  id: Plan;
  name: string;
  monthly: number;
  yearly: number;
  tagline: string;
  icon: typeof Zap;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    id: "free",
    name: "Free",
    monthly: 0,
    yearly: 0,
    tagline: "Para empezar con buena técnica",
    icon: Zap,
    features: ["Biblioteca de técnica completa", "Registro de entrenos ilimitado", "Diario de nutrición", "1 clase en vivo por semana"],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 12.99,
    yearly: 99.99,
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
    monthly: 29.99,
    yearly: 249.99,
    tagline: "Con un coach humano a tu lado",
    icon: Crown,
    features: ["Todo lo de Pro", "Revisión de técnica por video (48 h)", "Plan de nutrición personalizado", "Chat directo con tu coach", "Sesión 1:1 mensual en video"],
  },
];

export default function Plans() {
  const current = useApp(s => s.plan);
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
          const price = period === "monthly" ? p.monthly : p.yearly;
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
                <p className="mt-1 text-sm text-muted">{p.tagline}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="title-display text-6xl">{price === 0 ? "Gratis" : `$${price}`}</span>
                  {price > 0 && <span className="text-sm text-muted">/{period === "monthly" ? "mes" : "año"}</span>}
                </div>
                {price > 0 && period === "yearly" && (
                  <div className="text-xs text-success">Equivale a ${(p.yearly / 12).toFixed(2)} al mes</div>
                )}
                <ul className="my-6 flex-1 space-y-2.5">
                  {p.features.map(f => (
                    <li key={f} className="flex gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" /> {f}
                    </li>
                  ))}
                </ul>
                <Button variant={p.highlight ? "primary" : "secondary"} size="lg" disabled={isCurrent} onClick={() => actions.setPlan(p.id)}>
                  {isCurrent ? "Tu plan actual" : p.id === "free" ? "Volver a Free" : `Elegir ${p.name}`}
                </Button>
              </div>
            </section>
          );
        })}
      </div>
      <p className="text-center text-xs text-faint">
        7 días de prueba gratis en Pro. Cancela cuando quieras. Precios de referencia; el cobro se activa al conectar la pasarela de pago.
      </p>
    </div>
  );
}
