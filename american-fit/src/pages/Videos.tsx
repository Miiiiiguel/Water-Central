import { Clapperboard, Heart, Play, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ClassArt } from "@/components/video/ClassArt";
import { Avatar, Badge, Chip, HScroll, PageHeader, SectionHeader } from "@/components/ui";
import { hasVideo } from "@/config/streaming";
import { COACH_BY_ID } from "@/data/coaches";
import { LEVEL_LABEL } from "@/data/exercises";
import { CATEGORY_HUE, CATEGORY_LABEL, SERIES, VIDEOS } from "@/data/media";
import { useApp } from "@/lib/store";
import type { ClassCategory, VideoClass } from "@/lib/types";
import { cn, normalize } from "@/lib/utils";

export function VideoCard({ v, wide, progress }: { v: VideoClass; wide?: boolean; progress?: number }) {
  const coach = COACH_BY_ID[v.coachId]!;
  return (
    <Link href={`/videos/${v.id}`} className={cn("group block", wide ? "w-72 shrink-0 snap-start sm:w-80" : "")}>
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-line">
        <div className="size-full transition-transform duration-500 ease-snappy group-hover:scale-[1.04]">
          <ClassArt hue={CATEGORY_HUE[v.category]} word={CATEGORY_LABEL[v.category]} category={v.category} />
        </div>
        <div className="absolute left-2 top-2 flex gap-1.5">
          {v.isNew && <Badge tone="sky">Nuevo</Badge>}
          {v.isReplay && <Badge tone="brand">Repetición</Badge>}
          {!hasVideo(v.video.src) && (
            <Badge tone="neutral" className="bg-black/50 text-fg/90 backdrop-blur">
              <Clapperboard className="size-3" /> Próximamente
            </Badge>
          )}
        </div>
        <span className="absolute bottom-2 right-2 rounded-md bg-black/65 px-1.5 py-0.5 text-xs font-semibold tabular">{v.durationMin} min</span>
        <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="grid size-12 place-items-center rounded-full bg-white/90 text-ink-950">
            <Play className="size-5 translate-x-px" fill="currentColor" />
          </span>
        </span>
        {progress !== undefined && progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <div className="h-full bg-brand" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-2.5">
        <Avatar name={coach.name} hue={coach.hue} size={30} />
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold leading-snug">{v.title}</div>
          <div className="truncate text-xs text-muted">
            {coach.name} · {LEVEL_LABEL[v.level]}
            {v.kcal > 0 ? ` · ${v.kcal} kcal` : ""}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Videos() {
  const watched = useApp(s => s.watched);
  const favs = useApp(s => s.favorites.videos);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ClassCategory | "fav" | null>(null);
  const [dur, setDur] = useState<"short" | "mid" | "long" | null>(null);

  const featured = VIDEOS.find(v => v.isNew)!;
  const filtering = !!(q || cat || dur);
  const results = useMemo(() => {
    const nq = normalize(q);
    return VIDEOS.filter(v => {
      if (cat === "fav" && !favs.includes(v.id)) return false;
      if (cat && cat !== "fav" && v.category !== cat) return false;
      if (dur === "short" && v.durationMin > 20) return false;
      if (dur === "mid" && (v.durationMin <= 20 || v.durationMin > 40)) return false;
      if (dur === "long" && v.durationMin <= 40) return false;
      if (nq && !normalize(`${v.title} ${COACH_BY_ID[v.coachId]?.name} ${CATEGORY_LABEL[v.category]}`).includes(nq)) return false;
      return true;
    });
  }, [q, cat, dur, favs]);
  const continuing = VIDEOS.filter(v => watched[v.id]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Clases a demanda" title={<>American Fit <span className="text-gradient-brand">TV</span></>} />

      {!filtering && (
        <Link href={`/videos/${featured.id}`} className="group relative block overflow-hidden rounded-[28px] border border-line">
          <div className="aspect-[4/3] sm:aspect-[16/6]">
            <ClassArt hue={CATEGORY_HUE[featured.category]} word={CATEGORY_LABEL[featured.category]} category={featured.category} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/80 to-ink-950/30" />
          <div className="absolute inset-y-0 left-0 flex max-w-lg flex-col justify-end p-6 sm:p-10">
            <Badge tone="sky">Estreno</Badge>
            <h2 className="title-display mt-2 text-4xl sm:text-6xl">{featured.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-fg/90">{featured.description}</p>
            <span className="mt-4 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-fg px-5 text-sm font-bold text-ink-950">
              <Play className="size-4" fill="currentColor" /> Ver ahora
            </span>
          </div>
        </Link>
      )}

      <div className="space-y-3">
        <label className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-ink-900 px-4">
          <Search className="size-4 text-muted" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar clases, coaches…" className="flex-1 bg-transparent outline-none placeholder:text-muted" />
          {q && (
            <button onClick={() => setQ("")} aria-label="Limpiar">
              <X className="size-4 text-muted" />
            </button>
          )}
        </label>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <Chip active={cat === "fav"} onClick={() => setCat(cat === "fav" ? null : "fav")}>
            <Heart className="size-3.5" /> Mi lista
          </Chip>
          {(Object.keys(CATEGORY_LABEL) as ClassCategory[]).map(c => (
            <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? null : c)}>
              {CATEGORY_LABEL[c]}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 bg-line" />
          {(
            [
              ["short", "≤ 20 min"],
              ["mid", "20–40 min"],
              ["long", "40+ min"],
            ] as const
          ).map(([k, l]) => (
            <Chip key={k} active={dur === k} onClick={() => setDur(dur === k ? null : k)}>
              {l}
            </Chip>
          ))}
        </div>
      </div>

      {filtering ? (
        <section>
          <div className="mb-3 text-sm text-muted">{results.length} clases</div>
          <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(v => (
              <VideoCard key={v.id} v={v} progress={watched[v.id] ? watched[v.id]! / (v.durationMin * 60) : undefined} />
            ))}
          </div>
        </section>
      ) : (
        <>
          {continuing.length > 0 && (
            <section>
              <SectionHeader title="Continuar viendo" />
              <HScroll>
                {continuing.map(v => (
                  <VideoCard key={v.id} v={v} wide progress={watched[v.id]! / (v.durationMin * 60)} />
                ))}
              </HScroll>
            </section>
          )}
          {SERIES.map(s => {
            const eps = VIDEOS.filter(v => v.seriesId === s.id).sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0));
            return (
              <section key={s.id}>
                <SectionHeader title={s.title} subtitle={s.subtitle} />
                <HScroll>
                  {eps.map(v => (
                    <VideoCard key={v.id} v={v} wide />
                  ))}
                </HScroll>
              </section>
            );
          })}
          <section>
            <SectionHeader title="Todas las clases" />
            <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {VIDEOS.filter(v => !v.seriesId).map(v => (
                <VideoCard key={v.id} v={v} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
