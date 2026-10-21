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
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-brand px-2 py-1 text-xs font-bold uppercase tracking-wider text-white">
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
    <div className={cn("overflow-hidden rounded-3xl border border-line bg-ink-900", className)}>
      <div className="relative aspect-video">
        {art}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
          <Clapperboard className="size-4" /> {title}
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
        <p className="flex-1 text-[15px] leading-relaxed text-fg">{text}</p>
        {onNotify && (
          <button
            onClick={onNotify}
            className={cn(
              "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition active:scale-95",
              notified ? "bg-success/20 text-success" : "bg-fg text-ink-950"
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
