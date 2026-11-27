# Pasa los aranceles oficiales descargados a un mismo formato:
# una línea JSON por fila {c: código (sólo dígitos, '' si es un grupo), n: nivel,
# d: descripción, t: tasa general (texto) o null, f: true si es la línea que se declara}.
import sys, re, json, gzip, html, os
D = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
only = set(sys.argv[3:])

def dashes(s):
    m = re.match(r'^((?:-\s*)+)', s)
    return (m.group(1).count('-'), s[m.end():].strip()) if m else (0, s.strip())

def tasa_pct(v):
    if v is None: return None
    s = str(v).strip().replace(',', '.')
    if s == '': return None
    if re.fullmatch(r'\d+(\.\d+)?', s):
        x = float(s); return (str(int(x)) if x == int(x) else ('%g' % x)) + '%'
    return s

def write(iso, rows, meta):
    with gzip.open(f'{OUT}/{iso}.ndjson.gz', 'wt', encoding='utf-8') as f:
        for r in rows: f.write(json.dumps(r, ensure_ascii=False, separators=(',', ':')) + '\n')
    finales = [r for r in rows if r['f']]
    con = [r for r in finales if r['t'] is not None]
    meta['filas'] = len(rows); meta['lineas'] = len(finales); meta['con_tasa'] = len(con); meta['descargado'] = '2026-11-27'
    json.dump(meta, open(f'{OUT}/{iso}.meta.json', 'w'), ensure_ascii=False, indent=1)
    print(iso, 'filas', len(rows), 'lineas', len(finales), 'con tasa', len(con))

def busca(rows, pref):
    return [(r['c'], r['d'][:50], r['t']) for r in rows if r['c'].startswith(pref) and r['f']][:4]

# ---------------- Chile ----------------
def chile():
    import openpyxl
    wb = openpyxl.load_workbook(f'{D}/cl/arancel_cl_2022.xlsx', read_only=True)
    ws = wb[wb.sheetnames[0]]; rows = []
    for r in ws.iter_rows(values_only=True):
        a, b, c = (r + (None,) * 6)[:3]; e = (r + (None,) * 6)[4]
        a = str(a).strip() if a is not None else ''; b = str(b).strip() if b is not None else ''; c = str(c).strip() if c is not None else ''
        if re.fullmatch(r'\d\d\.\d\d', a) and c:
            rows.append({'c': a.replace('.', ''), 'n': 0, 'd': c, 't': None, 'f': False})
            if re.fullmatch(r'\d{4}\.\d{4}', b):
                rows.append({'c': b.replace('.', ''), 'n': 1, 'd': c, 't': tasa_pct(e), 'f': True})
            continue
        if re.fullmatch(r'\d{4}\.\d{4}', b) and c:
            n, d = dashes(c)
            rows.append({'c': b.replace('.', ''), 'n': max(1, n), 'd': d, 't': tasa_pct(e), 'f': True}); continue
        if not b and c.startswith('-'):
            n, d = dashes(c); rows.append({'c': '', 'n': n, 'd': d, 't': None, 'f': False})
    write('CL', rows, {'pais': 'Chile', 'fuente': 'Servicio Nacional de Aduanas de Chile — Arancel Aduanero Nacional 2022 (versión publicada en aduana.cl)', 'url': 'https://www.aduana.cl/arancel-aduanero-2022/aduana/2021-12-19/163240.html', 'idioma': 'es', 'nota': 'Tasa general (NMF). Chile aplica 6 % a casi todo lo que no entra con un TLC.'})
    print('  ', busca(rows, '61091'))

