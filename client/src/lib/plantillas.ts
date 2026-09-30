// Las plantillas de documentos de exportación: los datos que se llenan
// una vez y los documentos que salen de ellos (factura comercial,
// proforma, lista de empaque, certificación de origen).
//
// Todo es puro y se prueba sin navegador. Los documentos van en español
// con la etiqueta en inglés al lado, porque los lee la aduana de EE. UU.
//
// Nada de esto reemplaza al agente de aduanas: las plantillas ordenan la
// información que él o la aduana van a pedir, con los campos que la
// norma exige, y la página lo dice.

export type TipoDocumento = 'factura' | 'proforma' | 'empaque' | 'origen';

export interface Parte {
  nombre: string;
  identificacion: string;
  direccion: string;
  ciudad: string;
  pais: string;
  contacto: string;
  correo: string;
  telefono: string;
}

export interface Item {
  descripcion: string;
  /** Partida arancelaria (HTS de EE. UU. o, como mínimo, la subpartida de 6 dígitos). */
  partida: string;
  cantidad: number;
  unidad: string;
  valorUnitario: number;
  pesoNetoKg: number;
  pesoBrutoKg: number;
  bultos: number;
  /** Largo x ancho x alto de cada bulto, en cm. */
  medidas: string;
}

export interface Documento {
  exportador: Parte;
  importador: Parte;
  /** Productor, si no es el exportador (la certificación de origen lo pide). */
  productor: Parte | null;
  numero: string;
  fecha: string;
  moneda: string;
  incoterm: string;
  lugarIncoterm: string;
  paisOrigen: string;
  puertoSalida: string;
  puertoDestino: string;
  transporte: string;
  condicionesPago: string;
  /** Proforma: hasta cuándo vale la oferta. */
  validez: string;
  items: Item[];
  // Certificación de origen
  tratado: string;
  certificador: 'exportador' | 'productor' | 'importador';
  criterioOrigen: string;
  periodoDesde: string;
  periodoHasta: string;
  firmante: string;
  cargo: string;
}

export const PARTE_VACIA: Parte = { nombre: '', identificacion: '', direccion: '', ciudad: '', pais: '', contacto: '', correo: '', telefono: '' };

export const ITEM_VACIO: Item = {
  descripcion: '', partida: '', cantidad: 1, unidad: 'unidades', valorUnitario: 0, pesoNetoKg: 0, pesoBrutoKg: 0, bultos: 1, medidas: '',
};

export function documentoVacio(hoy = new Date()): Documento {
  return {
    exportador: { ...PARTE_VACIA },
    importador: { ...PARTE_VACIA, pais: 'Estados Unidos' },
    productor: null,
    numero: '',
    fecha: hoy.toISOString().slice(0, 10),
    moneda: 'USD',
    incoterm: 'DDP',
    lugarIncoterm: '',
    paisOrigen: 'Colombia',
    puertoSalida: '',
    puertoDestino: '',
    transporte: 'Aéreo',
    condicionesPago: '',
    validez: '',
    items: [{ ...ITEM_VACIO }],
    tratado: 'TPA Colombia – Estados Unidos',
    certificador: 'exportador',
    criterioOrigen: '',
    periodoDesde: '',
    periodoHasta: '',
    firmante: '',
    cargo: '',
  };
}

export interface Totales {
  valor: number;
  pesoNetoKg: number;
  pesoBrutoKg: number;
  bultos: number;
  unidades: number;
}

const num = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function totalDeItem(i: Item): number {
  return Math.round(num(i.cantidad) * num(i.valorUnitario) * 100) / 100;
}

export function totales(items: Item[]): Totales {
  const t = items.reduce(
    (acc, i) => ({
      valor: acc.valor + totalDeItem(i),
      pesoNetoKg: acc.pesoNetoKg + num(i.pesoNetoKg),
      pesoBrutoKg: acc.pesoBrutoKg + num(i.pesoBrutoKg),
      bultos: acc.bultos + num(i.bultos),
      unidades: acc.unidades + num(i.cantidad),
    }),
    { valor: 0, pesoNetoKg: 0, pesoBrutoKg: 0, bultos: 0, unidades: 0 }
  );
  return { ...t, valor: Math.round(t.valor * 100) / 100, pesoNetoKg: Math.round(t.pesoNetoKg * 1000) / 1000, pesoBrutoKg: Math.round(t.pesoBrutoKg * 1000) / 1000 };
}

