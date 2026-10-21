import { motion } from "framer-motion";
import { Bot, CheckCircle2, Headset, LifeBuoy, Mail, MessageCircle, Send, Ticket as TicketIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button, Segmented, Sheet } from "@/components/ui";
import { searchFaqs, SUPPORT_CATEGORY_LABEL, SUPPORT_EMAIL, SUPPORT_WHATSAPP, type Faq, type SupportCategory } from "@/data/support";
import { useAuth } from "@/lib/auth";
import { actions, useApp, type Ticket } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/*
 * Support, everywhere: a floating button on every screen opens the
 * assistant (instant answers from data/support.ts, day and night), direct
 * contact (WhatsApp / email when configured) and tickets for the team.
 */

interface Msg {
  from: "bot" | "tu";
  text: string;
  faqs?: Faq[];
  escalate?: boolean;
}

const QUICK = ["Problema con un pago", "Cancelar mi plan", "No puedo iniciar sesión", "¿Cómo registro una comida?", "Siento dolor en un ejercicio", "Hablar con una persona"];

let openSupport: ((tab?: "asistente" | "contacto" | "tickets") => void) | null = null;
/** Opens the support panel from anywhere (help center, error states…). */
export const showSupport = (tab?: "asistente" | "contacto" | "tickets") => openSupport?.(tab);

async function submitTicket(t: Ticket) {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("af_support_tickets").insert({ user_id: data.user.id, ref: t.id, category: t.category, subject: t.subject, message: t.message });
}

