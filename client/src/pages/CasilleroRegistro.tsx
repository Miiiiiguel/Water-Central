import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMarcaDMatrix } from '@/lib/marca';

const MEDIOS = ['Instagram', 'Facebook', 'TikTok', 'WhatsApp', 'Recomendación', 'Google', 'Otro'];
const selectCls = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm';

// Registro del casillero: la misma cuenta de Easycomex (AuthContext.signUp),
// con los datos extra del formulario de DMatrixUSA. Los pasa Supabase al
// trigger handle_new_user (supabase/casillero.sql), que además le asigna
// su código de casillero (DM1001, DM1002…). El rol sigue fijo en 'cliente'.
export default function CasilleroRegistro() {
  useMarcaDMatrix('Crear mi casillero | DMatrixUSA');
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
    <div><Label>{etiqueta}</Label><Input type={tipo} value={f[k]} onChange={set(k)} /></div>
  );

  return (
    <div className="grid min-h-screen bg-white md:grid-cols-[1fr_1.5fr]">
      <div className="flex items-center justify-center bg-[#b01c2e] p-8">
        <img src="/dmatrix/logo.png" alt="DMatrixUSA" className="max-w-[260px] brightness-0 invert" />
      </div>
      <form onSubmit={(e) => void enviar(e)} className="mx-auto w-full max-w-3xl p-6 md:p-10">
        <h1 className="mb-6 text-center text-3xl">Registrarme</h1>
        {!configured && <p className="mb-4 rounded bg-amber-100 p-3 text-sm">La conexión con el sistema de cuentas no está configurada.</p>}
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl">Datos personales</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={esEmpresa} onChange={(e) => setEsEmpresa(e.target.checked)} />Soy una empresa</label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {esEmpresa && campo('empresa', 'Nombre de la empresa')}
          {campo('nombre', 'Nombre')}{campo('apellidos', 'Apellidos')}{campo('telefono', 'Teléfono', 'tel')}
          <div><Label>Tipo de documento</Label>
            <select className={selectCls} value={f.tipo_doc} onChange={set('tipo_doc')}>{['Cédula', 'Cédula de extranjería', 'Pasaporte', 'NIT'].map((x) => <option key={x}>{x}</option>)}</select></div>
          {campo('num_doc', 'Número de documento')}{campo('direccion', 'Dirección')}
          <div><Label>País</Label><select className={selectCls} value={f.pais} onChange={set('pais')}>{['Colombia', 'Estados Unidos', 'Otro'].map((x) => <option key={x}>{x}</option>)}</select></div>
          {campo('departamento', 'Departamento')}{campo('ciudad', 'Ciudad')}{campo('codigo_postal', 'Código postal')}
          <div><Label>¿Por qué medio nos conociste?</Label>
            <select className={selectCls} value={f.como_nos_conocio} onChange={set('como_nos_conocio')}><option value="">Selecciona</option>{MEDIOS.map((x) => <option key={x}>{x}</option>)}</select></div>
        </div>
        <h2 className="mb-2 mt-6 text-xl">Datos de la cuenta</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {campo('email', 'Correo electrónico', 'email')}{campo('password', 'Contraseña', 'password')}{campo('password2', 'Repetir contraseña', 'password')}
        </div>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
          <span>Acepto el <a href="https://www.dmatrixusa.com/terminosCondiciones" target="_blank" rel="noreferrer" className="text-[#b01c2e] underline">aviso de privacidad</a> y la política de tratamiento de la información, y autorizo el tratamiento de mis datos personales.</span>
        </label>
        {error && <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {ok && <p className="mt-3 rounded bg-green-50 p-3 text-sm text-green-700">¡Cuenta creada! Si te pedimos confirmar el correo, revísalo y luego inicia sesión.</p>}
        <div className="mt-5 flex items-center gap-4">
          <Button type="submit" disabled={ocupado} className="bg-[#b01c2e] hover:bg-[#8e1523]">{ocupado ? 'Creando…' : 'Crear mi casillero'}</Button>
          <Link href="/casillero/login" className="text-sm text-[#b01c2e] underline">Ya tengo cuenta</Link>
        </div>
      </form>
    </div>
  );
}
