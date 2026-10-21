import { Link } from "wouter";
import { DemoThumb } from "@/components/technique/FormDemo";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <DemoThumb demoId="plank" animate className="h-40" />
      <h1 className="title-display mt-4 text-6xl">404</h1>
      <p className="mt-1 text-muted">Esta página se fue a descansar entre series.</p>
      <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-fg px-6 font-semibold text-ink-950">
        Volver al inicio
      </Link>
    </div>
  );
}
