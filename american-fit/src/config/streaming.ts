/*
 * Where real video comes from.
 *
 * A video or live class `src` can be:
 *   - a full URL to an .mp4 or HLS .m3u8 (Bunny, Vimeo, S3/CloudFront…)
 *   - "mux:<playbackId>"          → Mux (recommended for live + VOD)
 *   - "cf:<videoId>"              → Cloudflare Stream (needs the customer
 *                                   code in VITE_CLOUDFLARE_STREAM_CODE)
 *   - "youtube:<videoId>"         → YouTube embed (handy for a first launch)
 *
 * Leave it empty while the clip is not recorded: the app shows a
 * "grabación en producción" state instead of a broken player.
 */

export type Playback =
  | { kind: "none" }
  | { kind: "file"; url: string; poster?: string }
  | { kind: "hls"; url: string; poster?: string }
  | { kind: "youtube"; id: string };

const CF_CODE = import.meta.env.VITE_CLOUDFLARE_STREAM_CODE as string | undefined;

export function resolvePlayback(src?: string, poster?: string): Playback {
  if (!src) return { kind: "none" };
  if (src.startsWith("mux:")) {
    const id = src.slice(4);
    return {
      kind: "hls",
      url: `https://stream.mux.com/${id}.m3u8`,
      poster: poster ?? `https://image.mux.com/${id}/thumbnail.webp?width=1280`,
    };
  }
  if (src.startsWith("cf:")) {
    const id = src.slice(3);
    if (!CF_CODE) return { kind: "none" };
    const base = `https://customer-${CF_CODE}.cloudflarestream.com/${id}`;
    return { kind: "hls", url: `${base}/manifest/video.m3u8`, poster: poster ?? `${base}/thumbnails/thumbnail.jpg` };
  }
  if (src.startsWith("youtube:")) return { kind: "youtube", id: src.slice(8) };
  if (/\.m3u8(\?|$)/.test(src)) return { kind: "hls", url: src, poster };
  return { kind: "file", url: src, poster };
}

/** True once a real clip or stream is wired up. */
export const hasVideo = (src?: string) => resolvePlayback(src).kind !== "none";
