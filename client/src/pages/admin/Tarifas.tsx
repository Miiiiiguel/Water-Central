import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Calculator, Plus, Trash2 } from 'lucide-react';
import { Aparece, BarraCambios, Boton, Campo, Entrada, ErrorCarga, PageHeader, Seccion, Skeleton, useAsync, useConfirmar, cn } from '@/portal/ui';
import { Barras, PALETA } from '@/portal/charts';
import { usd } from '@/portal/format';
import { MODALIDADES, cotizarTodas, db, validarTarifas, type ConfigCasillero, type Modalidad, type Tarifa } from '@/lib/casillero';

// La tabla de tarifas se edita completa en pantalla y se guarda de una vez,
// ya revisada: sin rangos traslapados ni precios inválidos. Debajo, el precio
// por libra extra y una calculadora que usa lo que estás editando.

interface Borrador { llave: string; id?: number; desde: string; hasta: string; precios: Record<Modalidad, string> }
const MODS = Object.keys(MODALIDADES) as Modalidad[];
const COLOR_MOD: Record<Modalidad, string> = { rec_oficina: PALETA.marino, local: PALETA.naranja, regional: PALETA.indigo, nacional: PALETA.celeste };
const EXTRA = (m: Modalidad) => `libra_extra_${m}`;

const aBorrador = (t: Tarifa): Borrador => ({ llave: `t${t.id}`, id: t.id, desde: String(t.libras_desde), hasta: String(t.libras_hasta), precios: { rec_oficina: String(t.rec_oficina), local: String(t.local), regional: String(t.regional), nacional: String(t.nacional) } });
const aNumeros = (b: Borrador) => ({ libras_desde: Number(b.desde), libras_hasta: Number(b.hasta), rec_oficina: b.precios.rec_oficina === '' ? Number.NaN : Number(b.precios.rec_oficina), local: b.precios.local === '' ? Number.NaN : Number(b.precios.local), regional: b.precios.regional === '' ? Number.NaN : Number(b.precios.regional), nacional: b.precios.nacional === '' ? Number.NaN : Number(b.precios.nacional) });
const firma = (b: Borrador) => JSON.stringify([b.desde, b.hasta, ...MODS.map((m) => Number(b.precios[m]))]);

