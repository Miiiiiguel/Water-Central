import { ArrowRight, Crown, Lock, ShoppingBag, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { formatMoney } from "@/lib/payments";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Product } from "@/data/shop";

/** Full paywall for locked content, with every way to unlock it. */
export function Paywall({
  title,
  text,
  product,
  className,
}: {
  title: string;
  text: string;
  product?: Product;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-3xl border-2 border-brand/60 bg-ink-900", className)}>
      <div className="bg-gradient-brand px-5 py-4 text-white">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
          <Lock className="size-4" /> Contenido Pro
        </div>
        <div className="mt-1 text-2xl font-bold">{title}</div>
      </div>
      <div className="space-y-3 p-5">
        <p className="text-[16px] leading-relaxed text-fg">{text}</p>
        <Link href="/pago/pro/yearly" className="flex h-14 items-center justify-center gap-2 rounded-full bg-gradient-brand text-[16px] font-bold text-white shadow-[0_8px_24px_-8px_rgb(139_77_255/0.65)]">
          <Sparkles className="size-5" /> Desbloquear todo con Pro
        </Link>
        {product && (
          <Link href={`/pago/producto/${product.id}`} className="flex h-14 items-center justify-center gap-2 rounded-full border-2 border-fg text-[16px] font-bold text-fg">
            <ShoppingBag className="size-5" /> Comprar solo esto · {formatMoney(product.COP, "COP")}
          </Link>
        )}
        <Link href="/planes" className="block text-center text-[15px] font-bold text-sky-300 underline-offset-4 hover:underline">
          Comparar planes
        </Link>
      </div>
    </section>
  );
}

/** Wide upgrade banner; hidden for accounts that already pay. */
export function UpsellBanner({ title, text, cta = "Hazte Pro", href = "/planes", className }: { title: string; text: string; cta?: string; href?: string; className?: string }) {
  const plan = useApp(s => s.plan);
  if (plan !== "free") return null;
  return (
    <Link href={href} className={cn("flex items-center gap-4 rounded-3xl bg-gradient-brand p-5 text-white shadow-[0_16px_40px_-20px_rgb(139_77_255/0.9)]", className)}>
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/20">
        <Crown className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold leading-tight">{title}</span>
        <span className="block text-[15px] text-white">{text}</span>
      </span>
      <span className="hidden shrink-0 items-center gap-1 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[#6a1fd6] sm:inline-flex">
        {cta} <ArrowRight className="size-4" />
      </span>
      <ArrowRight className="size-6 shrink-0 sm:hidden" />
    </Link>
  );
}

export function ProBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-gradient-brand px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white", className)}>
      <Lock className="size-3" /> Pro
    </span>
  );
}
