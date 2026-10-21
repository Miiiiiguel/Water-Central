import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { Confetti } from "@/components/fx";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { PRODUCT_BY_ID } from "@/data/shop";
import { formatMoney, PLAN_NAME } from "@/lib/payments";
import { useApp } from "@/lib/store";
import { refreshSubscription } from "@/lib/sync";

/*
 * Landing page after a gateway redirect. The webhook may land a few
 * seconds after the buyer, so it polls the subscription briefly.
 */
export default function PaymentResult() {
  const search = new URLSearchParams(useSearch());
  const params = useParams<{ provider?: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const provider = params.provider ?? search.get("provider");
  const plan = useApp(s => s.plan);
  const sub = useApp(s => s.subscription);
  const last = useApp(s => s.payments[0]);
  const [tries, setTries] = useState(0);

  const isProduct = !!last?.productId;
  const approved =
    provider === "demo" || isProduct
      ? last?.status === "approved"
      : !!sub && sub.status === "active" && sub.renewsAt > Date.now() && last?.status === "approved";
  const declined = last?.status === "declined";

  useEffect(() => {
    if (provider === "demo" || approved || declined || !user || tries >= 8) return;
    const t = setTimeout(async () => {
      await refreshSubscription(user.id);
      setTries(n => n + 1);
    }, tries === 0 ? 300 : 2500);
    return () => clearTimeout(t);
  }, [provider, approved, declined, user, tries]);

  const state = approved ? "ok" : declined ? "no" : tries >= 8 ? "pending" : "wait";

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-10 text-center">
      {state === "ok" && (
        <>
          <Confetti />
          <CheckCircle2 className="size-20 text-success" />
        </>
      )}
      {state === "no" && <XCircle className="size-20 text-brand" />}
      {state === "pending" && <Clock className="size-20 text-warn" />}
      {state === "wait" && <Loader2 className="size-20 animate-spin text-fg" />}
      <h1 className="title-display mt-5 text-5xl">
        {state === "ok" ? "¡Pago aprobado!" : state === "no" ? "Pago rechazado" : state === "pending" ? "Pago en proceso" : "Confirmando tu pago…"}
      </h1>
      <p className="mt-3 text-lg text-fg/90">
        {state === "ok"
          ? isProduct
            ? `Compraste ${PRODUCT_BY_ID[last!.productId!]?.name ?? "tu producto"}. Te escribiremos al correo con los siguientes pasos.`
            : `Ya tienes American Fit ${PLAN_NAME[plan]}.${sub ? ` Vigente hasta el ${new Date(sub.renewsAt).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}.` : ""}`
          : state === "no"
            ? "Tu banco no aprobó el pago. No se hizo ningún cobro; puedes intentarlo otra vez con otro método."
            : state === "pending"
              ? "Tu banco todavía no confirma el pago (con PSE puede tardar unos minutos). Activaremos tu plan apenas llegue la confirmación."
              : "Estamos esperando la confirmación de la pasarela."}
      </p>
      {last && (
        <div className="mt-6 w-full rounded-2xl border border-line-strong bg-ink-900 p-4 text-left text-[15px]">
          <div className="flex justify-between">
            <span className="text-muted">Referencia</span>
            <span className="font-mono text-sm">{last.reference.slice(0, 22)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted">Monto</span>
            <span className="font-semibold">{formatMoney(last.amount, last.currency)}</span>
          </div>
          {last.provider === "demo" && <div className="mt-2 text-sm font-semibold text-warn">Pago simulado · modo de prueba, sin cobro real</div>}
        </div>
      )}
      <div className="mt-8 grid w-full gap-2">
        <Button size="lg" onClick={() => navigate(state === "no" ? "/planes" : "/")}>
          {state === "no" ? "Intentar de nuevo" : "Ir al inicio"}
        </Button>
        <Button variant="secondary" onClick={() => navigate("/historial")}>
          Ver mi historial
        </Button>
      </div>
    </div>
  );
}
