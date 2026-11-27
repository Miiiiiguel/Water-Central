# Pone en español las descripciones de los aranceles publicados en inglés
# (Canadá y la UE), sin inventar nada:
#   * Las partidas (4 dígitos) y subpartidas (6) son las del Sistema
#     Armonizado, iguales en todo el mundo: se toma el texto oficial en
#     español de los aranceles de Colombia, Perú, Chile y México.
#   * Las frases que más se repiten salen de glosario_en_es.json.
#   * El resto queda en inglés y la calculadora lo traduce al mostrarlo
#     (server/hts/traduccion.ts).
# El original en inglés queda en "o". Se puede volver a correr: parte de "o".
#
#   python3 -I scripts/aranceles/traducir_es.py server/aranceles
import sys, re, json, gzip, os
DIR = sys.argv[1]
AQUI = os.path.dirname(os.path.abspath(__file__))
G = json.load(open(os.path.join(AQUI, 'glosario_en_es.json'), encoding='utf-8'))

def norm(s): return re.sub(r'\s+', ' ', s).strip().rstrip(':').strip().lower()
FRASES = {norm(k): v for k, v in G['frases'].items()}
PAISES = G['paises']

def cargar(id):
    return [json.loads(l) for l in gzip.open(f'{DIR}/arancel-{id}.ndjson.gz', 'rt', encoding='utf-8')]

# El Sistema Armonizado en español, por código de 4 y 6 dígitos.
# Primero los renglones de 4 y 6 dígitos; después las líneas que no abren
# la subpartida (6109100000 = 610910).
# Sólo textos completos: el PDF de México a veces deja trozos sueltos
# ("pastas similares para el").
CORTADO = re.compile(r'(?:\b(?:y|o|e|u|de|del|la|el|los|las|para|con|en|por|a|al|que|sin)|[,(])\s*$', re.I)
def completo(d):
    d = d.strip()
    return len(d) > 2 and (d[0].isupper() or d[0].isdigit()) and not CORTADO.search(d) and d.count('(') == d.count(')')
HS = {}
LATAM = {id: cargar(id) for id in ['CO', 'PE', 'CL', 'MX']}
for filas in LATAM.values():
    for r in filas:
        if len(r['c']) in (4, 6) and completo(r['d']): HS.setdefault(r['c'], r['d'])
for filas in LATAM.values():
    for r in filas:
        c = r['c']
        if len(c) >= 8 and c[6:].strip('0') == '' and completo(r['d']): HS.setdefault(c[:6], r['d'])

def es_subpartida(c):
    """El código es la partida o subpartida misma (sin abrir más)."""
    return len(c) == 4 or len(c) == 6 or (len(c) >= 8 and c[6:].strip('0') == '')

VOL = r'(\d+(?:[.,]\d+)?) ?% vol'
REGLAS = [
    (re.compile(r'^consigned from (.+)$'), lambda m: 'Enviados desde ' + PAISES.get(m.group(1).lower(), None) if m.group(1).lower() in PAISES else None),
    (re.compile(r'^of an actual alcoholic strength by volume not exceeding ' + VOL + r'$'), lambda m: f'De grado alcohólico volumétrico adquirido inferior o igual a {m.group(1)} % vol'),
    (re.compile(r'^of an actual alcoholic strength by volume exceeding ' + VOL + r' but not exceeding ' + VOL + r'$'), lambda m: f'De grado alcohólico volumétrico adquirido superior a {m.group(1)} % vol pero inferior o igual a {m.group(2)} % vol'),
    (re.compile(r'^of an actual alcoholic strength by volume exceeding ' + VOL + r'$'), lambda m: f'De grado alcohólico volumétrico adquirido superior a {m.group(1)} % vol'),
    (re.compile(r'^in immediate packings of a net content not exceeding ([\d.,]+ ?k?g)$'), lambda m: f'En envases inmediatos de contenido neto inferior o igual a {m.group(1)}'),
    (re.compile(r'^in immediate packings of a net content exceeding ([\d.,]+ ?k?g) but not exceeding ([\d.,]+ ?k?g)$'), lambda m: f'En envases inmediatos de contenido neto superior a {m.group(1)} pero inferior o igual a {m.group(2)}'),
    (re.compile(r'^in immediate packings of a net content exceeding ([\d.,]+ ?k?g)$'), lambda m: f'En envases inmediatos de contenido neto superior a {m.group(1)}'),
    (re.compile(r'^of a thickness not exceeding ([\d.,]+ ?mm)$'), lambda m: f'De espesor inferior o igual a {m.group(1)}'),
    (re.compile(r'^of a thickness exceeding ([\d.,]+ ?mm)$'), lambda m: f'De espesor superior a {m.group(1)}'),
    (re.compile(r'^of a thickness of ([\d.,]+ ?mm) or more but (?:not exceeding|less than) ([\d.,]+ ?mm)$'), lambda m: f'De espesor superior o igual a {m.group(1)} pero inferior a {m.group(2)}'),
    (re.compile(r'^for use in (?:certain types of )?aircraft$'), lambda m: 'Para uso en aeronaves'),
]

def traducir(d):
    n = norm(d)
    dos_puntos = d.rstrip().endswith(':')
    es = FRASES.get(n)
    if es is None:
        for rx, f in REGLAS:
            m = rx.match(n)
            if m:
                es = f(m)
                if es: break
    if es is None: return None
    return es + (':' if dos_puntos else '')

for id in ['CA', 'UE']:
    filas = cargar(id)
    hs = frases = 0
    # En la UE un título sin código lleva el de su primera línea (8517610000
    # es "Other apparatus..." y también "Base stations"): sólo el último
    # renglón con ese código es la subpartida.
    ultimo = {r['c']: i for i, r in enumerate(filas)}
    for i, r in enumerate(filas):
        en = r.get('o', r['d'])
        r.pop('o', None); r['d'] = en
        es = None
        if r['c'] and es_subpartida(r['c']) and ultimo[r['c']] == i:
            es = HS.get(r['c'] if len(r['c']) <= 6 else r['c'][:6])
            if es: hs += 1
        if es is None:
            es = traducir(en)
            if es: frases += 1
        if es and es != en:
            r['d'] = es; r['o'] = en
    with gzip.open(f'{DIR}/arancel-{id}.ndjson.gz', 'wt', encoding='utf-8') as f:
        for r in filas: f.write(json.dumps(r, ensure_ascii=False, separators=(',', ':')) + '\n')
    meta_p = f'{DIR}/arancel-{id}.meta.json'
    meta = json.load(open(meta_p, encoding='utf-8'))
    meta['idioma'] = 'es'
    meta['traduccion'] = ('Partidas y subpartidas con el texto oficial del Sistema Armonizado en español; '
                          'las frases frecuentes, con glosario; el resto se traduce al mostrarlo. El original en inglés queda en "o".')
    meta['traducidas'] = sum(1 for r in filas if 'o' in r)
    json.dump(meta, open(meta_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(id, 'filas', len(filas), 'sistema armonizado', hs, 'glosario', frases, 'en inglés', sum(1 for r in filas if 'o' not in r))
