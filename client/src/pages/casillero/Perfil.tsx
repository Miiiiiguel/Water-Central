import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Save, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import MfaSetup from '@/components/MfaSetup';
import { Aparece, Boton, BotonCopiar, Campo, Entrada, Seccion, Seleccion } from '@/portal/ui';
import { db } from '@/lib/casillero';

const CAMPOS = ['full_name', 'telefono', 'tipo_doc', 'num_doc', 'company', 'direccion', 'pais', 'departamento', 'ciudad', 'codigo_postal'] as const;
type Clave = (typeof CAMPOS)[number];

export default function Perfil() {
  const { profile, user, resetPassword } = useAuth();
  const inicial = useMemo(() => Object.fromEntries(CAMPOS.map((k) => [k, String((profile as unknown as Record<string, unknown> | null)?.[k] ?? '')])) as Record<Clave, string>, [profile]);
  const [v, setV] = useState(inicial);
  const [errores, setErrores] = useState<Partial<Record<Clave, string>>>({});
  const [ocupado, setOcupado] = useState(false);
  const cambiado = CAMPOS.some((k) => v[k] !== inicial[k]);
  const poner = (k: Clave) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setV({ ...v, [k]: e.target.value }); setErrores({ ...errores, [k]: undefined }); };

  const guardar = async () => {
    if (!user) return;
    const e: Partial<Record<Clave, string>> = {};
    if (v.full_name.trim().length < 3) e.full_name = 'Escribe tu nombre completo.';
    if (v.telefono && !/^[+\d][\d\s()-]{6,}$/.test(v.telefono.trim())) e.telefono = 'Revisa el teléfono (solo números, con o sin indicativo).';
    if (v.direccion && v.direccion.trim().length < 6) e.direccion = 'La dirección parece incompleta.';
    setErrores(e);
    if (Object.keys(e).length) return toast.error('Revisa los campos marcados');
    setOcupado(true);
    const { error } = await (await db()).from('profiles').update(Object.fromEntries(CAMPOS.map((k) => [k, v[k].trim() || null]))).eq('id', user.id);
    setOcupado(false);
    if (error) return toast.error('No pudimos guardar', { description: error.message });
    toast.success('Perfil actualizado', { description: 'Se verá reflejado en tu próxima sesión.' });
  };

  const cambiarClave = async () => {
    if (!user?.email) return;
    const { error } = await resetPassword(user.email);
    if (error) toast.error(error); else toast.success('Te enviamos un correo', { description: `Sigue el enlace que llegó a ${user.email} para elegir una contraseña nueva.` });
  };

  const campo = (k: Clave, etiqueta: string, extra?: { tipo?: string; auto?: string }) => (
    <Campo etiqueta={etiqueta} id={`p-${k}`} error={errores[k]}><Entrada id={`p-${k}`} type={extra?.tipo} autoComplete={extra?.auto} value={v[k]} onChange={poner(k)} aria-invalid={!!errores[k]} /></Campo>
  );

  return (
    <div className="space-y-6">
      <div><h1 className="font-heading text-2xl font-black text-primary md:text-3xl">Mi perfil</h1><p className="mt-1 text-sm text-muted-foreground">Tus datos para envíos y facturación.</p></div>

      <Aparece>
        <Seccion titulo="Tu casillero">
          <div className="flex flex-wrap items-center gap-4">
            <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Código</p><p className="font-heading text-3xl font-black text-primary">{profile?.casillero_codigo}</p></div>
            <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Correo</p><p className="truncate font-semibold">{user?.email}</p></div>
            <div className="ml-auto"><BotonCopiar texto={profile?.casillero_codigo ?? ''} etiqueta="Copiar código" /></div>
          </div>
        </Seccion>
      </Aparece>

      <Aparece retraso={0.05}>
        <Seccion titulo="Datos personales">
          <div className="grid gap-4 sm:grid-cols-2">
            {campo('full_name', 'Nombre completo', { auto: 'name' })}
            {campo('telefono', 'Teléfono', { tipo: 'tel', auto: 'tel' })}
            <Campo etiqueta="Tipo de documento" id="p-tipo_doc"><Seleccion id="p-tipo_doc" value={v.tipo_doc} onChange={poner('tipo_doc')}><option value="">—</option>{['Cédula', 'Cédula de extranjería', 'Pasaporte', 'NIT'].map((x) => <option key={x}>{x}</option>)}</Seleccion></Campo>
            {campo('num_doc', 'Número de documento')}
            {campo('company', 'Empresa (opcional)', { auto: 'organization' })}
          </div>
        </Seccion>
      </Aparece>

      <Aparece retraso={0.08}>
        <Seccion titulo="Dirección de entrega" ayuda="La usamos por defecto al despachar; puedes cambiarla en cada envío.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{campo('direccion', 'Dirección', { auto: 'street-address' })}</div>
            <Campo etiqueta="País" id="p-pais"><Seleccion id="p-pais" value={v.pais} onChange={poner('pais')}><option value="">—</option>{['Colombia', 'Estados Unidos', 'Otro'].map((x) => <option key={x}>{x}</option>)}</Seleccion></Campo>
            {campo('departamento', 'Departamento')}
            {campo('ciudad', 'Ciudad')}
            {campo('codigo_postal', 'Código postal', { auto: 'postal-code' })}
          </div>
        </Seccion>
      </Aparece>

      <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-3xl border border-gray-100 bg-white/95 p-3 pl-5 backdrop-blur app-shadow lg:bottom-4">
        <p className="text-sm text-muted-foreground">{cambiado ? 'Tienes cambios sin guardar.' : 'Todo está al día.'}</p>
        <div className="flex gap-2">{cambiado && <Boton onClick={() => { setV(inicial); setErrores({}); }}>Descartar</Boton>}<Boton variante="primario" cargando={ocupado} disabled={!cambiado} icono={<Save size={15} />} onClick={() => void guardar()}>Guardar cambios</Boton></div>
      </div>

      <Aparece retraso={0.1}>
        <Seccion titulo="Seguridad" ayuda="Protege tu cuenta y el dinero de tu wallet.">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 p-4"><p className="flex items-center gap-2 font-bold text-primary"><KeyRound size={17} />Contraseña</p><p className="mt-1 text-sm text-muted-foreground">Te enviamos un enlace al correo para elegir una nueva.</p><div className="mt-3"><Boton chico onClick={() => void cambiarClave()}>Cambiar contraseña</Boton></div></div>
            <div className="rounded-2xl border border-gray-100 p-4"><p className="mb-2 flex items-center gap-2 font-bold text-primary"><ShieldCheck size={17} />Verificación en dos pasos</p><MfaSetup /></div>
          </div>
        </Seccion>
      </Aparece>
    </div>
  );
}