# ---------------- Perú ----------------
def peru():
    lines = open(f'{D}/pe/pe.txt', encoding='utf-8').read().replace('\f', '\n').split('\n')
    rows = []; cur = None
    for ln in lines:
        if not ln.strip(): cur = None if cur and cur['f'] else cur; continue
        m = re.match(r'^(\d\d\.\d\d)\s{2,}(\S.*)$', ln)
        if m:
            cur = {'c': m.group(1).replace('.', ''), 'n': 0, 'd': m.group(2).strip(), 't': None, 'f': False}; rows.append(cur); continue
        m = re.match(r'^(\d{4}\.\d{2}(?:\.\d{2}(?:\.\d{2})?)?)\s+(.*?)\s*$', ln)
        if m:
            code = m.group(1).replace('.', ''); rest = m.group(2)
            t = None
            mt = re.search(r'\s{2,}(\d+)\s*$', rest)
            if mt and len(code) == 10: t = mt.group(1) + '%'; rest = rest[:mt.start()]
            n, d = dashes(rest)
            cur = {'c': code, 'n': max(1, n), 'd': d, 't': t, 'f': len(code) == 10}; rows.append(cur); continue
        m = re.match(r'^\s{4,}((?:-\s*)+)(\S.*)$', ln)
        if m and not re.search(r'\s{2,}\d+\s*$', ln):
            n, d = dashes(m.group(1) + m.group(2)); cur = {'c': '', 'n': n, 'd': d, 't': None, 'f': False}; rows.append(cur); continue
        if cur and re.match(r'^\s{10,}\S', ln):  # continuación de la descripción
            txt = ln.strip()
            mt = re.search(r'\s{2,}(\d+)\s*$', ln)
            if mt and cur['f'] and cur['t'] is None: cur['t'] = mt.group(1) + '%'; txt = ln[:mt.start()].strip()
            if not re.fullmatch(r'\d+', txt): cur['d'] = (cur['d'] + ' ' + txt).strip()
    write('PE', rows, {'pais': 'Perú', 'fuente': 'SUNAT — Arancel de Aduanas 2022 (Decreto Supremo 404-2021-EF)', 'url': 'https://www.sunat.gob.pe/orientacionaduanera/aranceles/2022/arancel-ad-2022.pdf', 'idioma': 'es', 'nota': 'Derecho ad valorem general. Revisar modificaciones posteriores (p. ej. DS 163-2022-EF).'})
    print('  ', busca(rows, '61091'))

# ---------------- Colombia ----------------
def colombia():
    lines = open(f'{D}/co/decreto_1881_2021.htm.txt', encoding='utf-8').read().split('\n')
    rows = []; empezo = False
    for ln in lines:
        p = [x.strip() for x in ln.split('|')]
        p = [x for x in p if x != '']
        if not p: continue
        if re.fullmatch(r'\d\d\.\d\d', p[0]) and len(p) >= 2:
            empezo = True; rows.append({'c': p[0].replace('.', ''), 'n': 0, 'd': p[1], 't': None, 'f': False}); continue
        if not empezo: continue
        if re.fullmatch(r'\d{4}\.\d{2}(\.\d{2}(\.\d{2})?)?', p[0]) and len(p) >= 2:
            code = p[0].replace('.', ''); n, d = dashes(p[1])
            t = tasa_pct(p[2]) if len(p) >= 3 and re.fullmatch(r'[\d,\.]+', p[2]) else None
            rows.append({'c': code, 'n': max(1, n), 'd': d, 't': t, 'f': len(code) == 10}); continue
        if p[0].startswith('-') and len(p) == 1:
            n, d = dashes(p[0]); rows.append({'c': '', 'n': n, 'd': d, 't': None, 'f': False})
    write('CO', rows, {'pais': 'Colombia', 'fuente': 'DIAN — Arancel de Aduanas, Decreto 1881 de 2021 (compilación del normograma DIAN, con sus modificaciones)', 'url': 'https://normograma.dian.gov.co/dian/compilacion/docs/decreto_1881_2021.htm', 'idioma': 'es', 'nota': 'Gravamen arancelario general. Algunos productos agrícolas usan el Sistema Andino de Franjas de Precios.'})
    print('  ', busca(rows, '61091'))