export function SupportWidget() {
  const [loc, navigate] = useLocation();
  const { user } = useAuth();
  const active = useApp(s => s.active);
  const tickets = useApp(s => s.tickets);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"asistente" | "contacto" | "tickets">("asistente");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [cat, setCat] = useState<SupportCategory>("pagos");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState<Ticket | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    openSupport = t => {
      if (t) setTab(t);
      setOpen(true);
    };
    return () => {
      openSupport = null;
    };
  }, []);

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([
        {
          from: "bot",
          text: `Hola${user ? `, ${user.name.split(" ")[0]}` : ""}. Soy el asistente de American Fit y respondo al instante, a cualquier hora. ¿En qué te ayudo?`,
        },
      ]);
    }
  }, [open, msgs.length, user]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  if (loc.startsWith("/entrenar/sesion")) return null;

  const ask = (q: string) => {
    if (!q.trim()) return;
    const human = /persona|humano|asesor|agente|hablar con/i.test(q);
    const faqs = human ? [] : searchFaqs(q);
    const reply: Msg = human
      ? { from: "bot", text: "Claro. Escríbele al equipo y te responde una persona. Elige cómo:", escalate: true }
      : faqs.length
        ? { from: "bot", text: faqs[0]!.a, faqs }
        : { from: "bot", text: "No encontré una respuesta exacta para eso. Puedo pasarle tu caso al equipo para que una persona te responda.", escalate: true };
    setMsgs(m => [...m, { from: "tu", text: q }, reply]);
    setText("");
  };

  const send = () => {
    if (!subject.trim() || !body.trim()) return;
    const t = actions.addTicket({ category: cat, subject: subject.trim(), message: body.trim() });
    void submitTicket(t);
    setSent(t);
    setSubject("");
    setBody("");
  };

  const bottom = active ? "bottom-[calc(170px+env(safe-area-inset-bottom))]" : "bottom-[calc(98px+env(safe-area-inset-bottom))]";

  return (
    <>
      <motion.button
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setOpen(true)}
        className={cn(
          "fixed right-4 z-40 grid size-14 place-items-center rounded-full bg-sky text-white shadow-[0_10px_30px_-6px_rgb(60_123_255/0.7)] ring-4 ring-ink-950 transition active:scale-95 lg:bottom-6 lg:flex lg:h-14 lg:w-auto lg:gap-2 lg:pl-4 lg:pr-5 lg:text-[15px] lg:font-bold",
          user ? bottom : "bottom-[max(1rem,env(safe-area-inset-bottom))]"
        )}
        aria-label="Abrir soporte"
      >
        <Headset className="size-6" /> <span className="hidden lg:inline">Ayuda</span>
      </motion.button>

      <Sheet open={open} onClose={() => setOpen(false)} title={<span className="flex items-center gap-2"><LifeBuoy className="size-5 text-sky" /> Soporte 24/7</span>} className="sm:max-w-lg">
        <div className="pb-3">
          <Segmented
            value={tab}
            onChange={v => {
              setTab(v);
              setSent(null);
            }}
            options={[
              { value: "asistente", label: "Asistente" },
              { value: "contacto", label: "Escribir" },
              { value: "tickets", label: `Mis casos${tickets.length ? ` · ${tickets.length}` : ""}` },
            ]}
          />

          {tab === "asistente" && (
            <div className="mt-4 flex h-[56dvh] flex-col">
              <div ref={list} className="flex-1 space-y-3 overflow-y-auto pr-1">
                {msgs.map((m, i) => (
                  <div key={i} className={cn("flex gap-2", m.from === "tu" && "flex-row-reverse")}>
                    {m.from === "bot" && (
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sky text-white">
                        <Bot className="size-5" />
                      </span>
                    )}
                    <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed", m.from === "tu" ? "bg-brand text-white" : "border border-line-strong bg-ink-850 text-fg")}>
                      {m.text}
                      {m.faqs?.[0]?.action && (
                        <button
                          onClick={() => {
                            setOpen(false);
                            navigate(m.faqs![0]!.action!.href);
                          }}
                          className="mt-3 flex h-10 w-full items-center justify-center rounded-full bg-fg text-sm font-bold text-ink-950"
                        >
                          {m.faqs[0].action.label}
                        </button>
                      )}
                      {m.faqs && m.faqs.length > 1 && (
                        <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                          <div className="text-sm font-semibold">También te puede servir:</div>
                          {m.faqs.slice(1).map(f => (
                            <button key={f.id} onClick={() => ask(f.q)} className="block w-full rounded-xl bg-fg/8 px-3 py-2 text-left text-sm font-medium hover:bg-fg/12">
                              {f.q}
                            </button>
                          ))}
                        </div>
                      )}
                      {m.escalate && (
                        <div className="mt-3 grid gap-2">
                          <button onClick={() => setTab("contacto")} className="flex h-10 items-center justify-center gap-2 rounded-full bg-fg text-sm font-bold text-ink-950">
                            <TicketIcon className="size-4" /> Crear caso para el equipo
                          </button>
                          {SUPPORT_WHATSAPP && (
                            <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-2 rounded-full bg-[#25d366] text-sm font-bold text-[#06210f]">
                              <MessageCircle className="size-4" /> WhatsApp
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-2">
                {QUICK.map(q => (
                  <button key={q} onClick={() => ask(q)} className="h-10 shrink-0 rounded-full border-2 border-line-strong px-4 text-sm font-semibold text-fg hover:bg-fg/8">
                    {q}
                  </button>
                ))}
              </div>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  ask(text);
                }}
                className="flex gap-2"
              >
                <label htmlFor="af-support-q" className="sr-only">
                  Escribe tu pregunta
                </label>
                <input id="af-support-q" value={text} onChange={e => setText(e.target.value)} placeholder="Escribe tu pregunta…" className="h-12 flex-1 rounded-full border-2 border-line-strong bg-ink-850 px-4 text-[15px] outline-none placeholder:text-muted focus:border-sky" />
                <button type="submit" className="grid size-12 place-items-center rounded-full bg-sky text-white" aria-label="Enviar pregunta">
                  <Send className="size-5" />
                </button>
              </form>
            </div>
          )}

          {tab === "contacto" && (
            <div className="mt-4 space-y-4">
              {sent ? (
                <div className="rounded-2xl border-2 border-success/50 bg-success/12 p-5 text-center">
                  <CheckCircle2 className="mx-auto size-10 text-success" />
                  <div className="mt-2 text-lg font-bold">Caso {sent.id} creado</div>
                  <p className="mt-1 text-[15px] text-fg">El equipo te responderá aquí, en “Mis casos”, y a tu correo {user?.email}.</p>
                  <Button className="mt-4" onClick={() => setTab("tickets")}>
                    Ver mis casos
                  </Button>
                </div>
              ) : (
                <>
                  {(SUPPORT_WHATSAPP || SUPPORT_EMAIL) && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {SUPPORT_WHATSAPP && (
                        <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#25d366] font-bold text-[#06210f]">
                          <MessageCircle className="size-5" /> WhatsApp
                        </a>
                      )}
                      {SUPPORT_EMAIL && (
                        <div className="flex h-12 items-center justify-center gap-2 rounded-full border-2 border-line-strong text-sm font-semibold">
                          <Mail className="size-5" /> <span className="select-all">{SUPPORT_EMAIL}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label htmlFor="af-ticket-cat" className="mb-1.5 block text-[15px] font-bold">
                      Tema
                    </label>
                    <select id="af-ticket-cat" value={cat} onChange={e => setCat(e.target.value as SupportCategory)} className="h-12 w-full rounded-2xl border-2 border-line-strong bg-ink-850 px-4 text-[15px] outline-none">
                      {(Object.keys(SUPPORT_CATEGORY_LABEL) as SupportCategory[]).map(c => (
                        <option key={c} value={c}>
                          {SUPPORT_CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="af-ticket-subject" className="mb-1.5 block text-[15px] font-bold">
                      Asunto
                    </label>
                    <input id="af-ticket-subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ej.: me cobraron dos veces" className="h-12 w-full rounded-2xl border-2 border-line-strong bg-ink-850 px-4 text-[15px] outline-none placeholder:text-muted focus:border-sky" />
                  </div>
                  <div>
                    <label htmlFor="af-ticket-body" className="mb-1.5 block text-[15px] font-bold">
                      Cuéntanos qué pasó
                    </label>
                    <textarea id="af-ticket-body" value={body} onChange={e => setBody(e.target.value)} rows={5} placeholder="Incluye la referencia del pago si es sobre un cobro." className="w-full rounded-2xl border-2 border-line-strong bg-ink-850 p-4 text-[15px] outline-none placeholder:text-muted focus:border-sky" />
                  </div>
                  <Button size="lg" className="w-full" disabled={!subject.trim() || !body.trim()} onClick={send}>
                    <Send className="size-5" /> Enviar al equipo
                  </Button>
                </>
              )}
            </div>
          )}

          {tab === "tickets" && (
            <div className="mt-4 space-y-3">
              {tickets.length === 0 ? (
                <p className="rounded-2xl border-2 border-line-strong p-5 text-center text-[15px]">No tienes casos abiertos. Si algo no funciona, el asistente responde al instante.</p>
              ) : (
                tickets.map(t => (
                  <div key={t.id} className="rounded-2xl border-2 border-line-strong p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{t.subject}</span>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", t.status === "resuelto" ? "bg-success/20 text-success" : "bg-warn/20 text-warn")}>
                        {t.status === "resuelto" ? "Resuelto" : t.status === "en-revision" ? "En revisión" : "Abierto"}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-fg">
                      {t.id} · {SUPPORT_CATEGORY_LABEL[t.category as SupportCategory] ?? t.category} · {new Date(t.at).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <p className="mt-2 text-[15px]">{t.message}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}

/** Small inline "¿Necesitas ayuda?" button for pages (checkout, errors…). */
export function HelpLink({ label = "¿Necesitas ayuda? Escríbenos", className }: { label?: string; className?: string }) {
  return (
    <button onClick={() => showSupport("asistente")} className={cn("inline-flex items-center gap-2 text-[15px] font-bold text-sky-300 hover:underline", className)}>
      <Headset className="size-5" /> {label}
    </button>
  );
}
