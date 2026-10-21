import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { actions, switchUser } from "./store";
import { cloudEnabled, supabase } from "./supabase";
import { startSync } from "./sync";
import { uid } from "./utils";

/*
 * Accounts.
 *
 * Cloud mode (Supabase configured): email + password, Google and password
 * reset through Supabase Auth.
 *
 * Device mode (no Supabase): accounts live on this device only. Passwords
 * are stored as salted PBKDF2 hashes, never in clear text. It exists so
 * the app can be tried anywhere; the sign-in screen says which mode is on.
 */

export interface Account {
  id: string;
  email: string;
  name: string;
  provider: "email" | "google";
  createdAt: number;
}

export interface LoginRecord {
  at: number;
  method: "password" | "google" | "signup";
  device: string;
}

interface StoredAccount extends Account {
  salt: string;
  hash: string;
}

interface AuthValue {
  ready: boolean;
  user: Account | null;
  mode: "cloud" | "device";
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const ACCOUNTS_KEY = "americanfit:accounts";
const SESSION_KEY = "americanfit:session";

function readAccounts(): StoredAccount[] {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as StoredAccount[];
  } catch {
    return [];
  }
}

function writeAccounts(list: StoredAccount[]) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  } catch {
    // Ignore: the session still works in memory.
  }
}

function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Navegador";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "";
  return br ? `${br} · ${os}` : os;
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

async function hashPassword(password: string, salt: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 120_000, hash: "SHA-256" }, key, 256);
  return toHex(bits);
}

const normEmail = (e: string) => e.trim().toLowerCase();

export function validatePassword(p: string) {
  if (p.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (!/\d/.test(p) || !/[a-zA-Z]/.test(p)) return "Usa letras y números en la contraseña.";
  return null;
}

const CLOUD_ERRORS: Record<string, string> = {
  "Invalid login credentials": "Correo o contraseña incorrectos.",
  "User already registered": "Ya existe una cuenta con ese correo. Inicia sesión.",
  "Email not confirmed": "Confirma tu correo con el enlace que te enviamos y vuelve a intentarlo.",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Account | null>(null);

  const activate = useCallback((acc: Account | null) => {
    switchUser(acc?.id ?? null);
    setUser(acc);
  }, []);

  useEffect(() => {
    if (supabase) {
      const fromSession = (u: { id: string; email?: string; created_at: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } | undefined) =>
        u
          ? {
              id: u.id,
              email: u.email ?? "",
              name: (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || (u.email ?? "").split("@")[0]!,
              provider: (u.app_metadata?.provider === "google" ? "google" : "email") as Account["provider"],
              createdAt: new Date(u.created_at).getTime(),
            }
          : null;
      supabase.auth.getSession().then(({ data }) => {
        activate(fromSession(data.session?.user));
        setReady(true);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        const acc = fromSession(session?.user);
        activate(acc);
        if (event === "SIGNED_IN" && acc) actions.recordLogin({ at: Date.now(), method: acc.provider === "google" ? "google" : "password", device: deviceLabel() });
      });
      return () => sub.subscription.unsubscribe();
    }
    let sessionId: string | null = null;
    try {
      sessionId = localStorage.getItem(SESSION_KEY);
    } catch {
      // Ignore.
    }
    const acc = readAccounts().find(a => a.id === sessionId);
    if (acc) activate(acc);
    setReady(true);
  }, [activate]);

  useEffect(() => (user && supabase ? startSync(user.id) : undefined), [user]);

  const remember = (acc: StoredAccount, method: LoginRecord["method"]) => {
    try {
      localStorage.setItem(SESSION_KEY, acc.id);
    } catch {
      // Ignore.
    }
    activate(acc);
    actions.recordLogin({ at: Date.now(), method, device: deviceLabel() });
  };

  const value: AuthValue = {
    ready,
    user,
    mode: cloudEnabled ? "cloud" : "device",
    async signUp(name, email, password) {
      const bad = validatePassword(password);
      if (bad) return bad;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return "Escribe un correo válido.";
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: normEmail(email),
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin },
        });
        if (error) return CLOUD_ERRORS[error.message] ?? error.message;
        if (!data.session) return "Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego inicia sesión.";
        return null;
      }
      const list = readAccounts();
      if (list.some(a => a.email === normEmail(email))) return "Ya existe una cuenta con ese correo en este dispositivo. Inicia sesión.";
      const salt = uid() + uid();
      const acc: StoredAccount = {
        id: `local-${uid()}`,
        email: normEmail(email),
        name: name.trim() || normEmail(email).split("@")[0]!,
        provider: "email",
        createdAt: Date.now(),
        salt,
        hash: await hashPassword(password, salt),
      };
      writeAccounts([acc, ...list]);
      remember(acc, "signup");
      return null;
    },
    async signIn(email, password) {
      if (supabase) {
        const { error } = await supabase.auth.signInWithPassword({ email: normEmail(email), password });
        return error ? CLOUD_ERRORS[error.message] ?? error.message : null;
      }
      const acc = readAccounts().find(a => a.email === normEmail(email));
      if (!acc || (await hashPassword(password, acc.salt)) !== acc.hash) return "Correo o contraseña incorrectos.";
      remember(acc, "password");
      return null;
    },
    async signInWithGoogle() {
      if (!supabase) return "El acceso con Google se activa al conectar Supabase. Por ahora crea una cuenta con tu correo.";
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
      return error ? error.message : null;
    },
    async resetPassword(email) {
      if (!supabase) return "En modo dispositivo no podemos enviar correos. Crea una cuenta nueva o conecta Supabase para recuperar contraseñas.";
      const { error } = await supabase.auth.resetPasswordForEmail(normEmail(email), { redirectTo: `${window.location.origin}/perfil` });
      return error ? error.message : null;
    },
    async signOut() {
      if (supabase) await supabase.auth.signOut();
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {
        // Ignore.
      }
      activate(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
