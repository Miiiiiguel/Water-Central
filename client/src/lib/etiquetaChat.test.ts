import { describe, expect, it } from 'vitest';
import { leerChip, nombrarCapitulos, respuestaChip, textoDePartidas, turnoDe } from './etiquetaChat';
import type { Analisis } from './etiqueta';

// Lo que Marco Polo dice después de una foto. Un chat pregunta de a
// una cosa: la pantalla podía mostrar cinco preguntas juntas, acá no.

const VACIO: Analisis = {
  texto: '', etiqueta: '', pista: null, legible: false,
  generico: { origen: null, marca: null, modelo: null, contenidoNeto: null, codigoDeBarras: null,
    lote: null, vencimiento: null, materiales: [], electrico: null },
  familia: null, candidatas: [], atributos: [], textil: null, preguntas: [], terminos: '',
};

const con = (cambios: Partial<Analisis>): Analisis => ({ ...VACIO, legible: true, texto: 'x', ...cambios });

describe('cuando la foto no sirvió', () => {
  it('lo dice y ofrece otra, no inventa nada', () => {
    const t = turnoDe(VACIO, 'es');
    expect(t.texto).toMatch(/no se leyó nada/i);
    expect(t.pregunta).toBeNull();
    expect(t.opciones[0].value).toBe('__analizar__');
  });
});

describe('el turno', () => {
  const analisis = con({
    familia: { id: 'calzado', nombre: 'Calzado', capitulos: ['64'] },
    generico: { ...VACIO.generico, origen: 'VIETNAM', marca: 'Nike' },
    atributos: [
      { id: 'material_corte', pregunta: '¿De qué es el corte?', decisivo: true, valor: 'textil', etiqueta: 'Textil / tela', origen: 'etiqueta' },
      { id: 'material_suela', pregunta: '¿De qué es la suela?', decisivo: true, valor: null, etiqueta: null, origen: null },
    ],
    preguntas: [
      { campo: 'material_suela', pregunta: '¿De qué es la suela?', decisiva: true,
        opciones: [{ valor: 'cuero', etiqueta: 'Cuero' }, { valor: 'caucho_plastico', etiqueta: 'Caucho o plástico' }] },
      { campo: 'origen', pregunta: '¿En qué país se fabricó?', decisiva: false },
    ],
  });

  it('dice qué producto es y en qué capítulo vive', () => {
    expect(turnoDe(analisis, 'es').texto).toMatch(/calzado.*capítulo 64/is);
  });

  it('resume lo que leyó de la etiqueta', () => {
    const t = turnoDe(analisis, 'es').texto;
    expect(t).toContain('Nike');
    expect(t).toContain('VIETNAM');
    expect(t.toLowerCase()).toContain('textil');
  });

  it('pregunta UNA sola cosa aunque falten varias', () => {
    const t = turnoDe(analisis, 'es');
    expect(t.pregunta?.campo).toBe('material_suela');
    expect(t.texto).not.toContain('¿En qué país se fabricó?');
    expect(t.texto).toMatch(/faltan 2 datos/i);
  });

  it('los botones llevan el campo y el valor, no texto suelto', () => {
    const t = turnoDe(analisis, 'es');
    expect(t.opciones.map((o) => o.value)).toEqual([
      '__etiqueta:material_suela=cuero__',
      '__etiqueta:material_suela=caucho_plastico__',
    ]);
    expect(t.opciones[0].label).toBe('Cuero');
  });

  it('una pregunta sin opciones se contesta escribiendo', () => {
    const t = turnoDe(con({ preguntas: [{ campo: 'articulo', pregunta: '¿Qué artículo es?', decisiva: true }] }), 'es');
    expect(t.opciones).toEqual([]);
    expect(t.pregunta?.campo).toBe('articulo');
  });
});

describe('lo que se dedujo', () => {
  it('se dice que se dedujo, no se pasa por dato leído', () => {
    const t = turnoDe(con({
      familia: { id: 'textil', nombre: 'Ropa y textiles', capitulos: ['61', '62', '63'] },
      atributos: [{ id: 'tejido', pregunta: '¿Punto o plana?', decisivo: true, valor: 'punto', etiqueta: 'De punto (elástica)', origen: 'supuesto' }],
    }), 'es');
    expect(t.texto).toMatch(/supuse/i);
    expect(t.texto).toMatch(/corregime/i);
    // Y no aparece en la lista de lo leído, que es lo que sí estaba impreso.
    expect(t.texto).not.toMatch(/Leí:.*de punto/i);
  });
});

