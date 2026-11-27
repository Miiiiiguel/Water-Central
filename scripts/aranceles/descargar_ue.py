# Descarga el arancel común de la UE (vía la API XI del Trade Tariff británico:
# Irlanda del Norte aplica el arancel de la UE). Una línea por código.
import json, ssl, sys, time, urllib.request, gzip, os
OUT = sys.argv[1]
CTX = ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt')
BASE = 'https://www.trade-tariff.service.gov.uk/xi/api/v2'
def get(path, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(BASE + path, headers={'Accept': 'application/json', 'User-Agent': 'easycomex-aranceles/1.0'})
            with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            if hasattr(e, 'code') and e.code == 404: return None
            time.sleep(2 ** i)
    raise RuntimeError('fallo ' + path)
headings = []
for ch in range(1, 98):
    c = f'{ch:02d}'
    d = get(f'/chapters/{c}')
    if not d: continue
    for x in d.get('included', []):
        if x['type'] == 'heading':
            headings.append((x['attributes']['goods_nomenclature_item_id'][:4], x['attributes'].get('description_plain') or x['attributes'].get('description')))
    time.sleep(0.15)
print('partidas', len(headings), flush=True)
n = 0
with gzip.open(OUT, 'wt', encoding='utf-8') as f:
    for h, hdesc in headings:
        d = get(f'/headings/{h}')
        if not d: continue
        inc = d.get('included', [])
        dx = {x['id']: x['attributes'] for x in inc if x['type'] == 'duty_expression'}
        mt = {x['id']: x['attributes']['description'] for x in inc if x['type'] == 'measure_type'}
        ms = {}
        for x in inc:
            if x['type'] == 'measure':
                r = x['relationships']
                tipo = mt.get(r['measure_type']['data']['id'], '')
                de = dx.get(r['duty_expression']['data']['id'], {}) if r.get('duty_expression', {}).get('data') else {}
                ms[x['id']] = (tipo, de.get('verbose_duty') or de.get('base'))
        coms = [x for x in inc if x['type'] == 'commodity']
        if not coms:
            a = d['data']['attributes']
            coms = [{'attributes': {'goods_nomenclature_item_id': a['goods_nomenclature_item_id'], 'description_plain': a.get('description_plain') or hdesc, 'number_indents': 0, 'leaf': True, 'declarable': a.get('declarable', True)}, 'relationships': d['data'].get('relationships', {})}]
        f.write(json.dumps({'codigo': h, 'nivel': 0, 'descripcion': hdesc, 'tasa': None}, ensure_ascii=False) + '\n')
        for x in coms:
            a = x['attributes']
            tasa = None
            for m in (x.get('relationships', {}).get('overview_measures', {}) or {}).get('data', []) or []:
                tipo, val = ms.get(m['id'], ('', None))
                if tipo == 'Third country duty': tasa = val
            f.write(json.dumps({'codigo': a['goods_nomenclature_item_id'], 'nivel': (a.get('number_indents') or 0) + 1, 'descripcion': a.get('description_plain') or a.get('description'), 'tasa': tasa, 'final': bool(a.get('declarable', a.get('leaf')))}, ensure_ascii=False) + '\n')
            n += 1
        time.sleep(0.15)
print('lineas', n)