export default function Tarifas() {
  const confirmar = useConfirmar();
  const d = useAsync(async () => {
    const s = await db();
    const [t, c] = await Promise.all([s.from('casillero_tarifas').select('*').order('libras_desde'), s.from('casillero_config').select('clave,valor')]);
    if (t.error) throw t.error;
    return { tarifas: (t.data ?? []) as Tarifa[], config: Object.fromEntries(((c.data ?? []) as { clave: string; valor: string }[]).map((x) => [x.clave, x.valor])) as ConfigCasillero };
  }, []);

  const [filas, setFilas] = useState<Borrador[]>([]);
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [peso, setPeso] = useState('4.5');
  const [guardando, setGuardando] = useState(false);
  const [intento, setIntento] = useState(false);

  useEffect(() => {
    if (!d.datos) return;
    setFilas(d.datos.tarifas.map(aBorrador));
    setExtras(Object.fromEntries(MODS.map((m) => [EXTRA(m), d.datos!.config[EXTRA(m)] ?? ''])));
    setIntento(false);
  }, [d.datos]);

  const originales = d.datos?.tarifas ?? [];
  const numeros = useMemo(() => filas.map(aNumeros), [filas]);
  const { errores, avisos } = useMemo(() => validarTarifas(numeros), [numeros]);
  const borradas = originales.filter((o) => !filas.some((f) => f.id === o.id));
  const cambiadas = filas.filter((f) => f.id === undefined || firma(f) !== firma(aBorrador(originales.find((o) => o.id === f.id)!)));
  const extrasCambiados = MODS.filter((m) => (extras[EXTRA(m)] ?? '') !== (d.datos?.config[EXTRA(m)] ?? ''));
  const sucio = cambiadas.length + borradas.length + extrasCambiados.length > 0;

  const tabla: Tarifa[] = useMemo(() => numeros.map((n, i) => ({ id: i, ...n })), [numeros]);
  const configVista = useMemo(() => ({ ...(d.datos?.config ?? {}), ...extras }), [d.datos, extras]);
  const lb = Number(peso);
  const cotizacion = Number.isFinite(lb) && lb > 0 && !errores.length ? cotizarTodas(tabla, lb, configVista) : null;

  const cambiar = (llave: string, parche: Partial<Omit<Borrador, 'precios'>> & { precio?: [Modalidad, string] }) =>
    setFilas((l) => l.map((f) => (f.llave === llave ? { ...f, ...(parche.desde !== undefined && { desde: parche.desde }), ...(parche.hasta !== undefined && { hasta: parche.hasta }), precios: parche.precio ? { ...f.precios, [parche.precio[0]]: parche.precio[1] } : f.precios } : f)));
  const agregar = () => {
    const ult = [...numeros].filter((n) => Number.isInteger(n.libras_hasta)).sort((a, b) => b.libras_hasta - a.libras_hasta)[0];
    const desde = ult ? ult.libras_hasta + 1 : 1;
    setFilas((l) => [...l, { llave: `n${Date.now()}`, desde: String(desde), hasta: String(desde + 1), precios: ult ? { rec_oficina: String(ult.rec_oficina), local: String(ult.local), regional: String(ult.regional), nacional: String(ult.nacional) } : { rec_oficina: '', local: '', regional: '', nacional: '' } }]);
  };
  const quitar = async (f: Borrador) => {
    if (f.id !== undefined && !(await confirmar({ titulo: `¿Quitar el rango ${f.desde}–${f.hasta} lb?`, texto: 'Los paquetes con ese peso quedarán fuera de la tabla hasta que agregues otro rango. Se aplica al guardar.', confirmar: 'Quitar', peligro: true }))) return;
    setFilas((l) => l.filter((x) => x.llave !== f.llave));
  };
  const descartar = () => { if (d.datos) { setFilas(d.datos.tarifas.map(aBorrador)); setExtras(Object.fromEntries(MODS.map((m) => [EXTRA(m), d.datos!.config[EXTRA(m)] ?? '']))); setIntento(false); } };

  const guardar = async () => {
    setIntento(true);
    const extraMal = extrasCambiados.find((m) => { const v = extras[EXTRA(m)].trim(); return v !== '' && !(Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 999); });
    if (errores.length || extraMal) return toast.error(errores[0] ?? `El precio por libra extra de ${MODALIDADES[extraMal!].toLowerCase()} no es válido.`);
    setGuardando(true);
    const s = await db();
    const fallos: string[] = [];
    if (borradas.length) { const r = await s.from('casillero_tarifas').delete().in('id', borradas.map((b) => b.id)); if (r.error) fallos.push(r.error.message); }
    for (const f of cambiadas.filter((x) => x.id !== undefined)) {
      const n = aNumeros(f);
      const r = await s.from('casillero_tarifas').update(n).eq('id', f.id!);
      if (r.error) fallos.push(r.error.message);
    }
    const nuevas = cambiadas.filter((x) => x.id === undefined).map(aNumeros);
    if (nuevas.length) { const r = await s.from('casillero_tarifas').insert(nuevas); if (r.error) fallos.push(r.error.message); }
    for (const m of extrasCambiados) {
      const r = await s.from('casillero_config').upsert({ clave: EXTRA(m), valor: extras[EXTRA(m)].trim() }, { onConflict: 'clave' });
      if (r.error) fallos.push(r.error.message);
    }
    setGuardando(false);
    if (fallos.length) toast.error('No se guardó todo', { description: fallos[0] }); else toast.success('Tarifas guardadas', { description: 'Los clientes ya ven los precios nuevos al cotizar.' });
    await d.recargar();
  };

  const grafica = useMemo(() => (errores.length ? [] : [...numeros].sort((a, b) => a.libras_desde - b.libras_desde).map((n) => ({ rango: n.libras_desde === n.libras_hasta ? `${n.libras_desde} lb` : `${n.libras_desde}–${n.libras_hasta} lb`, rec_oficina: n.rec_oficina, local: n.local, regional: n.regional, nacional: n.nacional }))), [numeros, errores.length]);

  if (d.error && !d.datos) return <ErrorCarga mensaje={d.error} onReintentar={() => void d.recargar()} />;
  const campoNum = 'text-right tabular-nums !px-3 !py-2';

  return (
    <div className="space-y-6 pb-24">
      <PageHeader titulo="Tarifas" subtitulo="Lo que se cobra por despachar según el peso y la modalidad. Los clientes ven los cambios al instante, pero lo ya cobrado no se toca." />

      <Aparece>
        <Seccion titulo="Tabla de precios (USD)" ayuda="El peso se redondea hacia arriba: 3.2 lb se cobra como 4 lb."
          acciones={<Boton chico onClick={agregar} icono={<Plus size={13} />}>Agregar rango</Boton>}>
          {d.cargando ? <Skeleton className="h-60 w-full" /> : (
            <div className="space-y-3">
              <div className="hidden grid-cols-[1fr_1fr_repeat(4,1.2fr)_2.5rem] gap-3 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground md:grid">
                <span>Desde (lb)</span><span>Hasta (lb)</span>{MODS.map((m) => <span key={m} className="text-right">{MODALIDADES[m]}</span>)}<span />
              </div>
              {filas.map((f, i) => {
                const n = numeros[i];
                const malRango = intento && (!Number.isInteger(n.libras_desde) || !Number.isInteger(n.libras_hasta) || n.libras_hasta < n.libras_desde);
                const nueva = f.id === undefined;
                return (
                  <div key={f.llave} className={cn('grid grid-cols-2 items-end gap-3 rounded-2xl border p-3 md:grid-cols-[1fr_1fr_repeat(4,1.2fr)_2.5rem] md:border-0 md:p-0', nueva ? 'border-accent/40 bg-secondary/40 md:bg-transparent' : 'border-gray-100')}>
                    <label className="text-xs font-semibold text-muted-foreground md:contents"><span className="md:hidden">Desde (lb)</span><Entrada aria-label={`Fila ${i + 1}: desde`} inputMode="numeric" className={campoNum} value={f.desde} onChange={(e) => cambiar(f.llave, { desde: e.target.value })} aria-invalid={malRango} /></label>
                    <label className="text-xs font-semibold text-muted-foreground md:contents"><span className="md:hidden">Hasta (lb)</span><Entrada aria-label={`Fila ${i + 1}: hasta`} inputMode="numeric" className={campoNum} value={f.hasta} onChange={(e) => cambiar(f.llave, { hasta: e.target.value })} aria-invalid={malRango} /></label>
                    {MODS.map((m) => (
                      <label key={m} className="text-xs font-semibold text-muted-foreground md:contents"><span className="md:hidden">{MODALIDADES[m]}</span><Entrada aria-label={`Fila ${i + 1}: ${MODALIDADES[m]}`} inputMode="decimal" className={campoNum} value={f.precios[m]} onChange={(e) => cambiar(f.llave, { precio: [m, e.target.value] })} aria-invalid={intento && !Number.isFinite(n[m])} /></label>
                    ))}
                    <Boton chico variante="fantasma" className="col-span-2 !px-2 md:col-span-1" aria-label={`Quitar la fila ${i + 1}`} onClick={() => void quitar(f)}><Trash2 size={15} className="text-red-500" /><span className="md:hidden">Quitar</span></Boton>
                  </div>
                );
              })}
              {!filas.length && <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-muted-foreground">No hay rangos. Agrega el primero para que los clientes puedan cotizar.</p>}
              {(intento || sucio) && errores.length > 0 && <ul role="alert" className="space-y-1 rounded-2xl border border-red-100 bg-red-50 p-3.5 text-sm text-red-700">{errores.map((e) => <li key={e} className="flex gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{e}</li>)}</ul>}
              {avisos.length > 0 && <ul className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">{avisos.map((a) => <li key={a} className="flex gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{a}</li>)}</ul>}
            </div>
          )}
        </Seccion>
      </Aparece>

      <div className="grid gap-6 xl:grid-cols-2">
        <Aparece retraso={0.06}>
          <Seccion titulo="Libra adicional" ayuda="Para paquetes más pesados que el último rango: se cobra el precio del último rango más este valor por cada libra de más. Vacío = el cliente debe contactar a un asesor.">
            <div className="grid gap-4 sm:grid-cols-2">
              {MODS.map((m) => (
                <Campo key={m} etiqueta={`${MODALIDADES[m]} (USD por lb)`} id={`ex-${m}`}>
                  <Entrada id={`ex-${m}`} inputMode="decimal" placeholder="Vacío = asesor" value={extras[EXTRA(m)] ?? ''} onChange={(e) => setExtras({ ...extras, [EXTRA(m)]: e.target.value })} aria-invalid={intento && extrasCambiados.includes(m) && extras[EXTRA(m)].trim() !== '' && !(Number(extras[EXTRA(m)]) >= 0)} />
                </Campo>
              ))}
            </div>
          </Seccion>
        </Aparece>

        <Aparece retraso={0.08}>
          <Seccion titulo="Calculadora" ayuda={sucio ? 'Usa la tabla con tus cambios sin guardar.' : 'Prueba cuánto vería pagar un cliente.'}>
            <div className="flex items-end gap-3">
              <Campo etiqueta="Peso (lb)" id="calc-peso" className="w-36"><Entrada id="calc-peso" type="number" min="0" step="0.1" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} /></Campo>
              <p className="pb-2.5 text-sm text-muted-foreground">se cobra como <b className="text-primary">{Number.isFinite(lb) && lb > 0 ? Math.ceil(lb) : '—'} lb</b></p>
            </div>
            {cotizacion ? (
              <ul className="mt-4 grid grid-cols-2 gap-3">
                {MODS.map((m) => (
                  <li key={m} className="rounded-2xl bg-gray-50 p-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: COLOR_MOD[m] }} />{MODALIDADES[m]}</p>
                    <p className="mt-1 font-heading text-2xl font-black text-primary">{cotizacion[m] !== null ? usd(cotizacion[m]) : <span className="text-base font-bold text-amber-600">Cotiza un asesor</span>}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 flex items-center gap-2 rounded-2xl bg-gray-50 p-4 text-sm text-muted-foreground"><Calculator size={16} />{errores.length ? 'Corrige la tabla para calcular.' : 'Escribe un peso mayor a 0.'}</p>}
          </Seccion>
        </Aparece>
      </div>

      <Aparece retraso={0.1}>
        <Seccion titulo="Cómo escalan los precios" ayuda="Cada barra es un rango de peso; cada color, una modalidad.">
          <Barras datos={grafica} x="rango" formato={(n) => `$${n}`} alto={250} series={MODS.map((m) => ({ clave: m, etiqueta: MODALIDADES[m], color: COLOR_MOD[m] }))} resumen="Precio de despacho por rango de peso y modalidad" />
        </Seccion>
      </Aparece>

      <BarraCambios visible={sucio} detalle={`${cambiadas.length + borradas.length} en la tabla${extrasCambiados.length ? `, ${extrasCambiados.length} en libra adicional` : ''}`} onDescartar={descartar} onGuardar={() => void guardar()} guardando={guardando} deshabilitado={errores.length > 0} etiqueta="Guardar tarifas" />
    </div>
  );
}
