import { Eye, EyeOff, Info, Loader2, Lock, Mail, User } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Logo } from "@/components/layout/AppShell";
import { DemoThumb } from "@/components/technique/FormDemo";
import { Button, Segmented } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Mode = "entrar" | "registro" | "recuperar";

function Field({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-fg">
        {label}
      </label>
      <div className="flex h-13 items-center gap-3 rounded-2xl border border-line-strong bg-ink-850 px-4 focus-within:border-fg/60">
        <span className="text-muted">{icon}</span>
        {children}
      </div>
    </div>
  );
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
  </svg>
);

export default function Login() {
  const { signIn, signUp, signInWithGoogle, resetPassword, mode: authMode } = useAuth();
  const [mode, setMode] = useState<Mode>("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "recuperar") {
        const err = await resetPassword(email);
        if (err) setError(err);
        else setNotice("Listo. Revisa tu correo y sigue el enlace para crear una contraseña nueva.");
      } else if (mode === "registro") {
        const err = await signUp(name, email, password);
        if (err?.startsWith("Te enviamos")) setNotice(err);
        else if (err) setError(err);
      } else {
        const err = await signIn(email, password);
        if (err) setError(err);
      }
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    const err = await signInWithGoogle();
    if (err) setError(err);
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_40%_40%,rgb(255_59_78/0.28),transparent_70%),radial-gradient(50%_50%_at_90%_100%,rgb(60_123_255/0.2),transparent_70%)]" />
        <div className="relative flex h-full flex-col p-10">
          <Logo />
          <div className="flex flex-1 items-center justify-center">
            <DemoThumb demoId="deadlift" animate className="h-[52vh] max-h-[460px]" />
          </div>
          <h2 className="title-display max-w-lg text-6xl">
            Cada repetición, <span className="text-gradient-brand">bien hecha</span>
          </h2>
          <p className="mt-3 max-w-md text-lg text-fg/90">Técnica guiada, entrenos que se adaptan a ti, nutrición y clases en vivo. Tu historial te acompaña en todos tus dispositivos.</p>
        </div>
      </aside>

      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="title-display text-5xl">
            {mode === "registro" ? "Crea tu cuenta" : mode === "recuperar" ? "Recupera tu acceso" : "Bienvenido de vuelta"}
          </h1>
          <p className="mt-2 text-fg/90">
            {mode === "registro"
              ? "Guarda tus entrenos, comidas y progreso en un solo lugar."
              : mode === "recuperar"
                ? "Te enviaremos un enlace para crear una contraseña nueva."
                : "Inicia sesión para seguir donde lo dejaste."}
          </p>

          {mode !== "recuperar" && (
            <Segmented
              className="mt-6"
              value={mode}
              onChange={m => {
                setMode(m);
                setError(null);
                setNotice(null);
              }}
              options={[
                { value: "entrar", label: "Iniciar sesión" },
                { value: "registro", label: "Crear cuenta" },
              ]}
            />
          )}

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {mode === "registro" && (
              <Field id="af-name" label="Nombre" icon={<User className="size-5" />}>
                <input id="af-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" className="h-full flex-1 bg-transparent text-base outline-none placeholder:text-muted" required />
              </Field>
            )}
            <Field id="af-email" label="Correo electrónico" icon={<Mail className="size-5" />}>
              <input id="af-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" className="h-full flex-1 bg-transparent text-base outline-none placeholder:text-muted" required />
            </Field>
            {mode !== "recuperar" && (
              <Field id="af-password" label="Contraseña" icon={<Lock className="size-5" />}>
                <input
                  id="af-password"
                  type={show ? "text" : "password"}
                  autoComplete={mode === "registro" ? "new-password" : "current-password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === "registro" ? "Mínimo 8 caracteres, con números" : "Tu contraseña"}
                  className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
                  required
                />
                <button type="button" onClick={() => setShow(v => !v)} className="text-muted hover:text-fg" aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </Field>
            )}

            {mode === "entrar" && (
              <button type="button" onClick={() => { setMode("recuperar"); setError(null); }} className="text-sm font-semibold text-sky-300 hover:underline">
                ¿Olvidaste tu contraseña?
              </button>
            )}

            {error && (
              <p role="alert" className="rounded-2xl border border-brand/40 bg-brand/12 p-3 text-sm font-medium text-brand-300">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-2xl border border-success/40 bg-success/12 p-3 text-sm font-medium text-success">
                {notice}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={busy || !email || (mode !== "recuperar" && !password)}>
              {busy && <Loader2 className="size-5 animate-spin" />}
              {mode === "registro" ? "Crear cuenta" : mode === "recuperar" ? "Enviar enlace" : "Iniciar sesión"}
            </Button>
          </form>

          {mode === "recuperar" ? (
            <button onClick={() => { setMode("entrar"); setError(null); setNotice(null); }} className="mt-5 text-sm font-semibold text-sky-300 hover:underline">
              ← Volver a iniciar sesión
            </button>
          ) : (
            <>
              <div className="my-6 flex items-center gap-3 text-sm text-muted">
                <span className="h-px flex-1 bg-line-strong" /> o <span className="h-px flex-1 bg-line-strong" />
              </div>
              <button
                onClick={google}
                className="flex h-13 w-full items-center justify-center gap-3 rounded-full border border-line-strong bg-white text-[15px] font-semibold text-ink-950 transition hover:bg-white/90"
              >
                <GoogleIcon /> Continuar con Google
              </button>
            </>
          )}

          <p className={cn("mt-8 flex gap-2 rounded-2xl border border-line-strong bg-ink-900 p-3.5 text-sm text-fg/90")}>
            <Info className="mt-0.5 size-4 shrink-0 text-sky-300" />
            {authMode === "cloud"
              ? "Tu historial se guarda de forma segura en la nube y se sincroniza entre tus dispositivos."
              : "Modo dispositivo: tu cuenta y tu historial se guardan en este navegador. Al conectar la nube, se sincronizarán entre dispositivos."}
          </p>
        </div>
      </main>
    </div>
  );
}
