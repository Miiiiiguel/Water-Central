import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Camera, Image as ImageIcon, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  analizarFoto, estadoDelLector, prepararFoto, reinterpretar,
  NOMBRE_CAPA, NOMBRE_CUIDADO, NOMBRE_FIBRA,
  type Analisis, type FotoLista, type Genero, type Tejido,
} from '@/lib/etiqueta';

/**
 * /analizar — "Analizar producto".
 *
 * Una pantalla, un botón: tomar la foto de la etiqueta. Lo que pasa
 * después —leerla, sacar la composición, reconocer la prenda— es
 * trabajo del servidor; acá sólo se muestra lo que se entendió y se
 * pregunta lo que falta.
 *
 * Dos decisiones de fondo:
 *
 *   - La foto se reduce antes de subirla. Una etiqueta se lee igual de
 *     bien a 1600 px, y el cliente que está en una bodega con mala
 *     señal no puede esperar a que suban cinco megas.
 *   - Nada se rellena solo. Si la etiqueta no dice si la tela es de
 *     punto o plana, se pregunta: ese dato cambia el capítulo del
 *     arancel entero, y suponerlo sale caro en aduana.
 */
export default function AnalizarProducto() {
  const { getAccessToken, user } = useAuth();
  const [lector, setLector] = useState<{ ocr: boolean; falta: string | null } | null>(null);
  const [foto, setFoto] = useState<{ vista: string; lista: FotoLista } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [respuestas, setRespuestas] = useState<{ genero?: Genero; tejido?: Tejido }>({});
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  useEffect(() => {
    estadoDelLector().then(setLector);
  }, []);

  // La vista previa es una URL temporal del navegador; hay que soltarla.
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.vista); }, [foto]);

  const tomarFoto = async (archivo: File | undefined) => {
    if (!archivo) return;
    setProblema(null);
    setAnalisis(null);
    try {
      const lista = await prepararFoto(archivo);
      const vista = URL.createObjectURL(archivo);
      setFoto({ vista, lista });
      if (lista.demasiadoChica) {
        setProblema('Esa imagen es muy pequeña y la letra de la etiqueta no se va a leer. Acercate y tomala de nuevo.');
        return;
      }
      await enviar(lista);
    } catch (err) {
      setProblema((err as Error).message || 'No pudimos abrir esa imagen.');
    }
  };

  const enviar = async (lista: FotoLista) => {
    setCargando(true);
    const r = await analizarFoto(getAccessToken(), lista, respuestas);
    setCargando(false);
    if (r.estado === 'ok') { setAnalisis(r.analisis); return; }
    if (r.estado === 'sin_sesion') { setProblema('Entrá a tu cuenta para analizar productos.'); return; }
    setProblema(r.mensaje);
  };

  /** La persona contesta lo que faltaba: se recalcula sin gastar otra foto. */
  const contestar = async (campo: 'genero' | 'tejido', valor: string) => {
    const nuevas = { ...respuestas, [campo]: valor as Genero & Tejido };
    setRespuestas(nuevas);
    if (!analisis) return;
    setCargando(true);
    const r = await reinterpretar(getAccessToken(), analisis.texto, nuevas);
    setCargando(false);
    if (r.estado === 'ok') setAnalisis(r.analisis);
  };

  const reiniciar = () => {
    if (foto) URL.revokeObjectURL(foto.vista);
    setFoto(null);
    setAnalisis(null);
    setProblema(null);
    setRespuestas({});
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 pb-28">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver
        </Link>

        <h1 className="text-3xl font-bold tracking-tight">Analizar producto</h1>
        <p className="mt-2 text-muted-foreground">
          Tomá una foto de la etiqueta de composición. Leemos la tela, la prenda y lo que haga falta
          para clasificarla en el arancel de Estados Unidos.
        </p>

        {lector && !lector.ocr && (
          <p className="mt-6 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            <span>
              La lectura de fotos todavía no está activada en el servidor. Es configuración nuestra, no tuya:
              avisale al equipo{lector.falta ? ` (falta ${lector.falta})` : ''}.
            </span>
          </p>
        )}

        {!user && (
          <p className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-sm">
            Entrá a tu cuenta para analizar productos.{' '}
            <Link href="/login" className="font-medium underline">Entrar</Link>
          </p>
        )}

        {!foto && (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => camara.current?.click()}
              disabled={!user || (lector ? !lector.ocr : false)}
              className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card font-medium transition hover:border-primary hover:bg-primary/5 disabled:opacity-50"
            >
              <Camera className="h-7 w-7" aria-hidden="true" />
              Tomar foto
            </button>
            <button
              type="button"
              onClick={() => galeria.current?.click()}
              disabled={!user || (lector ? !lector.ocr : false)}
              className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card font-medium transition hover:border-primary hover:bg-primary/5 disabled:opacity-50"
            >
              <ImageIcon className="h-7 w-7" aria-hidden="true" />
              Subir una imagen
            </button>
          </div>
        )}

        {/* `capture` abre la cámara trasera directamente en el teléfono. */}
        <input
          ref={camara} type="file" accept="image/*" capture="environment" className="sr-only"
          aria-label="Tomar foto de la etiqueta"
          onChange={(e) => tomarFoto(e.target.files?.[0])}
        />
        <input
          ref={galeria} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
          aria-label="Subir imagen de la etiqueta"
          onChange={(e) => tomarFoto(e.target.files?.[0])}
        />

        {foto && (
          <div className="mt-8 space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border">
              <img src={foto.vista} alt="Etiqueta fotografiada" className="max-h-72 w-full object-contain bg-muted" />
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={reiniciar} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Otra foto
              </button>
              <span className="self-center text-xs text-muted-foreground">
                {foto.lista.ancho}×{foto.lista.alto} px
              </span>
            </div>
          </div>
        )}

        {cargando && (
          <p className="mt-8 flex items-center gap-3 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Leyendo la etiqueta…
          </p>
        )}

        {problema && (
          <p className="mt-8 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{problema}</p>
        )}

        {analisis && !cargando && <Resultado analisis={analisis} onContestar={contestar} />}
      </div>
    </main>
  );
}