# ---------------- Brasil / Mercosur ----------------
def brasil():
    import openpyxl
    wb = openpyxl.load_workbook(f'{D}/br/tec_br.xlsx', read_only=True)
    aplicada = {}
    for r in wb['Anexo II - Diferentes da TEC'].iter_rows(values_only=True):
        if r and r[0] and re.fullmatch(r'\d{4}\.\d{2}\.\d{2}', str(r[0]).strip()) and len(r) > 5 and r[5] not in (None, ''):
            aplicada[str(r[0]).strip().replace('.', '')] = str(r[5]).strip()
    tec = []
    for r in wb['Anexo I - TEC'].iter_rows(values_only=True):
        a = str(r[0]).strip() if r and r[0] is not None else ''; b = str(r[1]).strip() if len(r) > 1 and r[1] is not None else ''; c = r[2] if len(r) > 2 else None
        if not a or not b: continue
        if re.fullmatch(r'\d\d\.\d\d', a): tec.append({'c': a.replace('.', ''), 'n': 0, 'd': b, 't': None, 'f': False}); continue
        if re.fullmatch(r'\d{4}(\.\d{1,2}(\.\d{2})?)?', a):
            code = a.replace('.', ''); n, d = dashes(b)
            t = None
            if c not in (None, ''):
                s = str(c).strip(); mm = re.match(r'^([\d,\.]+)\s*(BK|BIT)?$', s)
                t = (tasa_pct(mm.group(1)) + (' ' + mm.group(2) if mm.group(2) else '')) if mm else s
            tec.append({'c': code, 'n': max(1, n), 'd': d, 't': t, 'f': len(code) == 8})
    write('MERCOSUR', tec, {'pais': 'Mercosur (Argentina, Paraguay, Uruguay)', 'fuente': 'Tarifa Externa Común del Mercosur (NCM/TEC, SH-2022) — Anexo I de la Resolución Gecex 272/2021, Camex/MDIC', 'url': 'https://www.gov.br/mdic/pt-br/assuntos/camex/se-camex/strat/tarifas/vigentes', 'idioma': 'pt', 'nota': 'Tasa común del Mercosur. Cada país tiene su lista de excepciones, que puede cambiar la tasa de algunos productos.'})
    br = []
    for r in tec:
        x = dict(r)
        if x['f'] and x['c'] in aplicada: x['t'] = tasa_pct(aplicada[x['c']])
        br.append(x)
    write('BR', br, {'pais': 'Brasil', 'fuente': 'Camex/MDIC — TEC con las tarifas que Brasil aplica distinto (Anexos I y II de la Resolución Gecex 272/2021, actualizados al 25-11-2026)', 'url': 'https://www.gov.br/mdic/pt-br/assuntos/camex/se-camex/strat/tarifas/vigentes', 'idioma': 'pt', 'nota': 'Alíquota aplicada por Brasil. Hay reducciones temporales con cupo (LETEC, desabastecimiento) que no se incluyen.'})
    print('  ', busca(br, '61091'))

