import { beforeEach, describe, expect, it } from 'vitest';
import { arancelDe, FalloArancelDestino, leerArancel, leerLineas, lineasDe, olvidarConsultas, tasaDeDestino } from './tradeTariff';

// Respuestas armadas con la forma JSON:API que documenta el Trade Tariff
// (data + included, medidas enlazadas a su tipo, su derecho y su zona).
// No son grabaciones: desde este entorno la API no es alcanzable. La
// primera prueba contra la fuente real es el diagnóstico del panel.

const geo = (id: string, descripcion: string, hijos: string[] = []) => ({
  id,
  type: 'geographical_area',
  attributes: { id, geographical_area_id: id, description: descripcion },
  relationships: { children_geographical_areas: { data: hijos.map((h) => ({ id: h, type: 'geographical_area' })) } },
});

const medida = (id: string, tipo: string, area: string, derecho: string, extra: Record<string, unknown> = {}) => ({
  measure: {
    id,
    type: 'measure',
    attributes: { id, import: true, ...extra },
    relationships: {
      measure_type: { data: { id: tipo, type: 'measure_type' } },
      geographical_area: { data: { id: area, type: 'geographical_area' } },
      duty_expression: { data: { id: `${id}-duty_expression`, type: 'duty_expression' } },
      excluded_countries: { data: [] as Array<{ id: string; type: string }> },
    },
  },
  derecho: { id: `${id}-duty_expression`, type: 'duty_expression', attributes: { base: derecho, formatted_base: `<span>${derecho}</span>` } },
});

function commodity(codigo: string, medidas: ReturnType<typeof medida>[], areas: ReturnType<typeof geo>[], atributos: Record<string, unknown> = {}) {
  return {
    data: {
      id: '99999',
      type: 'commodity',
      attributes: { goods_nomenclature_item_id: codigo, description: 'Of cotton', description_plain: 'Of cotton', declarable: true, ...atributos },
      relationships: { import_measures: { data: medidas.map((m) => ({ id: m.measure.id, type: 'measure' })) } },
    },
    included: [...medidas.flatMap((m) => [m.measure, m.derecho]), ...areas],
  };
}

const AREAS = [
  geo('1011', 'ERGA OMNES'),
  geo('2005', 'Andean countries (CO, EC, PE)', ['CO', 'EC', 'PE']),
  geo('MX', 'Mexico'),
];

describe('leer el arancel de una línea', () => {
  it('general y preferencial por grupo de países (Reino Unido, Colombia)', () => {
    const cuerpo = commodity('6109100010', [medida('1', '103', '1011', '12.00 %'), medida('2', '142', '2005', '0.00 %')], AREAS);
    const a = leerArancel(cuerpo, 'uk', 'CO');
    expect(a.codigo).toBe('6109100010');
    expect(a.general?.texto).toBe('12%');
    expect(a.general?.calculable).toBe(true);
    expect(a.preferencial?.tasa.libre).toBe(true);
    expect(a.preferencial?.acuerdo).toBe('Andean countries (CO, EC, PE)');
  });

  it('un país fuera del grupo paga la general', () => {
    const cuerpo = commodity('6109100010', [medida('1', '103', '1011', '12.00 %'), medida('2', '142', '2005', '0.00 %')], AREAS);
    expect(leerArancel(cuerpo, 'uk', 'BR').preferencial).toBeNull();
  });

  it('preferencia a un país directo', () => {
    const cuerpo = commodity('6109100010', [medida('1', '103', '1011', '12.00 %'), medida('3', '142', 'MX', '0.00 %')], AREAS);
    expect(leerArancel(cuerpo, 'xi', 'MX').preferencial?.acuerdo).toBe('Mexico');
  });

  it('un país excluido de la medida no la recibe', () => {
    const m = medida('2', '142', '2005', '0.00 %');
    m.measure.relationships.excluded_countries.data = [{ id: 'EC', type: 'geographical_area' }];
    const cuerpo = commodity('6109100010', [medida('1', '103', '1011', '12.00 %'), m], AREAS);
    expect(leerArancel(cuerpo, 'uk', 'EC').preferencial).toBeNull();
    expect(leerArancel(cuerpo, 'uk', 'CO').preferencial).not.toBeNull();
  });

  it('en el arancel de la UE sólo cuentan las medidas de la UE', () => {
    const cuerpo = commodity(
      '6109100010',
      [medida('1', '103', '1011', '12.00 %', { origin: 'eu' }), medida('9', '103', '1011', '10.00 %', { origin: 'uk' })],
      AREAS
    );
    expect(leerArancel(cuerpo, 'xi', 'CO').general?.texto).toBe('12%');
  });

  it('una tarifa en euros por kilo no se calcula: se muestra y se pide confirmarla', () => {
    const cuerpo = commodity('1806900000', [medida('1', '103', '1011', '8.30 % + 25.20 EUR / 100 kg')], AREAS);
    const a = leerArancel(cuerpo, 'xi', 'CO');
    expect(a.general?.calculable).toBe(false);
    expect(a.general?.texto).toContain('EUR / 100 kg');
    expect(a.general?.motivo).toContain('EUR');
  });

  it('dos tarifas generales distintas (según condición) no se eligen al azar', () => {
    const cuerpo = commodity('2204210000', [medida('1', '103', '1011', '12.00 %'), medida('2', '103', '1011', '8.00 %')], AREAS);
    const a = leerArancel(cuerpo, 'uk', 'CO');
    expect(a.general?.calculable).toBe(false);
    expect(a.general?.texto).toBe('12% / 8%');
  });

  it('sin medida 103, usa la tarifa básica que publica la línea', () => {
    const cuerpo = commodity('6109100010', [], AREAS, { basic_duty_rate: '12.00 %' });
    expect(leerArancel(cuerpo, 'uk', 'CO').general?.texto).toBe('12%');
  });

  it('avisa si hay antidumping para ese origen', () => {
    const cuerpo = commodity('7318150000', [medida('1', '103', '1011', '3.70 %'), medida('5', '552', '2005', '22.00 %')], AREAS);
    expect(leerArancel(cuerpo, 'xi', 'PE').avisos.some((a) => a.includes('antidumping'))).toBe(true);
    expect(leerArancel(cuerpo, 'xi', 'MX').avisos.some((a) => a.includes('antidumping'))).toBe(false);
  });

  it('siempre dice que se cobra sobre CIF y que hay IVA de importación', () => {
    const cuerpo = commodity('6109100010', [medida('1', '103', '1011', '12.00 %')], AREAS);
    expect(leerArancel(cuerpo, 'uk', 'CO').avisos.join(' ')).toContain('CIF');
  });

  it('una respuesta sin data es un error con nombre, no un arancel vacío', () => {
    expect(() => leerArancel({}, 'uk', 'CO')).toThrow(FalloArancelDestino);
  });
});

