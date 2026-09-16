import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Check, X, AlertTriangle, Loader2, Copy, ArrowLeft } from 'lucide-react';
import { accountsKey } from '@/lib/supabase';
import { runAuthCheck, type CheckLine, type CheckReport } from '@/lib/authCheck';

/**
 * /estado — por qué no se puede entrar.
 *
 * Existe porque cada intento de arreglar el registro costaba un mensaje,
 * una espera y una suposición. Entrar con Google y entrar con correo
 * pasan los dos por el cliente de Supabase, así que la pregunta útil es
 * una sola: ¿la app llega al proyecto de cuentas, y si no, dónde se
 * corta? Esta página lo prueba sola y lo deja escrito.
 *
 * No pide sesión: si hubiera que entrar para ver por qué no se puede
 * entrar, no serviría de nada.
 *
 * La llave NUNCA se enseña. Se dice si está, de qué tipo es y si el
 * proyecto la acepta; el valor no aparece ni en pantalla ni en el
 * informe que se copia.
 */
export default function Estado() {
  const [report, setReport] = useState<CheckReport | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    runAuthCheck(accountsKey).then((r) => { if (!cancelled) setReport(r); });
    return () => { cancelled = true; };
  }, []);

  const copy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const icon = (line: CheckLine) =>
    line.state === 'ok' ? (
      <Check size={16} className="text-green-600" />
    ) : line.state === 'warn' ? (
      <AlertTriangle size={16} className="text-amber-500" />
    ) : (
      <X size={16} className="text-red-600" />
    );

  const roto = report?.lines.some((l) => l.state === 'fail') ?? false;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
          <ArrowLeft size={16} />
          Volver
        </Link>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 app-shadow md:p-8">
          <h1 className="font-heading text-2xl font-black text-primary">Estado del sistema de cuentas</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Esta página prueba, en vivo, si la app puede hablar con el proyecto de cuentas. Si crear una
            cuenta o entrar con Google no funciona, acá se ve en qué punto se corta.
          </p>

          {!report ? (
            <div className="mt-8 flex items-center gap-3 text-muted-foreground">
              <Loader2 size={18} className="animate-spin" />
              Probando…
            </div>
          ) : (
            <>
              <ul className="mt-6 divide-y divide-gray-100">
                {report.lines.map((line, i) => (
                  <li key={i} className="flex items-start gap-3 py-3">
                    <span className="mt-0.5 flex-shrink-0">{icon(line)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">{line.label}</p>
                      <p className="text-sm leading-snug text-muted-foreground">{line.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div
                className={`mt-6 rounded-2xl border p-4 text-sm leading-relaxed ${
                  roto ? 'border-red-100 bg-red-50 text-red-900' : 'border-green-100 bg-green-50 text-green-900'
                }`}
              >
                {roto
                  ? 'Hay algo en rojo: eso es lo que impide entrar. La línea dice exactamente qué cambiar y dónde.'
                  : 'Todo en verde: la app llega al proyecto y el proyecto acepta la llave. Si aun así no podés entrar, el problema está en la cuenta concreta, no en la conexión.'}
              </div>

              <button
                onClick={copy}
                className="tap-scale mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 px-5 py-3 text-sm font-bold text-foreground hover:bg-gray-50"
              >
                <Copy size={15} />
                {copied ? 'Copiado' : 'Copiar informe'}
              </button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                El informe no incluye ninguna llave ni contraseña.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
