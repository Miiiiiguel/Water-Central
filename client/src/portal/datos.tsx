import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api, db, saldoDe, type ConfigCasillero, type Despacho, type MovimientoWallet, type Paquete, type Tarifa } from '@/lib/casillero';

// Los datos del portal del cliente se cargan una vez y se comparten entre
// secciones (cambiar de pestaña no vuelve a pedirlos). Se refrescan al
// volver a la pestaña del navegador y después de cada acción.

export interface ConfigServidor { usdCop: number; minUsd: number; maxUsd: number; wompi: boolean }

interface Datos {
  paquetes: Paquete[];
  despachos: Despacho[];
  movs: MovimientoWallet[];
  tarifas: Tarifa[];
  config: ConfigCasillero;
  servidor: ConfigServidor | null;
  saldo: number;
  cargando: boolean;
  error: string | null;
  recargar: () => Promise<void>;
}

const Ctx = createContext<Datos | null>(null);

export function DatosProvider({ children }: { children: ReactNode }) {
  const { user, getAccessToken } = useAuth();
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [movs, setMovs] = useState<MovimientoWallet[]>([]);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [config, setConfig] = useState<ConfigCasillero>({});
  const [servidor, setServidor] = useState<ConfigServidor | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      const s = await db();
      const [p, d, m, t, c] = await Promise.all([
        s.from('casillero_paquetes').select('*').order('created_at', { ascending: false }),
        s.from('casillero_despachos').select('*').order('created_at', { ascending: false }),
        s.from('casillero_wallet').select('*').order('created_at', { ascending: false }),
        s.from('casillero_tarifas').select('*').order('libras_desde'),
        s.from('casillero_config').select('clave,valor'),
      ]);
      const fallo = [p, d, m, t].find((r) => r.error);
      if (fallo?.error) throw fallo.error;
      setPaquetes((p.data ?? []) as Paquete[]);
      setDespachos((d.data ?? []) as Despacho[]);
      setMovs((m.data ?? []) as MovimientoWallet[]);
      setTarifas((t.data ?? []) as Tarifa[]);
      setConfig(Object.fromEntries(((c.data ?? []) as { clave: string; valor: string }[]).map((x) => [x.clave, x.valor])));
      setError(null);
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'No pudimos cargar tus datos.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { if (user) void recargar(); }, [user, recargar]);
  useEffect(() => {
    if (!user) return;
    void api<ConfigServidor>('/casillero/config', getAccessToken()).then((r) => r.ok && setServidor(r.data));
  }, [user, getAccessToken]);
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') void recargar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [recargar]);

  const saldo = useMemo(() => saldoDe(movs), [movs]);
  const valor = useMemo(() => ({ paquetes, despachos, movs, tarifas, config, servidor, saldo, cargando, error, recargar }), [paquetes, despachos, movs, tarifas, config, servidor, saldo, cargando, error, recargar]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useDatos(): Datos {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDatos necesita <DatosProvider>');
  return c;
}
