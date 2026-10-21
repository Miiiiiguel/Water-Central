import { Check, Gift, GraduationCap, HeartHandshake, Salad, ShoppingBag, Trophy, Users, Video } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { UpsellBanner } from "@/components/monetize";
import { HelpLink } from "@/components/SupportWidget";
import { Chip, PageHeader } from "@/components/ui";
import { PRODUCTS, SHOP_CATEGORY_LABEL, type ShopCategory } from "@/data/shop";
import { formatMoney } from "@/lib/payments";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

const ICON: Record<ShopCategory, React.ReactNode> = {
  coaching: <Video className="size-7" />,
  programas: <GraduationCap className="size-7" />,
  nutricion: <Salad className="size-7" />,
  clases: <Users className="size-7" />,
  retos: <Trophy className="size-7" />,
  regalos: <Gift className="size-7" />,
  propinas: <HeartHandshake className="size-7" />,
};

export default function Shop() {
  const purchases = useApp(s => s.purchases);
  const [cat, setCat] = useState<ShopCategory | null>(null);
  const list = PRODUCTS.filter(p => !p.hidden && (!cat || p.category === cat));
  const cats = [...new Set(PRODUCTS.filter(p => !p.hidden).map(p => p.category))];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Compra única, sin suscripción" title="Tienda" />
      <p className="-mt-3 max-w-2xl text-[17px] text-fg">Coaching personal, programas para siempre, planes de nutrición y regalos. Paga con PSE, Nequi, tarjeta o desde el exterior.</p>

      <UpsellBanner title="¿Lo quieres todo?" text="Con Pro tienes todos los programas, videos y clases en vivo por un solo pago." />

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip active={!cat} onClick={() => setCat(null)}>
          Todo
        </Chip>
        {cats.map(c => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {SHOP_CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map(p => {
          const owned = purchases.includes(p.id) && p.category !== "regalos";
          return (
            <article key={p.id} className="card flex flex-col overflow-hidden">
              <div className="flex items-start gap-4 p-5 pb-0">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl text-white" style={{ background: `linear-gradient(135deg, hsl(${p.hue} 80% 55%), hsl(${(p.hue + 30) % 360} 75% 40%))` }}>
                  {ICON[p.category]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold uppercase tracking-wide text-fg">{SHOP_CATEGORY_LABEL[p.category]}</span>
                    {p.badge && <span className="rounded-full bg-warn px-2.5 py-0.5 text-xs font-bold text-[#2a1a00]">{p.badge}</span>}
                  </div>
                  <h2 className="mt-0.5 text-xl font-bold leading-tight">{p.name}</h2>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-[16px] text-fg">{p.tagline}</p>
                <ul className="mt-3 flex-1 space-y-2">
                  {p.includes.map(i => (
                    <li key={i} className="flex gap-2 text-[15px] text-fg">
                      <Check className="mt-0.5 size-5 shrink-0 text-success" /> {i}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="tabular text-2xl font-bold">{formatMoney(p.COP, "COP")}</div>
                    <div className="text-sm font-medium text-fg">o {formatMoney(p.USD, "USD")}</div>
                  </div>
                  {owned ? (
                    <span className="inline-flex h-12 items-center gap-2 rounded-full bg-success/20 px-5 font-bold text-success">
                      <Check className="size-5" /> Comprado
                    </span>
                  ) : (
                    <Link href={`/pago/producto/${p.id}`} className={cn("inline-flex h-12 items-center gap-2 rounded-full bg-gradient-brand px-5 font-bold text-white")}>
                      <ShoppingBag className="size-5" /> Comprar
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="flex justify-center pt-2">
        <HelpLink label="¿Dudas antes de comprar? Habla con soporte" />
      </div>
    </div>
  );
}
