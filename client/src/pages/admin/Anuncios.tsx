import { useState } from 'react';
import { toast } from 'sonner';
import { Bell, Megaphone, Pin, PinOff, Send, Users } from 'lucide-react';
import { Aparece, AreaTexto, Boton, Campo, Card, Entrada, EstadoVacio, PageHeader, Seccion, Seleccion, Skeleton, useAsync, useConfirmar } from '@/portal/ui';
import { fechaHora, hace, num } from '@/portal/format';
import { useAdmin } from '@/portal/admin';
import { db } from '@/lib/casillero';

// Dos formas de hablarle a los clientes: un anuncio (llega a la campanita de
// todos y queda en su historial) y un aviso fijo (una franja en el inicio del
// casillero mientras lo mantengas).

const DESTINOS = [
  { valor: '/casillero', texto: 'Inicio del casillero' },
  { valor: '/casillero/paquetes', texto: 'Mis paquetes' },
  { valor: '/casillero/despacho', texto: 'Despachar' },
  { valor: '/casillero/wallet', texto: 'Wallet' },
  { valor: '/casillero/tarifas', texto: 'Tarifas' },
  { valor: '/casillero/inventario', texto: 'Inventario' },
];

interface Anuncio { id: number; created_at: string; detalle: { titulo: string; cuerpo: string; link: string; destinatarios: number } }

