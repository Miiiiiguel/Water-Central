import { motion } from "framer-motion";
import { Droplets, Dumbbell, Headset, Radio, Scale, ShoppingBag, Utensils, Wand2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { showSupport } from "@/components/SupportWidget";
import { Button, Sheet, Stepper } from "@/components/ui";
import { actions, useApp } from "@/lib/store";
import { dayKey } from "@/lib/utils";

/** The center "+" of the dock: everything you log, one tap away. */
export function QuickActions({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();
  const profile = useApp(s => s.profile);
  const [weight, setWeight] = useState<number | null>(null);
  const go = (href: string) => {
    onClose();
    navigate(href);
  };
  const items: [string, string, React.ReactNode, string, () => void][] = [
    ["Empezar entreno", "Tu programa de hoy", <Dumbbell key="a" className="size-6" />, "from-[#7b3dff] to-[#ff4fd8]", () => go("/entrenar")],
    ["Entreno inteligente", "Según tu recuperación", <Wand2 key="b" className="size-6" />, "from-[#3c7bff] to-[#7b5cff]", () => go("/entrenar")],
    ["Registrar comida", "Busca o escanea", <Utensils key="c" className="size-6" />, "from-[#12b981] to-[#2be09a]", () => go("/nutricion")],
    ["+250 ml de agua", "Suma un vaso", <Droplets key="d" className="size-6" />, "from-[#2b8cff] to-[#5cc8ff]", () => { actions.addWater(dayKey(), 250); onClose(); }],
    ["Registrar peso", "Para tu tendencia", <Scale key="e" className="size-6" />, "from-[#7b5cff] to-[#b07bff]", () => setWeight(profile?.weightKg ?? 70)],
    ["Clase en vivo", "Únete o reserva", <Radio key="f" className="size-6" />, "from-[#ff3b5c] to-[#c4122f]", () => go("/live")],
    ["Tienda", "Coaching y programas", <ShoppingBag key="g" className="size-6" />, "from-[#e0a419] to-[#ffb547]", () => go("/tienda")],
    ["Ayuda 24/7", "Te respondemos ya", <Headset key="h" className="size-6" />, "from-[#475569] to-[#64748b]", () => { onClose(); showSupport(); }],
  ];
  return (
    <Sheet open={open} onClose={() => { setWeight(null); onClose(); }} title={weight === null ? "¿Qué quieres hacer?" : "Peso de hoy"}>
      {weight === null ? (
        <div className="grid grid-cols-2 gap-3 pb-3">
          {items.map(([title, sub, icon, grad, fn], i) => (
            <motion.button
              key={title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i }}
              onClick={fn}
              className="flex flex-col items-start gap-3 rounded-3xl border border-line bg-ink-850 p-4 text-left transition active:scale-[0.97]"
            >
              <span className={`grid size-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${grad}`}>{icon}</span>
              <span>
                <span className="block text-[16px] font-bold leading-tight">{title}</span>
                <span className="block text-sm text-fg">{sub}</span>
              </span>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5 py-4">
          <Stepper value={weight} step={0.1} onChange={setWeight} suffix="kg" className="scale-125" />
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              actions.logWeight(Math.round(weight * 10) / 10);
              setWeight(null);
              onClose();
            }}
          >
            Guardar peso
          </Button>
        </div>
      )}
    </Sheet>
  );
}
