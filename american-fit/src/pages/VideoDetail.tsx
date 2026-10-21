import { Check, CheckCircle2, Dumbbell, Flame, Gauge, Heart, ListVideo, Timer } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "wouter";
import { ClassArt } from "@/components/video/ClassArt";
import { InProduction, VideoPlayer } from "@/components/video/VideoPlayer";
import { Avatar, Button, HScroll, SectionHeader } from "@/components/ui";
import { COACH_BY_ID } from "@/data/coaches";
import { EQUIPMENT_LABEL, LEVEL_LABEL } from "@/data/exercises";
import { CATEGORY_HUE, CATEGORY_LABEL, SERIES, VIDEO_BY_ID, VIDEOS } from "@/data/media";
import { actions, useApp } from "@/lib/store";
import { cn, fmtDuration } from "@/lib/utils";
import NotFound from "./NotFound";
import { VideoCard } from "./Videos";

export default function VideoDetail() {
  const { id } = useParams<{ id: string }>();
  const v = VIDEO_BY_ID[id];
  const fav = useApp(s => s.favorites.videos.includes(id));
  const watched = useApp(s => s.watched[id] ?? 0);
  const reminders = useApp(s => s.reminders);
  const [done, setDone] = useState(false);
  if (!v) return <NotFound />;
  const coach = COACH_BY_ID[v.coachId]!;
  const series = v.seriesId ? SERIES.find(s => s.id === v.seriesId) : undefined;
  const episodes = series ? VIDEOS.filter(x => x.seriesId === series.id).sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0)) : [];
  const more = VIDEOS.filter(x => x.coachId === v.coachId && x.id !== v.id);
  const notifyKey = `video:${v.id}`;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Link href="/videos" className="inline-flex text-[13px] font-medium text-muted hover:text-fg">
            ← American Fit TV
          </Link>
          <VideoPlayer
            src={v.video.src}
            poster={v.video.poster}
            startAt={watched}
            onProgress={s => {
              if (Math.abs(s - watched) > 5) actions.setWatched(v.id, Math.floor(s));
            }}
            placeholder={
              <InProduction
                art={<ClassArt hue={CATEGORY_HUE[v.category]} word={CATEGORY_LABEL[v.category]} category={v.category} />}
                text={`${coach.name} está grabando esta clase. Activa el aviso y te notificamos el día del estreno.`}
                notified={reminders.includes(notifyKey)}
                onNotify={() => actions.toggleReminder(notifyKey)}
              />
            }
          />
          <div>
            {series && (
              <div className="eyebrow mb-1">
                {series.title} · Episodio {v.episode}
              </div>
            )}
            <h1 className="title-display text-4xl sm:text-5xl">{v.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/coaches/${coach.id}`} className="mr-2 flex items-center gap-2.5">
              <Avatar name={coach.name} hue={coach.hue} size={40} />
              <div>
                <div className="text-sm font-semibold">{coach.name}</div>
                <div className="text-xs text-muted">{coach.role}</div>
              </div>
            </Link>
            <Button variant="secondary" size="sm" onClick={() => actions.toggleFavorite("videos", v.id)}>
              <Heart className={cn("size-4", fav && "text-brand")} fill={fav ? "currentColor" : "none"} /> {fav ? "En mi lista" : "Mi lista"}
            </Button>
            <Button
              variant={done ? "secondary" : "primary"}
              size="sm"
              disabled={done}
              onClick={() => {
                actions.logClass(v.title, v.durationMin);
                setDone(true);
              }}
            >
              {done ? <CheckCircle2 className="size-4 text-success" /> : <Check className="size-4" />} {done ? "Registrada" : "Marcar como hecha"}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [<Timer key="t" className="size-4" />, `${v.durationMin} min`, "Duración"],
              [<Gauge key="g" className="size-4" />, LEVEL_LABEL[v.level], "Nivel"],
              [<Flame key="f" className="size-4" />, v.kcal ? `~${v.kcal}` : "—", "kcal"],
              [<Dumbbell key="d" className="size-4" />, v.equipment.map(e => EQUIPMENT_LABEL[e]).join(", "), "Material"],
            ].map(([icon, val, label]) => (
              <div key={label as string} className="card p-3">
                <div className="mb-1 text-muted">{icon}</div>
                <div className="truncate text-sm font-semibold">{val}</div>
                <div className="text-xs text-muted">{label}</div>
              </div>
            ))}
          </div>
          <p className="leading-relaxed text-fg/95">{v.description}</p>
          {v.chapters && (
            <div className="card divide-y divide-line">
              <div className="flex items-center gap-2 p-4 font-semibold">
                <ListVideo className="size-4" /> Capítulos
              </div>
              {v.chapters.map(ch => (
                <div key={ch.at} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="tabular w-12 text-muted">{fmtDuration(ch.at)}</span>
                  {ch.title}
                </div>
              ))}
            </div>
          )}
        </div>

        {episodes.length > 0 && (
          <aside className="lg:pt-8">
            <div className="card overflow-hidden">
              <div className="border-b border-line p-4">
                <div className="font-bold">{series!.title}</div>
                <div className="text-xs text-muted">{episodes.length} episodios</div>
              </div>
              <ul className="divide-y divide-line">
                {episodes.map(e => (
                  <li key={e.id}>
                    <Link href={`/videos/${e.id}`} className={cn("flex items-center gap-3 p-3 hover:bg-white/[0.03]", e.id === v.id && "bg-white/[0.05]")}>
                      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-xl">
                        <ClassArt hue={CATEGORY_HUE[e.category]} word="" category={e.category} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-muted">Episodio {e.episode}</div>
                        <div className="line-clamp-2 text-sm font-semibold">{e.title}</div>
                        <div className="text-xs text-muted">{e.durationMin} min</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>

      {more.length > 0 && (
        <section>
          <SectionHeader title={`Más de ${coach.name}`} href={`/coaches/${coach.id}`} action="Perfil" />
          <HScroll>
            {more.map(x => (
              <VideoCard key={x.id} v={x} wide />
            ))}
          </HScroll>
        </section>
      )}
    </div>
  );
}
