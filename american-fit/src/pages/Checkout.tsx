import { ArrowLeft, Check, CreditCard, Landmark, Loader2, Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Button, Segmented } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { formatMoney, paymentsLive, PLAN_NAME, PRICES, startCheckout, type Gateway } from "@/lib/payments";
import { actions, type BillingPeriod } from "@/lib/store";
import { cn, uid } from "@/lib/utils";
import NotFound from "./NotFound";

const FEATURES: Record<"pro" | "elite", string[]> = {
  pro: ["Clases en vivo ilimitadas", "Todos los programas y videos", "Entreno inteligente y mapa de recuperación", "Coach adaptativo de calorías"],
  elite: ["Todo lo de Pro", "Revisión de técnica por video en 48 h", "Plan de nutrición personalizado", "Chat directo con tu coach"],
};

export default function Checkout() {
  const params = useParams<{ plan: string; period: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const plan = params.plan === "pro" || params.plan === "elite" ? params.plan : null;
  const [period, setPeriod] = useState<BillingPeriod>(params.period === "monthly" ? "monthly" : "yearly");
  const [gateway, setGateway] = useState<Gateway>("wompi");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!plan) return <NotFound />;

  const price = PRICES[plan][period];
  const amount = gateway === "wompi" ? price.COP : price.USD;
  const currency = gateway === "wompi" ? "COP" : "USD";

  const pay = async () => {
    setError(null);
    setBusy(true);
    const err = await startCheckout(plan, period, gateway);
    setBusy(false);
    if (err) setError(err);
  };

  // Test mode only: no gateway is connected, so nothing is charged.
  const simulate = () => {
    const ref = `PRUEBA-${uid().toUpperCase()}`;
    actions.recordPayment({ id: ref, at: Date.now(), plan, period, amount, currency, provider: "demo", status: "approved", reference: ref });
    navigate("/pago/resultado/demo");
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/planes" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-fg/90 hover:text-fg">
        <ArrowLeft className="size-4" /> Planes
      </Link>
      <h1 className="title-display mb-6 text-5xl">Finalizar compra</h1>

      {!paymentsLive && (
        <div className="mb-6 flex gap-3 rounded-2xl border border-warn/50 bg-warn/12 p-4 text-[15px] text-fg">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warn" />
          <p>
            <strong className="text-warn">Modo de prueba.</strong> La pasarela aún no está conectada, así que no se cobra nada. Puedes simular un pago aprobado para ver cómo queda tu cuenta.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-bold">1. Periodo</h2>
            <Segmented
              value={period}
              onChange={setPeriod}
              options={[
                { value: "monthly", label: "Mensual" },
                { value: "yearly", label: "Anual · ahorra 35%" },
              ]}
            />
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-lg font-bold">2. Método de pago</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["wompi", <Landmark key="w" className="size-6" />, "Colombia", "PSE, Nequi, Bancolombia, tarjeta débito o crédito", "Pago en pesos con Wompi"],
                  ["stripe", <CreditCard key="s" className="size-6" />, "Tarjeta internacional", "Visa, Mastercard, Amex, Apple Pay, Google Pay", "Pago en dólares con Stripe"],
                ] as [Gateway, React.ReactNode, string, string, string][]
              ).map(([g, icon, title, text, foot]) => (
                <button
                  key={g}
                  onClick={() => setGateway(g)}
                  aria-pressed={gateway === g}
                  className={cn(
                    "rounded-2xl border-2 p-4 text-left transition",
                    gateway === g ? "border-brand bg-brand/10" : "border-line-strong bg-ink-850 hover:border-fg/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={gateway === g ? "text-brand" : "text-fg"}>{icon}</span>
                    <span className={cn("grid size-6 place-items-center rounded-full border-2", gateway === g ? "border-brand bg-brand" : "border-fg/40")}>
                      {gateway === g && <Check className="size-3.5 text-white" strokeWidth={3} />}
                    </span>
                  </div>
                  <div className="mt-3 font-bold">{title}</div>
                  <div className="text-sm text-fg/90">{text}</div>
                  <div className="mt-2 text-xs font-semibold text-muted">{foot}</div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-fg/85">
              {gateway === "wompi"
                ? "Con Wompi pagas el periodo completo. Te avisaremos antes de que venza para renovarlo."
                : "Con Stripe la suscripción se renueva sola. Puedes cancelarla cuando quieras desde tu perfil."}
            </p>
          </section>

          <label className="flex cursor-pointer gap-3 rounded-2xl border border-line-strong bg-ink-900 p-4 text-[15px]">
            <input id="af-terms" type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1 size-5 accent-[#ff3b4e]" />
            <span>
              Acepto los términos del servicio y entiendo que {period === "monthly" ? "el plan es mensual" : "el plan es anual"}. Cuenta: <strong>{user?.email}</strong>
            </span>
          </label>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <section className="card overflow-hidden">
            <div className="border-b border-line bg-[radial-gradient(90%_100%_at_100%_0%,rgb(255_59_78/0.25),transparent_70%)] p-5">
              <div className="text-sm font-semibold uppercase tracking-wider text-muted">Resumen</div>
              <div className="title-display mt-1 text-4xl">American Fit {PLAN_NAME[plan]}</div>
              <div className="text-fg/90">{period === "monthly" ? "Facturación mensual" : "Facturación anual"}</div>
            </div>
            <ul className="space-y-2 p-5">
              {FEATURES[plan].map(f => (
                <li key={f} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" /> {f}
                </li>
              ))}
            </ul>
            <div className="space-y-2 border-t border-line p-5">
              <div className="flex justify-between text-[15px]">
                <span className="text-fg/90">Total</span>
                <span className="tabular text-xl font-bold">{formatMoney(amount, currency)}</span>
              </div>
              {period === "yearly" && (
                <div className="text-right text-sm font-semibold text-success">
                  Equivale a {formatMoney(currency === "COP" ? Math.round(amount / 12) : Math.round((amount / 12) * 100) / 100, currency)} al mes
                </div>
              )}
              {error && <p className="rounded-xl bg-brand/12 p-3 text-sm font-medium text-brand-300">{error}</p>}
              {paymentsLive ? (
                <Button size="lg" className="mt-2 w-full" disabled={!accepted || busy} onClick={pay}>
                  {busy ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-4" />} Pagar {formatMoney(amount, currency)}
                </Button>
              ) : (
                <Button size="lg" className="mt-2 w-full" disabled={!accepted} onClick={simulate}>
                  Simular pago aprobado
                </Button>
              )}
              <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs font-medium text-muted">
                <ShieldCheck className="size-4 text-success" /> Pago procesado por {gateway === "wompi" ? "Wompi (Bancolombia)" : "Stripe"}. No guardamos los datos de tu tarjeta.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