# ---------------- México ----------------
def mexico():
    lines = open(f'{D}/mx/mx.txt', encoding='utf-8').read().replace('\f', '\n').split('\n')
    # Empieza en la Tarifa (artículo 1), en el capítulo 01.
    ini = next(i for i, l in enumerate(lines) if re.match(r'^\s*01\.01(\s|$)', l))
    # La descripción de la partida 01.01 está justo arriba del código.
    while ini > 0 and lines[ini - 1].strip() and not re.search(r'DE EXP\.|DE IMP\.', lines[ini - 1]): ini -= 1
    lines = lines[ini:]
    cab = re.compile(r'LEY DE LOS IMPUESTOS GENERALES|CÁMARA DE DIPUTADOS|Secretaría General|Secretaría de Servicios Parlamentarios|^\s*\d+ de \d+\s*$|CUOTA \(ARANCEL\)|CÓDIGO\s+DESCRIPCIÓN|DE IMP\.\s+DE EXP\.|^\s*(Capítulo|CAPÍTULO|Sección|SECCIÓN)\b|^\s*Notas?\b|^\s*[a-z]\)\s')
    nota = re.compile(r'DOF|antes Imp|Arancel modificado|Fracción reformada|Fracción adicionada|Modificación|derogad|mantiene Imp|restablece|vigencia temporal|Imp\.\s*\d|Imp\.\)|^\s*\)|Exp\.\s*\d')
    U = r'(Kg|Pza|L|Par|Cbza|G|CARAT|Mll|M2|M3|M|KWH|Barr|Jgo|Kit)'
    R = r'(Ex\.?|AE|Prohibida|\d+(?:\.\d+)?)'
    tail = re.compile(r'(?:^|\s+)' + U + r'\s+' + R + r'\s+' + R + r'\s*$')
    rows = []; cur = None; pend = []
    def cierra():
        nonlocal cur
        if cur and not cur['d'] and pend: cur['d'] = ' '.join(pend)
        cur = None
    for ln in lines:
        if cab.search(ln): continue
        if re.match(r'^\s*(ARTÍCULO|Artículo)\s+2', ln): break  # fin de la Tarifa
        if not ln.strip(): continue
        mt = tail.search(ln); unidad = imp = None
        if mt: unidad, imp = mt.group(1), mt.group(2); body = ln[:mt.start()]
        else: body = ln
        m8 = re.match(r'^\s*(\d{4}\.\d{2}\.\d{2})\b(.*)$', body)
        m6 = re.match(r'^\s*(\d{4}\.\d{2})\s+(.*)$', body)
        mh = re.match(r'^\s*(\d\d\.\d\d)\s+(.*)$', body) or re.match(r'^\s*(\d\d\.\d\d)\s*$', body)
        if m8:
            cierra()
            txt = m8.group(2).strip()
            if nota.search(txt): txt = ''
            prefijo = ' '.join(pend) if pend and not pend[-1].endswith('.') else ''
            cur = {'c': m8.group(1).replace('.', ''), 'n': 3, 'd': ((prefijo + ' ' + txt).strip() if txt else ' '.join(pend)), 't': None, 'f': True, '_u': unidad}
            if imp: cur['t'] = tasa_pct(imp) if not imp.startswith('Ex') else 'Ex.'
            pend = []; rows.append(cur); continue
        if m6 and not m8:
            cierra()
            n, d = dashes(m6.group(2)); d = '' if nota.search(d) else d
            cur = {'c': m6.group(1).replace('.', ''), 'n': max(1, n), 'd': d or ' '.join(pend), 't': None, 'f': False}; pend = []; rows.append(cur); continue
        if mh:
            cierra()
            d = (mh.group(2) if mh.lastindex and mh.lastindex >= 2 else '').strip()
            cur = {'c': mh.group(1).replace('.', ''), 'n': 0, 'd': (' '.join(pend) + ' ' + d).strip(), 't': None, 'f': False}; pend = []; rows.append(cur); continue
        if imp and cur and cur['f'] and cur['t'] is None:
            cur['t'] = tasa_pct(imp) if not imp.startswith('Ex') else 'Ex.'; cur['_u'] = unidad
            txt = body.strip()
            if txt and not nota.search(txt) and not cur['d']: cur['d'] = txt
            continue
        txt = body.strip()
        if not txt or nota.search(txt): continue
        mg = re.match(r'^((?:-\s*)+)(\S.*)$', txt)
        if mg:
            cierra(); n, d = dashes(txt); rows.append({'c': '', 'n': n, 'd': d, 't': None, 'f': False}); pend = []; continue
        if cur and not cur['f'] and cur['n'] == 0 and len(cur['d']) < 400 and not cur['d'].endswith('.'):
            cur['d'] = (cur['d'] + ' ' + txt).strip(); continue
        if cur and cur['f'] and (cur['t'] is None or (cur['d'] and not cur['d'].endswith('.'))):
            cur['d'] = (cur['d'] + ' ' + txt).strip() if cur['d'] else txt; continue
        pend.append(txt)
        if len(pend) > 6: pend = pend[-6:]
    cierra()
    for r in rows:
        r.pop('_u', None)
        d = r['d']
        # Arancel mixto: "AMX (20%+0.36 Dls por Kg de azúcar)", repartido entre líneas.
        m = re.search(r'\((\d+(?:\.\d+)?)%\s*\+\s*(\d+(?:\.\d+)?)', d) if 'Dls por Kg de az' in d else None
        if r['f'] and r['t'] is None and m:
            r['t'] = f"{m.group(1)}% + {m.group(2)} USD/kg de azúcar"
        if 'Dls por Kg de az' in d or 'AMX' in d:
            d = re.sub(r'AMX|\(\d+(?:\.\d+)?%\s*\+\s*\d+(?:\.\d+)?|Dls por Kg de azúcar\)\]?|\bKg\s+Ex\.?|[\[\]_]+', ' ', d)
            # Si quedó pegada la descripción de la fila siguiente, se corta en la primera oración.
            m2 = re.match(r'^\s*(.*?\.)\s', d + ' ')
            if m2 and len(m2.group(1)) > 3: d = m2.group(1)
        r['d'] = re.sub(r'\s+', ' ', d).strip()
    write('MX', rows, {'pais': 'México', 'fuente': 'Ley de los Impuestos Generales de Importación y de Exportación (TIGIE), texto vigente publicado por la Cámara de Diputados — última reforma DOF 29-12-2025, con las fracciones modificadas por decreto DOF 13-10-2026', 'url': 'https://www.diputados.gob.mx/LeyesBiblio/ref/ligie_2022.htm', 'idioma': 'es', 'nota': 'Arancel de importación general (sin tratado). "Ex." = exento. Desde 2026 México subió aranceles a países sin tratado; los productos con TLC (T-MEC, Alianza del Pacífico, etc.) pagan menos.'})
    print('  ', busca(rows, '61091'), busca(rows, '090121'))

