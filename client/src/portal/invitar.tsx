import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Info, MessageCircle, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/casillero';
import { Boton, BotonCopiar, Campo, Entrada, Modal } from '@/portal/ui';

// Invitar a un cliente al casillero (ver server/casillero/invitar.ts).

export interface RespuestaInvitacion {
  estado: 'invitado' | 'reenviado' | 'ya_tiene_cuenta' | 'es_equipo';
  userId: string | null;
  codigo: string | null;
  enlace: string | null;
  correoEnviado: boolean;
  correoConfigurado: boolean;
}

export function useInvitar() {
  const { getAccessToken } = useAuth();
  return async (cuerpo: { email: string; nombre?: string; empresa?: string }) => {
    const r = await api<RespuestaInvitacion>('/casillero/invitar', getAccessToken(), cuerpo);
    if (!r.ok) {
      toast.error(r.message ?? 'No pudimos crear la invitación');
      return null;
    }
    return r.data;
  };
}

/** El texto para mandar el enlace por WhatsApp. */
export function mensajeWhatsApp(enlace: string, codigo: string | null): string {
  return `Hola, te invitamos a tu casillero de Easycomex${codigo ? ` (código ${codigo})` : ''}. Crea tu contraseña aquí: ${enlace}`;
}

export function ResultadoInvitacion({ r, email }: { r: RespuestaInvitacion; email: string }) {
  if (r.estado === 'ya_tiene_cuenta' || r.estado === 'es_equipo') {
    return (
      <p className="flex items-start gap-2 rounded-2xl bg-blue-50 p-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          {r.estado === 'es_equipo'
            ? `${email} es del equipo (administrador), no hace falta invitarlo.`
            : `${email} ya tiene cuenta${r.codigo ? ` (${r.codigo})` : ''} y ya entró antes. Que ingrese con su correo; si no recuerda la contraseña, en el ingreso usa "¿La olvidaste?".`}
        </span>
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <p className={`flex items-start gap-2 rounded-2xl p-3 text-sm ${r.correoEnviado ? 'bg-green-50 text-green-800' : 'bg-orange-50 text-orange-800'}`}>
        {r.correoEnviado ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0" />}
        <span>
          {r.correoEnviado
            ? <>Le enviamos la invitación a <b>{email}</b>{r.codigo ? <> · casillero <b>{r.codigo}</b></> : null}. Si no la ve, que revise spam, o mándale el enlace por WhatsApp.</>
            : <>La cuenta {r.estado === 'invitado' ? 'quedó creada' : 'sigue lista'}{r.codigo ? <> (casillero <b>{r.codigo}</b>)</> : null}, pero el correo {r.correoConfigurado ? 'no salió' : 'de la app no está configurado'}. Mándale este enlace por WhatsApp o por tu correo.</>}
        </span>
      </p>
      {r.enlace && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Enlace para crear su contraseña (es personal: no lo publiques)</p>
          <p className="mb-3 break-all font-mono text-[11px] text-primary">{r.enlace}</p>
          <div className="flex flex-wrap gap-2">
            <BotonCopiar texto={r.enlace} etiqueta="Copiar enlace" />
            <a href={`https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp(r.enlace, r.codigo))}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700">
              <MessageCircle size={13} />Enviar por WhatsApp
            </a>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Sirve una sola vez y vence en unas horas. Si vence, ábrelo en Clientes y usa "Reenviar invitación".</p>
        </div>
      )}
    </div>
  );
}

export function InvitarCliente({ abierto, onCerrar, onListo }: { abierto: boolean; onCerrar: () => void; onListo: () => Promise<void> }) {
  const invitar = useInvitar();
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [r, setR] = useState<RespuestaInvitacion | null>(null);
  useEffect(() => { if (abierto) { setEmail(''); setNombre(''); setEmpresa(''); setR(null); } }, [abierto]);

  const enviar = async () => {
    const correo = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(correo)) return toast.error('Escribe un correo válido');
    setOcupado(true);
    const res = await invitar({ email: correo, nombre: nombre.trim(), empresa: empresa.trim() });
    setOcupado(false);
    if (!res) return;
    setR(res);
    if (res.estado === 'invitado' || res.estado === 'reenviado') await onListo();
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Invitar cliente" descripcion="Le creamos su casillero y le llega un correo para crear su contraseña. Después entra con su correo y ve su inventario, paquetes, despachos y saldo." ancho="max-w-lg">
      {r ? (
        <div className="space-y-4">
          <ResultadoInvitacion r={r} email={email.trim().toLowerCase()} />
          <div className="flex justify-end gap-2"><Boton onClick={() => setR(null)}>Invitar a otro</Boton><Boton variante="primario" onClick={onCerrar}>Listo</Boton></div>
        </div>
      ) : (
        <div className="space-y-4">
          <Campo etiqueta="Correo del cliente" id="inv-email"><Entrada id="inv-email" type="email" autoComplete="off" autoFocus placeholder="cliente@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void enviar()} /></Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Nombre (opcional)" id="inv-nombre"><Entrada id="inv-nombre" autoComplete="off" value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} /></Campo>
            <Campo etiqueta="Empresa (opcional)" id="inv-empresa"><Entrada id="inv-empresa" autoComplete="off" value={empresa} maxLength={120} onChange={(e) => setEmpresa(e.target.value)} /></Campo>
          </div>
          <div className="flex justify-end gap-2"><Boton onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" cargando={ocupado} disabled={!email.trim()} onClick={() => void enviar()} icono={<Send size={14} />}>Enviar invitación</Boton></div>
        </div>
      )}
    </Modal>
  );
}
