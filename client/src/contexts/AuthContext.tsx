import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { accountsUrl, getSupabase, hasSessionToRestore, isSupabaseConfigured, supabaseConfigProblem, Profile } from '@/lib/supabase';
import { trackSignUp } from '@/lib/analytics';
import { getStoredReferralCode, clearStoredReferralCode } from '@/lib/referral';
import { getMfaStatus } from '@/lib/mfa';
import { authErrorLog, authErrorMessage, classifyAuthError, errorDetail } from '@/lib/authErrors';
import { hostOf, probeAccountsHost, probeMessage } from '@/lib/accountsProbe';
import { captureOAuthError } from '@/lib/oauthReturn';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  // The account has 2FA enabled but this session hasn't passed the code yet.
  mfaRequired: boolean;
  refreshMfa: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string, company: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  // Bearer token for calling our own /api routes as the logged-in user.
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * El idioma sale del atributo `lang` del documento, que el selector de
 * idioma ya mantiene al día. Este contexto está por encima del de
 * idioma, así que no puede pedírselo.
 */
const enEspanol = () => (typeof document === 'undefined' ? true : document.documentElement.lang !== 'en');

/**
 * El mensaje final de un fallo de autenticación.
 *
 * Cuando la petición no llegó a ninguna parte, "Failed to fetch" tapa
 * tres cosas distintas: el host no existe, no hay red, o la política de
 * seguridad de nuestra propia página bloqueó la conexión. En vez de
 * decir "no hubo respuesta" y dejar a todo el mundo adivinando, se toca
 * el host y se dice cuál de las tres fue.
 */