# ---------------- UE ----------------
def ue():
    rows = []
    for ln in gzip.open(f'{D}/ue.ndjson.gz', 'rt', encoding='utf-8'):
        x = json.loads(ln); c = x['codigo']
        if len(c) == 4: rows.append({'c': c, 'n': 0, 'd': x['descripcion'], 't': None, 'f': False}); continue
        t = x.get('tasa')
        if isinstance(t, str):
            m = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*%\s*', t)
            t = tasa_pct(m.group(1)) if m else re.sub(r'\s+', ' ', t).strip()
        rows.append({'c': c, 'n': x['nivel'], 'd': x['descripcion'], 't': t, 'f': bool(x.get('final'))})
    write('UE', rows, {'pais': 'Unión Europea (27 países)', 'fuente': 'Arancel común de la UE (TARIC, derecho de terceros países), tomado de la API pública del UK Trade Tariff para Irlanda del Norte (XI), que aplica el arancel de la UE', 'url': 'https://www.trade-tariff.service.gov.uk/xi/', 'idioma': 'en', 'nota': 'Derecho de terceros países (NMF). Con acuerdo comercial (p. ej. Colombia, Perú, Ecuador, México, Chile, Centroamérica) muchos productos entran con 0 %.'})
    print('  ', busca(rows, '610910'))