function Resultado({
  analisis,
  onContestar,
}: {
  analisis: Analisis;
  onContestar: (campo: 'genero' | 'tejido', valor: string) => void;
}) {
  const { etiqueta, prenda, preguntas } = analisis;

  if (!analisis.legible) {
    return (
      <section className="mt-8 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm">
        <p className="font-medium">No se leyó nada en esa foto.</p>
        <p className="mt-1 text-muted-foreground">{analisis.consejo}</p>
      </section>
    );
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Lo que dice la etiqueta</h2>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Dato titulo="Prenda" valor={prenda.prenda?.etiqueta ?? 'Sin identificar'} />
          <Dato
            titulo="Tela"
            valor={
              prenda.tejido
                ? `${prenda.tejido === 'punto' ? 'De punto' : 'Plana'}${prenda.origenDelTejido === 'habitual' ? ' (supuesto)' : ''}`
                : 'Falta saberlo'
            }
          />
          <Dato titulo="Para" valor={NOMBRE_GENERO[prenda.genero ?? ''] ?? 'Falta saberlo'} />
          <Dato titulo="Origen" valor={etiqueta.origen ?? 'No figura'} />
          {etiqueta.talla && <Dato titulo="Talla" valor={etiqueta.talla} />}
          {etiqueta.rn && <Dato titulo="RN" valor={etiqueta.rn} />}
        </dl>

        {etiqueta.capas.length > 0 && (
          <div className="mt-6 space-y-3">
            {etiqueta.capas.map((capa) => (
              <div key={capa.capa}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {NOMBRE_CAPA[capa.capa] ?? capa.capa}
                </p>
                <p className="mt-1">
                  {capa.fibras
                    .map((f) => `${f.porcentaje !== null ? f.porcentaje + '% ' : ''}${NOMBRE_FIBRA[f.fibra] ?? f.fibra}`)
                    .join(' · ')}
                </p>
              </div>
            ))}
          </div>
        )}

        {etiqueta.fibraPrincipal && (
          <p className="mt-5 rounded-xl bg-primary/10 p-3 text-sm">
            Para el arancel manda la fibra de mayor peso en la tela exterior:{' '}
            <strong>{NOMBRE_FIBRA[etiqueta.fibraPrincipal.fibra] ?? etiqueta.fibraPrincipal.fibra}</strong>
            {etiqueta.fibraPrincipal.porcentaje !== null ? ` (${etiqueta.fibraPrincipal.porcentaje}%)` : ''}.
          </p>
        )}

        {etiqueta.cuidados.length > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Cuidados: {etiqueta.cuidados.map((c) => NOMBRE_CUIDADO[c] ?? c).join(' · ')}
          </p>
        )}
      </div>

      {etiqueta.advertencias.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm">
          <p className="font-medium">Revisá esto antes de clasificar</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {etiqueta.advertencias.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </div>
      )}

      {preguntas.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Falta un dato</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sin esto no se puede llegar a una partida arancelaria correcta.
          </p>
          <div className="mt-4 space-y-5">
            {preguntas.map((p) => (
              <div key={p.campo}>
                <p className="text-sm">{p.pregunta}</p>
                {p.opciones && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.opciones.map((o) => (
                      <button
                        key={o.valor}
                        type="button"
                        onClick={() => onContestar(p.campo as 'genero' | 'tejido', o.valor)}
                        className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-primary hover:bg-primary/5"
                      >
                        {o.etiqueta}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <details className="rounded-2xl border border-border bg-card p-5">
        <summary className="cursor-pointer text-sm font-medium">Ver el texto leído</summary>
        <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">{analisis.texto}</pre>
      </details>

      <p className="text-xs text-muted-foreground">
        La clasificación arancelaria y el cálculo del impuesto llegan en la próxima entrega. Por ahora
        esto lee la etiqueta y deja los datos listos.
      </p>
    </section>
  );
}

const NOMBRE_GENERO: Record<string, string> = {
  hombre: 'Hombre',
  mujer: 'Mujer',
  nina_nino: 'Niño o niña',
  bebe: 'Bebé',
};

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</dt>
      <dd className="mt-1">{valor}</dd>
    </div>
  );
}
