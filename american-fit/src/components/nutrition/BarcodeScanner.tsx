import { Camera, Keyboard, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * Camera barcode scanner using the browser's BarcodeDetector (Chrome on
 * Android, recent Safari). Where it is missing, or the camera is denied,
 * the code can be typed instead.
 */
export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "manual">("starting");
  const [manual, setManual] = useState("");

  useEffect(() => {
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setStatus("manual");
      return;
    }
    let stream: MediaStream | undefined;
    let raf = 0;
    let stopped = false;
    const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async s => {
        stream = s;
        if (!video.current || stopped) return;
        video.current.srcObject = s;
        await video.current.play();
        setStatus("scanning");
        const loop = async () => {
          if (stopped || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            if (codes[0]?.rawValue) {
              navigator.vibrate?.(60);
              onCode(codes[0].rawValue);
              return;
            }
          } catch {
            // Frame not ready yet.
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      })
      .catch(() => setStatus("manual"));
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [onCode]);

  return (
    <div className="space-y-4">
      {status !== "manual" && (
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-black">
          <video ref={video} className="size-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-10 top-1/2 h-28 -translate-y-1/2 rounded-2xl border-2 border-white/80 shadow-[0_0_0_999px_rgb(0_0_0/0.45)]">
            <div className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-brand" />
          </div>
          {status === "starting" && (
            <div className="absolute inset-0 grid place-items-center text-sm text-muted">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-3 text-center text-xs text-white/80">
            <Camera className="mr-1 inline size-3.5" /> Apunta al código de barras
          </div>
        </div>
      )}
      <form
        onSubmit={e => {
          e.preventDefault();
          if (manual.trim().length >= 6) onCode(manual.trim());
        }}
        className="flex gap-2"
      >
        <label className="flex h-12 flex-1 items-center gap-2 rounded-2xl border border-line bg-ink-850 px-4">
          <Keyboard className="size-4 text-muted" />
          <input
            inputMode="numeric"
            value={manual}
            onChange={e => setManual(e.target.value.replace(/\D/g, ""))}
            placeholder="O escribe el código"
            className="flex-1 bg-transparent outline-none"
          />
        </label>
        <Button type="submit" disabled={manual.length < 6}>
          Buscar
        </Button>
      </form>
    </div>
  );
}
