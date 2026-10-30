import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, ShieldOff, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Aparece, Boton, Campo, Card, Entrada, Etiqueta, PageHeader, Seccion, Skeleton, useAsync, useConfirmar } from '@/portal/ui';
import { fecha, iniciales, num } from '@/portal/format';
import { leerTodo } from '@/portal/admin';
import { db } from '@/lib/casillero';

interface Miembro { id: string; email: string; full_name: string | null; casillero_codigo: string | null; created_at: string }

const PUEDE = [
  'Recibir y pesar paquetes, y cambiar su estado',
  'Alistar, despachar y cancelar despachos con reembolso',
  'Aprobar recargas y ajustar saldos',
  'Registrar ingresos de inventario y ver todas las tiendas conectadas',
  'Editar tarifas, configuración, clientes y anuncios',
  'Ver la auditoría completa',
];

export default function Equipo() {
  const { user } = useAuth();
  const confirmar = useConfirmar();
  const d = useAsync(async () => {
    const s = await db();
    const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [m, a] = await Promise.all([
      s.from('profiles').select('id, email, full_name, casillero_codigo, created_at').eq('role', 'vendedor').order('created_at'),
      leerTodo<{ actor: string | null }>((x, y) => s.from('casillero_auditoria').select('actor').gte('created_at', desde).order('id').range(x, y), 20_000),
    ]);
    if (m.error) throw m.error;
    const acciones = new Map<string, number>();
    for (const x of a) if (x.actor) acciones.set(x.actor, (acciones.get(x.actor) ?? 0) + 1);
    return { equipo: (m.data ?? []) as Miembro[], acciones };
  }, []);
  const [correo, setCorreo] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const equipo = d.datos?.equipo ?? [];
  const total = useMemo(() => Array.from(d.datos?.acciones.values() ?? []).reduce((a, b) => a + b, 0), [d.datos]);

  const agregar = async () => {
    const email = correo.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error('Escribe un correo válido');
    setOcupado('nuevo');
    const { data, error } = await (await db()).from('profiles').select('id, email, full_name, role').ilike('email', email.replace(/[\\%_]/g, (m) => `\\${m}`)).maybeSingle();
    if (error) { setOcupado(null); return toast.error(error.message); }
    if (!data) { setOcupado(null); return toast.error('Esa persona todavía no tiene cuenta', { description: 'Pídele que se registre en el casillero con ese correo y vuelve a intentarlo.' }); }
    if (data.role === 'vendedor') { setOcupado(null); return toast.message('Esa persona ya es del equipo'); }
    setOcupado(null);
    if (!(await confirmar({ titulo: `¿Dar acceso de administrador a ${data.full_name ?? data.email}?`, texto: 'Podrá ver y modificar todos los clientes, paquetes, wallets e inventarios. Cada cosa que haga queda en la auditoría.', confirmar: 'Dar acceso' }))) return;
    setOcupado('nuevo');
    const r = await (await db()).rpc('casillero_set_rol', { p_user: data.id, p_rol: 'vendedor' });
    setOcupado(null);
    if (r.error) return toast.error(r.error.message);
    toast.success(`${data.full_name ?? data.email} ya es del equipo`);
    setCorreo('');
    await d.recargar();
  };

  const quitar = async (m: Miembro) => {
    if (!(await confirmar({ titulo: `¿Quitar el acceso de ${m.full_name ?? m.email}?`, texto: 'Vuelve a ser un cliente normal: pierde el portal del administrador. Su historial en la auditoría se conserva.', confirmar: 'Quitar acceso', peligro: true }))) return;
    setOcupado(m.id);
    const { error } = await (await db()).rpc('casillero_set_rol', { p_user: m.id, p_rol: 'cliente' });
    setOcupado(null);
    if (error) return toast.error(error.message);
    toast.success('Acceso retirado');
    await d.recargar();
  };

  return (
    <div className="space-y-6">
      <PageHeader titulo="Equipo" subtitulo="Quién puede entrar al portal del administrador. Tiene control total, así que da acceso solo a gente de confianza." />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Aparece>
          <Seccion titulo="Administradores" ayuda={`${equipo.length} ${equipo.length === 1 ? 'persona' : 'personas'} · ${num(total)} acciones registradas en 30 días`}>
            {d.cargando ? <Skeleton className="h-32 w-full" /> : (
              <ul className="divide-y divide-gray-100">
                {equipo.map((m) => {
                  const yo = m.id === user?.id;
                  return (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 py-3.5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-white">{iniciales(m.full_name, m.email)}</span>
                      <div className="min-w-0 flex-1"><p className="truncate font-bold text-primary">{m.full_name || m.email} {yo && <Etiqueta tono="azul">Tú</Etiqueta>}</p><p className="truncate text-xs text-muted-foreground">{m.email} · desde {fecha(m.created_at)}</p></div>
                      <div className="text-right text-xs text-muted-foreground"><b className="block text-sm text-primary">{num(d.datos?.acciones.get(m.id) ?? 0)}</b>acciones en 30 d</div>
                      {!yo && <Boton chico variante="peligro" cargando={ocupado === m.id} onClick={() => void quitar(m)} icono={<ShieldOff size={13} />}>Quitar</Boton>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Seccion>
        </Aparece>

        <Aparece retraso={0.06}>
          <div className="space-y-6">
            <Seccion titulo="Agregar a alguien" ayuda="Debe tener cuenta. Si no, pídele que se registre primero.">
              <div className="space-y-3">
                <Campo etiqueta="Correo de su cuenta" id="eq-correo"><Entrada id="eq-correo" type="email" autoComplete="off" placeholder="nombre@empresa.com" value={correo} onChange={(e) => setCorreo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void agregar()} /></Campo>
                <Boton variante="primario" className="w-full" cargando={ocupado === 'nuevo'} disabled={!correo.trim()} onClick={() => void agregar()} icono={<UserPlus size={15} />}>Dar acceso de administrador</Boton>
              </div>
            </Seccion>
            <Card>
              <p className="mb-3 flex items-center gap-2 font-bold text-primary"><ShieldCheck size={17} className="text-accent" />Un administrador puede</p>
              <ul className="space-y-2 text-sm text-muted-foreground">{PUEDE.map((p) => <li key={p} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{p}</li>)}</ul>
              <p className="mt-4 rounded-2xl bg-gray-50 p-3 text-xs text-muted-foreground">Nadie puede cambiar su propio rol: otro administrador debe hacerlo. Así nunca te quedas sin acceso por error.</p>
            </Card>
          </div>
        </Aparece>
      </div>
    </div>
  );
}
