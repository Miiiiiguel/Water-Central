import { BookOpen, Info } from "lucide-react";
import { Link, useParams } from "wouter";
import { PageHeader } from "@/components/ui";
import { ARTICLE_BY_ID, ARTICLES } from "@/data/articles";
import NotFound from "./NotFound";

const CATEGORY: Record<string, string> = {
  nutricion: "Nutrición",
  entrenamiento: "Entrenamiento",
  recuperacion: "Recuperación",
  suplementos: "Suplementos",
};

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>();
  const a = ARTICLE_BY_ID[id];
  if (!a) return <NotFound />;
  const more = ARTICLES.filter(x => x.id !== a.id).slice(0, 3);
  return (
    <article className="mx-auto max-w-2xl">
      <PageHeader eyebrow={`${CATEGORY[a.category]} · ${a.minutes} min de lectura`} title={a.title} back="/nutricion" />
      <div className="grain relative mb-6 h-40 overflow-hidden rounded-3xl border border-line" style={{ background: `radial-gradient(80% 100% at 80% 0%, hsl(${a.hue} 85% 55% / 0.5), hsl(${a.hue} 40% 9%))` }}>
        <BookOpen className="absolute bottom-5 right-6 size-16 text-white/70" strokeWidth={1.2} />
      </div>
      <p className="mb-6 text-lg leading-relaxed text-fg/90">{a.summary}</p>
      <div className="space-y-5">
        {a.body.map((b, i) => (
          <section key={i}>
            {b.h && <h2 className="mb-1.5 text-xl font-bold">{b.h}</h2>}
            <p className="leading-relaxed text-fg/90">{b.p}</p>
          </section>
        ))}
      </div>
      <p className="mt-8 flex gap-2 rounded-2xl border border-line bg-white/[0.02] p-4 text-xs text-muted">
        <Info className="size-4 shrink-0" />
        Contenido educativo general, no sustituye el consejo de un profesional de la salud. Si tienes una condición médica, consulta a tu médico o nutricionista.
      </p>
      <h3 className="mb-3 mt-10 font-bold">Sigue leyendo</h3>
      <div className="space-y-2">
        {more.map(m => (
          <Link key={m.id} href={`/nutricion/guias/${m.id}`} className="card card-hover block p-4">
            <div className="font-semibold">{m.title}</div>
            <div className="text-sm text-muted">{m.summary}</div>
          </Link>
        ))}
      </div>
    </article>
  );
}
