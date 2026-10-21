import { Bell, BellRing, Clapperboard } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { resolvePlayback } from "@/config/streaming";
import { cn } from "@/lib/utils";

/**
 * Plays an .mp4, an HLS stream (native on Safari/iOS, hls.js elsewhere,
 * loaded only when needed) or a YouTube embed. With no source yet it
 * renders `placeholder`, so screens never show a broken player while the
 * real videos are being recorded.
 */
export function VideoPlayer({
  src,
  poster,
  live,
  startAt = 0,
  onProgress,
  placeholder,
  className,
}: {
  src?: string;
  poster?: string;
  live?: boolean;
  startAt?: number;
  onProgress?: (seconds: number) => void;
  placeholder: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const playback = resolvePlayback(src, poster);

  useEffect(() => {
    const video = ref.current;
    if (!video || playback.kind !== "hls") return;
    let destroy: (() => void) | undefined;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playback.url;
    } else {
      import("hls.js").then(({ default: Hls }) => {
        if (!Hls.isSupported()) return;
        const hls = new Hls({ lowLatencyMode: !!live });
        hls.loadSource(playback.url);
        hls.attachMedia(video);
        destroy = () => hls.destroy();
      });
    }
    return () => destroy?.();
  }, [playback.kind, playback.kind === "hls" ? playback.url : "", live]);

  if (playback.kind === "none") return <>{placeholder}</>;

  if (playback.kind === "youtube") {
    return (
      <div className={cn("relative aspect-video overflow-hidden rounded-3xl bg-black", className)}>
        <iframe
          className="absolute inset-0 size-full"
          src={`https://www.youtube-nocookie.com/embed/${playback.id}?rel=0&modestbranding=1${startAt ? `&start=${Math.floor(startAt)}` : ""}`}
          title="Video"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-3xl bg-black", className)}>
      <video
        ref={ref}
        className="size-full"
        src={playback.kind === "file" ? playback.url : undefined}
        poster={playback.poster}
        controls
        playsInline
        preload="metadata"
        autoPlay={live}
        onLoadedMetadata={e => {
          if (startAt && !live) e.currentTarget.currentTime = startAt;
        }}
        onTimeUpdate={e => onProgress?.(e.currentTarget.currentTime)}
      />
      {live && (
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-brand px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
          <span className="size-1.5 animate-pulse rounded-full bg-white" /> En vivo
        </span>
      )}
    </div>
  );
}

/** What a video slot shows while the real clip is still being recorded. */
export function InProduction({
  art,
  title = "Grabación en producción",
  text = "Estamos grabando este video con nuestros coaches. Mientras tanto, sigue la demostración animada y las claves de técnica.",
  notified,
  onNotify,
  className,
}: {
  art: ReactNode;
  title?: string;
  text?: string;
  notified?: boolean;
  onNotify?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-3xl border border-line", className)}>
      <div className="absolute inset-0">{art}</div>
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/95 via-ink-950/55 to-ink-950/10" />
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-fg backdrop-blur">
          <Clapperboard className="size-3.5" /> {title}
        </div>
        <p className="max-w-md text-sm text-fg/80">{text}</p>
        {onNotify && (
          <button
            onClick={onNotify}
            className={cn(
              "mt-3 inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition active:scale-95",
              notified ? "bg-success/15 text-success" : "bg-fg text-ink-950"
            )}
          >
            {notified ? <BellRing className="size-4" /> : <Bell className="size-4" />}
            {notified ? "Te avisaremos" : "Avísame cuando salga"}
          </button>
        )}
      </div>
    </div>
  );
}