# ---------------- Canadá ----------------
# El PDF oficial de la CBSA (Customs Tariff, 01-99), pasado a texto con
# `pdftotext -layout`. La tasa NMF está en el "tariff item" de 8 dígitos; la
# línea que se declara es el número de clasificación de 10 (item + sufijo
# estadístico SS), que hereda la tasa de su item.
CA_ITEM = re.compile(r'^(\s*)(\d{4}\.\d{2}(?:\.\d{2})?)(?:\s(\d{2}))?\s+(\S.*)$')
# Las siglas de los tratados ("UST, MXT, CPUKT: N/A") que pdftotext a veces pega a la tasa.
CA_SIGLAS = re.compile(r'\b[A-Z]{1,5}T\s*:\s*(?:N/A|Free|\d[\d.]*%)|\b[A-Z]{1,5}T\b\s*[,:]?')
CA_PARTIDA = re.compile(r'^\s*(\d{2})\.(\d{2})\s{2,}(\S.*)$')
CA_SS = re.compile(r'^\s*(\d{2})\s+(-[\s-]*\S.*)$')
CA_GRUPO = re.compile(r'^\s+(-[\s-]*\S.*)$')
CA_TASA = re.compile(r'^(Free|N/A|\d|\$|\d+(?:\.\d+)?¢)')
CA_UNIDAD = re.compile(r'^(?:[A-Z]{3}|-)$')

def ca_trozos(linea):
    """Los textos de la línea separados por 2+ espacios, con su columna."""
    return [(m.start(), m.group(0)) for m in re.finditer(r'\S+(?: \S+)*', linea)]

def ca_desc(t):
    t = re.sub(r'\s*\.{3,}.*$', '', t)          # puntos guía y la unidad al final
    return dashes(t)

