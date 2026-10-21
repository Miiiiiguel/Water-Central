import { ArrowLeft, Check, Loader2, Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { HelpLink } from "@/components/SupportWidget";
import { Button } from "@/components/ui";
import { PRODUCT_BY_ID, SHOP_CATEGORY_LABEL } from "@/data/shop";
import { useAuth } from "@/lib/auth";
import { formatMoney, paymentsLive, startProductCheckout, type Gateway } from "@/lib/payments";
import { actions } from "@/lib/store";
import { uid } from "@/lib/utils";
import { GatewayPicker } from "./Checkout";
import NotFound from "./NotFound";

export default function ProductCheckout() {
  const { id } = useParams<{ id: string }>();
  const p = PRODUCT_BY_ID[id];
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [gateway, setGateway] = useState<Gateway>("wompi");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!p) return <NotFound />;

  const amount = gateway === "wompi" ? p.COP : p.USD;
  const currency = gateway === "wompi" ? "COP" : "USD";

  const pay = async () => {
    setBusy(true);
    setError(null);
    const err = await startProductCheckout(p.id, gateway);
    setBusy(false);
    if (err) setError(err);
  };
  const simulate = () => {
    const ref = `PRUEBA-${uid().toUpperCase()}`;
    actions.recordPayment({ id: ref, at: Date.now(), plan: "free", period: "monthly", productId: p.id, amount, currency, provider: "demo", status: "approved", reference: ref });
    navigate("/pago/resultado/demo");
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={p.category === "propinas" ? "/live" : "/tienda"} className="mb-4 inline-flex items-center gap-1 text-[15px] font-bold text-fg hover:underline">
        <ArrowLeft className="size-5" /> {p.category === "propinas" ? "Live" : "Tienda"}
      </Link>
      <h1 className="title-display mb-6 text-5xl">{p.category === "propinas" ? "Enviar propina" : "Finalizar compra"}</h1>

      {!paymentsLive && (
        <div className="mb-6 flex gap-3 rounded-2xl border-2 border-warn/60 bg-warn/12 p-4 text-[16px] text-fg">
          <TriangleAlert className="mt-0.5 size-6 shrink-0 text-warn" />
          <p>
            <strong className="text-warn">Modo de prueba.</strong> La pasarela aún no está conectada: no se cobra nada y puedes simular el pago.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-bold">Método de pago</h2>
            <GatewayPicker gateway={gateway} onChange={setGateway} />
          </section>
          <label className="flex cursor-pointer gap-3 rounded-2xl border-2 border-line-strong bg-ink-900 p-4 text-[16px]">
            <input id="af-terms-product" type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1 size-5 accent-[#ff3b4e]" />
            <span>
              Acepto los términos de compra. Pago único, sin renovación. Cuenta: <strong>{user?.email}</strong>
            </span>
          </label>
        </div>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <section className="card overflow-hidden">
            <div className="p-5" style={{ background: `linear-gradient(135deg, hsl(${p.hue} 80% 50% / 0.35), transparent)` }}>
              <div className="text-sm font-bold uppercase tracking-wider">{SHOP_CATEGORY_LABEL[p.category]}</div>
              <div className="mt-1 text-2xl font-bold leading-tight">{p.name}</div>
              <div className="mt-1 text-[15px]">{p.tagline}</div>
            </div>
            <ul className="space-y-2 p-5">
              {p.includes.map(i => (
                <li key={i} className="flex gap-2 text-[15px]">
                  <Check className="mt-0.5 size-5 shrink-0 text-success" /> {i}
                </li>
              ))}
            </ul>
            <div className="space-y-2 border-t border-line p-5">
              <div className="flex justify-between text-[16px]">
                <span className="font-semibold">Total</span>
                <span className="tabular text-xl font-bold">{formatMoney(amount, currency)}</span>
              </div>
              {error && <p className="rounded-xl bg-brand/12 p-3 text-[15px] font-semibold text-brand-300">{error}</p>}
              {paymentsLive ? (
                <Button size="lg" className="mt-2 w-full" disabled={!accepted || busy} onClick={pay}>
                  {busy ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-4" />} Pagar {formatMoney(amount, currency)}
                </Button>
              ) : (
                <Button size="lg" className="mt-2 w-full" disabled={!accepted} onClick={simulate}>
                  Simular pago aprobado
                </Button>
              )}
              <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-sm font-semibold">
                <ShieldCheck className="size-4 text-success" /> No guardamos los datos de tu tarjeta.
              </p>
            </div>
          </section>
          <div className="mt-4 text-center">
            <HelpLink />
          </div>
        </aside>
      </div>
    </div>
  );
}
