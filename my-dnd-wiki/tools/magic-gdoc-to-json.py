# Магия из Google Docs (документ «Магия», 2026-11) → server/seed/magic-2.json и знаки школ public/assets/magic/*.webp.
# Школы (16 + утилитарная, Аркана со звёздными картами, гримуары), заклинания, звёздные карты (Арканы).
# Статью «Тренировка заклинаний и ритуалов» не берём — на сайте своя, правленая. Сервер заменяет школы и заклинания
# один раз (server/rules.js, исправление «magic2»): id прежних заклинаний сохраняются (привязка навыков листов к вики).
#   python tools/magic-gdoc-to-json.py <doc.html>   (export?format=html)
import base64
import hashlib
import io
import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1])
OUT = ROOT / 'server' / 'seed' / 'magic-2.json'
SIGNS = ROOT / 'public' / 'assets' / 'magic'

hid = lambda *parts: hashlib.md5('|'.join(parts).encode('utf8')).hexdigest()[:8]

# цвета документа → читаемые на тёмном фоне (как в tools/rules-gdoc-to-json.py)
COLORS = {'#6aa84f': '#7ed07a', '#38761d': '#6cc35a', '#e69138': '#f0a24f', '#f1c232': '#f1c232', '#3c78d8': '#6fa8ff',
          '#9900ff': '#c27bff', '#1c4587': '#7fa6e8', '#45818e': '#6fc3d1', '#a64d79': '#e07ab0', '#1155cc': '#6fa8ff',
          '#ff0000': '#ff6b5e', '#0000ff': '#6fa8ff', '#00ff00': '#7ed07a', '#ff9900': '#f0a24f'}
PLAIN = {'#000000', '#141414', '#121212', '#ffffff', '#434343', '#666666', '#222222', '#1f1f1f'}

soup = BeautifulSoup(SRC.read_text(encoding='utf8'), 'html.parser')
css = soup.style.string if soup.style else ''
CLS = {m.group(1): m.group(2) for m in re.finditer(r'\.(c\d+)\{([^}]*)\}', css or '')}


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def inline(el):
    out = []
    for ch in el.children:
        if isinstance(ch, NavigableString):
            out.append(esc(str(ch)))
            continue
        if not isinstance(ch, Tag) or ch.name == 'img':
            continue
        if ch.name == 'br':
            out.append('<br>')
            continue
        txt = inline(ch)
        if ch.name == 'span' and txt.strip():
            st = ';'.join(CLS.get(c, '') for c in ch.get('class', [])) + ';' + (ch.get('style') or '')
            col = re.findall(r'(?<![-\w])color:(#[0-9a-f]{6})', st)
            col = col[-1] if col else None
            if col and col not in PLAIN:
                txt = f'<span style="color:{COLORS.get(col, col)}">{txt}</span>'
            if 'font-style:italic' in st:
                txt = f'<em>{txt}</em>'
            if re.search(r'font-weight:(700|bold)', st):
                txt = f'<strong>{txt}</strong>'
        out.append(txt)
    return ''.join(out).replace('\xa0', ' ')


def text_of(el):
    return re.sub(r'\s+', ' ', el.get_text(' ')).replace('\xa0', ' ').strip()


def paras(td):
    """ячейка → абзацы HTML (пустые — мимо)"""
    ps = td.find_all(['p', 'li'])
    out = [inline(p).strip() for p in ps] if ps else [inline(td).strip()]
    return [p for p in out if re.sub(r'<[^>]+>', '', p).strip()]


def cell_html(td):
    return ''.join(f'<p>{p}</p>' for p in paras(td))


def cells(tr):
    return tr.find_all('td', recursive=False)


def table_html(t):
    rows = []
    for tr in t.find_all('tr'):
        rows.append('<tr>' + ''.join(f'<td>{cell_html(td)}</td>' for td in cells(tr)) + '</tr>')
    return '<table><tbody>' + ''.join(rows) + '</tbody></table>'


# документ: заголовок-абзац, за ним таблица
body = [e for e in soup.body.children if isinstance(e, Tag)]
blocks = []  # (заголовок, [абзацы], таблица)
title, texts = '', []
for e in body:
    if e.name == 'table':
        blocks.append((title, texts, e))
        texts = []
        continue
    t = text_of(e)
    if not t:
        continue
    if len(t) < 60 and not t.endswith('.'):
        title, texts = t, []
    else:
        texts.append(inline(e).strip())
by_title = {}
for b in blocks:
    by_title.setdefault(b[0], b)

# ---------- школы: тип и знак ----------
SID = {'Огонь': 'fire', 'Вода': 'water', 'Воздух': 'air', 'Земля': 'earth', 'Магма': 'magma', 'Лед': 'ice', 'Лёд': 'ice',
       'Молния': 'lightning', 'Природа': 'nature', 'Свет': 'light', 'Тьма': 'dark', 'Порядок': 'order', 'Хаос': 'chaos',
       'Призыв': 'summon', 'Зачарование': 'enchant', 'Разум': 'mind', 'Аркана': 'arcana'}
NAME = {'fire': 'Школа огня', 'water': 'Школа воды', 'air': 'Школа воздуха', 'earth': 'Школа земли', 'magma': 'Школа магмы',
        'ice': 'Школа льда', 'lightning': 'Школа молний', 'nature': 'Школа природы', 'light': 'Школа света', 'dark': 'Школа тьмы',
        'order': 'Школа порядка', 'chaos': 'Школа хаоса', 'summon': 'Школа призыва', 'enchant': 'Школа зачарования',
        'mind': 'Школа разума', 'arcana': 'Аркана'}
