import { AnimatePresence, motion } from "framer-motion";
import {
  Apple,
  Dumbbell,
  Flame,
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
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Avatar } from "@/components/ui";
import { useApp } from "@/lib/store";
import { cn, fmtDuration } from "@/lib/utils";

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 40 40" className="size-8 shrink-0" aria-hidden>
        <defs>
          <linearGradient id="af-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff3b4e" />
            <stop offset="1" stopColor="#ff7a45" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="11" fill="url(#af-logo)" />
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
  { href: "/comunidad", label: "Comunidad", icon: Users },
  { href: "/planes", label: "Planes", icon: Trophy },
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
          className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 lg:bottom-6 lg:left-auto lg:right-6 lg:w-96"
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

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-ink-950 px-4 py-6 lg:flex">
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
          {plan === "free" && (
            <Link href="/planes" className="mb-4 block overflow-hidden rounded-2xl border border-brand/25 bg-brand/8 p-4">
              <div className="mb-1 flex items-center gap-1.5 text-sm font-bold">
                <Flame className="size-4 text-brand" /> Hazte Pro
              </div>
              <p className="text-xs text-muted">Clases en vivo ilimitadas, planes de nutrición y coach.</p>
            </Link>
          )}
          {profile && (
            <Link href="/perfil" className="flex items-center gap-3 rounded-2xl p-2 hover:bg-white/5">
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
                <Link href="/comunidad" className="grid size-9 place-items-center rounded-full bg-white/6 text-muted" aria-label="Comunidad">
                  <Users className="size-[18px]" />
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
            immersive ? "pb-10 pt-safe" : "pb-[calc(96px+env(safe-area-inset-bottom))] pt-5 lg:pb-16 lg:pt-10"
          )}
        >
          {children}
        </main>

        {!immersive && (
          <nav className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line lg:hidden" aria-label="Principal">
            <div className="mx-auto grid h-[68px] max-w-lg grid-cols-5">
              {PRIMARY.map(({ href, label, icon: Icon }) => {
                const active = isActive(loc, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
                      active ? "text-fg" : "text-muted"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {active && (
                      <motion.span
                        layoutId="tab-pill"
                        className="absolute top-1.5 h-8 w-14 rounded-full bg-white/8"
                        transition={{ type: "spring", stiffness: 500, damping: 38 }}
                      />
                    )}
                    <span className="relative">
                      <Icon className={cn("size-[22px]", active && href === "/live" && "text-brand")} strokeWidth={active ? 2.4 : 2} />
                      {href === "/live" && <span className="absolute -right-1 -top-0.5 size-2 rounded-full bg-brand ring-2 ring-ink-950" />}
                    </span>
                    <span className="relative">{label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
        <ActiveSessionPill />
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
        active ? "bg-white/8 text-fg" : "text-muted hover:bg-white/4 hover:text-fg"
      )}
    >
      <Icon className={cn("size-[18px]", active && "text-brand")} />
      {label}
      {href === "/live" && <span className="ml-auto rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">LIVE</span>}
    </Link>
  );
}