async function explainAuthFailure(err: unknown): Promise<string> {
  const failure = classifyAuthError(err);
  const es = enEspanol();
  if (failure !== 'sin_respuesta') return authErrorMessage(failure, es, errorDetail(err));
  const result = await probeAccountsHost(accountsUrl);
  return probeMessage(result, hostOf(accountsUrl), es);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data } = await (await getSupabase()).from('profiles').select('*').eq('id', userId).single();
    setProfile((data as Profile) ?? null);
  };

  const refreshMfa = async () => {
    try {
      const status = await getMfaStatus();
      setMfaRequired(status.required);
    } catch {
      setMfaRequired(false);
    }
  };

  // Email sign-ups pass the referral code as auth metadata (resolved by
  // the DB trigger). Google sign-ins can't, so we apply it here on the
  // first session — the RPC is a no-op if the user was already referred.
  const applyPendingReferral = async () => {
    const code = getStoredReferralCode();
    if (!code) return;
    const { data } = await (await getSupabase()).rpc('apply_referral_code', { p_code: code });
    if (data === true) clearStoredReferralCode();
  };

  // Volver de Google con un error tiene que DECIRSE.
  //
  // El proveedor devuelve el motivo en la URL y la app no lo leía: la
  // página se pintaba igual, sin mensaje y sin sesión. Se guarda
  // traducido, se limpia la URL —si el error se queda en la barra,
  // recargar lo repite para siempre— y se manda a la pantalla de
  // entrar, que es donde se puede leer y volver a intentar.
  useEffect(() => {
    if (!captureOAuthError(enEspanol())) return;
    const donde = window.location.pathname;
    if (donde !== '/login' && donde !== '/registro') window.location.replace('/login');
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // supabase-js son 56 KB comprimidos. Quien nunca ha entrado no tiene
    // nada que restaurar, así que no hay por qué hacérselos bajar: la
    // librería llega cuando toque el botón de entrar.
    //
    // hasSessionToRestore() también reconoce la vuelta de un OAuth — si
    // eso se saltara, entrar con Google devolvería a la página sin sesión
    // y sin ningún error a la vista.
    if (!hasSessionToRestore()) {
      setLoading(false);
      return;
    }

    // `loading` tapa el dashboard con un spinner. Si la lectura de la
    // sesión falla o se queda colgada y nadie apaga esa bandera, la app
    // gira para siempre sin decir por qué — que es exactamente lo que
    // pasa con una llave mal puesta: supabase-js rechaza la promesa y un
    // `.then()` solo nunca se entera. Así que esto se apaga siempre: al
    // resolver, al fallar, y por tiempo si la red no contesta.
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      setLoading(false);
    };

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    getSupabase().then((supabase) => {
      if (cancelled) return;

      supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        if (data.session?.user) {
          fetchProfile(data.session.user.id);
          refreshMfa();
        }
        done();
      })
      .catch((err) => {
        console.error(
          '[auth] No se pudo leer la sesión de Supabase. La app sigue, pero sin login. ' +
            'Casi siempre es VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY mal puestas:',
          err
        );
        done();
      });

      const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          fetchProfile(newSession.user.id);
          refreshMfa();
          if (event === 'SIGNED_IN') applyPendingReferral().then(() => fetchProfile(newSession.user.id));
        } else {
          setProfile(null);
          setMfaRequired(false);
        }
      });

      if (cancelled) listener.subscription.unsubscribe();
      else unsubscribe = () => listener.subscription.unsubscribe();
    }).catch((err) => {
      console.error('[auth] No se pudo cargar supabase-js:', err);
      done();
    });

    // El tope de tiempo cuenta desde acá, no desde que llega la librería:
    // si el trozo de JavaScript nunca baja, el spinner también se apaga.
    const timeout = window.setTimeout(() => {
      if (!settled) {
        console.error('[auth] Supabase no contestó en 8 segundos. Seguimos sin sesión.');
        done();
      }
    }, 8000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      unsubscribe?.();
    };
  }, []);

  const signUp: AuthContextType['signUp'] = async (email, password, fullName, company) => {
    if (!isSupabaseConfigured) return { error: supabaseConfigProblem() ?? 'La conexión con el sistema de cuentas no está configurada.' };
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: fullName.trim(), company: company.trim(), referred_by_code: getStoredReferralCode() } },
      });
      if (error) return { error: error.message };

      // La fila de `profiles` la crea un trigger de la base de datos (ver
      // supabase/schema.sql). Este upsert es sólo una red por si el
      // trigger no estuviera instalado — y va SIN await a propósito:
      //
      // cuando Supabase pide confirmar el correo, quien acaba de
      // registrarse todavía no tiene sesión, así que este upsert puede
      // quedarse esperando contra las políticas RLS. Esperarlo dejaba el
      // botón "Creando cuenta…" girando para siempre aunque la cuenta ya
      // estuviera creada.
      if (data.user) {
        void supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: email.trim().toLowerCase(),
            full_name: fullName.trim(),
            company: company.trim(),
            role: 'cliente',
          })
          .then(({ error: upsertError }) => {
            if (upsertError) console.warn('[auth] el trigger de profiles ya hizo su trabajo, o RLS bloqueó el respaldo:', upsertError.message);
          });
      }

      // Los píxeles NO deciden si una cuenta se creó.
      //
      // Esta línea estaba dentro del try, sin protección. Si el píxel de
      // Meta, el de TikTok o el de Google lanzaban —un bloqueador que
      // deja un objeto a medias, un script que la CSP frenó— la
      // excepción caía en el catch de abajo y a quien acababa de crear
      // su cuenta le decíamos que no se había creado. Al reintentar le
      // salía "ya existe ese correo", que parece un segundo error
      // distinto. Analítica rota, registro perdido.
      try {
        trackSignUp({ company });
      } catch (err) {
        console.warn('[auth] el píxel de registro falló; la cuenta sí se creó:', err);
      }

      return { error: null };
    } catch (err) {
      console.error(...authErrorLog('signUp', classifyAuthError(err), err));
      return { error: await explainAuthFailure(err) };
    }
  };

  const signIn: AuthContextType['signIn'] = async (email, password) => {
    if (!isSupabaseConfigured) return { error: supabaseConfigProblem() ?? 'La conexión con el sistema de cuentas no está configurada.' };
    try {
      const { error } = await (await getSupabase()).auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      return { error: error ? error.message : null };
    } catch (err) {
      console.error(...authErrorLog('signIn', classifyAuthError(err), err));
      return { error: await explainAuthFailure(err) };
    }
  };

  const signInWithGoogle: AuthContextType['signInWithGoogle'] = async () => {
    if (!isSupabaseConfigured) return { error: supabaseConfigProblem() ?? 'La conexión con el sistema de cuentas no está configurada.' };
    // Sin este try, una excepción acá dejaba el botón de Google girando
    // para siempre y sin una palabra de por qué.
    try {
      const { error } = await (await getSupabase()).auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: { access_type: 'offline', prompt: 'select_account' },
        },
      });
      return { error: error ? error.message : null };
    } catch (err) {
      console.error(...authErrorLog('signInWithGoogle', classifyAuthError(err), err));
      return { error: await explainAuthFailure(err) };
    }
  };

  const resetPassword: AuthContextType['resetPassword'] = async (email) => {
    if (!isSupabaseConfigured) return { error: supabaseConfigProblem() ?? 'La conexión con el sistema de cuentas no está configurada.' };
    const { error } = await (await getSupabase()).auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/restablecer`,
    });
    return { error: error ? error.message : null };
  };

  const updatePassword: AuthContextType['updatePassword'] = async (password) => {
    const { error } = await (await getSupabase()).auth.updateUser({ password });
    return { error: error ? error.message : null };
  };

  // Global scope: revokes the refresh token everywhere, not just this tab.
  const signOut = async () => {
    await (await getSupabase()).auth.signOut({ scope: 'global' });
    setProfile(null);
    setMfaRequired(false);
  };

  const getAccessToken = () => session?.access_token ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        configured: isSupabaseConfigured,
        mfaRequired,
        refreshMfa,
        signUp,
        signIn,
        signInWithGoogle,
        resetPassword,
        updatePassword,
        signOut,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
