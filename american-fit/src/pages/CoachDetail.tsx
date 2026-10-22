import { Radio, Star } from "lucide-react";
import { Link, useParams } from "wouter";
import { Avatar, Badge, HScroll, SectionHeader } from "@/components/ui";
import { COACH_BY_ID } from "@/data/coaches";
import { LIVE_CLASSES, nextOccurrence, VIDEOS } from "@/data/media";
import { PROGRAMS } from "@/data/programs";
import { fmtTime, fmtWeekday } from "@/lib/utils";
import NotFound from "./NotFound";
import { VideoCard } from "./Videos";

export default function CoachDetail() {
  const { id } = useParams<{ id: string }>();
  const c = COACH_BY_ID[id];
  if (!c) return <NotFound />;
  const live = LIVE_CLASSES.filter(x => x.coachId === c.id)
    .map(x => ({ x, at: nextOccurrence(x) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const videos = VIDEOS.filter(v => v.coachId === c.id);
  const programs = PROGRAMS.filter(p => p.coachId === c.id);

  return (
    <div className="space-y-8">
      <section className="card grain relative overflow-hidden p-6 sm:p-10">
        <div className="absolute inset-0" style={{ background: `radial-gradient(70% 100% at 100% 0%, hsl(${c.hue} 85% 55% / 0.35), transparent 60%)` }} />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Avatar name={c.name} hue={c.hue} size={104} />
          <div>
            <Badge tone="brand">Coach MyGym</Badge>
            <h1 className="title-display mt-2 text-5xl sm:text-6xl">{c.name}</h1>
            <p className="text-fg/90">{c.role}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
              <span className="flex items-center gap-1">
                <Star className="size-4 text-warn" fill="currentColor" /> {c.rating}
              </span>
              <span>{c.classes} clases impartidas</span>
            </div>
          </div>
        </div>
        <p className="relative mt-5 max-w-2xl leading-relaxed text-fg/90">{c.bio}</p>
        <div className="relative mt-4 flex flex-wrap gap-2">
          {c.specialties.map(s => (
            <span key={s} className="rounded-full bg-black/30 px-3 py-1 text-sm backdrop-blur">
              {s}
            </span>
          ))}
        </div>
      </section>

      {live.length > 0 && (
        <section>
          <SectionHeader title="Próximas clases en vivo" />
          <div className="card divide-y divide-line">
            {live.map(({ x, at }) => (
              <Link key={x.id} href={`/live/${x.id}`} className="flex items-center gap-4 p-4 hover:bg-fg/[0.02]">
                <div className="w-14">
                  <div className="tabular font-bold">{fmtTime(at)}</div>
                  <div className="text-xs uppercase text-muted">{fmtWeekday(at)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{x.title}</div>
                  <div className="text-xs text-muted">{x.durationMin} min</div>
                </div>
                <Radio className="size-4 text-brand" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {videos.length > 0 && (
        <section>
          <SectionHeader title="Clases a demanda" />
          <HScroll>
            {videos.map(v => (
              <VideoCard key={v.id} v={v} wide />
            ))}
          </HScroll>
        </section>
      )}

      {programs.length > 0 && (
        <section>
          <SectionHeader title="Programas" />
          <div className="grid gap-3 sm:grid-cols-2">
            {programs.map(p => (
              <Link key={p.id} href={`/entrenar/programa/${p.id}`} className="card card-hover p-5">
                <h3 className="title-display text-3xl">{p.name}</h3>
                <p className="text-sm text-muted">{p.tagline}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
