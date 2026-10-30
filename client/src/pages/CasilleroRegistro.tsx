import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AlertTriangle, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import GoogleButton from '@/components/GoogleButton';
import PantallaMarca from '@/portal/Marca';
import { Boton, Campo, Entrada, Seleccion } from '@/portal/ui';

const MEDIOS = ['Instagram', 'Facebook', 'TikTok', 'WhatsApp', 'Recomendación', 'Google', 'Otro'];
type Form = Record<'nombre' | 'apellidos' | 'telefono' | 'tipo_doc' | 'num_doc' | 'direccion' | 'pais' | 'departamento' | 'ciudad' | 'codigo_postal' | 'como_nos_conocio' | 'empresa' | 'email' | 'password' | 'password2', string>;

// Registro del casillero: la misma cuenta de Easycomex (AuthContext.signUp),
// con los datos extra del formulario del casillero. Los pasa Supabase al
// trigger handle_new_user (supabase/casillero.sql), que además le asigna
// su código de casillero (DM1001, DM1002…). El rol sigue fijo en 'cliente'.
export default function CasilleroRegistro() {
  const { signUp, configured } = useAuth();
  const [, navigate] = useLocation();
  const [f, setF] = useState<Form>({ nombre: '', apellidos: '', telefono: '', tipo_doc: 'Cédula', num_doc: '', direccion: '', pais: 'Colombia', departamento: '', ciudad: '', codigo_postal: '', como_nos_conocio: '', empresa: '', email: '', password: '', password2: '' });
  const [esEmpresa, setEsEmpresa] = useState(false);
  const [acepto, setAcepto] = useState(false);
  const [errores, setErrores] = useState<Partial<Record<keyof Form | 'acepto' | 'general', string>>>({});
  const [ok, setOk] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setErrores({ ...errores, [k]: undefined, general: undefined }); };

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: typeof errores = {};
    if (!f.nombre.trim()) e.nombre = 'Escribe tu nombre.';
    if (!f.apellidos.trim()) e.apellidos = 'Escribe tus apellidos.';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Escribe un correo válido.';
    if (f.telefono && !/^[+\d][\d\s()-]{6,}$/.test(f.telefono.trim())) e.telefono = 'Revisa el teléfono.';
    if (esEmpresa && !f.empresa.trim()) e.empresa = 'Escribe el nombre de la empresa.';
    if (f.password.length < 8 || !/[a-zA-Z]/.test(f.password) || !/\d/.test(f.password)) e.password = 'Mínimo 8 caracteres, con letras y números.';
    if (f.password !== f.password2) e.password2 = 'Las contraseñas no coinciden.';
    if (!acepto) e.acepto = 'Debes aceptar para crear tu casillero.';
    setErrores(e);
    if (Object.values(e).some(Boolean)) { document.getElementById('registro-errores')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    setOcupado(true);
    try {
      const { error } = await signUp(f.email, f.password, `${f.nombre.trim()} ${f.apellidos.trim()}`, esEmpresa ? f.empresa : '', {
        telefono: f.telefono.trim(), tipo_doc: f.tipo_doc, num_doc: f.num_doc.trim(), direccion: f.direccion.trim(), pais: f.pais,
        departamento: f.departamento.trim(), ciudad: f.ciudad.trim(), codigo_postal: f.codigo_postal.trim(), como_nos_conocio: f.como_nos_conocio, es_empresa: esEmpresa,
      });
      if (error) return setErrores({ general: error });
      setOk(true);
      setTimeout(() => navigate('/casillero'), 1800);
    } finally { setOcupado(false); }
  };

  const campo = (k: keyof Form, etiqueta: string, tipo = 'text', auto?: string) => (
    <Campo etiqueta={etiqueta} id={`r-${k}`} error={errores[k]}><Entrada id={`r-${k}`} type={tipo} autoComplete={auto} value={f[k]} onChange={set(k)} aria-invalid={!!errores[k]} /></Campo>
  );
  const hayErrores = Object.values(errores).some(Boolean);

  return (
    <PantallaMarca ancho="max-w-2xl">
      <h1 className="font-heading text-3xl font-black text-primary">Crea tu casillero</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Recibimos tus compras en Miami y las enviamos a donde estés. Es gratis.</p>

      {!configured && <p className="mb-5 flex items-start gap-2 rounded-2xl border border-orange-100 bg-orange-50 p-3 text-xs text-orange-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" />Supabase aún no está configurado en este entorno: el registro no funcionará hasta agregar las variables.</p>}
      {ok && <p className="mb-5 flex items-start gap-2 rounded-2xl border border-green-100 bg-green-50 p-3.5 text-sm text-green-700"><CheckCircle size={17} className="mt-0.5 shrink-0" />¡Cuenta creada! Si te pedimos confirmar el correo, revisa tu bandeja y luego ingresa.</p>}
      <div id="registro-errores">{(errores.general || (hayErrores && !errores.general)) && <p role="alert" className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-3.5 text-sm text-red-700">{errores.general ?? 'Revisa los campos marcados.'}</p>}</div>

      <GoogleButton idioma="es" onError={(m) => setErrores({ general: m })} />

      <form onSubmit={(e) => void enviar(e)} className="space-y-4" noValidate>
        <div className="flex items-center justify-between pt-1"><h2 className="font-heading text-lg font-black text-primary">Datos personales</h2><label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" className="accent-[#FF5A36]" checked={esEmpresa} onChange={(e) => setEsEmpresa(e.target.checked)} />Soy una empresa</label></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {esEmpresa && <div className="sm:col-span-2">{campo('empresa', 'Nombre de la empresa', 'text', 'organization')}</div>}
          {campo('nombre', 'Nombre', 'text', 'given-name')}{campo('apellidos', 'Apellidos', 'text', 'family-name')}
          {campo('telefono', 'Teléfono', 'tel', 'tel')}
          <Campo etiqueta="Tipo de documento" id="r-tipo_doc"><Seleccion id="r-tipo_doc" value={f.tipo_doc} onChange={set('tipo_doc')}>{['Cédula', 'Cédula de extranjería', 'Pasaporte', 'NIT'].map((x) => <option key={x}>{x}</option>)}</Seleccion></Campo>
          {campo('num_doc', 'Número de documento')}{campo('direccion', 'Dirección', 'text', 'street-address')}
          <Campo etiqueta="País" id="r-pais"><Seleccion id="r-pais" value={f.pais} onChange={set('pais')}>{['Colombia', 'Estados Unidos', 'Otro'].map((x) => <option key={x}>{x}</option>)}</Seleccion></Campo>
          {campo('departamento', 'Departamento')}{campo('ciudad', 'Ciudad')}{campo('codigo_postal', 'Código postal', 'text', 'postal-code')}
          <Campo etiqueta="¿Cómo nos conociste?" id="r-medio"><Seleccion id="r-medio" value={f.como_nos_conocio} onChange={set('como_nos_conocio')}><option value="">Selecciona</option>{MEDIOS.map((x) => <option key={x}>{x}</option>)}</Seleccion></Campo>
        </div>
        <h2 className="pt-2 font-heading text-lg font-black text-primary">Tu cuenta</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{campo('email', 'Correo electrónico', 'email', 'email')}</div>
          {campo('password', 'Contraseña', 'password', 'new-password')}{campo('password2', 'Confirmar contraseña', 'password', 'new-password')}
        </div>
        <div>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm"><input type="checkbox" className="mt-1 accent-[#FF5A36]" checked={acepto} onChange={(e) => { setAcepto(e.target.checked); setErrores({ ...errores, acepto: undefined }); }} /><span>Acepto la <Link href="/privacidad" className="font-bold text-accent hover:underline">política de privacidad</Link> y los <Link href="/terminos" className="font-bold text-accent hover:underline">términos</Link>, y autorizo el tratamiento de mis datos personales.</span></label>
          {errores.acepto && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{errores.acepto}</p>}
        </div>
        <Boton type="submit" variante="primario" cargando={ocupado} className="w-full py-3.5" icono={!ocupado ? <ArrowRight size={17} /> : undefined}>{ocupado ? 'Creando tu casillero…' : 'Crear mi casillero'}</Boton>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">¿Ya tienes cuenta? <Link href="/login?next=/casillero" className="font-bold text-accent hover:underline">Ingresa</Link> · <Link href="/rastreo" className="font-bold text-accent hover:underline">Rastrea un paquete</Link></p>
    </PantallaMarca>
  );
}