export default function Anuncios() {
  const { stats } = useAdmin();
  const confirmar = useConfirmar();
  const h = useAsync(async () => {
    const s = await db();
    const [a, c] = await Promise.all([
      s.from('casillero_auditoria').select('id, created_at, detalle').eq('tabla', 'anuncio').order('id', { ascending: false }).limit(20),
      s.from('casillero_config').select('valor').eq('clave', 'aviso_clientes').maybeSingle(),
    ]);
    if (a.error) throw a.error;
    return { anuncios: (a.data ?? []) as Anuncio[], aviso: (c.data?.valor as string | undefined) ?? '' };
  }, []);

  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [link, setLink] = useState('/casillero');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fijando, setFijando] = useState(false);
  const destinatarios = stats?.clientes ?? 0;
  const avisoActual = h.datos?.aviso ?? '';
  const avisoTexto = aviso ?? avisoActual;

  const enviar = async () => {
    if (!titulo.trim()) return toast.error('El anuncio necesita un título');
    if (!(await confirmar({ titulo: `Enviar a ${num(destinatarios)} ${destinatarios === 1 ? 'cliente' : 'clientes'}`, texto: <>Aparecerá en la campanita de cada cliente, con notificación en su celular si la activó. <b>No se puede retirar</b> una vez enviado.</>, confirmar: 'Enviar anuncio' }))) return;
    setEnviando(true);
    const { data, error } = await (await db()).rpc('casillero_anunciar', { p_titulo: titulo.trim(), p_cuerpo: cuerpo.trim(), p_link: link });
    setEnviando(false);
    if (error) return toast.error(error.message);
    toast.success(`Anuncio enviado a ${num(Number(data))} ${Number(data) === 1 ? 'cliente' : 'clientes'}`);
    setTitulo(''); setCuerpo('');
    await h.recargar();
  };

  const fijar = async (texto: string) => {
    setFijando(true);
    const { error } = await (await db()).from('casillero_config').upsert({ clave: 'aviso_clientes', valor: texto.trim() }, { onConflict: 'clave' });
    setFijando(false);
    if (error) return toast.error(error.message);
    toast.success(texto.trim() ? 'Aviso publicado en el inicio de los clientes' : 'Aviso retirado');
    setAviso(null);
    await h.recargar();
  };

  return (
    <div className="space-y-6">
      <PageHeader titulo="Anuncios" subtitulo="Avise a sus clientes de un feriado, un cambio de tarifa o una novedad. Llega a la campanita de cada uno." />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Aparece>
          <Seccion titulo="Nuevo anuncio" ayuda={`Se envía a ${num(destinatarios)} ${destinatarios === 1 ? 'cliente' : 'clientes'}.`}>
            <div className="space-y-4">
              <Campo etiqueta="Título" id="an-titulo" ayuda={`${titulo.length}/80`}><Entrada id="an-titulo" maxLength={80} placeholder="Ej. Sin despachos el lunes festivo" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Campo>
              <Campo etiqueta="Mensaje" id="an-cuerpo" ayuda={`${cuerpo.length}/300`}><AreaTexto id="an-cuerpo" maxLength={300} placeholder="Retomamos las salidas el martes. Los paquetes que lleguen quedan listos para el siguiente vuelo." value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} /></Campo>
              <Campo etiqueta="Al tocarlo, lleva a" id="an-link"><Seleccion id="an-link" value={link} onChange={(e) => setLink(e.target.value)}>{DESTINOS.map((d) => <option key={d.valor} value={d.valor}>{d.texto}</option>)}</Seleccion></Campo>
              <div className="flex justify-end"><Boton variante="primario" cargando={enviando} disabled={!titulo.trim()} onClick={() => void enviar()} icono={<Send size={15} />}>Enviar anuncio</Boton></div>
            </div>
          </Seccion>
        </Aparece>

        <Aparece retraso={0.06}>
          <div className="space-y-6">
            <Card>
              <p className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Así lo verá el cliente</p>
              <div className="flex gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white"><Bell size={18} /></span>
                <div className="min-w-0"><p className="break-words font-bold text-primary">{titulo.trim() || 'Título del anuncio'}</p><p className="mt-0.5 break-words text-sm text-muted-foreground">{cuerpo.trim() || 'El mensaje aparece aquí.'}</p><p className="mt-1.5 text-xs text-gray-400">justo ahora</p></div>
              </div>
            </Card>

            <Seccion titulo="Aviso fijo en el inicio" ayuda="Una franja visible en el inicio del casillero hasta que la retires. Ideal para horarios o promociones.">
              <AreaTexto aria-label="Texto del aviso fijo" maxLength={240} placeholder="Ej. Esta semana el despacho sale miércoles y viernes." value={avisoTexto} onChange={(e) => setAviso(e.target.value)} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Boton chico variante="primario" cargando={fijando} disabled={!avisoTexto.trim() || avisoTexto.trim() === avisoActual.trim()} onClick={() => void fijar(avisoTexto)} icono={<Pin size={13} />}>{avisoActual.trim() ? 'Actualizar aviso' : 'Publicar aviso'}</Boton>
                {avisoActual.trim() && <Boton chico variante="peligro" disabled={fijando} onClick={() => void fijar('')} icono={<PinOff size={13} />}>Retirar</Boton>}
                {avisoActual.trim() && <span className="text-xs font-semibold text-green-700">● Publicado</span>}
              </div>
            </Seccion>
          </div>
        </Aparece>
      </div>

      <Aparece retraso={0.1}>
        <Seccion titulo="Anuncios enviados">
          {h.cargando ? <Skeleton className="h-28 w-full" /> : !h.datos?.anuncios.length ? (
            <EstadoVacio icono={<Megaphone size={26} />} titulo="Aún no has enviado anuncios" texto="Cuando envíes el primero, queda aquí con la fecha y a cuántos clientes llegó." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {h.datos.anuncios.map((a) => (
                <li key={a.id} className="flex flex-wrap items-start gap-3 py-3.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-accent"><Megaphone size={16} /></span>
                  <div className="min-w-0 flex-1"><p className="font-bold text-primary">{a.detalle.titulo}</p>{a.detalle.cuerpo && <p className="text-sm text-muted-foreground">{a.detalle.cuerpo}</p>}</div>
                  <div className="text-right text-xs text-muted-foreground"><p title={fechaHora(a.created_at)}>{hace(a.created_at)}</p><p className="mt-0.5 flex items-center justify-end gap-1 font-semibold"><Users size={12} />{num(a.detalle.destinatarios)}</p></div>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      </Aparece>
    </div>
  );
}
