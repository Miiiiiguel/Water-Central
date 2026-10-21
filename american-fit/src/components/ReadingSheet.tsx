import { Contrast, Moon, Sun, SunMoon } from "lucide-react";
import { Sheet, Toggle } from "@/components/ui";
import { setPrefs, usePrefs, type TextSize, type Theme } from "@/lib/prefs";
import { cn } from "@/lib/utils";

/** "Pantalla y lectura": theme, high contrast and text size, one tap away. */
export function ReadingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = usePrefs();
  return (
    <Sheet open={open} onClose={onClose} title="Pantalla y lectura">
      <div className="space-y-6 pb-3">
        <div>
          <div className="mb-2 text-[15px] font-bold">Tema</div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["auto", "Automático", <SunMoon key="a" className="size-6" />],
                ["light", "Claro", <Sun key="l" className="size-6" />],
                ["dark", "Oscuro", <Moon key="d" className="size-6" />],
              ] as [Theme, string, React.ReactNode][]
            ).map(([v, label, icon]) => (
              <button
                key={v}
                onClick={() => setPrefs({ theme: v })}
                aria-pressed={p.theme === v}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl border-2 py-3 text-sm font-bold",
                  p.theme === v ? "border-brand bg-brand/12 text-fg" : "border-line-strong text-fg"
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-fg">El tema claro se lee mejor a pleno sol o en el gimnasio con mucha luz.</p>
        </div>

        <div>
          <div className="mb-2 text-[15px] font-bold">Tamaño de letra</div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["normal", "Normal", "text-base"],
                ["grande", "Grande", "text-xl"],
                ["extra", "Muy grande", "text-2xl"],
              ] as [TextSize, string, string][]
            ).map(([v, label, cls]) => (
              <button
                key={v}
                onClick={() => setPrefs({ size: v })}
                aria-pressed={p.size === v}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl border-2 py-3 text-sm font-bold",
                  p.size === v ? "border-brand bg-brand/12" : "border-line-strong"
                )}
              >
                <span className={cn("font-bold leading-none", cls)}>Aa</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border-2 border-line-strong p-4">
          <Contrast className="size-6 shrink-0" />
          <div className="flex-1">
            <div className="text-[15px] font-bold">Alto contraste</div>
            <div className="text-sm text-fg">Blanco y negro puros con bordes marcados.</div>
          </div>
          <Toggle checked={p.contrast} onChange={v => setPrefs({ contrast: v })} label="Alto contraste" />
        </div>
      </div>
    </Sheet>
  );
}
