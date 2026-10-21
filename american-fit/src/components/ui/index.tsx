import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "wouter";
import { cn, initials } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "light" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-gradient-brand text-white shadow-[0_8px_24px_-8px_rgb(255_59_78/0.65)] hover:brightness-110",
  secondary: "bg-fg/7 text-fg hover:bg-fg/11 border border-line",
  ghost: "text-muted hover:text-fg hover:bg-fg/5",
  outline: "border border-line-strong text-fg hover:bg-fg/5",
  light: "bg-fg text-ink-950 hover:opacity-90",
  danger: "bg-brand/12 text-brand-300 hover:bg-brand/20 border border-brand/25",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-full",
  md: "h-11 px-5 text-sm gap-2 rounded-full",
  lg: "h-14 px-7 text-[15px] gap-2.5 rounded-full",
  icon: "size-10 rounded-full",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold transition duration-200 ease-snappy active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55",
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...props}
    />
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold transition duration-200 ease-snappy active:scale-[0.97]",
        VARIANT[variant],
        SIZE[size],
        className
      )}
    >
      {children}
    </Link>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "sky" | "success" | "warn" | "live";
  className?: string;
}) {
  const tones = {
    neutral: "bg-fg/12 text-fg/90",
    brand: "bg-brand/15 text-brand-300",
    sky: "bg-sky/15 text-sky-300",
    success: "bg-success/12 text-success",
    warn: "bg-warn/14 text-warn",
    live: "bg-brand text-white",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        tones[tone],
        className
      )}
    >
      {tone === "live" && <span className="size-1.5 animate-pulse rounded-full bg-white" />}
      {children}
    </span>
  );
}

export function SectionHeader({
  title,
  href,
  action = "Ver todo",
  subtitle,
  className,
}: {
  title: string;
  href?: string;
  action?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="flex shrink-0 items-center text-sm font-medium text-muted hover:text-fg">
          {action}
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

/** Horizontal scroll row that bleeds to the screen edge on mobile. */
export function HScroll({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("relative flex rounded-full border border-line bg-ink-900 p-1", className)} role="tablist">
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 flex-1 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors",
              active ? "text-ink-950" : "text-muted hover:text-fg"
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${options.map(x => x.value).join("")}`}
                className="absolute inset-0 -z-10 rounded-full bg-fg"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition active:scale-95",
        active ? "border-fg bg-fg text-ink-950" : "border-line-strong bg-fg/6 text-fg/85 hover:text-fg",
        className
      )}
    >
      {children}
    </button>
  );
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  color = "var(--color-brand)",
  track = "rgb(128 136 152 / 0.25)",
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Bar({ value, color = "var(--color-brand)", className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-fg/12", className)}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-snappy"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }}
      />
    </div>
  );
}

export function Avatar({ name, hue, size = 40, ring = false }: { name: string; hue: number; size?: number; ring?: boolean }) {
  return (
    <div
      className={cn("grid shrink-0 place-items-center rounded-full font-bold text-white", ring && "ring-2 ring-ink-950")}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 80% 58%), hsl(${(hue + 40) % 360} 70% 38%))`,
      }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-fg/6 text-muted">{icon}</div>
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, unit, className }: { label: string; value: ReactNode; unit?: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="tabular text-xl font-bold tracking-tight">
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-muted">{unit}</span>}
      </div>
      <div className="truncate text-[12px] text-muted">{label}</div>
    </div>
  );
}

/** Bottom sheet on phones, centered dialog from `sm` up. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className={cn(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-line bg-ink-900 sm:max-w-lg sm:rounded-[28px]",
              className
            )}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-fg/15 sm:hidden" />
            {title && (
              <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
                <h3 className="text-lg font-bold">{title}</h3>
                <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-fg/6 text-muted hover:text-fg" aria-label="Cerrar">
                  <X className="size-4" />
                </button>
              </div>
            )}
            <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 rounded-2xl bg-fg/5 p-1", className)}>
      <button
        className="grid size-9 place-items-center rounded-xl text-lg text-muted hover:bg-fg/8 hover:text-fg"
        onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}
        aria-label="Restar"
      >
        −
      </button>
      <input
        inputMode="decimal"
        className="tabular w-14 bg-transparent text-center font-semibold outline-none"
        value={value}
        onChange={e => {
          const n = Number(e.target.value.replace(",", "."));
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
      {suffix && <span className="-ml-2 pr-1 text-xs text-muted">{suffix}</span>}
      <button
        className="grid size-9 place-items-center rounded-xl text-lg text-muted hover:bg-fg/8 hover:text-fg"
        onClick={() => onChange(Math.round((value + step) * 100) / 100)}
        aria-label="Sumar"
      >
        +
      </button>
    </div>
  );
}

export function PageHeader({
  title,
  eyebrow,
  back,
  actions,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  back?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-5 flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-fg">
            <ChevronRight className="size-4 rotate-180" /> Volver
          </Link>
        )}
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="title-display text-[40px] sm:text-5xl">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 rounded-full transition-colors", checked ? "bg-success" : "bg-fg/12")}
    >
      <span
        className={cn(
          "absolute left-0 top-1 size-5 rounded-full bg-white shadow transition-transform duration-300 ease-snappy",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}