/**
 * Lo que falta para que el documento sirva. Los campos de la factura
 * comercial son los que la aduana de EE. UU. pide en toda factura de
 * importación (quién vende, quién compra, qué es, cuánto, a qué precio,
 * en qué moneda, de qué país de origen y en qué condiciones de venta).
 */
export function faltantes(tipo: TipoDocumento, d: Documento): string[] {
  const f: string[] = [];
  const parte = (p: Parte, quien: string) => {
    if (!p.nombre.trim()) f.push(`Nombre del ${quien}`);
    if (!p.direccion.trim() || !p.ciudad.trim() || !p.pais.trim()) f.push(`Dirección completa del ${quien}`);
  };
  parte(d.exportador, 'exportador');
  if (tipo !== 'origen' || d.certificador === 'importador') parte(d.importador, 'importador');
  else if (!d.importador.nombre.trim()) f.push('Nombre del importador (o "Varios" si es una certificación por período)');

  const conProductos = d.items.filter((i) => i.descripcion.trim());
  if (!conProductos.length) f.push('Al menos un producto con su descripción');
  if (tipo === 'factura' || tipo === 'proforma' || tipo === 'origen') {
    if (conProductos.some((i) => i.partida.replace(/\D/g, '').length < 6)) f.push('La partida arancelaria de cada producto (mínimo 6 dígitos)');
  }
  if (tipo === 'factura' || tipo === 'proforma') {
    if (tipo === 'factura' && !d.numero.trim()) f.push('Número de factura');
    if (conProductos.some((i) => !(i.valorUnitario > 0))) f.push('Precio unitario de cada producto');
    if (!d.incoterm) f.push('Incoterm');
    if (!d.paisOrigen.trim()) f.push('País de origen de la mercancía');
  }
  if (tipo === 'empaque') {
    if (conProductos.some((i) => !(i.pesoBrutoKg > 0))) f.push('Peso bruto de cada producto');
    if (conProductos.some((i) => !(i.bultos > 0))) f.push('Número de bultos de cada producto');
  }
  if (tipo === 'origen') {
    if (!d.tratado) f.push('El acuerdo comercial');
    if (!d.criterioOrigen.trim()) f.push('El criterio de origen (por qué el producto es originario)');
    if (!d.firmante.trim()) f.push('Nombre de quien firma');
    if (d.certificador === 'productor' && !d.productor?.nombre.trim()) f.push('Nombre del productor');
  }
  return f;
}

// ---- Acuerdos para la certificación de origen ---------------------------

export interface Tratado {
  nombre: string;
  /** Países de origen que cubre, con acuerdo vigente con EE. UU. */
  paises: string;
  nota: string;
}

// Ninguno de estos acuerdos exige un formulario oficial: la preferencia
// se pide con una certificación que contenga ciertos datos mínimos. Eso
// es lo que ordena la plantilla.
export const TRATADOS: Tratado[] = [
  { nombre: 'TPA Colombia – Estados Unidos', paises: 'Colombia', nota: 'La certificación la puede hacer el importador, el exportador o el productor. No tiene formato oficial.' },
  { nombre: 'T-MEC / USMCA', paises: 'México (y Canadá)', nota: 'No tiene formato oficial: la certificación debe traer los datos mínimos del acuerdo.' },
  { nombre: 'CAFTA-DR', paises: 'Costa Rica, El Salvador, Guatemala, Honduras, Nicaragua y República Dominicana', nota: 'La certificación no tiene formato oficial.' },
  { nombre: 'TPA Perú – Estados Unidos', paises: 'Perú', nota: 'La certificación no tiene formato oficial.' },
  { nombre: 'TLC Chile – Estados Unidos', paises: 'Chile', nota: 'La certificación no tiene formato oficial.' },
  { nombre: 'TPA Panamá – Estados Unidos', paises: 'Panamá', nota: 'La certificación no tiene formato oficial.' },
];

