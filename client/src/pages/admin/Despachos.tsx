import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Ban, CircleDollarSign, Clock, Mail, PackageCheck, Printer, Save, Truck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Aparece, Boton, Campo, Entrada, Etiqueta, PageHeader, Segmentos, Seleccion, Stat, useAsync, useConfirmar } from '@/portal/ui';
import DataTable, { type Columna } from '@/portal/DataTable';
import { fecha, hace, num, usd } from '@/portal/format';
import { esc, imprimirHtml } from '@/portal/imprimir';
import { leerTodo, quien, useAdmin } from '@/portal/admin';
import { MODALIDADES, api, db, type Despacho, type Paquete } from '@/lib/casillero';

interface Cliente { full_name: string | null; casillero_codigo: string | null; email: string | null; telefono: string | null; tipo_doc: string | null; num_doc: string | null; ciudad: string | null }
type PaqueteDespacho = Pick<Paquete, 'id' | 'guia' | 'descripcion' | 'proveedor' | 'peso_lb' | 'estado'>;
type Fila = Despacho & { profiles: Cliente | null; paquetes: PaqueteDespacho[] };
type Filtro = 'todos' | Despacho['estado'];

const corto = (id: string) => id.slice(0, 8).toUpperCase();
const ESTADOS: { valor: Despacho['estado']; texto: string }[] = [{ valor: 'solicitado', texto: 'Por alistar' }, { valor: 'despachado', texto: 'Despachado' }, { valor: 'entregado', texto: 'Entregado' }];

async function cargar(): Promise<Fila[]> {
  const s = await db();
  const [d, p] = await Promise.all([
    leerTodo<Omit<Fila, 'paquetes'>>((a, b) => s.from('casillero_despachos').select('*, profiles(full_name, casillero_codigo, email, telefono, tipo_doc, num_doc, ciudad)').order('created_at', { ascending: false }).order('id').range(a, b), 5000),
    leerTodo<PaqueteDespacho & { despacho_id: string }>((a, b) => s.from('casillero_paquetes').select('id, guia, descripcion, proveedor, peso_lb, estado, despacho_id').not('despacho_id', 'is', null).order('id').range(a, b), 20_000),
  ]);
  const porDespacho = new Map<string, PaqueteDespacho[]>();
  for (const x of p) {
    const l = porDespacho.get(x.despacho_id) ?? [];
    l.push(x);
    porDespacho.set(x.despacho_id, l);
  }
  return d.map((x) => ({ ...x, paquetes: porDespacho.get(x.id) ?? [] }));
}

function hojaDeDespacho(d: Fila) {
  const c = d.profiles;
  const filas = d.paquetes.map((p) => `<tr><td>${esc(p.guia)}</td><td>${esc(p.descripcion ?? p.proveedor ?? '—')}</td><td class="n">${p.peso_lb ?? '—'} lb</td></tr>`).join('');
  imprimirHtml(`Despacho ${corto(d.id)}`, `
    <div class="cab"><div><div class="logo"><b>easy</b>comex</div><h1>Hoja de despacho</h1></div><div class="id">Despacho ${esc(corto(d.id))}<br>${esc(fecha(d.created_at))}</div></div>
    <h2>Cliente</h2>
    <div class="rejilla">
      <div><span>Nombre</span>${esc(c?.full_name ?? '—')} (${esc(c?.casillero_codigo ?? '—')})</div>
      <div><span>Teléfono</span>${esc(c?.telefono ?? '—')}</div>
      <div><span>Documento</span>${esc([c?.tipo_doc, c?.num_doc].filter(Boolean).join(' ') || '—')}</div>
      <div><span>Correo</span>${esc(c?.email ?? '—')}</div>
    </div>
    <h2>Entrega</h2>
    <div class="rejilla">
      <div style="grid-column:1/3"><span>Dirección de destino</span>${esc(d.destino ?? '—')}</div>
      <div><span>Modalidad</span>${esc(MODALIDADES[d.modalidad])}</div>
      <div><span>Guía de despacho</span>${esc(d.guia_despacho ?? 'Por asignar')}</div>
      <div><span>Peso total</span>${esc(d.peso_total)} lb</div>
      <div><span>Costo cobrado</span>${esc(usd(d.costo))}</div>
    </div>
    <h2>Paquetes (${d.paquetes.length})</h2>
    <table><thead><tr><th>Guía</th><th>Contenido</th><th class="n">Peso</th></tr></thead><tbody>${filas || '<tr><td colspan="3">Sin paquetes</td></tr>'}</tbody></table>
    <div class="firmas"><div>Alistado por</div><div>Recibido por</div></div>
    <p class="pie">Easycomex · Miami, FL</p>`);
}

