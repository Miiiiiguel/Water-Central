import { ChevronDown, Headset, MessageCircle, Search, Ticket } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { showSupport } from "@/components/SupportWidget";
import { Chip, PageHeader } from "@/components/ui";
import { FAQS, searchFaqs, SUPPORT_CATEGORY_LABEL, SUPPORT_WHATSAPP, type SupportCategory } from "@/data/support";
import { cn } from "@/lib/utils";

export default function HelpCenter() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<SupportCategory | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(() => (q.trim().length > 2 ? searchFaqs(q, 8) : FAQS.filter(f => !cat || f.category === cat)), [q, cat]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Soporte 24/7" title="Centro de ayuda" />

      <div className="grid gap-3 sm:grid-cols-3">
        <button onClick={() => showSupport("asistente")} className="flex items-center gap-3 rounded-2xl bg-sky p-4 text-left text-white">
          <Headset className="size-7 shrink-0" />
          <span>
            <span className="block text-[16px] font-bold">Asistente</span>
            <span className="block text-sm text-white">Responde al instante</span>
          </span>
        </button>
        <button onClick={() => showSupport("contacto")} className="flex items-center gap-3 rounded-2xl bg-fg p-4 text-left text-ink-950">
          <Ticket className="size-7 shrink-0" />
          <span>
            <span className="block text-[16px] font-bold">Escribir al equipo</span>
            <span className="block text-sm">Te responde una persona</span>
          </span>
        </button>
        {SUPPORT_WHATSAPP ? (
          <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-[#25d366] p-4 text-[#06210f]">
            <MessageCircle className="size-7 shrink-0" />
            <span>
              <span className="block text-[16px] font-bold">WhatsApp</span>
              <span className="block text-sm">Chat directo</span>
            </span>
          </a>
        ) : (
          <button onClick={() => showSupport("tickets")} className="flex items-center gap-3 rounded-2xl border-2 border-line-strong p-4 text-left">
            <MessageCircle className="size-7 shrink-0" />
            <span>
              <span className="block text-[16px] font-bold">Mis casos</span>
              <span className="block text-sm">Sigue tus solicitudes</span>
            </span>
          </button>
        )}
      </div>

      <label htmlFor="af-help-search" className="flex h-14 items-center gap-3 rounded-2xl border-2 border-line-strong bg-ink-900 px-4 focus-within:border-sky">
        <Search className="size-5" />
        <input id="af-help-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Busca: pago, contraseña, cancelar…" className="flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted" />
      </label>

      {!q && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip active={!cat} onClick={() => setCat(null)}>
            Todo
          </Chip>
          {(Object.keys(SUPPORT_CATEGORY_LABEL) as SupportCategory[]).map(c => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {SUPPORT_CATEGORY_LABEL[c]}
            </Chip>
          ))}
        </div>
      )}

      <div className="card divide-y divide-line">
        {list.length === 0 && (
          <div className="p-5 text-[16px]">
            No encontramos eso.{" "}
            <button onClick={() => showSupport("contacto")} className="font-bold text-sky-300 underline">
              Escríbele al equipo
            </button>
          </div>
        )}
        {list.map(f => {
          const isOpen = open === f.id;
          return (
            <div key={f.id}>
              <button onClick={() => setOpen(isOpen ? null : f.id)} className="flex w-full items-center gap-3 p-5 text-left" aria-expanded={isOpen}>
                <span className="flex-1 text-[17px] font-bold">{f.q}</span>
                <ChevronDown className={cn("size-5 shrink-0 transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="space-y-3 px-5 pb-5">
                  <p className="text-[16px] leading-relaxed text-fg">{f.a}</p>
                  {f.action && (
                    <Link href={f.action.href} className="inline-flex h-11 items-center rounded-full bg-fg px-5 text-sm font-bold text-ink-950">
                      {f.action.label}
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