// ---- Incoterms 2020 -------------------------------------------------------

export interface Incoterm {
  codigo: string;
  nombre: string;
  /** Sirve para cualquier transporte o sólo marítimo y fluvial. */
  transporte: 'cualquiera' | 'maritimo';
  /** Dónde pasa el riesgo del vendedor al comprador. */
  riesgo: string;
  /** Quién paga el flete principal. */
  flete: 'vendedor' | 'comprador';
  /** Quién contrata el seguro, cuando la regla lo exige. */
  seguro: 'vendedor' | 'nadie obligado';
  /** Quién hace el trámite y paga los aranceles de importación. */
  importacion: 'vendedor' | 'comprador';
}

export const INCOTERMS: Incoterm[] = [
  { codigo: 'EXW', nombre: 'En fábrica', transporte: 'cualquiera', riesgo: 'En las instalaciones del vendedor, sin cargar', flete: 'comprador', seguro: 'nadie obligado', importacion: 'comprador' },
  { codigo: 'FCA', nombre: 'Franco transportista', transporte: 'cualquiera', riesgo: 'Al entregar al transportista del comprador, despachada para exportar', flete: 'comprador', seguro: 'nadie obligado', importacion: 'comprador' },
  { codigo: 'CPT', nombre: 'Transporte pagado hasta', transporte: 'cualquiera', riesgo: 'Al entregar al primer transportista', flete: 'vendedor', seguro: 'nadie obligado', importacion: 'comprador' },
  { codigo: 'CIP', nombre: 'Transporte y seguro pagados hasta', transporte: 'cualquiera', riesgo: 'Al entregar al primer transportista', flete: 'vendedor', seguro: 'vendedor', importacion: 'comprador' },
  { codigo: 'DAP', nombre: 'Entregada en lugar', transporte: 'cualquiera', riesgo: 'En el lugar de destino, lista para descargar', flete: 'vendedor', seguro: 'nadie obligado', importacion: 'comprador' },
  { codigo: 'DPU', nombre: 'Entregada en lugar descargada', transporte: 'cualquiera', riesgo: 'En el lugar de destino, ya descargada', flete: 'vendedor', seguro: 'nadie obligado', importacion: 'comprador' },
  { codigo: 'DDP', nombre: 'Entregada con derechos pagados', transporte: 'cualquiera', riesgo: 'En el lugar de destino, con la importación hecha y los aranceles pagados', flete: 'vendedor', seguro: 'nadie obligado', importacion: 'vendedor' },
  { codigo: 'FAS', nombre: 'Franco al costado del buque', transporte: 'maritimo', riesgo: 'Al costado del buque en el puerto de embarque', flete: 'comprador', seguro: 'nadie obligado', importacion: 'comprador' },
  { codigo: 'FOB', nombre: 'Franco a bordo', transporte: 'maritimo', riesgo: 'A bordo del buque en el puerto de embarque', flete: 'comprador', seguro: 'nadie obligado', importacion: 'comprador' },
  { codigo: 'CFR', nombre: 'Costo y flete', transporte: 'maritimo', riesgo: 'A bordo del buque en el puerto de embarque', flete: 'vendedor', seguro: 'nadie obligado', importacion: 'comprador' },
  { codigo: 'CIF', nombre: 'Costo, seguro y flete', transporte: 'maritimo', riesgo: 'A bordo del buque en el puerto de embarque', flete: 'vendedor', seguro: 'vendedor', importacion: 'comprador' },
];

export const NOMBRE_DOCUMENTO: Record<TipoDocumento, { es: string; en: string }> = {
  factura: { es: 'Factura comercial', en: 'Commercial invoice' },
  proforma: { es: 'Factura proforma', en: 'Proforma invoice' },
  empaque: { es: 'Lista de empaque', en: 'Packing list' },
  origen: { es: 'Certificación de origen', en: 'Certification of origin' },
};