SIGNS.mkdir(parents=True, exist_ok=True)
schools = [{'id': 'utility', 'page': 'utility', 'name': 'Утилитарная магия', 'kind': '', 'sign': '', 'about': ''}]
for tr in by_title['Магические школы'][2].find_all('tr')[1:]:
    td = cells(tr)
    name, kind = text_of(td[0]), text_of(td[1])
    sid = SID[name]
    sign = ''
    img = td[2].find('img') if len(td) > 2 else None
    if img and img.get('src', '').startswith('data:image'):
        raw = base64.b64decode(img['src'].split(',', 1)[1])
        im = Image.open(io.BytesIO(raw)).convert('RGBA')
        im.save(SIGNS / f'{sid}.webp', 'WEBP', quality=90, method=6)
        sign = f'/assets/magic/{sid}.webp'
    schools.append({'id': sid, 'page': f'school-{sid}', 'name': NAME[sid], 'kind': kind, 'sign': sign, 'about': ''})


def split_cost(parts):
    """«Требует 50 маны», «Перезарядка 2 хода» → ('50 маны', '2 хода')"""
    cost, cd = [], ''
    flat = re.sub(r'\s+', ' ', ' '.join(parts))
    m = re.search(r'(?i)без перезарядки|перезарядка\s*[:;—-]?\s*([^.;]+)', flat)
    if m:
        cd = (m.group(1) or 'нет').strip()
        flat = flat[:m.start()] + flat[m.end():]
    for part in [flat]:
        for p in re.split(r'(?<=[.;])\s+', part):
            p = p.strip().rstrip('.;').strip()
            if not p:
                continue
            m = re.match(r'(?i)требует\s+(.+)', p)
            cost.append(m.group(1) if m else ('без маны' if re.match(r'(?i)без расхода маны', p) else p))
    return '; '.join(cost), cd


spells = []


def add(sid, name, circle, html, cost='', cd='', group=''):
    spells.append({'id': 's-' + hid(sid, name), 'school': sid, 'circle': circle.upper(), 'name': name, 'html': html,
                   'cost': cost, 'cd': cd, 'group': group})


# ---------- утилитарные: название | описание (перезарядка — в конце описания) ----------
for tr in by_title['Утилитарные заклинания'][2].find_all('tr')[1:]:
    td = cells(tr)
    ps = paras(td[1])
    joined = ' '.join(ps)
    m = re.search(r'\s*Перезарядка\s*[:—-]?\s*([^<]+?)\.?\s*$', re.sub(r'<[^>]+>', '', joined))
    cd = m.group(1) if m else ''
    html = re.sub(r'\s*(<[^>]+>)*\s*Перезарядка\s*[:—-]?\s*[^<]*?(</[^>]+>)*\s*$', '', joined).strip()
    add('utility', text_of(td[0]), '', f'<p>{html}</p>', '', cd)

# ---------- Аркана: звёздные карты и Арканы стихий (название | эффект | требование) ----------
for t, texts, table in blocks:
    if t == 'Звездные карты' or 'Арканы' in t:
        group = 'Звёздные карты' if t == 'Звездные карты' else t
        for tr in table.find_all('tr')[1:]:
            td = cells(tr)
            if len(td) < 3 or not text_of(td[0]):
                continue
            req = [re.sub(r'<[^>]+>', '', p) for p in paras(td[2])]
            add('arcana', text_of(td[0]), '', cell_html(td[1]), ' · '.join(req), '', group)

# ---------- гримуары: вступление и таблицы уровней — описание «школы» ----------
gb = by_title.get('Гримуар Архидемона'), by_title.get('Гримуар Аспекта')
intro = []
on = False
for e in body:
    t = text_of(e)
    if t == 'Заклинания гримуара':
        on = True
        continue
    if on:
        if t.startswith('Гримуар '):
            break
        if t:
            intro.append(f'<p>{inline(e).strip()}</p>')
grim = ''.join(intro) + ''.join(f'<h4>{b[0]}</h4>{table_html(b[2])}' for b in gb if b)
schools.append({'id': 'grimoire', 'page': 'grimoire', 'name': 'Гримуары', 'kind': '', 'sign': '', 'about': grim})

# ---------- школы: название | круг | описание | расход и перезарядка ----------
for t, texts, table in blocks:
    m = re.match(r'(?i)школа (\S+)$', t)
    if not m:
        continue
    sid = next((k for k, v in NAME.items() if v.lower() == t.lower()), None)
    assert sid, t
    for tr in table.find_all('tr')[1:]:
        td = cells(tr)
        # пустое место в таблице («ТРЕБУЕТСЯ ЗАКЛИНАНИЕ») — заклинания ещё нет
        if len(td) < 4 or not text_of(td[0]) or re.match(r'(?i)требуется заклинание', text_of(td[0])):
            continue
        cost, cd = split_cost([re.sub(r'<[^>]+>', '', p) for p in paras(td[3])])
        add(sid, text_of(td[0]), text_of(td[1]), cell_html(td[2]), cost, cd)

# одно название дважды в школе — второму свой id
seen = {}
for x in spells:
    k = x['id']
    seen[k] = seen.get(k, 0) + 1
    if seen[k] > 1:
        x['id'] = f"{k}-{seen[k]}"

OUT.write_text(json.dumps({'schools': schools, 'spells': spells}, ensure_ascii=False), encoding='utf8')
print('школ', len(schools), 'заклинаний', len(spells), 'знаков', sum(1 for s in schools if s['sign']))
for s in schools:
    print(' ', s['id'], s['name'], s['kind'], sum(1 for x in spells if x['school'] == s['id']))
