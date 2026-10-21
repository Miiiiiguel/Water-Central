import { AnimatePresence, motion } from "framer-motion";
import {
  Apple,
  Dumbbell,
  Flame,
  History,
  LifeBuoy,
  Medal,
  Plus,
  ShoppingBag,
  Type,
  Home,
  LineChart,
  PlayCircle,
  Radio,
  Sparkles,
  Timer,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { QuickActions } from "@/components/QuickActions";
import { ReadingSheet } from "@/components/ReadingSheet";
import { Avatar } from "@/components/ui";
import { useApp } from "@/lib/store";
import { cn, fmtDuration } from "@/lib/utils";

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  // Unique per instance: a hidden copy (desktop sidebar) would otherwise own the gradient.
  const gid = `af-logo-${useId().replace(/:/g, "")}`;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 40 40" className="size-8 shrink-0" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff3b4e" />
            <stop offset="1" stopColor="#ff7a45" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="11" fill={`url(#${gid})`} />
        <path d="M20 7.5l3.4 7.6 8.3.8-6.3 5.5 1.9 8.1L20 25.3l-7.3 4.2 1.9-8.1-6.3-5.5 8.3-.8z" fill="#fff" />
        <rect x="9" y="31.5" width="22" height="2.6" rx="1.3" fill="#fff" opacity="0.9" />
      </svg>
      {!compact && (
        <span className="title-display text-[22px] leading-none">
          American <span className="text-gradient-brand">Fit</span>
        </span>
      )}
    </span>
  );
}

const PRIMARY = [
  { href: "/", label: "Hoy", icon: Home },
  { href: "/entrenar", label: "Entrenar", icon: Dumbbell },
  { href: "/tecnica", label: "Técnica", icon: Sparkles },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/nutricion", label: "Nutrición", icon: Apple },
];

