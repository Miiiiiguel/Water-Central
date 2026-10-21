import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Bell, BellRing, Flame, Hand, Heart, Info, MessageCircle, Send, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { ClassArt } from "@/components/video/ClassArt";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Avatar, Badge, Segmented } from "@/components/ui";
import { COACH_BY_ID } from "@/data/coaches";
import { EQUIPMENT_LABEL, LEVEL_LABEL } from "@/data/exercises";
import { CATEGORY_HUE, CATEGORY_LABEL, isLiveNow, LIVE_BY_ID, nextOccurrence } from "@/data/media";
import { actions, useApp } from "@/lib/store";
import { cn, fmtDuration, fmtTime, seededRandom } from "@/lib/utils";
import { audience } from "./Live";
import NotFound from "./NotFound";

/*
 * The live room. Video comes from the class's `streamUrl` (HLS). Chat,
 * reactions and the leaderboard run on sample data until a realtime
 * backend is connected (Supabase Realtime, Mux Spaces, Stream Chat…);
 * the UI says "vista previa" while that is the case.
 */

const NAMES = ["Sofía", "Mateo", "Valeria", "Santiago", "Isabella", "Sebastián", "Camila", "Daniel", "Lucía", "Nicolás", "Mariana", "Alejandro", "Gabriela", "Tomás", "Emma", "Juan Pablo"];
const LINES = [
  "¡Vamos con todo! 🔥",
  "Primera vez en una clase en vivo 🙌",
  "¿Se puede hacer con mancuernas de 5 kg?",
  "Saludos desde Medellín 🇨🇴",
  "Saludos desde Miami 🇺🇸",
  "Ese ejercicio quema 😅",
  "Gracias coach, la corrección de la rodilla me ayudó",
  "💪💪💪",
  "¿Cuántas rondas faltan?",
  "Aquí desde la oficina en la hora de almuerzo",
  "Racha de 12 semanas 🔥",
  "Me encanta la música de hoy",
];

