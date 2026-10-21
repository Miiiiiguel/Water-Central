import { Salad } from "lucide-react";
import { DemoThumb } from "@/components/technique/FormDemo";
import { cn } from "@/lib/utils";
import type { ClassCategory } from "@/lib/types";

const CATEGORY_DEMO: Partial<Record<ClassCategory, string>> = {
  fuerza: "squat_barbell",
  hiit: "burpee",
  cardio: "jumping_jack",
  yoga: "hip_flexor_stretch",
  movilidad: "hip_flexor_stretch",
  core: "plank",
  baile: "jumping_jack",
  boxeo: "split_squat",
};

/**
 * Branded artwork used as a thumbnail until real posters exist: a hue
 * gradient, stripes, the category in display type and the technique
 * figure of that discipline.
 */
export function ClassArt({
  hue,
  word,
  category,
  demo,
  className,
  figure = true,
}: {
  hue: number;
  word: string;
  category?: ClassCategory;
  demo?: string;
  className?: string;
  figure?: boolean;
}) {
  const demoId = demo ?? (category ? CATEGORY_DEMO[category] : undefined);
  return (
    <div
      className={cn("grain relative size-full overflow-hidden", className)}
      style={{
        background: `radial-gradient(120% 90% at 85% 10%, hsl(${hue} 85% 55% / 0.85), transparent 55%), radial-gradient(90% 80% at 0% 100%, hsl(${(hue + 210) % 360} 80% 45% / 0.55), transparent 60%), linear-gradient(160deg, hsl(${hue} 45% 16%), #07090f 80%)`,
      }}
    >
      <div className="stripes absolute inset-0 opacity-70" />
      <span className="title-display pointer-events-none absolute -bottom-3 -left-1 select-none text-[86px] text-white/[0.07] sm:text-[110px]">
        {word}
      </span>
      {figure && demoId && (
        <div className="absolute inset-y-0 right-0 flex w-[62%] items-end justify-center opacity-90">
          <DemoThumb demoId={demoId} tile={false} className="h-[118%] w-auto drop-shadow-[0_10px_30px_rgb(0_0_0/0.5)]" />
        </div>
      )}
      {figure && category === "nutricion" && (
        <Salad className="absolute bottom-[18%] right-[14%] size-[38%] text-white/70" strokeWidth={1.2} />
      )}
    </div>
  );
}