describe('cuando ya no falta nada', () => {
  it('lo dice sin prometer una partida que todavía no calcula', () => {
    const t = turnoDe(con({ familia: { id: 'bebida', nombre: 'Bebidas', capitulos: ['22'] } }), 'es');
    expect(t.pregunta).toBeNull();
    expect(t.texto).toMatch(/ya tengo lo que hace falta/i);
    expect(t.opciones[0].value).toBe('__analizar__');
  });
});

describe('los chips de respuesta', () => {
  it('van y vuelven iguales', () => {
    expect(leerChip(respuestaChip('material_suela', 'cuero'))).toEqual({ campo: 'material_suela', valor: 'cuero' });
  });

  it('no confunden un chip de otra cosa con una respuesta', () => {
    expect(leerChip('__research:tiktok__')).toBeNull();
    expect(leerChip('__analizar__')).toBeNull();
    expect(leerChip('hola')).toBeNull();
  });
});

describe('en inglés', () => {
  it('contesta en inglés', () => {
    expect(turnoDe(VACIO, 'en').texto).toMatch(/nothing could be read/i);
  });
});

describe('lo que se vio en la foto', () => {
  const reloj = con({
    pista: 'reloj de pulsera',
    familia: { id: 'cap91', nombre: 'Relojes', capitulos: ['91'] },
    generico: { ...VACIO.generico, origen: 'JAPON' },
  });

  it('se dice como visto, aparte de lo leído', () => {
    const t = turnoDe(reloj, 'es').texto;
    expect(t).toContain('En la foto veo: reloj de pulsera.');
    const leido = t.split('\n').find((l) => l.startsWith('Leí:')) ?? '';
    expect(leido).not.toContain('reloj');
  });

  it('sin pista no se dice nada de la foto', () => {
    expect(turnoDe(con({}), 'es').texto).not.toContain('En la foto');
  });
});

describe('cómo se nombran los capítulos', () => {
  it('uno se nombra, pocos se enumeran, muchos van como rango', () => {
    expect(nombrarCapitulos(['91'], 'es')).toBe('capítulo 91');
    expect(nombrarCapitulos(['61', '62', '63'], 'es')).toBe('capítulos 61, 62 y 63');
    // El alimento ocupa dieciséis capítulos: leídos uno por uno no se entienden.
    expect(nombrarCapitulos(['04', '02', '21', '10', '03'], 'es')).toBe('entre los capítulos 02 y 21');
  });
});

describe('las partidas sugeridas', () => {
  const ok = {
    estado: 'ok' as const,
    sugeridas: 3,
    partidas: [
      { codigo: '9102.11.10.00', descripcion: 'Having no jewels › Other', tarifa: '6.4%', tarifaSegun: '9102.11.10', alterna: false },
      { codigo: '9102.19', descripcion: 'Other', tarifa: null, tarifaSegun: null, alterna: true },
    ],
  };

  it('se dicen con su código, su descripción y su tarifa, y como sugerencias', () => {
    const t = textoDePartidas(ok, 'es');
    expect(t).toContain('9102.11.10.00: Having no jewels › Other. Tarifa general: 6.4%.');
    expect(t).toContain('9102.19: Other.');
    expect(t).toMatch(/verificadas contra el arancel/);
    expect(t).toMatch(/agente de aduana/);
    expect(t).toMatch(/no incluye sobretasas/);
  });

  it('nunca nombran de dónde salen', () => {
    for (const r of [ok, { estado: 'no_configurado' as const }, { estado: 'ok' as const, partidas: [], sugeridas: 2 }]) {
      expect(textoDePartidas(r, 'es')).not.toMatch(/fedex/i);
      expect(textoDePartidas(r, 'en')).not.toMatch(/fedex/i);
    }
  });

  it('si ninguna existe en el arancel, lo dice y no inventa una', () => {
    const t = textoDePartidas({ estado: 'ok', partidas: [], sugeridas: 4 }, 'es');
    expect(t).toMatch(/no te doy ninguna/);
    expect(t).not.toMatch(/\d{4}\.\d{2}/);
  });

  it('sin el servicio conectado, dice lo mismo que decía antes', () => {
    expect(textoDePartidas({ estado: 'no_configurado' }, 'es')).toMatch(/lo próximo que entra/);
  });

  it('una falla se dice con su motivo', () => {
    expect(textoDePartidas({ estado: 'error', mensaje: 'El servicio de partidas no respondió.' }, 'es')).toBe('El servicio de partidas no respondió.');
  });
});
