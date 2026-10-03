import { describe, expect, it } from 'vitest';
import { directorio, metricas, normalizar, pautaVigente, publico, puntaje, sugeridos, terminos, type FabricanteFila } from './match';

const HOY = '2026-10-03';

const fab = (o: Partial<FabricanteFila>): FabricanteFila => ({
  id: o.nombre ?? 'x',
  nombre: 'Fabricante',
  descripcion: null,
  pais: 'CO',
  ciudad: 'Medellín',
  categorias: [],
  palabras: [],
  pedido_minimo: null,
  certificaciones: null,
  contacto_nombre: null,
  contacto_email: 'ventas@lab.co',
  contacto_whatsapp: '+573001234567',
  sitio_web: null,
  estado: 'aprobado',
  activo: true,
  pauta_hasta: '2026-12-31',
  prioridad: 0,
  plan: null,
  precio_mensual_usd: 150,
  notas: 'paga por transferencia',
  created_at: '2026-10-01T00:00:00Z',
  ...o,
});

const labCosmeticos = fab({ nombre: 'Lab Cosméticos', categorias: ['33'], palabras: ['shampoo', 'champú', 'crema'] });
const arenas = fab({ nombre: 'Arenas del Valle', categorias: ['2508'], palabras: ['arena para gatos', 'arena sanitaria'] });
const confecciones = fab({ nombre: 'Confecciones Andinas', categorias: ['61', '62'], palabras: ['camisetas', 'ropa deportiva'], prioridad: 5 });

describe('normalizar y terminos', () => {
  it('ignores accents, case and filler words', () => {
    expect(normalizar('Champú ANTICASPA!')).toBe('champu anticaspa');
    expect(terminos('Arena para gatos de bentonita')).toEqual(['arena', 'gatos', 'bentonita']);
  });
});

describe('pautaVigente', () => {
  it('needs approved, active and paid through today', () => {
    expect(pautaVigente(fab({}), HOY)).toBe(true);
    expect(pautaVigente(fab({ pauta_hasta: HOY }), HOY)).toBe(true);
    expect(pautaVigente(fab({ pauta_hasta: '2026-10-02' }), HOY)).toBe(false);
    expect(pautaVigente(fab({ pauta_hasta: null }), HOY)).toBe(false);
    expect(pautaVigente(fab({ activo: false }), HOY)).toBe(false);
    expect(pautaVigente(fab({ estado: 'pendiente' }), HOY)).toBe(false);
  });
});

describe('puntaje', () => {
  it('matches by tariff code: a heading beats a whole chapter', () => {
    expect(puntaje(labCosmeticos, { codigo: '3305.10.00' })).toBe(4);
    expect(puntaje(fab({ categorias: ['3305'] }), { codigo: '3305.10.00' })).toBe(6);
    expect(puntaje(labCosmeticos, { codigo: '6109.10.00' })).toBe(0);
  });

  it('matches by words, singular or plural, with or without accents', () => {
    expect(puntaje(labCosmeticos, { q: 'champu' })).toBe(3);
    expect(puntaje(arenas, { q: 'arenas para gato' })).toBe(6);
    expect(puntaje(confecciones, { q: 'camiseta' })).toBe(3);
    // A word only in the name counts less.
    expect(puntaje(arenas, { q: 'valle' })).toBe(1);
    expect(puntaje(labCosmeticos, { q: 'tornillos' })).toBe(0);
  });
});

describe('sugeridos', () => {
  const todos = [labCosmeticos, arenas, confecciones, fab({ nombre: 'Vencido', palabras: ['shampoo'], pauta_hasta: '2026-09-30' })];

  it('shows only current, matching sponsors, best match first', () => {
    expect(sugeridos(todos, { q: 'shampoo' }, HOY).map((f) => f.nombre)).toEqual(['Lab Cosméticos']);
    expect(sugeridos(todos, { q: 'arena para gatos', codigo: '2508.10' }, HOY).map((f) => f.nombre)).toEqual(['Arenas del Valle']);
    expect(sugeridos(todos, { q: 'nada que ver' }, HOY)).toEqual([]);
  });

  it('breaks ties with the paid priority, and caps the list', () => {
    const otro = fab({ nombre: 'Textiles Uno', categorias: ['61'], prioridad: 1 });
    expect(sugeridos([otro, confecciones], { codigo: '6109.10' }, HOY).map((f) => f.nombre)).toEqual(['Confecciones Andinas', 'Textiles Uno']);
    expect(sugeridos([otro, confecciones], { codigo: '6109.10' }, HOY, 1)).toHaveLength(1);
  });
});

describe('directorio', () => {
  it('lists every current sponsor by priority, or filters by a search', () => {
    expect(directorio([labCosmeticos, arenas, confecciones], null, HOY).map((f) => f.nombre)).toEqual(['Confecciones Andinas', 'Arenas del Valle', 'Lab Cosméticos']);
    expect(directorio([labCosmeticos, arenas, confecciones], 'crema', HOY).map((f) => f.nombre)).toEqual(['Lab Cosméticos']);
  });
});

it('the public view leaves out direct contact, price and notes', () => {
  const p = publico(labCosmeticos) as unknown as Record<string, unknown>;
  for (const k of ['contacto_email', 'contacto_whatsapp', 'precio_mensual_usd', 'notas', 'prioridad', 'palabras']) expect(k in p).toBe(false);
  expect(p.nombre).toBe('Lab Cosméticos');
});

it('metricas counts 30-day views and contacts', () => {
  const ahora = new Date('2026-10-03T12:00:00Z');
  const m = metricas(
    [
      { tipo: 'impresion', created_at: '2026-10-02T00:00:00Z' },
      { tipo: 'impresion', created_at: '2026-08-01T00:00:00Z' },
      { tipo: 'contacto', created_at: '2026-10-01T00:00:00Z' },
      { tipo: 'contacto', created_at: '2026-07-01T00:00:00Z' },
    ],
    ahora
  );
  expect(m).toEqual({ impresiones30: 1, contactos30: 1, contactos: 2 });
});

describe('route helpers', async () => {
  const { enlaceWhatsapp, fabricanteSchema, hoyColombia } = await import('./route');

  it('builds a WhatsApp link from any phone format', () => {
    expect(enlaceWhatsapp('+57 300 123 4567')).toBe('https://wa.me/573001234567');
    expect(enlaceWhatsapp('123')).toBeNull();
    expect(enlaceWhatsapp(null)).toBeNull();
  });

  it('dates the listing in Colombia, not UTC', () => {
    // 2 a.m. UTC on Oct 4 is still Oct 3 in Bogotá.
    expect(hoyColombia(new Date('2026-10-04T02:00:00Z'))).toBe('2026-10-03');
  });

  it('cleans what the admin types: codes to digits, words to lowercase, empty to null', () => {
    const f = fabricanteSchema.parse({ nombre: 'Lab', categorias: ['33', '3304.99', 'x'], palabras: ['Shampoo', 'shampoo', ''], ciudad: '', sitio_web: '' });
    expect(f.categorias).toEqual(['33', '330499']);
    expect(f.palabras).toEqual(['shampoo']);
    expect(f.ciudad).toBeNull();
    expect(f.sitio_web).toBeNull();
    expect(fabricanteSchema.safeParse({ nombre: 'Lab', sitio_web: 'lab.co' }).success).toBe(false);
    expect(fabricanteSchema.safeParse({ nombre: 'Lab', contacto_email: 'no-es-correo' }).success).toBe(false);
  });
});
