import { Check, Crown, Flame, Share2, Trophy, Users } from "lucide-react";
import { useMemo } from "react";
import { Avatar, Badge, Bar, Button, PageHeader, SectionHeader } from "@/components/ui";
import { CHALLENGES } from "@/data/media";
import { actions, useApp } from "@/lib/store";
import { seededRandom } from "@/lib/utils";

/*
 * Challenges and the weekly ranking. Other members are sample data until
 * accounts are connected (see README → Backend); the ranking says so.
 */

const MEMBERS = ["Valeria M.", "Andrés P.", "Camila R.", "Juan D.", "Sofía L.", "Mateo G.", "Daniela C.", "Felipe O.", "Laura V.", "Santiago B."];

export default function Community() {
  const profile = useApp(s => s.profile)!;
  const workouts = useApp(s => s.workouts);
  const joined = useApp(s => s.challenges);

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }, []);
  const myWeek = workouts.filter(w => w.startedAt >= weekStart);
  const myVolume = Math.round(myWeek.reduce((a, w) => a + w.volume, 0));

  const ranking = useMemo(() => {
    const r = seededRandom(7);
    const rows = MEMBERS.map((name, i) => ({ name, hue: (i * 53) % 360, volume: Math.round(3000 + r() * 14000), me: false }));
    rows.push({ name: profile.name, hue: 352, volume: myVolume, me: true });
    return rows.sort((a, b) => b.volume - a.volume);
  }, [profile.name, myVolume]);
  const myPos = ranking.findIndex(r => r.me) + 1;

  const progressFor = (id: string) => {
    if (id === "volumen-10k") {
      const month = new Date();
      month.setDate(1);
      month.setHours(0, 0, 0, 0);
      return Math.min(1, workouts.filter(w => w.startedAt >= month.getTime()).reduce((a, w) => a + w.volume, 0) / 10000);
    }
    if (id === "plancha-30") return Math.min(1, workouts.filter(w => w.exercises.some(e => e.exerciseId === "plancha")).length / 30);
    return 0;
  };

  const invite = async () => {
    const text = "Entrena conmigo en MyGym Community: técnica, clases en vivo y nutrición en una sola app.";
    try {
      if (navigator.share) await navigator.share({ title: "MyGym Community", text });
      else await navigator.clipboard.writeText(text);
    } catch {
      // Dismissed.
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Entrena acompañado"
        title="Comunidad"
        actions={
          <Button size="sm" variant="secondary" onClick={invite}>
            <Share2 className="size-4" /> Invitar
          </Button>
        }
      />

      <section>
        <SectionHeader title="Retos" subtitle="Únete, registra y gana insignias" />
        <div className="grid gap-3 sm:grid-cols-2">
          {CHALLENGES.map(c => {
            const on = joined.includes(c.id);
            const p = progressFor(c.id);
            return (
              <div key={c.id} className="card relative overflow-hidden p-5">
                <div className="absolute inset-0" style={{ background: `radial-gradient(80% 90% at 100% 0%, hsl(${c.hue} 85% 55% / 0.2), transparent 60%)` }} />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">{c.title}</h3>
                      <p className="text-sm text-muted">{c.description}</p>
                    </div>
                    <Trophy className="size-6 shrink-0" style={{ color: `hsl(${c.hue} 90% 65%)` }} />
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Users className="size-3.5" /> {c.participants.toLocaleString("es")} participantes
                    </span>
                    <span>{c.days} días</span>
                  </div>
                  <div className="mt-1 text-xs text-faint">Premio: {c.reward}</div>
                  {on && (
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-xs text-muted">
                        <span>Tu progreso</span>
                        <span className="tabular">{Math.round(p * 100)}%</span>
                      </div>
                      <Bar value={p} color={`hsl(${c.hue} 85% 60%)`} />
                    </div>
                  )}
                  <Button size="sm" variant={on ? "secondary" : "primary"} className="mt-4" onClick={() => actions.toggleChallenge(c.id)}>
                    {on ? <Check className="size-4" /> : <Flame className="size-4" />} {on ? "Unido" : "Unirme al reto"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader title="Ranking semanal" subtitle="Volumen total levantado esta semana" />
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line bg-brand/8 p-4">
            <div className="flex items-center gap-3">
              <Avatar name={profile.name} hue={352} size={40} />
              <div>
                <div className="font-semibold">Tu posición: #{myPos}</div>
                <div className="tabular text-xs text-muted">{myVolume.toLocaleString("es")} kg esta semana</div>
              </div>
            </div>
            <Badge tone="neutral">Vista previa</Badge>
          </div>
          <ol className="divide-y divide-line">
            {ranking.map((r, i) => (
              <li key={r.name} className={r.me ? "flex items-center gap-3 bg-brand/6 px-4 py-3" : "flex items-center gap-3 px-4 py-3"}>
                <span className="w-6 text-center font-bold tabular text-muted">{i === 0 ? <Crown className="mx-auto size-4 text-warn" /> : i + 1}</span>
                <Avatar name={r.name} hue={r.hue} size={34} />
                <span className="flex-1 truncate text-sm font-medium">{r.me ? `${r.name} (tú)` : r.name}</span>
                <span className="tabular text-sm font-semibold">{r.volume.toLocaleString("es")} kg</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