const SECONDARY = [
  { href: "/videos", label: "Videos", icon: PlayCircle },
  { href: "/progreso", label: "Progreso", icon: LineChart },
  { href: "/historial", label: "Historial", icon: History },
  { href: "/logros", label: "Logros", icon: Medal },
  { href: "/comunidad", label: "Comunidad", icon: Users },
  { href: "/tienda", label: "Tienda", icon: ShoppingBag },
  { href: "/planes", label: "Planes", icon: Trophy },
  { href: "/ayuda", label: "Ayuda 24/7", icon: LifeBuoy },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

function isActive(loc: string, href: string) {
  return href === "/" ? loc === "/" : loc === href || loc.startsWith(href + "/");
}

function useElapsed(since?: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  return since ? (now - since) / 1000 : 0;
}

function ActiveSessionPill() {
  const active = useApp(s => s.active);
  const [loc] = useLocation();
  const elapsed = useElapsed(active?.startedAt);
  const show = !!active && !loc.startsWith("/entrenar/sesion");
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          className="fixed inset-x-3 bottom-[calc(92px+env(safe-area-inset-bottom))] z-40 lg:bottom-6 lg:left-auto lg:right-6 lg:w-96"
        >
          <Link
            href="/entrenar/sesion"
            className="glass flex items-center gap-3 rounded-2xl border border-brand/30 p-3 shadow-2xl shadow-black/50"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-brand">
              <Timer className="size-5 text-white" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{active!.name}</span>
              <span className="tabular text-xs text-muted">Entrenamiento en curso · {fmtDuration(elapsed)}</span>
            </span>
            <span className="rounded-full bg-fg px-3 py-1.5 text-xs font-bold text-ink-950">Volver</span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const profile = useApp(s => s.profile);
  const plan = useApp(s => s.plan);
  const immersive = loc.startsWith("/entrenar/sesion") || /^\/live\/[^/]+$/.test(loc);
  const [reading, setReading] = useState(false);
  const [quick, setQuick] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="no-scrollbar sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-line bg-ink-950 px-4 py-6 lg:flex">
        <Link href="/" className="mb-8 px-2">
          <Logo />
        </Link>
        <nav className="space-y-1">
          {PRIMARY.map(item => (
            <SideLink key={item.href} {...item} active={isActive(loc, item.href)} />
          ))}
        </nav>
        <div className="eyebrow mb-2 mt-7 px-3">Más</div>
        <nav className="space-y-1">
          {SECONDARY.map(item => (
            <SideLink key={item.href} {...item} active={isActive(loc, item.href)} />
          ))}
        </nav>
        <div className="mt-auto">
          <button onClick={() => setReading(true)} className="mb-3 flex w-full items-center gap-3 rounded-xl border-2 border-line-strong px-3 py-2.5 text-sm font-bold">
            <Type className="size-[18px]" /> Pantalla y lectura
          </button>
          {plan === "free" && (
            <Link href="/planes" className="mb-4 block overflow-hidden rounded-2xl border border-brand/25 bg-brand/8 p-4">
              <div className="mb-1 flex items-center gap-1.5 text-sm font-bold">
                <Flame className="size-4 text-brand" /> Hazte Pro
              </div>
              <p className="text-xs text-muted">Clases en vivo ilimitadas, planes de nutrición y coach.</p>
            </Link>
          )}
          {profile && (
            <Link href="/perfil" className="flex items-center gap-3 rounded-2xl p-2 hover:bg-fg/5">
              <Avatar name={profile.name} hue={352} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{profile.name}</span>
                <span className="block text-xs capitalize text-muted">Plan {plan}</span>
              </span>
            </Link>
          )}
        </div>
      </aside>

      <div className="min-w-0">
        {!immersive && (
          <header className="glass pt-safe sticky top-0 z-30 border-b border-line lg:hidden">
            <div className="flex h-14 items-center justify-between px-4">
              <Link href="/">
                <Logo />
              </Link>
              <div className="flex items-center gap-2">
                <button onClick={() => setReading(true)} className="flex h-10 items-center gap-1 rounded-full border-2 border-line-strong px-3 text-[15px] font-bold" aria-label="Pantalla y lectura">
                  <Type className="size-4" /> Aa
                </button>
                <Link href="/tienda" className="grid size-10 place-items-center rounded-full border-2 border-line-strong" aria-label="Tienda">
                  <ShoppingBag className="size-5" />
                </Link>
                <Link href="/perfil" aria-label="Perfil">
                  <Avatar name={profile?.name ?? "AF"} hue={352} size={34} />
                </Link>
              </div>
            </div>
          </header>
        )}

        <main
          className={cn(
            "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10",
            immersive ? "pb-10 pt-safe" : "pb-[calc(120px+env(safe-area-inset-bottom))] pt-5 lg:pb-16 lg:pt-10"
          )}
        >
          {children}
        </main>

        {!immersive && (
          <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 lg:hidden" aria-label="Principal">
            <div className="glass mx-auto flex h-[70px] max-w-lg items-center gap-1 rounded-[28px] border border-line-strong p-1.5 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.55)]">
              <div className="grid h-full flex-1 grid-cols-5">
                {PRIMARY.map(({ href, label, icon: Icon }) => {
                  const active = isActive(loc, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn("relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[11.5px] font-semibold tracking-tight transition-colors", active ? "text-fg" : "text-muted")}
                      aria-current={active ? "page" : undefined}
                    >
                      {active && (
                        <motion.span layoutId="tab-pill" className="absolute inset-0.5 rounded-[20px] bg-fg/10" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
                      )}
                      <span className="relative">
                        <Icon className={cn("size-[22px]", active && "text-brand")} strokeWidth={active ? 2.5 : 2} />
                        {href === "/live" && <span className="absolute -right-1 -top-0.5 size-2 rounded-full bg-brand ring-2 ring-ink-900" />}
                      </span>
                      <span className="relative">{label}</span>
                    </Link>
                  );
                })}
              </div>
              <button
                onClick={() => setQuick(true)}
                className="grid size-[52px] shrink-0 place-items-center rounded-[20px] bg-gradient-brand text-white shadow-[0_10px_24px_-8px_rgb(255_59_78/0.9)] transition active:scale-90"
                aria-label="Registrar o empezar algo"
              >
                <Plus className="size-7" strokeWidth={2.6} />
              </button>
            </div>
          </nav>
        )}
        <ActiveSessionPill />
        <ReadingSheet open={reading} onClose={() => setReading(false)} />
        <QuickActions open={quick} onClose={() => setQuick(false)} />
      </div>
    </div>
  );
}

function SideLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-fg/8 text-fg" : "text-muted hover:bg-fg/4 hover:text-fg"
      )}
    >
      <Icon className={cn("size-[18px]", active && "text-brand")} />
      {label}
      {href === "/live" && <span className="ml-auto rounded-md bg-brand px-1.5 py-0.5 text-xs font-bold text-white">LIVE</span>}
    </Link>
  );
}
