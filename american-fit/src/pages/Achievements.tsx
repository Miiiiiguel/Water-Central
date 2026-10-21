import { motion } from "framer-motion";
import { useMemo } from "react";
import { CountUp, Stagger, staggerItem } from "@/components/fx";
import { Medal } from "@/components/Medal";
import { Bar, PageHeader } from "@/components/ui";
import { evaluate } from "@/lib/achievements";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

const TIER_LABEL = { bronce: "Bronce", plata: "Plata", oro: "Oro" };

export default function Achievements() {
  const state = useApp(s => s);
  const list = useMemo(() => evaluate(state), [state]);
  const done = list.filter(a => a.done).length;
  const sorted = [...list].sort((a, b) => Number(b.done) - Number(a.done) || b.current / b.goal - a.current / a.goal);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Tu colección" title="Logros" />

      <section className="card relative overflow-hidden p-6">
        <div className="absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,rgb(255_181_71/0.25),transparent_60%)]" />
        <div className="relative flex items-center gap-5">
          <div className="title-display text-7xl">
            <CountUp value={done} />
            <span className="text-3xl text-muted">/{list.length}</span>
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold">Insignias desbloqueadas</div>
            <div className="mb-3 text-[15px] text-fg">Entrena, registra y vuelve cada semana para completar la colección.</div>
            <Bar value={done / list.length} color="var(--color-warn)" className="h-2.5" />
          </div>
        </div>
      </section>

      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map(a => (
          <motion.article key={a.id} {...staggerItem} className={cn("card flex flex-col items-center p-5 text-center", a.done && "border-warn/40")}>
            <Medal a={a} done={a.done} progress={a.current / a.goal} />
            <div className="mt-3 text-[16px] font-bold leading-tight">{a.title}</div>
            <div className="mt-1 text-sm text-fg">{a.text}</div>
            <div className="mt-3 flex flex-col items-center gap-0.5 text-xs font-bold uppercase tracking-wider">
              <span className={cn(a.tier === "oro" ? "text-warn" : a.tier === "plata" ? "text-fg" : "text-ember")}>{TIER_LABEL[a.tier]}</span>
              <span className={a.done ? "text-success" : "text-muted"}>
                {a.done ? "Conseguido" : `${a.current.toLocaleString("es")}/${a.goal.toLocaleString("es")}`}
              </span>
            </div>
          </motion.article>
        ))}
      </Stagger>
    </div>
  );
}
