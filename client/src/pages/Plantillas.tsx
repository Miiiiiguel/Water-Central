import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, FileText, Plus, Printer, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  INCOTERMS, ITEM_VACIO, NOMBRE_DOCUMENTO, PARTE_VACIA, TRATADOS, documentoVacio, faltantes, totalDeItem, totales,
  type Documento, type Item, type Parte, type TipoDocumento,
} from '@/lib/plantillas';

// Las plantillas de exportación: los datos se llenan una vez y salen la
// factura comercial, la proforma, la lista de empaque y la certificación
// de origen, listas para imprimir o guardar como PDF. Más la guía de
// Incoterms. Todo queda en el navegador de quien las llena.

type Pestana = TipoDocumento | 'incoterms';
const CLAVE = 'ecx:plantillas';

function cargar(): Documento {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (raw) return { ...documentoVacio(), ...(JSON.parse(raw) as Partial<Documento>) };
  } catch {
    /* sin almacenamiento: se empieza de cero */
  }
  return documentoVacio();
}

const inputCls = 'w-full rounded-lg border-[1.5px] border-gray-200 bg-white px-2.5 py-2 text-sm text-foreground outline-none focus:border-accent';

function Campo({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </label>
  );
}

function FormParte({ titulo, p, onChange }: { titulo: string; p: Parte; onChange: (p: Parte) => void }) {
  const set = (k: keyof Parte) => (v: string) => onChange({ ...p, [k]: v });
  return (
    <fieldset className="rounded-2xl border border-gray-100 bg-white p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{titulo}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="Razón social / nombre" value={p.nombre} onChange={set('nombre')} />
        <Campo label="NIT / Tax ID" value={p.identificacion} onChange={set('identificacion')} />
        <Campo label="Dirección" value={p.direccion} onChange={set('direccion')} />
        <Campo label="Ciudad" value={p.ciudad} onChange={set('ciudad')} />
        <Campo label="País" value={p.pais} onChange={set('pais')} />
        <Campo label="Contacto" value={p.contacto} onChange={set('contacto')} />
        <Campo label="Correo" value={p.correo} onChange={set('correo')} type="email" />
        <Campo label="Teléfono" value={p.telefono} onChange={set('telefono')} />
      </div>
    </fieldset>
  );
}

