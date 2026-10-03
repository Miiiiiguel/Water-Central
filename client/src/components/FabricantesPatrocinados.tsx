import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { BadgeCheck, Check, Factory, Loader2, MapPin, MessageCircle, Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { contactarFabricante, fabricantesSugeridos, type Fabricante, type Lugar } from '@/lib/fabricantes';
import { pais } from '@/lib/paises';

// Las tarjetas de fabricantes patrocinados ("fabrícalo con nosotros"):
// salen en Marco Polo, en la calculadora ROI y en /fabricantes. Van
// marcadas como "Patrocinado" (la publicidad tiene que distinguirse de
// los datos), y el contacto va por un formulario que el servidor cuenta y
// le reenvía al fabricante.

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-primary outline-none placeholder:text-gray-400 focus:border-accent focus:ring-2 focus:ring-accent/20';

function Contacto({ f, es, contexto, lugar }: { f: Fabricante; es: boolean; contexto: string; lugar: Lugar }) {
  const { user, getAccessToken } = useAuth();
  const [nombre, setNombre] = useState((user?.user_metadata?.full_name as string | undefined) ?? '');
  const [correo, setCorreo] = useState(user?.email ?? '');
  const [telefono, setTelefono] = useState('');
  const [mensaje, setMensaje] = useState(
    es
      ? `Hola, ${f.nombre}. Me interesa fabricar ${contexto ? `"${contexto}"` : 'un producto'} con mi marca. ¿Me cuentan condiciones, pedido mínimo y tiempos?`
      : `Hi ${f.nombre}. I want to manufacture ${contexto ? `"${contexto}"` : 'a product'} under my brand. Could you share terms, minimum order and lead times?`
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<{ whatsapp: string | null } | null>(null);

  if (listo)
    return (
      <div className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-800">
        <p className="flex items-center gap-1.5 font-semibold">
          <Check size={16} /> {es ? `Listo: le enviamos tu mensaje a ${f.nombre}. Te van a escribir a ${correo}.` : `Done: your message went to ${f.nombre}. They will write to ${correo}.`}
        </p>
        {listo.whatsapp && (
          <a href={listo.whatsapp} target="_blank" rel="noopener noreferrer" className="tap-scale-sm mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3.5 py-1.5 text-xs font-bold text-white">
            <MessageCircle size={14} /> {es ? 'Escribirles por WhatsApp' : 'Message them on WhatsApp'}
          </a>
        )}
      </div>
    );

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const r = await contactarFabricante(getAccessToken(), f.id, { nombre, correo, telefono, mensaje, contexto: contexto.slice(0, 200), lugar });
    setEnviando(false);
    if (r.ok) setListo({ whatsapp: r.data.whatsapp });
    else setError(r.message);
  };

  return (
    <form onSubmit={enviar} className="mt-3 space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} placeholder={es ? 'Tu nombre' : 'Your name'} aria-label={es ? 'Tu nombre' : 'Your name'} className={inputCls} />
        <input value={correo} onChange={(e) => setCorreo(e.target.value)} required type="email" placeholder={es ? 'Tu correo' : 'Your email'} aria-label={es ? 'Tu correo' : 'Your email'} className={inputCls} />
      </div>
      <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder={es ? 'WhatsApp (opcional)' : 'WhatsApp (optional)'} aria-label="WhatsApp" className={inputCls} />
      <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} required minLength={5} rows={3} aria-label={es ? 'Mensaje' : 'Message'} className={inputCls} />
      {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
      <button type="submit" disabled={enviando} className="tap-scale-sm inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
        {enviando && <Loader2 size={14} className="animate-spin" />}
        {es ? 'Enviar' : 'Send'}
      </button>
    </form>
  );
}

export function TarjetaFabricante({
  f,
  es,
  contexto,
  lugar,
  vistaPrevia = false,
}: {
  f: Fabricante;
  es: boolean;
  contexto: string;
  lugar: Lugar;
  /** Para el portal del fabricante: se ve igual, pero el botón no abre el formulario. */
  vistaPrevia?: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const ubicacion = [f.ciudad, es ? pais(f.pais)?.es : pais(f.pais)?.en].filter(Boolean).join(', ');
  return (
    <div data-fabricante className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-primary">{f.nombre}</p>
          {ubicacion && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={12} /> {ubicacion}
            </p>
          )}
        </div>
        <span className="flex-none rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
          {es ? 'Patrocinado' : 'Sponsored'}
        </span>
      </div>
      {f.descripcion && <p className="mt-2 text-sm text-muted-foreground">{f.descripcion}</p>}
      {(f.pedido_minimo || f.certificaciones) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-primary">
          {f.pedido_minimo && (
            <span className="inline-flex items-center gap-1">
              <Package size={12} /> {es ? 'Mínimo' : 'Minimum'}: {f.pedido_minimo}
            </span>
          )}
          {f.certificaciones && (
            <span className="inline-flex items-center gap-1">
              <BadgeCheck size={12} /> {f.certificaciones}
            </span>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {!abierta && (
          <button
            type="button"
            disabled={vistaPrevia}
            onClick={() => setAbierta(true)}
            className="tap-scale-sm rounded-full bg-primary px-4 py-2 text-sm font-bold text-white disabled:cursor-default"
          >
            {es ? 'Contactar' : 'Contact'}
          </button>
        )}
        {f.sitio_web && (
          <a href={f.sitio_web} target="_blank" rel="noopener noreferrer sponsored" className="text-sm font-semibold text-accent hover:underline">
            {es ? 'Ver sitio web' : 'Website'}
          </a>
        )}
      </div>
      {abierta && <Contacto f={f} es={es} contexto={contexto} lugar={lugar} />}
    </div>
  );
}

/** La lista, con su encabezado y la invitación a aparecer. */
export function ListaFabricantes({ fabricantes, es, contexto, lugar }: { fabricantes: Fabricante[]; es: boolean; contexto: string; lugar: Lugar }) {
  if (!fabricantes.length) return null;
  return (
    <section data-fabricantes-patrocinados className="rounded-2xl border border-gray-100 bg-secondary/40 p-4 md:p-5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <Factory size={13} /> {es ? 'Fabrícalo con tu marca' : 'Make it under your brand'}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {es ? 'Fabricantes que pueden hacer este producto para ti:' : 'Manufacturers that can make this product for you:'}
      </p>
      <div className="mt-3 space-y-3">
        {fabricantes.map((f) => (
          <TarjetaFabricante key={f.id} f={f} es={es} contexto={contexto} lugar={lugar} />
        ))}
      </div>
      <Link href="/fabricantes#aparecer" className="mt-3 inline-block text-xs font-semibold text-muted-foreground hover:text-accent">
        {es ? '¿Fabricas esto? Aparece aquí →' : 'Do you make this? Get listed →'}
      </Link>
    </section>
  );
}

/**
 * Pide los patrocinados para una búsqueda y los muestra. Si no hay
 * ninguno (o falla), no muestra nada: nunca ocupa espacio vacío.
 */
export default function FabricantesSugeridos({
  q,
  codigo,
  contexto,
  lugar,
  es,
}: {
  q?: string;
  codigo?: string;
  /** Cómo se nombra el producto en el mensaje al fabricante (por defecto, lo buscado). */
  contexto?: string;
  lugar: Lugar;
  es: boolean;
}) {
  const [lista, setLista] = useState<Fabricante[]>([]);
  useEffect(() => {
    let vivo = true;
    if (!q && !codigo) {
      setLista([]);
      return;
    }
    void fabricantesSugeridos({ q, codigo, lugar }).then((r) => vivo && setLista(r));
    return () => {
      vivo = false;
    };
  }, [q, codigo, lugar]);
  return <ListaFabricantes fabricantes={lista} es={es} contexto={contexto || q || codigo || ''} lugar={lugar} />;
}
