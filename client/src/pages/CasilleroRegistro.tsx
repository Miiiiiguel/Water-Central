import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AlertTriangle, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import GoogleButton from '@/components/GoogleButton';
import { CLASE_CAMPO, Entrada, Logo } from '@/components/CasilleroShell';

const MEDIOS = ['Instagram', 'Facebook', 'TikTok', 'WhatsApp', 'Recomendación', 'Google', 'Otro'];

// Registro del casillero: la misma cuenta de Easycomex (AuthContext.signUp),
// con los datos extra del formulario del casillero. Los pasa Supabase al
// trigger handle_new_user (supabase/casillero.sql), que además le asigna
// su código de casillero (DM1001, DM1002…). El rol sigue fijo en 'cliente'.
export default function CasilleroRegistro() {
  const { signUp, configured } = useAuth();
  const [, navigate] = useLocation();
  const [f, setF] = useState({
    nombre: '', apellidos: '', telefono: '', tipo_doc: 'Cédula', num_doc: '', direccion: '', pais: 'Colombia',
    departamento: '', ciudad: '', codigo_postal: '', como_nos_conocio: '', empresa: '', email: '', password: '', password2: '',
  });
  const [esEmpresa, setEsEmpresa] = useState(false);
  const [acepto, setAcepto] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    if (!f.nombre.trim() || !f.apellidos.trim() || !f.email.trim()) return setError('Completa nombre, apellidos y correo.');
    if (f.password.length < 8 || !/[a-zA-Z]/.test(f.password) || !/\d/.test(f.password)) return setError('La contraseña debe tener al menos 8 caracteres, con letras y números.');
    if (f.password !== f.password2) return setError('Las contraseñas no coinciden.');
    if (!acepto) return setError('Debes aceptar la política de tratamiento de datos.');
    setOcupado(true);
    try {
      const { error: err } = await signUp(f.email, f.password, `${f.nombre.trim()} ${f.apellidos.trim()}`, esEmpresa ? f.empresa : '', {
        telefono: f.telefono.trim(), tipo_doc: f.tipo_doc, num_doc: f.num_doc.trim(), direccion: f.direccion.trim(), pais: f.pais,
        departamento: f.departamento.trim(), ciudad: f.ciudad.trim(), codigo_postal: f.codigo_postal.trim(),
        como_nos_conocio: f.como_nos_conocio, es_empresa: esEmpresa,
      });
      if (err) return setError(err);
      setOk(true);
      setTimeout(() => navigate('/casillero'), 1500);
    } finally {
      setOcupado(false);
    }
  };

  const campo = (k: keyof typeof f, etiqueta: string, tipo = 'text') => (
    <div><Label className="mb-1.5 block">{etiqueta}</Label><Entrada type={tipo} value={f[k]} onChange={set(k)} /></div>
  );

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <Link href="/" className="flex justify-center mb-8"><Logo className="text-3xl" /></Link>
        <div className="bg-white rounded-3xl border border-gray-100 app-shadow p-8">
          <h1 className="text-2xl font-black text-primary mb-1">Crea tu casillero</h1>
          <p className="text-muted-foreground text-sm mb-6">Recibimos tus compras en Miami y las enviamos a donde estés.</p>

          {!configured && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-orange-50 border border-orange-100 text-xs text-orange-800 mb-5">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>Supabase aún no está configurado en este entorno. El registro no funcionará hasta agregar las variables de entorno.</span>
            </div>
          )}
          {ok && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-green-50 border border-green-100 text-xs text-green-700 mb-5">
              <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>¡Cuenta creada! Si tu proyecto requiere confirmación por email, revisa tu bandeja de entrada.</span>
            </div>
          )}
          {error && <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-xs text-red-700 mb-5">{error}</div>}

          <GoogleButton onError={setError} />

          <form onSubmit={(e) => void enviar(e)} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-primary">Datos personales</h2>
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={esEmpresa} onChange={(e) => setEsEmpresa(e.target.checked)} />Soy una empresa</label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {esEmpresa && campo('empresa', 'Nombre de la empresa')}
              {campo('nombre', 'Nombre')}{campo('apellidos', 'Apellidos')}{campo('telefono', 'Teléfono', 'tel')}
              <div><Label className="mb-1.5 block">Tipo de documento</Label>
                <select className={CLASE_CAMPO} value={f.tipo_doc} onChange={set('tipo_doc')}>{['Cédula', 'Cédula de extranjería', 'Pasaporte', 'NIT'].map((x) => <option key={x}>{x}</option>)}</select></div>
              {campo('num_doc', 'Número de documento')}{campo('direccion', 'Dirección')}
              <div><Label className="mb-1.5 block">País</Label><select className={CLASE_CAMPO} value={f.pais} onChange={set('pais')}>{['Colombia', 'Estados Unidos', 'Otro'].map((x) => <option key={x}>{x}</option>)}</select></div>
              {campo('departamento', 'Departamento')}{campo('ciudad', 'Ciudad')}{campo('codigo_postal', 'Código postal')}
              <div><Label className="mb-1.5 block">¿Por qué medio nos conociste?</Label>
                <select className={CLASE_CAMPO} value={f.como_nos_conocio} onChange={set('como_nos_conocio')}><option value="">Selecciona</option>{MEDIOS.map((x) => <option key={x}>{x}</option>)}</select></div>
            </div>
            <h2 className="text-lg font-black text-primary pt-2">Datos de la cuenta</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{campo('email', 'Email', 'email')}</div>
              {campo('password', 'Contraseña', 'password')}{campo('password2', 'Confirmar', 'password')}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
              <span>Acepto la <Link href="/privacidad" className="text-accent font-bold hover:underline">política de privacidad</Link> y los <Link href="/terminos" className="text-accent font-bold hover:underline">términos</Link>, y autorizo el tratamiento de mis datos personales.</span>
            </label>
            <Button type="submit" disabled={ocupado} className="tap-scale w-full rounded-full bg-accent hover:bg-accent/90 text-white py-6 font-bold border-0 app-shadow flex items-center justify-center gap-2">
              {ocupado ? 'Creando cuenta…' : 'Crear mi casillero'}{!ocupado && <ArrowRight size={18} />}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            ¿Ya tienes cuenta? <Link href="/login?next=/casillero" className="text-accent font-bold hover:underline">Ingresa</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