function Detalle({ d, avisar, onCambio }: { d: Fila; avisar: (id: string) => Promise<boolean>; onCambio: () => Promise<void> }) {
  const confirmar = useConfirmar();
  const [estado, setEstado] = useState<Despacho['estado']>(d.estado === 'cancelado' ? 'solicitado' : d.estado);
  const [guia, setGuia] = useState(d.guia_despacho ?? '');
  const [ocupado, setOcupado] = useState<'guardar' | 'cancelar' | null>(null);
  const cancelado = d.estado === 'cancelado';
  const nombre = d.profiles?.full_name ?? d.profiles?.casillero_codigo ?? 'el cliente';

  const guardar = async () => {
    if (estado !== 'solicitado' && !guia.trim() && !(await confirmar({ titulo: 'Sin guía de despacho', texto: 'El cliente recibirá el aviso sin número de guía para seguir su envío. ¿Guardar de todos modos?', confirmar: 'Guardar así' }))) return;
    setOcupado('guardar');
    const { error } = await (await db()).rpc('casillero_despacho_estado', { p_id: d.id, p_estado: estado, p_guia: guia.trim() || null });
    if (error) { setOcupado(null); return toast.error(error.message); }
    let avisados = 0;
    if (estado !== d.estado) avisados = (await Promise.all(d.paquetes.map((p) => avisar(p.id)))).filter(Boolean).length;
    setOcupado(null);
    toast.success('Despacho actualizado', { description: avisados ? `${avisados} ${avisados === 1 ? 'correo enviado' : 'correos enviados'} al cliente.` : estado !== d.estado ? 'Los paquetes cambiaron de estado y el cliente lo ve en su casillero.' : undefined });
    await onCambio();
  };

  const cancelar = async () => {
    if (!(await confirmar({
      titulo: `¿Cancelar el despacho ${corto(d.id)}?`,
      texto: <>Devolvemos <b>{usd(d.costo)}</b> al wallet de {nombre} y sus {d.paquetes.length} {d.paquetes.length === 1 ? 'paquete vuelve' : 'paquetes vuelven'} a la bodega para que pueda pedirlo otra vez. Solo se puede hacer una vez.</>,
      confirmar: 'Cancelar y reembolsar', peligro: true,
    }))) return;
    setOcupado('cancelar');
    const { error } = await (await db()).rpc('casillero_cancelar_despacho', { p_id: d.id });
    setOcupado(null);
    if (error) return toast.error(error.message);
    toast.success(`Despacho cancelado y ${usd(d.costo)} devueltos al wallet`);
    await onCambio();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Paquetes del despacho</p>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white">
            {d.paquetes.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <PackageCheck size={16} className="shrink-0 text-accent" />
                <div className="min-w-0 flex-1"><b className="break-all font-mono text-[13px] text-primary">{p.guia}</b><p className="truncate text-xs text-muted-foreground">{p.descripcion ?? p.proveedor ?? 'Sin descripción'}</p></div>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">{p.peso_lb != null ? `${p.peso_lb} lb` : '—'}</span>
              </li>
            ))}
            {!d.paquetes.length && <li className="px-4 py-3 text-sm text-muted-foreground">Este despacho no tiene paquetes (se devolvieron a la bodega).</li>}
          </ul>
        </div>
        <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 text-sm">
          <div className="col-span-2"><dt className="text-xs text-muted-foreground">Destino</dt><dd className="font-semibold">{d.destino ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Teléfono</dt><dd className="font-semibold">{d.profiles?.telefono ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Ciudad del cliente</dt><dd className="font-semibold">{d.profiles?.ciudad ?? '—'}</dd></div>
        </dl>
      </div>

      <div className="space-y-4">
        {cancelado ? (
          <p className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><Ban size={17} className="mt-0.5 shrink-0" />Despacho cancelado. El dinero volvió al wallet del cliente.</p>
        ) : (
          <>
            <Campo etiqueta="Estado" id={`de-${d.id}`}><Seleccion id={`de-${d.id}`} value={estado} onChange={(e) => setEstado(e.target.value as Despacho['estado'])}>{ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.texto}</option>)}</Seleccion></Campo>
            <Campo etiqueta="Guía de despacho" id={`dg-${d.id}`} ayuda="El número con el que la transportadora sigue el envío en Colombia."><Entrada id={`dg-${d.id}`} placeholder="Ej. SERV-48213" value={guia} onChange={(e) => setGuia(e.target.value)} /></Campo>
            <div className="flex flex-wrap gap-2">
              <Boton variante="primario" chico cargando={ocupado === 'guardar'} onClick={() => void guardar()} icono={<Save size={13} />}>Guardar</Boton>
              {d.estado !== 'solicitado' && <Boton chico onClick={() => void Promise.all(d.paquetes.map((p) => avisar(p.id))).then((r) => (r.some(Boolean) ? toast.success('Correo enviado al cliente') : toast.message('No se envió: el correo no está configurado')))} icono={<Mail size={13} />}>Reenviar aviso</Boton>}
            </div>
          </>
        )}
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <Boton chico onClick={() => hojaDeDespacho(d)} icono={<Printer size={13} />}>Hoja de despacho</Boton>
          {d.estado === 'solicitado' && <Boton chico variante="peligro" cargando={ocupado === 'cancelar'} onClick={() => void cancelar()} icono={<Ban size={13} />}>Cancelar y reembolsar</Boton>}
        </div>
      </div>
    </div>
  );
}