const dinero = (n: number, moneda: string) => `${moneda} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Bi({ es, en }: { es: string; en: string }) {
  return (
    <>
      {es} <span className="font-normal text-gray-500">/ {en}</span>
    </>
  );
}

function BloqueParte({ titulo, p }: { titulo: React.ReactNode; p: Parte }) {
  return (
    <div className="text-xs leading-relaxed">
      <p className="mb-1 font-bold uppercase tracking-wide">{titulo}</p>
      <p className="font-semibold">{p.nombre || '—'}</p>
      {p.identificacion && <p>ID: {p.identificacion}</p>}
      <p>{[p.direccion, p.ciudad, p.pais].filter(Boolean).join(', ') || '—'}</p>
      {(p.contacto || p.telefono || p.correo) && <p>{[p.contacto, p.telefono, p.correo].filter(Boolean).join(' · ')}</p>}
    </div>
  );
}

function VistaDocumento({ tipo, d }: { tipo: TipoDocumento; d: Documento }) {
  const items = d.items.filter((i) => i.descripcion.trim());
  const t = totales(items);
  const nombre = NOMBRE_DOCUMENTO[tipo];
  const incoterm = INCOTERMS.find((i) => i.codigo === d.incoterm);

  return (
    <article id="documento" className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-sm md:p-8">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-gray-300 pb-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wide">{nombre.es}</h2>
          <p className="text-sm text-gray-500">{nombre.en}</p>
        </div>
        <div className="text-right text-xs">
          {tipo !== 'origen' && d.numero && <p><b>N.º / No.:</b> {d.numero}</p>}
          <p><b>Fecha / Date:</b> {d.fecha}</p>
          {tipo === 'proforma' && d.validez && <p><b>Válida hasta / Valid until:</b> {d.validez}</p>}
        </div>
      </header>

      {tipo === 'origen' ? (
        <>
          <p className="mb-4 text-xs"><b>Acuerdo / Agreement:</b> {d.tratado}</p>
          <p className="mb-4 text-xs"><b>Certificador / Certifier:</b> {d.certificador === 'exportador' ? 'Exportador / Exporter' : d.certificador === 'productor' ? 'Productor / Producer' : 'Importador / Importer'}</p>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <BloqueParte titulo={<Bi es="Exportador" en="Exporter" />} p={d.exportador} />
            <BloqueParte titulo={<Bi es="Productor" en="Producer" />} p={d.productor ?? d.exportador} />
            <BloqueParte titulo={<Bi es="Importador" en="Importer" />} p={d.importador} />
          </div>
          <table className="mb-4 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-300 text-left">
                <th className="py-1.5 pr-2"><Bi es="Descripción" en="Description" /></th>
                <th className="py-1.5 pr-2"><Bi es="Partida (HTS)" en="HTS classification" /></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, n) => (
                <tr key={n} className="border-b border-gray-100 align-top">
                  <td className="py-1.5 pr-2">{i.descripcion}</td>
                  <td className="py-1.5 pr-2 font-mono">{i.partida}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mb-2 text-xs"><b>Criterio de origen / Origin criterion:</b> {d.criterioOrigen || '—'}</p>
          {(d.periodoDesde || d.periodoHasta) && (
            <p className="mb-2 text-xs"><b>Período (certificación general) / Blanket period:</b> {d.periodoDesde || '—'} → {d.periodoHasta || '—'}</p>
          )}
          <p className="mt-5 text-xs leading-relaxed">
            Certifico que las mercancías descritas en este documento califican como originarias y que la información aquí contenida es verdadera y exacta. Asumo la responsabilidad de probar lo aquí declarado y me comprometo a conservar y presentar, cuando se solicite, la documentación que lo respalde.
          </p>
          <p className="mt-1 text-xs italic leading-relaxed text-gray-600">
            I certify that the goods described in this document qualify as originating and the information contained in this document is true and accurate. I assume responsibility for proving such representations and agree to maintain and present upon request the documentation necessary to support this certification.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-6 text-xs">
            <div className="border-t border-gray-400 pt-1">
              <b>{d.firmante || 'Nombre / Name'}</b>
              <p>{d.cargo || 'Cargo / Title'}</p>
            </div>
            <div className="border-t border-gray-400 pt-1">
              <b>Firma / Signature</b>
              <p>Fecha / Date: {d.fecha}</p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BloqueParte titulo={<Bi es="Exportador / vendedor" en="Exporter / seller" />} p={d.exportador} />
            <BloqueParte titulo={<Bi es="Importador / comprador" en="Importer / buyer" />} p={d.importador} />
          </div>
          <div className="mb-5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
            {tipo !== 'empaque' && <p><b>Incoterm:</b> {d.incoterm} {d.lugarIncoterm} {incoterm ? `(Incoterms 2020)` : ''}</p>}
            {tipo !== 'empaque' && <p><b>Moneda / Currency:</b> {d.moneda}</p>}
            <p><b>País de origen / Country of origin:</b> {d.paisOrigen || '—'}</p>
            <p><b>Salida / Port of loading:</b> {d.puertoSalida || '—'}</p>
            <p><b>Destino / Port of entry:</b> {d.puertoDestino || '—'}</p>
            <p><b>Transporte / Transport:</b> {d.transporte || '—'}</p>
            {tipo !== 'empaque' && d.condicionesPago && <p><b>Pago / Payment terms:</b> {d.condicionesPago}</p>}
          </div>

          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-300 text-left">
                <th className="py-1.5 pr-2"><Bi es="Descripción" en="Description" /></th>
                {tipo !== 'empaque' && <th className="py-1.5 pr-2">HTS</th>}
                <th className="py-1.5 pr-2 text-right"><Bi es="Cant." en="Qty" /></th>
                {tipo === 'empaque' ? (
                  <>
                    <th className="py-1.5 pr-2 text-right"><Bi es="Bultos" en="Pkgs" /></th>
                    <th className="py-1.5 pr-2 text-right"><Bi es="Neto kg" en="Net kg" /></th>
                    <th className="py-1.5 pr-2 text-right"><Bi es="Bruto kg" en="Gross kg" /></th>
                    <th className="py-1.5 pr-2"><Bi es="Medidas cm" en="Dims cm" /></th>
                  </>
                ) : (
                  <>
                    <th className="py-1.5 pr-2 text-right"><Bi es="Precio unit." en="Unit price" /></th>
                    <th className="py-1.5 text-right">Total</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((i, n) => (
                <tr key={n} className="border-b border-gray-100 align-top">
                  <td className="py-1.5 pr-2">{i.descripcion}</td>
                  {tipo !== 'empaque' && <td className="py-1.5 pr-2 font-mono">{i.partida}</td>}
                  <td className="py-1.5 pr-2 text-right">{i.cantidad} {i.unidad}</td>
                  {tipo === 'empaque' ? (
                    <>
                      <td className="py-1.5 pr-2 text-right">{i.bultos}</td>
                      <td className="py-1.5 pr-2 text-right">{i.pesoNetoKg}</td>
                      <td className="py-1.5 pr-2 text-right">{i.pesoBrutoKg}</td>
                      <td className="py-1.5 pr-2">{i.medidas}</td>
                    </>
                  ) : (
                    <>
                      <td className="py-1.5 pr-2 text-right">{dinero(i.valorUnitario, d.moneda)}</td>
                      <td className="py-1.5 text-right">{dinero(totalDeItem(i), d.moneda)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-bold">
                <td className="py-2 pr-2" colSpan={tipo === 'empaque' ? 2 : 4}>TOTAL</td>
                {tipo === 'empaque' ? (
                  <>
                    <td className="py-2 pr-2 text-right">{t.bultos}</td>
                    <td className="py-2 pr-2 text-right">{t.pesoNetoKg}</td>
                    <td className="py-2 pr-2 text-right">{t.pesoBrutoKg}</td>
                    <td />
                  </>
                ) : (
                  <td className="py-2 text-right">{dinero(t.valor, d.moneda)}</td>
                )}
              </tr>
            </tfoot>
          </table>

          {tipo !== 'empaque' && (
            <p className="mt-4 text-xs"><b>Peso bruto total / Total gross weight:</b> {t.pesoBrutoKg} kg · <b>Bultos / Packages:</b> {t.bultos}</p>
          )}
          {tipo === 'factura' && (
            <p className="mt-4 text-xs leading-relaxed">
              Declaro que esta factura muestra el precio real de las mercancías descritas y que todos los datos son verdaderos y correctos.{' '}
              <span className="italic text-gray-600">I declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</span>
            </p>
          )}
          {tipo === 'proforma' && (
            <p className="mt-4 text-xs italic text-gray-600">Documento sin valor fiscal: es una oferta. / Not a tax document: this is a quotation.</p>
          )}
          <div className="mt-8 w-1/2 border-t border-gray-400 pt-1 text-xs">
            <b>Firma autorizada / Authorized signature</b>
            <p>{d.exportador.nombre}</p>
          </div>
        </>
      )}
    </article>
  );
}

function GuiaIncoterms({ es }: { es: boolean }) {
  const quien = (v: string) => (v === 'vendedor' ? (es ? 'Vendedor' : 'Seller') : es ? 'Comprador' : 'Buyer');
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {es
          ? 'Los Incoterms 2020 dicen quién paga qué y en qué punto el riesgo pasa del vendedor al comprador. Se escriben con el lugar: "DDP Miami, FL, Incoterms 2020".'
          : 'Incoterms 2020 say who pays for what and where the risk passes from seller to buyer. They are written with the place: "DDP Miami, FL, Incoterms 2020".'}
      </p>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="p-3">Incoterm</th>
              <th className="p-3">{es ? 'El riesgo pasa' : 'Risk passes'}</th>
              <th className="p-3">{es ? 'Flete' : 'Freight'}</th>
              <th className="p-3">{es ? 'Seguro' : 'Insurance'}</th>
              <th className="p-3">{es ? 'Importación y aranceles' : 'Import and duties'}</th>
            </tr>
          </thead>
          <tbody>
            {INCOTERMS.map((i) => (
              <tr key={i.codigo} className="border-b border-gray-50 align-top">
                <td className="p-3">
                  <b className="text-primary">{i.codigo}</b>
                  <span className="block text-xs text-muted-foreground">{i.nombre}{i.transporte === 'maritimo' ? (es ? ' · sólo marítimo' : ' · sea only') : ''}</span>
                </td>
                <td className="p-3 text-muted-foreground">{i.riesgo}</td>
                <td className="p-3">{quien(i.flete)}</td>
                <td className="p-3">{i.seguro === 'vendedor' ? (es ? 'Vendedor' : 'Seller') : '—'}</td>
                <td className="p-3">{quien(i.importacion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-5 text-sm text-primary">
        <p className="mb-2 font-bold">{es ? 'Para vender por ecommerce en EE. UU.' : 'For ecommerce sales in the US'}</p>
        <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
          <li>{es ? 'Si envías a Amazon FBA: Amazon no actúa como importador, así que alguien tiene que serlo. Lo usual es DDP con tu agente de carga, que hace la importación y paga los aranceles por ti.' : 'If you ship to Amazon FBA: Amazon does not act as importer, so someone else must. The usual choice is DDP with your forwarder, who clears customs and pays duties for you.'}</li>
          <li>{es ? 'Si vendes a un distribuidor en EE. UU.: FCA o FOB si él contrata el flete; DAP si lo contratas tú y él importa.' : 'If you sell to a US distributor: FCA or FOB if they book freight; DAP if you book it and they import.'}</li>
          <li>{es ? 'Para envío aéreo o de paquetería no uses FOB, CFR ni CIF: son sólo marítimos. Usa FCA, CPT, CIP, DAP o DDP.' : 'For air or courier shipments do not use FOB, CFR or CIF: they are sea-only. Use FCA, CPT, CIP, DAP or DDP.'}</li>
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">Incoterms® es una marca de la Cámara de Comercio Internacional (ICC).</p>
    </div>
  );
}

export default function Plantillas() {
  const { language } = useLanguage();
  const es = language === 'es';
  const [pestana, setPestana] = useState<Pestana>(() => {
    const q = new URLSearchParams(window.location.search).get('doc');
    return q === 'proforma' || q === 'empaque' || q === 'origen' || q === 'incoterms' ? q : 'factura';
  });
  const [d, setD] = useState<Documento>(cargar);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(d));
    } catch {
      /* modo privado */
    }
  }, [d]);

  // Al imprimir sale sólo el documento (ver index.css).
  useEffect(() => {
    document.body.classList.add('imprimir-documento');
    return () => document.body.classList.remove('imprimir-documento');
  }, []);

  const tipo = pestana === 'incoterms' ? null : pestana;
  const falta = useMemo(() => (tipo ? faltantes(tipo, d) : []), [tipo, d]);
  const set = <K extends keyof Documento>(k: K, v: Documento[K]) => setD((x) => ({ ...x, [k]: v }));
  const setItem = (n: number, cambio: Partial<Item>) => setD((x) => ({ ...x, items: x.items.map((i, k) => (k === n ? { ...i, ...cambio } : i)) }));
  const numero = (v: string) => {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const pestanas: Array<{ id: Pestana; es: string; en: string }> = [
    { id: 'factura', ...NOMBRE_DOCUMENTO.factura },
    { id: 'proforma', ...NOMBRE_DOCUMENTO.proforma },
    { id: 'empaque', ...NOMBRE_DOCUMENTO.empaque },
    { id: 'origen', ...NOMBRE_DOCUMENTO.origen },
    { id: 'incoterms', es: 'Guía de Incoterms', en: 'Incoterms guide' },
  ];

  return (
    <div className="min-h-screen bg-white pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl print:hidden">
        <div className="container flex h-16 items-center justify-between gap-3 md:h-20">
          <Link href="/" className="tap-scale-sm flex items-center gap-2 py-2 font-logo text-xl tracking-tight md:text-2xl">
            <ArrowLeft size={18} className="text-muted-foreground" />
            <span><span className="text-accent">easy</span><span className="text-primary">comex</span></span>
          </Link>
          <Link href="/ruta" className="rounded-full border border-gray-200 bg-secondary/60 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
            {es ? 'Ruta exportadora' : 'Export roadmap'}
          </Link>
        </div>
      </header>

      <div className="container max-w-5xl">
        <section className="pb-2 pt-8 print:hidden md:pt-10">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-accent">
            <FileText size={13} />
            {es ? 'Plantillas gratis' : 'Free templates'}
          </span>
          <h1 className="max-w-[22ch] text-3xl font-black leading-[1.08] text-primary sm:text-4xl">
            {es ? 'Los documentos para exportar, listos en minutos' : 'Your export documents, ready in minutes'}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {es
              ? 'Llena tus datos una vez y saca la factura comercial, la proforma, la lista de empaque y la certificación de origen, en español con su traducción al inglés. Se guardan en este navegador. Tu agente de aduanas revisa la versión final.'
              : 'Fill in your details once and get the commercial invoice, proforma, packing list and certification of origin, in Spanish with the English translation. They are saved in this browser. Your customs broker reviews the final version.'}
          </p>
        </section>

        <div role="tablist" className="my-6 flex gap-1.5 overflow-x-auto pb-1 print:hidden">
          {pestanas.map((p) => (
            <button
              key={p.id}
              role="tab"
              type="button"
              aria-selected={pestana === p.id}
              onClick={() => setPestana(p.id)}
              className={`tap-scale-sm flex-none cursor-pointer rounded-full border px-4 py-2 text-sm font-bold ${
                pestana === p.id ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-muted-foreground hover:text-foreground'
              }`}
            >
              {es ? p.es : p.en}
            </button>
          ))}
        </div>

        {!tipo ? (
          <div className="mb-16"><GuiaIncoterms es={es} /></div>
        ) : (
          <div className="mb-16 space-y-5">
            <div className="space-y-4 print:hidden">
              <FormParte titulo={es ? 'Exportador (tú)' : 'Exporter (you)'} p={d.exportador} onChange={(p) => set('exportador', p)} />
              <FormParte titulo={es ? 'Importador / comprador' : 'Importer / buyer'} p={d.importador} onChange={(p) => set('importador', p)} />

              <fieldset className="rounded-2xl border border-gray-100 bg-white p-4">
                <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{es ? 'Envío' : 'Shipment'}</legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {tipo !== 'origen' && <Campo label={es ? 'Número' : 'Number'} value={d.numero} onChange={(v) => set('numero', v)} />}
                  <Campo label={es ? 'Fecha' : 'Date'} value={d.fecha} onChange={(v) => set('fecha', v)} type="date" />
                  {tipo === 'proforma' && <Campo label={es ? 'Válida hasta' : 'Valid until'} value={d.validez} onChange={(v) => set('validez', v)} type="date" />}
                  {(tipo === 'factura' || tipo === 'proforma') && (
                    <>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-muted-foreground">Incoterm</span>
                        <select value={d.incoterm} onChange={(e) => set('incoterm', e.target.value)} className={inputCls}>
                          {INCOTERMS.map((i) => <option key={i.codigo} value={i.codigo}>{i.codigo} · {i.nombre}</option>)}
                        </select>
                      </label>
                      <Campo label={es ? 'Lugar del Incoterm' : 'Incoterm place'} value={d.lugarIncoterm} onChange={(v) => set('lugarIncoterm', v)} placeholder="Miami, FL" />
                      <Campo label={es ? 'Moneda' : 'Currency'} value={d.moneda} onChange={(v) => set('moneda', v.toUpperCase().slice(0, 3))} />
                      <Campo label={es ? 'Condiciones de pago' : 'Payment terms'} value={d.condicionesPago} onChange={(v) => set('condicionesPago', v)} placeholder={es ? '100 % anticipado' : '100% prepaid'} />
                    </>
                  )}
                  {tipo !== 'origen' && (
                    <>
                      <Campo label={es ? 'País de origen' : 'Country of origin'} value={d.paisOrigen} onChange={(v) => set('paisOrigen', v)} />
                      <Campo label={es ? 'Puerto / aeropuerto de salida' : 'Port of loading'} value={d.puertoSalida} onChange={(v) => set('puertoSalida', v)} />
                      <Campo label={es ? 'Puerto de llegada' : 'Port of entry'} value={d.puertoDestino} onChange={(v) => set('puertoDestino', v)} />
                      <Campo label={es ? 'Transporte' : 'Transport'} value={d.transporte} onChange={(v) => set('transporte', v)} />
                    </>
                  )}
                </div>
              </fieldset>

              {tipo === 'origen' && (
                <fieldset className="rounded-2xl border border-gray-100 bg-white p-4">
                  <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{es ? 'Certificación' : 'Certification'}</legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{es ? 'Acuerdo comercial' : 'Trade agreement'}</span>
                      <select value={d.tratado} onChange={(e) => set('tratado', e.target.value)} className={inputCls}>
                        {TRATADOS.map((t) => <option key={t.nombre} value={t.nombre}>{t.nombre} ({t.paises})</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{es ? 'Quién certifica' : 'Certifier'}</span>
                      <select value={d.certificador} onChange={(e) => set('certificador', e.target.value as Documento['certificador'])} className={inputCls}>
                        <option value="exportador">{es ? 'El exportador' : 'The exporter'}</option>
                        <option value="productor">{es ? 'El productor' : 'The producer'}</option>
                        <option value="importador">{es ? 'El importador' : 'The importer'}</option>
                      </select>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{es ? 'Criterio de origen: por qué el producto es originario' : 'Origin criterion: why the product is originating'}</span>
                      <textarea
                        value={d.criterioOrigen}
                        onChange={(e) => set('criterioOrigen', e.target.value)}
                        rows={2}
                        placeholder={es ? 'Ej.: producido enteramente en Colombia con materiales originarios; o cumple la regla específica de origen de su partida.' : 'E.g.: produced entirely in Colombia from originating materials; or meets the product-specific rule of its heading.'}
                        className={inputCls}
                      />
                    </label>
                    <Campo label={es ? 'Período desde (si cubre varios envíos)' : 'Blanket period from'} value={d.periodoDesde} onChange={(v) => set('periodoDesde', v)} type="date" />
                    <Campo label={es ? 'Período hasta (máx. 12 meses)' : 'Blanket period to (max. 12 months)'} value={d.periodoHasta} onChange={(v) => set('periodoHasta', v)} type="date" />
                    <Campo label={es ? 'Nombre de quien firma' : 'Signer name'} value={d.firmante} onChange={(v) => set('firmante', v)} />
                    <Campo label={es ? 'Cargo' : 'Title'} value={d.cargo} onChange={(v) => set('cargo', v)} />
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={Boolean(d.productor)} onChange={(e) => set('productor', e.target.checked ? { ...PARTE_VACIA } : null)} />
                    {es ? 'El productor es otra empresa (no el exportador)' : 'The producer is a different company'}
                  </label>
                  {d.productor && <div className="mt-3"><FormParte titulo={es ? 'Productor' : 'Producer'} p={d.productor} onChange={(p) => set('productor', p)} /></div>}
                  <p className="mt-3 text-xs text-muted-foreground">{TRATADOS.find((t) => t.nombre === d.tratado)?.nota}</p>
                </fieldset>
              )}

              <fieldset className="rounded-2xl border border-gray-100 bg-white p-4">
                <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{es ? 'Productos' : 'Products'}</legend>
                <div className="space-y-4">
                  {d.items.map((i, n) => (
                    <div key={n} className="rounded-xl border border-gray-100 bg-secondary/30 p-3">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="col-span-2"><Campo label={es ? 'Descripción (qué es y de qué está hecho)' : 'Description'} value={i.descripcion} onChange={(v) => setItem(n, { descripcion: v })} /></div>
                        <Campo label={es ? 'Partida HTS' : 'HTS code'} value={i.partida} onChange={(v) => setItem(n, { partida: v })} placeholder="6109.10.0012" />
                        <Campo label={es ? 'Cantidad' : 'Quantity'} value={i.cantidad} onChange={(v) => setItem(n, { cantidad: numero(v) })} type="number" />
                        <Campo label={es ? 'Unidad' : 'Unit'} value={i.unidad} onChange={(v) => setItem(n, { unidad: v })} />
                        {tipo !== 'origen' && tipo !== 'empaque' && <Campo label={es ? 'Precio unitario' : 'Unit price'} value={i.valorUnitario} onChange={(v) => setItem(n, { valorUnitario: numero(v) })} type="number" />}
                        {tipo !== 'origen' && (
                          <>
                            <Campo label={es ? 'Bultos' : 'Packages'} value={i.bultos} onChange={(v) => setItem(n, { bultos: numero(v) })} type="number" />
                            <Campo label={es ? 'Peso neto (kg)' : 'Net weight (kg)'} value={i.pesoNetoKg} onChange={(v) => setItem(n, { pesoNetoKg: numero(v) })} type="number" />
                            <Campo label={es ? 'Peso bruto (kg)' : 'Gross weight (kg)'} value={i.pesoBrutoKg} onChange={(v) => setItem(n, { pesoBrutoKg: numero(v) })} type="number" />
                            {tipo === 'empaque' && <Campo label={es ? 'Medidas por bulto (cm)' : 'Dims per package (cm)'} value={i.medidas} onChange={(v) => setItem(n, { medidas: v })} placeholder="40 x 30 x 25" />}
                          </>
                        )}
                      </div>
                      {d.items.length > 1 && (
                        <button type="button" onClick={() => setD((x) => ({ ...x, items: x.items.filter((_, k) => k !== n) }))} className="mt-2 inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs font-bold text-accent">
                          <Trash2 size={12} /> {es ? 'Quitar' : 'Remove'}
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => setD((x) => ({ ...x, items: [...x.items, { ...ITEM_VACIO }] }))} className="tap-scale-sm inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-primary">
                      <Plus size={12} /> {es ? 'Agregar producto' : 'Add product'}
                    </button>
                    <Link href="/analizar" className="text-xs font-bold text-accent hover:underline">
                      {es ? '¿No sabes la partida? Lee tu etiqueta →' : 'Do not know the code? Read your label →'}
                    </Link>
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              {falta.length ? (
                <div className="text-sm text-amber-800">
                  <p className="font-bold">{es ? 'Falta para que el documento sirva:' : 'Missing for the document to be usable:'}</p>
                  <ul className="list-disc pl-5">{falta.map((f) => <li key={f}>{f}</li>)}</ul>
                </div>
              ) : (
                <p className="text-sm font-semibold text-green-700">{es ? 'Tiene todos los datos necesarios.' : 'It has all the required data.'}</p>
              )}
              <button type="button" onClick={() => window.print()} className="tap-scale inline-flex cursor-pointer items-center gap-2 rounded-full border-0 bg-accent px-5 py-2.5 text-sm font-bold text-white">
                <Printer size={16} /> {es ? 'Imprimir o guardar PDF' : 'Print or save PDF'}
              </button>
            </div>

            <VistaDocumento tipo={tipo} d={d} />
          </div>
        )}
      </div>
    </div>
  );
}