def canada():
    lineas = open(f'{D}/ca/ca.txt', encoding='utf-8').read().split('\n')
    rows = []; tabla = False; vistos = {}
    pref_col = None
    abierta = None      # la fila cuya descripción puede seguir en la línea de abajo
    tasa_col = None     # columna de la tasa NMF del último item (para tasas en varias líneas)
    item = None         # el último item de 8 dígitos y su tasa
    for ln in lineas:
        st = ln.strip()
        if not st: abierta = None; tasa_col = None; continue
        if 'Description of Goods' in ln: tabla = True; abierta = None; continue
        if re.fullmatch(r'Chapter \d+', st) or st in ('Note.', 'Notes.'): tabla = False; abierta = None; continue
        if not tabla: continue
        if re.match(r'^(Issued|Revised) ', st) or st.startswith('CUSTOMS TARIFF') or re.fullmatch(r'\d{2} - \S+', st) \
           or re.match(r'^(Tariff|Item)\b', st) or st.startswith('Unit of'):
            abierta = None; continue
        m = CA_ITEM.match(ln)
        # Los items van pegados al margen; un código más adentro es texto
        # ("... of tariff item 8509.40.90 or 8509.80.90").
        if m and len(m.group(1)) <= 8:
            codigo = m.group(2).replace('.', ''); ss = m.group(3)
            ya = vistos.get(codigo + (ss or ''))
            if ya is not None:
                # El mismo item repetido al cambiar de página: sigue la misma fila.
                abierta = ya; item = ya if len(codigo) == 8 else None; tasa_col = None; continue
            trozos = ca_trozos(ln[m.start(4):]); base = m.start(4)
            desc = trozos[0][1]; tasa = None; tasa_col = None
            resto = trozos[1:]
            if resto and CA_UNIDAD.match(resto[0][1]): resto = resto[1:]
            if resto and CA_TASA.match(resto[0][1]):
                tasa = resto[0][1]; tasa_col = base + resto[0][0]
                # Donde empiezan los tratados: lo que siga a la izquierda es tasa.
                pref_col = base + resto[1][0] if len(resto) > 1 else tasa_col + 14
            n, d = ca_desc(desc)
            n = max(n, 1)   # un item sin guiones es la partida misma ("2603.00.00 Copper ores")
            if len(codigo) == 6:
                rows.append({'c': codigo, 'n': n, 'd': d, 't': None, 'f': False})
                item = None
            else:
                fila = {'c': codigo + (ss or ''), 'n': n, 'd': d, 't': tasa, 'f': bool(ss)}
                rows.append(fila); item = fila
            vistos[rows[-1]['c']] = rows[-1]
            abierta = rows[-1]; continue
        m = CA_PARTIDA.match(ln)
        if m and len(ln) - len(ln.lstrip()) < 12:
            rows.append({'c': m.group(1) + m.group(2), 'n': 0, 'd': ca_trozos(m.group(3))[0][1], 't': None, 'f': False})
            abierta = rows[-1]; item = None; tasa_col = None; continue
        m = CA_SS.match(ln)
        if m and item is not None:
            n, d = ca_desc(ca_trozos(m.group(2))[0][1])
            fila = {'c': item['c'][:8] + m.group(1), 'n': n, 'd': d, 't': item['t'], 'f': True, '_hijo': True}
            item['_padre'] = True
            if fila['c'] in vistos: abierta = vistos[fila['c']]; continue
            vistos[fila['c']] = fila
            rows.append(fila); abierta = fila; continue
        sangria = len(ln) - len(ln.lstrip())
        trozos = ca_trozos(ln)
        # Tasa que sigue en la línea de abajo ("241% but not" / "less than" / "$34.50/hl").
        if tasa_col is not None and item is not None and item['t'] is not None:
            for col, t in trozos:
                if tasa_col - 6 <= col < pref_col - 1:
                    item['t'] += ' ' + t
                    for r in rows[::-1]:
                        if r.get('_hijo') and r['c'][:8] == item['c'][:8]: r['t'] = item['t']
                        else: break
        m = CA_GRUPO.match(ln)
        if m and sangria < 40 and trozos[0][1].startswith('-'):
            n, d = ca_desc(trozos[0][1])
            rows.append({'c': '', 'n': n, 'd': d, 't': None, 'f': False}); abierta = rows[-1]; continue
        # Descripción que sigue en la línea de abajo.
        if abierta is not None and sangria < 60 and trozos:
            extra = re.sub(r'\s*\.{3,}.*$', '', trozos[0][1])
            if extra: abierta['d'] = (abierta['d'] + ' ' + extra).strip()
    # Un item sin sufijos estadísticos se declara tal cual.
    for r in rows:
        if len(r['c']) == 8 and not r.pop('_padre', False): r['f'] = True
        r.pop('_padre', None); r.pop('_hijo', None)
        r['d'] = re.sub(r'\s+', ' ', r['d']).strip()
        if len(r['d']) > 300: r['d'] = r['d'][:297].rsplit(' ', 1)[0] + '…'
        if r['t'] is not None:
            t = re.sub(r'\s+', ' ', CA_SIGLAS.sub(' ', r['t'])).strip()
            r['t'] = '0%' if t == 'Free' else t
    write('CA', rows, {'pais': 'Canadá', 'fuente': 'Customs Tariff (Schedule, capítulos 1 a 99) de la Agencia de Servicios Fronterizos de Canadá (CBSA), edición 2026', 'url': 'https://www.cbsa-asfc.gc.ca/trade-commerce/tariff-tarif/', 'idioma': 'en', 'nota': 'Tarifa NMF (Most-Favoured-Nation), sin tratado. Con acuerdo comercial (CUSMA/T-MEC con EE. UU. y México; TLC con Colombia, Perú, Chile, Panamá, Honduras, Costa Rica; CPTPP; CETA con la UE) la mayoría de los productos entra con 0 %.'})
    print('  ', busca(rows, '610910'), busca(rows, '040110'), busca(rows, '010121'))

for nombre, fn in [('CL', chile), ('PE', peru), ('CO', colombia), ('BR', brasil), ('MX', mexico), ('UE', ue), ('CA', canada)]:
    if only and nombre not in only: continue
    try: fn()
    except Exception as e: print(nombre, 'ERROR', repr(e))