export default function Despachos() {
  const { getAccessToken } = useAuth();
  const { recargar: recargarStats } = useAdmin();
  const d = useAsync(cargar, []);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const filas = d.datos ?? [];
  const cuenta = (f: Filtro) => (f === 'todos' ? filas.length : filas.filter((x) => x.estado === f).length);
  const visibles = useMemo(() => filas.filter((x) => filtro === 'todos' || x.estado === filtro), [filas, filtro]);
  const activos = filas.filter((x) => x.estado !== 'cancelado');
  const libras = activos.reduce((a, x) => a + Number(x.peso_total), 0);

  const avisar = async (id: string) => { const r = await api<{ enviado: boolean }>(`/casillero/paquetes/${id}/avisar`, getAccessToken()); return r.ok && r.data.enviado; };
  const cambio = async () => { await Promise.all([d.recargar(), recargarStats()]); };

  const columnas: Columna<Fila>[] = [
    { clave: 'id', titulo: 'Despacho', movil: 'titulo', orden: (x) => x.created_at, celda: (x) => <b className="font-mono text-[13px] text-primary">{corto(x.id)}</b> },
    { clave: 'cliente', titulo: 'Cliente', orden: (x) => x.profiles?.casillero_codigo ?? '', celda: (x) => <span className="whitespace-nowrap">{quien(x.profiles)}</span> },
    { clave: 'modalidad', titulo: 'Modalidad', celda: (x) => <span className="whitespace-nowrap text-muted-foreground">{MODALIDADES[x.modalidad]}</span> },
    { clave: 'paquetes', titulo: 'Paquetes', alinear: 'der', orden: (x) => x.paquetes.length, celda: (x) => `${x.paquetes.length} · ${x.peso_total} lb` },
    { clave: 'costo', titulo: 'Cobrado', alinear: 'der', orden: (x) => Number(x.costo), celda: (x) => <b className="tabular-nums text-primary">{usd(x.costo)}</b> },
    { clave: 'estado', titulo: 'Estado', orden: (x) => x.estado, celda: (x) => <Etiqueta estado={x.estado} /> },
    { clave: 'fecha', titulo: 'Solicitado', orden: (x) => x.created_at, celda: (x) => <span className="whitespace-nowrap text-muted-foreground">{hace(x.created_at)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader titulo="Despachos" subtitulo="Lo que los clientes pidieron enviar a Colombia. Aliste, asigne la guía, avise y, si hace falta, cancele con reembolso." />

      <Aparece>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Stat tono="naranja" etiqueta="Por alistar" valor={cuenta('solicitado')} icono={<Clock size={18} />} pista="pagados, esperando bodega" cargando={d.cargando} onClick={() => setFiltro('solicitado')} />
          <Stat etiqueta="En camino" valor={cuenta('despachado')} icono={<Truck size={18} />} tono="azul" pista="despachados, sin entregar" cargando={d.cargando} onClick={() => setFiltro('despachado')} />
          <Stat etiqueta="Entregados" valor={cuenta('entregado')} icono={<PackageCheck size={18} />} tono="verde" pista={`${num(Math.round(libras))} lb movidas en total`} cargando={d.cargando} onClick={() => setFiltro('entregado')} />
          <Stat tono="oscuro" etiqueta="Cobrado en despachos" valor={activos.reduce((a, x) => a + Number(x.costo), 0)} formato={usd} icono={<CircleDollarSign size={18} />} pista={`${cuenta('cancelado')} cancelados`} cargando={d.cargando} />
        </div>
      </Aparece>

      <Aparece retraso={0.06}>
        <DataTable
          columnas={columnas} filas={visibles} id={(x) => x.id} cargando={d.cargando} porPagina={25}
          buscar={(x) => `${x.id} ${x.guia_despacho ?? ''} ${x.destino ?? ''} ${x.profiles?.casillero_codigo ?? ''} ${x.profiles?.full_name ?? ''} ${x.paquetes.map((p) => p.guia).join(' ')}`}
          textoBuscar="Buscar despacho, cliente, guía o destino"
          filtros={<Segmentos valor={filtro} onCambio={setFiltro} opciones={[{ valor: 'todos', etiqueta: 'Todos', cuenta: cuenta('todos') }, { valor: 'solicitado', etiqueta: 'Por alistar', cuenta: cuenta('solicitado') }, { valor: 'despachado', etiqueta: 'Despachados', cuenta: cuenta('despachado') }, { valor: 'entregado', etiqueta: 'Entregados', cuenta: cuenta('entregado') }, { valor: 'cancelado', etiqueta: 'Cancelados', cuenta: cuenta('cancelado') }]} />}
          exportar={{ nombre: 'despachos', fila: (x) => ({ despacho: corto(x.id), cliente: quien(x.profiles), modalidad: MODALIDADES[x.modalidad], destino: x.destino, paquetes: x.paquetes.length, peso_lb: x.peso_total, cobrado_usd: x.costo, estado: x.estado, guia_despacho: x.guia_despacho, solicitado: x.created_at }) }}
          expandida={(x) => <Detalle key={`${x.id}-${x.estado}-${x.guia_despacho}`} d={x} avisar={avisar} onCambio={cambio} />}
          ordenInicial={{ clave: 'fecha', asc: false }}
        />
      </Aparece>
    </div>
  );
}