describe('tasas del destino', () => {
  it('lee porcentajes con el formato del servicio', () => {
    expect(tasaDeDestino('12.00 %', 'GBP').texto).toBe('12%');
    expect(tasaDeDestino('0.00 %', 'GBP').libre).toBe(true);
    expect(tasaDeDestino('<span>6.50</span> %', 'EUR').texto).toBe('6.5%');
  });
});

describe('las líneas de una subpartida', () => {
  const heading = {
    data: { id: '1', type: 'heading', attributes: { goods_nomenclature_item_id: '6109000000', declarable: false } },
    included: [
      { id: '10', type: 'commodity', attributes: { goods_nomenclature_item_id: '6109100000', producline_suffix: '80', leaf: false, description: 'Of cotton' } },
      { id: '11', type: 'commodity', attributes: { goods_nomenclature_item_id: '6109100010', producline_suffix: '80', leaf: true, description: "Men's or boys'" } },
      { id: '12', type: 'commodity', attributes: { goods_nomenclature_item_id: '6109100090', producline_suffix: '80', leaf: true, description: "Women's or girls'" } },
      { id: '13', type: 'commodity', attributes: { goods_nomenclature_item_id: '6109902000', producline_suffix: '80', leaf: true, description: 'Of wool' } },
      { id: '14', type: 'commodity', attributes: { goods_nomenclature_item_id: '6109100000', producline_suffix: '10', leaf: true, description: 'Título' } },
    ],
  };

  it('sólo las declarables de esa subpartida', () => {
    expect(leerLineas(heading, '610910')).toEqual([
      { codigo: '6109100010', descripcion: "Men's or boys'" },
      { codigo: '6109100090', descripcion: "Women's or girls'" },
    ]);
  });

  it('una partida declarable es su propia línea', () => {
    const d = { data: { id: '1', type: 'heading', attributes: { goods_nomenclature_item_id: '0409000000', declarable: true, description: 'Natural honey' } } };
    expect(leerLineas(d, '040900')).toEqual([{ codigo: '0409000000', descripcion: 'Natural honey' }]);
  });
});

describe('consultar', () => {
  beforeEach(() => olvidarConsultas());

  const servidor = (cuerpos: Record<string, { status: number; cuerpo?: unknown }>) => {
    const urls: string[] = [];
    const hacer = (async (url: string) => {
      urls.push(url);
      const r = cuerpos[new URL(url).pathname] ?? { status: 404 };
      return new Response(r.cuerpo ? JSON.stringify(r.cuerpo) : 'not found', { status: r.status });
    }) as unknown as typeof fetch;
    return { hacer, urls };
  };

  it('el Reino Unido y la UE van a sus rutas, y una consulta repetida sale de memoria', async () => {
    const cuerpo = commodity('6109100010', [medida('1', '103', '1011', '12.00 %')], AREAS);
    const { hacer, urls } = servidor({
      '/api/v2/commodities/6109100010': { status: 200, cuerpo },
      '/xi/api/v2/commodities/6109100010': { status: 200, cuerpo },
    });
    await arancelDe('uk', '6109100010', 'CO', hacer);
    await arancelDe('xi', '6109100010', 'CO', hacer);
    await arancelDe('uk', '6109100010', 'PE', hacer);
    expect(urls).toEqual([
      'https://www.trade-tariff.service.gov.uk/api/v2/commodities/6109100010',
      'https://www.trade-tariff.service.gov.uk/xi/api/v2/commodities/6109100010',
    ]);
  });

  it('un código que no existe en el destino se dice así', async () => {
    const { hacer } = servidor({});
    const err = (await arancelDe('uk', '6109100099', 'CO', hacer).catch((e) => e)) as FalloArancelDestino;
    expect(err.causa).toBe('no_existe');
  });

  it('una caída del servicio no se guarda como respuesta', async () => {
    const { hacer, urls } = servidor({ '/api/v2/headings/6109': { status: 503 } });
    await lineasDe('uk', '610910', hacer).catch(() => null);
    await lineasDe('uk', '610910', hacer).catch(() => null);
    expect(urls).toHaveLength(2);
  });
});
