# «Атлас» из Google Sheets (лист «Атлас») → server/seed/atlas.json и гербы public/assets/atlas/*.webp.
# Текст — из CSV (в xlsx «2-5» превращается в дату), картинки — из xlsx (герб народа у каждого блока).
# Блок народа: название, разделы «Основные сведения», «Политика», «Культура и демография», «Топография и биосфера»,
# «Показатели» — по две колонки «признак — значение» (с подзаголовками), внизу — «Глобальные структуры»:
# естественные (название, размер, эволюция, локация, опасность, особенности) и построенные (название, бонусы, особенности).
#   python tools/atlas-sheet-to-json.py <atlas.csv> <таблица.xlsx>
import csv
import hashlib
import io
import json
import re
import sys
from pathlib import Path

import openpyxl
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'server' / 'seed' / 'atlas.json'
IMG = ROOT / 'public' / 'assets' / 'atlas'
rows = list(csv.reader(open(sys.argv[1], encoding='utf8')))
wb = openpyxl.load_workbook(sys.argv[2])
ws = wb['Атлас']

A, D, E, F, G, H, L, O, P, Q, R, S = 0, 3, 4, 5, 6, 7, 11, 14, 15, 16, 17, 18
cell = lambda r, c: (rows[r][c].strip() if r < len(rows) and c < len(rows[r]) else '')
num = lambda v: re.sub(r'\.0$', '', v)
SECTIONS = {'Основные сведения', 'Политика', 'Культура и демография', 'Топография и биосфера', 'Показатели'}

# начало блока: в строке только название, через три строки — «Основные сведения»
starts = [i for i in range(len(rows)) if [c for c in rows[i] if c.strip()] == [cell(i, E)] and cell(i, E) and any(cell(i + k, E) == 'Основные сведения' for k in range(1, 5))]
starts.append(len(rows))
imgs = {}
for im in ws._images:
    imgs.setdefault(im.anchor._from.row, im)  # два одинаковых герба по бокам — берём один
IMG.mkdir(parents=True, exist_ok=True)

nations = []
for bi, r0 in enumerate(starts[:-1]):
    r1 = starts[bi + 1]
    name = cell(r0, E)
    nid = 'n-' + hashlib.md5(name.encode('utf8')).hexdigest()[:6]
    if name == '???':
        nid = f'n-unknown-{bi}'
    sections, cur = [], None
    natural, built = [], []
    mode = ''
    for r in range(r0 + 1, r1):
        a = cell(r, A)
        if a == 'Глобальные структуры':
            mode = 'struct'
            continue
        if mode == 'struct':
            if a in ('Естественные', 'Название'):
                continue
            if a:
                natural.append({'name': a, 'size': cell(r, D), 'evo': cell(r, E), 'place': cell(r, F), 'danger': cell(r, G), 'note': cell(r, H)})
            if cell(r, L) and cell(r, L) not in ('Построенные', 'Название'):
                built.append({'name': cell(r, L), 'bonus': [x for x in (cell(r, O), cell(r, P), cell(r, Q), cell(r, R)) if x], 'note': cell(r, S)})
            continue
        e, h, l, o = cell(r, E), cell(r, H), cell(r, L), num(cell(r, O))
        if e in SECTIONS and not h and not l:
            cur = {'title': e, 'left': [], 'right': []}
            sections.append(cur)
            continue
        if not cur or not (e or l):
            continue
        # подзаголовки колонок: «Рельеф и растительность» | «Водные источники»
        if e and not h:
            cur['left'].append({'h': e})
        elif e:
            cur['left'].append({'k': e, 'v': num(h)})
            if e == 'Общее население':
                cur['left'].append({'h': 'Кто живёт'})
        if l and not o:
            cur['right'].append({'h': l})
        elif l:
            cur['right'].append({'k': l, 'v': o})
    emblem = ''
    im = imgs.get(r0)
    if im is not None:
        pic = Image.open(io.BytesIO(im._data())).convert('RGBA')
        pic.thumbnail((640, 640))
        pic.save(IMG / f'{nid}.webp', 'WEBP', quality=88, method=6)
        emblem = f'/assets/atlas/{nid}.webp'
    nations.append({'id': nid, 'name': name, 'emblem': emblem, 'hidden': name == '???', 'sections': sections, 'natural': natural, 'built': built})

OUT.write_text(json.dumps(nations, ensure_ascii=False), encoding='utf8')
print('народов', len(nations))
for n in nations:
    print(' ', n['name'], 'разделов', len(n['sections']), 'строк', sum(len(s['left']) + len(s['right']) for s in n['sections']), 'естеств.', len(n['natural']), 'постр.', len(n['built']), 'герб' if n['emblem'] else '')
