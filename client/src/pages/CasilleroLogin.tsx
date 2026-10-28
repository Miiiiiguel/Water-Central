import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { getMfaStatus } from '@/lib/mfa';
import MfaChallenge from '@/components/MfaChallenge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMarcaDMatrix } from '@/lib/marca';

// Entrada al casillero con la cara de DMatrixUSA. Usa la misma cuenta y el
// mismo AuthContext que el resto de la app (incluido el 2FA).
export default function CasilleroLogin() {
  useMarcaDMatrix('Ingresar | DMatrixUSA');
  const { signIn, resetPassword, configured } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mfa, setMfa] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo(''); setOcupado(true);
    try {
      const { error: err } = await signIn(email, password);
      if (err) return setError('Correo o contraseña incorrectos.');
      const estado = await getMfaStatus().catch(() => ({ required: false }));
      if (estado.required) return setMfa(true);
      navigate('/casillero');
    } catch {
      setError('No pudimos entrar. Intenta de nuevo.');
    } finally {
      setOcupado(false);
    }
  };

  const olvide = async () => {
    setError(''); setInfo('');
    if (!email.trim()) return setError('Escribe tu correo y vuelve a pulsar "Olvidé mi contraseña".');
    await resetPassword(email);
    setInfo('Si ese correo tiene cuenta, te enviamos un enlace para restablecer la contraseña. Vence en 1 hora.');
  };

  return (
    <div className="grid min-h-screen bg-white md:grid-cols-[1fr_1.4fr]">
      <div className="flex items-center justify-center bg-[#b01c2e] p-8">
        <img src="/dmatrix/logo.png" alt="DMatrixUSA" className="max-w-[260px] brightness-0 invert" />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-col justify-center p-6">
        <h1 className="mb-6 text-center text-3xl">Iniciar sesión</h1>
        {mfa ? (
          <MfaChallenge onSuccess={() => navigate('/casillero')} />
        ) : (
          <form onSubmit={(e) => void entrar(e)} className="space-y-4">
            {!configured && <p className="rounded bg-amber-100 p-3 text-sm">La conexión con el sistema de cuentas no está configurada.</p>}
            <div><Label>Correo electrónico</Label><Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Contraseña</Label><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {info && <p className="rounded bg-green-50 p-3 text-sm text-green-700">{info}</p>}
            <Button type="submit" disabled={ocupado} className="w-full bg-[#b01c2e] hover:bg-[#8e1523]">{ocupado ? 'Entrando…' : 'Ingresar'}</Button>
            <button type="button" onClick={() => void olvide()} className="text-sm text-[#b01c2e] underline">Olvidé mi contraseña</button>
            <p className="text-sm">¿No tienes casillero? <Link href="/casillero/registro" className="text-[#b01c2e] underline">Créalo gratis</Link> · <Link href="/rastreo" className="text-[#b01c2e] underline">Rastrea un paquete</Link></p>
          </form>
        )}
      </div>
    </div>
  );
}
