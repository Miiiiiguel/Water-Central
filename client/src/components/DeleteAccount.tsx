import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

/**
 * Borrar la cuenta.
 *
 * Existe porque la política de privacidad dice "puedes eliminar tu
 * cuenta desde el dashboard", y durante un tiempo eso no fue cierto.
 *
 * Tres decisiones de diseño, todas por la misma razón — que nadie borre
 * su cuenta sin querer:
 *   - está plegado, no suelto entre los demás botones;
 *   - hay que escribir BORRAR, que un dedo en el móvil no acierta solo;
 *   - dice antes de borrar qué se va y qué se queda, sin eufemismos.
 */
export default function DeleteAccount() {
  const { language } = useLanguage();
  const { getAccessToken, signOut } = useAuth();
  const es = language === 'es';

  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const palabra = es ? 'BORRAR' : 'BORRAR';
  const listo = confirm.trim().toUpperCase() === palabra;

  const borrar = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ confirm: palabra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? (es ? 'No se pudo borrar la cuenta.' : 'Could not delete the account.'));
        setBusy(false);
        return;
      }
      // La sesión ya no apunta a nada: salir deja el navegador limpio.
      await signOut();
      window.location.href = '/';
    } catch {
      setError(es ? 'No hay conexión. Intenta de nuevo.' : 'No connection. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 app-shadow p-6">
      {!open ? (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="font-bold text-primary">{es ? 'Borrar mi cuenta' : 'Delete my account'}</p>
            <p className="text-sm text-muted-foreground">
              {es ? 'Elimina tu acceso y tus datos personales. No se puede deshacer.' : 'Removes your access and personal data. It cannot be undone.'}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setOpen(true)}
            className="tap-scale-sm rounded-full border-red-200 text-red-700 hover:bg-red-50 flex-shrink-0"
          >
            <Trash2 size={16} className="mr-2" />
            {es ? 'Borrar cuenta' : 'Delete account'}
          </Button>
        </div>
      ) : (
        <div>
          <p className="flex items-center gap-2 font-bold text-red-700 mb-3">
            <AlertTriangle size={18} />
            {es ? '¿Seguro que quieres borrar tu cuenta?' : 'Delete your account for good?'}
          </p>

          <div className="text-sm text-muted-foreground space-y-2 mb-4">
            <p>
              <strong className="text-primary">{es ? 'Se borra:' : 'Deleted:'}</strong>{' '}
              {es
                ? 'tu acceso, tu perfil, tus compras registradas y tus avisos.'
                : 'your login, profile, recorded purchases and notifications.'}
            </p>
            <p>
              <strong className="text-primary">{es ? 'Se queda:' : 'Kept:'}</strong>{' '}
              {es
                ? 'las cotizaciones y diagnósticos que hiciste, pero sin tu nombre — son registros contables de Easycomex y quedan sin dueño.'
                : 'the quotes and diagnoses you ran, with your name removed — they are Easycomex business records and stay unlinked.'}
            </p>
          </div>

          <label className="block text-sm font-semibold text-primary mb-1.5" htmlFor="confirmar-borrado">
            {es ? `Escribe ${palabra} para confirmar` : `Type ${palabra} to confirm`}
          </label>
          <input
            id="confirmar-borrado"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-red-400"
            placeholder={palabra}
          />

          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2 mt-4 flex-wrap">
            <Button
              onClick={borrar}
              disabled={!listo || busy}
              className="tap-scale-sm rounded-full bg-red-600 hover:bg-red-700 text-white border-0 disabled:opacity-50"
            >
              {busy ? (es ? 'Borrando…' : 'Deleting…') : es ? 'Borrar para siempre' : 'Delete for good'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setConfirm('');
                setError(null);
              }}
              disabled={busy}
              className="tap-scale-sm rounded-full"
            >
              {es ? 'Cancelar' : 'Cancel'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