interface Msg {
  id: number;
  name: string;
  hue: number;
  text: string;
  me?: boolean;
  coach?: boolean;
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export default function LiveRoom() {
  const { id } = useParams<{ id: string }>();
  const c = LIVE_BY_ID[id];
  const now = useNow();
  const profile = useApp(s => s.profile);
  const reminders = useApp(s => s.reminders);
  const [tab, setTab] = useState<"chat" | "ranking" | "info">("chat");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [fived, setFived] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const rand = useMemo(() => seededRandom((c?.startMin ?? 1) * 31), [c]);

  useEffect(() => {
    if (!c) return;
    const coach = COACH_BY_ID[c.coachId]!;
    setMsgs([{ id: seq.current++, name: coach.name, hue: coach.hue, text: `¡Bienvenidos a ${c.title}! Calienten hombros y caderas mientras empezamos.`, coach: true }]);
    const t = setInterval(() => {
      const i = Math.floor(Math.random() * NAMES.length);
      setMsgs(m => [...m.slice(-60), { id: seq.current++, name: NAMES[i]!, hue: (i * 47) % 360, text: LINES[Math.floor(Math.random() * LINES.length)]! }]);
    }, 3200);
    return () => clearInterval(t);
  }, [c]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const board = useMemo(() => {
    const rows = NAMES.slice(0, 12).map((n, i) => ({ name: n, hue: (i * 47) % 360, pts: Math.round(400 + rand() * 900), me: false }));
    rows.push({ name: profile?.name ?? "Tú", hue: 352, pts: Math.round(500 + rand() * 500), me: true });
    return rows.sort((a, b) => b.pts - a.pts);
  }, [rand, profile]);

  if (!c) return <NotFound />;
  const coach = COACH_BY_ID[c.coachId]!;
  const start = nextOccurrence(c, now);
  const live = isLiveNow(c, now);
  const secs = (start.getTime() - now.getTime()) / 1000;
  const elapsed = live ? (now.getTime() - start.getTime()) / 1000 : 0;
  const reminded = reminders.includes(c.id);

  const send = () => {
    if (!text.trim()) return;
    setMsgs(m => [...m, { id: seq.current++, name: profile?.name ?? "Tú", hue: 352, text: text.trim(), me: true }]);
    setText("");
  };
  const react = (emoji: string) => {
    const b = { id: seq.current++, emoji, x: 10 + Math.random() * 70 };
    setBursts(x => [...x, b]);
    setTimeout(() => setBursts(x => x.filter(y => y.id !== b.id)), 1800);
  };

  const lobby = (
    <div className="relative aspect-video overflow-hidden rounded-3xl border border-line">
      <ClassArt hue={CATEGORY_HUE[c.category]} word={CATEGORY_LABEL[c.category]} category={c.category} />
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-[2px]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
        {live ? (
          <>
            <Badge tone="live">En vivo</Badge>
            <div className="title-display mt-3 text-4xl sm:text-5xl">La transmisión arranca en segundos</div>
            <p className="mt-2 max-w-sm text-sm text-muted">{coach.name} está preparando la cámara. Mantente en la sala.</p>
          </>
        ) : (
          <>
            <div className="eyebrow">La clase empieza en</div>
            <div className="tabular title-display mt-1 text-6xl sm:text-8xl">{fmtDuration(Math.max(0, secs))}</div>
            <p className="mt-1 text-sm text-muted">
              {start.toDateString() === now.toDateString() ? "Hoy" : start.toLocaleDateString("es", { weekday: "long" })} a las {fmtTime(start)}
            </p>
            <button
              onClick={() => actions.toggleReminder(c.id)}
              className={cn("mt-4 inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold", reminded ? "bg-success/15 text-success" : "bg-fg text-ink-950")}
            >
              {reminded ? <BellRing className="size-4" /> : <Bell className="size-4" />}
              {reminded ? "Reservada · te avisamos" : "Reservar y avisarme"}
            </button>
          </>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 overflow-hidden">
        <AnimatePresence>
          {bursts.map(b => (
            <motion.span
              key={b.id}
              initial={{ y: 40, opacity: 0, scale: 0.6 }}
              animate={{ y: -120, opacity: [0, 1, 0], scale: 1.3 }}
              transition={{ duration: 1.8, ease: "easeOut" }}
              className="absolute bottom-0 text-3xl"
              style={{ left: `${b.x}%` }}
            >
              {b.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="pt-3">
      <div className="mb-3 flex items-center gap-3">
        <Link href="/live" className="grid size-10 shrink-0 place-items-center rounded-full bg-white/6" aria-label="Volver a Live">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-bold">{c.title}</h1>
            {live && <Badge tone="live">Live</Badge>}
          </div>
          <div className="truncate text-xs text-muted">
            {coach.name} · {c.durationMin} min{live ? ` · ${fmtDuration(elapsed)} transcurridos` : ""}
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5 text-xs font-semibold">
          <Users className="size-3.5" /> {audience(c, now)}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-3">
          <VideoPlayer src={live ? c.streamUrl : undefined} live placeholder={lobby} />
          <div className="flex items-center gap-2">
            {["🔥", "💪", "👏", "❤️", "😅"].map(e => (
              <button key={e} onClick={() => react(e)} className="grid size-11 place-items-center rounded-full bg-white/6 text-xl transition active:scale-90">
                {e}
              </button>
            ))}
            <div className="ml-auto hidden items-center gap-2 text-sm text-muted sm:flex">
              <Flame className="size-4 text-ember" /> ~{c.kcal} kcal
            </div>
          </div>
        </div>

        <aside className="card flex h-[520px] flex-col overflow-hidden lg:h-[calc(100dvh-140px)]">
          <div className="border-b border-line p-2">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: "chat", label: <span className="inline-flex items-center gap-1.5"><MessageCircle className="size-3.5" /> Chat</span> },
                { value: "ranking", label: <span className="inline-flex items-center gap-1.5"><Trophy className="size-3.5" /> Ranking</span> },
                { value: "info", label: <span className="inline-flex items-center gap-1.5"><Info className="size-3.5" /> Clase</span> },
              ]}
            />
          </div>

          {tab === "chat" && (
            <>
              <div className="px-4 pt-2 text-[10px] uppercase tracking-wider text-faint">Vista previa · mensajes de ejemplo</div>
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {msgs.map(m => (
                  <div key={m.id} className={cn("flex gap-2.5", m.me && "flex-row-reverse")}>
                    <Avatar name={m.name} hue={m.hue} size={28} />
                    <div className={cn("max-w-[78%] rounded-2xl px-3 py-2", m.me ? "bg-brand/20" : m.coach ? "border border-sky/30 bg-sky/10" : "bg-white/6")}>
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                        {m.name}
                        {m.coach && <Badge tone="sky">Coach</Badge>}
                      </div>
                      <div className="text-sm">{m.text}</div>
                    </div>
                  </div>
                ))}
              </div>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  send();
                }}
                className="flex gap-2 border-t border-line p-3"
              >
                <input value={text} onChange={e => setText(e.target.value)} placeholder="Escribe al grupo…" className="h-11 flex-1 rounded-full bg-white/6 px-4 text-sm outline-none" />
                <button type="submit" className="grid size-11 place-items-center rounded-full bg-gradient-brand text-white" aria-label="Enviar">
                  <Send className="size-4" />
                </button>
              </form>
            </>
          )}

          {tab === "ranking" && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 pt-3 text-[10px] uppercase tracking-wider text-faint">Vista previa · puntos de esfuerzo de ejemplo</div>
              <ol className="divide-y divide-line">
                {board.map((r, i) => (
                  <li key={r.name} className={cn("flex items-center gap-3 px-4 py-2.5", r.me && "bg-brand/10")}>
                    <span className={cn("w-6 text-center text-sm font-bold tabular", i < 3 ? "text-warn" : "text-muted")}>{i + 1}</span>
                    <Avatar name={r.name} hue={r.hue} size={32} />
                    <span className="flex-1 truncate text-sm font-medium">{r.me ? `${r.name} (tú)` : r.name}</span>
                    <span className="tabular text-sm font-semibold">{r.pts}</span>
                    {!r.me && (
                      <button
                        onClick={() => setFived(f => (f.includes(r.name) ? f : [...f, r.name]))}
                        className={cn("grid size-8 place-items-center rounded-full", fived.includes(r.name) ? "bg-warn/20 text-warn" : "bg-white/6 text-muted hover:text-fg")}
                        aria-label={`Chocar los cinco con ${r.name}`}
                      >
                        <Hand className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {tab === "info" && (
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <Link href={`/coaches/${coach.id}`} className="flex items-center gap-3 rounded-2xl bg-white/4 p-3">
                <Avatar name={coach.name} hue={coach.hue} size={44} />
                <div className="min-w-0">
                  <div className="font-semibold">{coach.name}</div>
                  <div className="truncate text-xs text-muted">{coach.role}</div>
                </div>
              </Link>
              <p className="text-sm text-muted">{c.description}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <InfoBox label="Nivel" value={LEVEL_LABEL[c.level]} />
                <InfoBox label="Duración" value={`${c.durationMin} min`} />
                <InfoBox label="Categoría" value={CATEGORY_LABEL[c.category]} />
                <InfoBox label="Energía" value={c.kcal ? `~${c.kcal} kcal` : "—"} />
              </div>
              <div>
                <div className="eyebrow mb-2">Material</div>
                <div className="flex flex-wrap gap-1.5">
                  {(c.equipment.length ? c.equipment : ["bodyweight" as const]).map(e => (
                    <span key={e} className="rounded-full bg-white/6 px-3 py-1 text-xs">
                      {EQUIPMENT_LABEL[e]}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => react("❤️")} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/5 py-3 text-sm font-semibold text-muted hover:text-fg">
                <Heart className="size-4" /> Dar las gracias a {coach.name.split(" ")[0]}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/4 p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
