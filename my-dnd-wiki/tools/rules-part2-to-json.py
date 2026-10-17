# Вторая часть вики: магия (страницы сайта src/pages → карточки заклинаний), статья «НПС» и эффекты
# с иконками (Google Docs, часть 2) → server/seed/rules-part2.json и public/assets/effects/*.webp.
# Сервер добавляет это в правила один раз (server/rules.js, исправление «part2»), дальше всё правится на сайте.
#   python tools/rules-part2-to-json.py <папка с html вкладок части 2>
# html вкладок: export?format=html&tab=t.<id>, файл <id>.html
import base64
import hashlib
import io
import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup, Comment, NavigableString, Tag
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1])
OUT = ROOT / 'server' / 'seed' / 'rules-part2.json'
ICONS = ROOT / 'public' / 'assets' / 'effects'

# разбор абзацев документа — тот же, что у первого переноса
conv = (ROOT / 'tools' / 'rules-gdoc-to-json.py').read_text(encoding='utf8').split('\nfor line in TREE')[0]
sys.argv = [sys.argv[0], str(SRC), str(SRC)]
G = {'__file__': str(ROOT / 'tools' / 'rules-gdoc-to-json.py')}
exec(compile(conv, 'rules-gdoc-to-json.py', 'exec'), G)
article, block, styles_of, text_of = G['article'], G['block'], G['styles_of'], G['text_of']

soup_of = lambda f: BeautifulSoup((SRC / f).read_text(encoding='utf8'), 'html.parser')
hid = lambda *parts: hashlib.md5('|'.join(parts).encode('utf8')).hexdigest()[:8]

# ---------- НПС ----------
npc = article(soup_of('lmvdpv5qvg1f.html'))
npc = re.sub(r'^<p>(<strong>)?Неигровые Персонажи \(НПС\)(</strong>)?</p>', '', npc)

# ---------- эффекты: таблица «иконка | название | описание» ----------
ICONS.mkdir(parents=True, exist_ok=True)
effects = []
for kind, f in (('buff', 'jp88ocjg1a8o.html'), ('debuff', 'qzs0u6ypl5t6.html'), ('special', 'dquuu75m35d1.html')):
    soup = soup_of(f)
    cls = styles_of(soup)
    for tr in soup.find_all('tr'):
        tds = tr.find_all('td', recursive=False)
        if len(tds) != 3 or not text_of(tds[1]):
            continue
        name = text_of(tds[1])
        html = ''.join(block(c, cls) for c in tds[2].children if isinstance(c, Tag))
        eid = 'fx-' + hid(kind, name)
        icon = ''
        img = tds[0].find('img')
        if img and img.get('src', '').startswith('data:image'):
            raw = base64.b64decode(img['src'].split(',', 1)[1])
            im = Image.open(io.BytesIO(raw)).convert('RGBA').resize((96, 96), Image.LANCZOS)
            im.save(ICONS / f'{eid}.webp', 'WEBP', quality=88, method=6)
            icon = f'/assets/effects/{eid}.webp'
        effects.append({'id': eid, 'kind': kind, 'name': name, 'html': html, 'icon': icon, 'tag': ''})

# ---------- магия: таблицы на страницах сайта ----------
PAGES = (
    ('utility', 'UtilityMagic.vue', [('utility', 'Утилитарная магия')]),
    ('school-fire', 'SchoolFire.vue', [('fire', 'Школа огня'), ('magma', 'Школа магмы')]),
    ('school-water', 'SchoolWater.vue', [('water', 'Школа воды'), ('ice', 'Школа льда')]),
    ('school-air', 'SchoolAir.vue', [('air', 'Школа воздуха'), ('lightning', 'Школа молний')]),
    ('school-earth', 'SchoolEarth.vue', [('earth', 'Школа земли'), ('nature', 'Школа природы')]),
)


# текст внутри <template> bs4 считает «шаблонным» и не отдаёт в get_text — разбираем как обычный div
def vue(fname):
    t = (ROOT / 'src' / 'pages' / fname).read_text(encoding='utf8').split('<script')[0]
    return t.replace('<template>', '<div>').replace('</template>', '</div>')


def inner(td):
    return ''.join(str(c) for c in td.contents).strip()


def split_cost(t):
    """«Требует 50 маны. Перезарядка: 2 хода.» → ('50 маны', '2 хода')"""
    cost, cd = [], ''
    for part in re.split(r'(?<=[.;])\s+', t.strip()):
        p = part.strip().rstrip('.;').strip()
        if not p:
            continue
        m = re.match(r'(?i)перезарядка\s*[:—-]?\s*(.+)', p)
        if m:
            cd = m.group(1)
            continue
        m = re.match(r'(?i)требует\s+(.+)', p)
        cost.append(m.group(1) if m else ('без маны' if re.match(r'(?i)без расхода маны', p) else p))
    return '; '.join(cost), cd


schools, spells = [], []
for page, fname, names in PAGES:
    soup = BeautifulSoup(vue(fname), 'html.parser')
    tables = soup.find_all('table')
    assert len(tables) == len(names), (fname, len(tables))
    for (sid, sname), table in zip(names, tables):
        sec = table.find_parent('section')
        lead = (sec or soup).find('p', class_='lead')
        schools.append({'id': sid, 'page': page, 'name': sname, 'about': f'<p>{inner(lead)}</p>' if lead else ''})
        for tr in table.select('tbody tr'):
            tds = tr.find_all('td', recursive=False)
            if len(tds) == 4:
                name, circle, html, (cost, cd) = text_of(tds[0]), text_of(tds[1]), inner(tds[2]), split_cost(text_of(tds[3]))
            elif len(tds) == 2:
                name, circle, html, cost = text_of(tds[0]), '', inner(tds[1]), ''
                m = re.search(r'\s*<strong>Перезарядка:</strong>\s*([^<]+?)\.?\s*$', html)
                cd = m.group(1) if m else ''
                html = html[:m.start()] if m else html
            else:
                continue
            spells.append({'id': 's-' + hid(sid, name), 'school': sid, 'circle': circle.upper(), 'name': name,
                           'html': f'<p>{html.strip()}</p>', 'cost': cost, 'cd': cd})

# ---------- «Общее» по магии — статья ----------
g = BeautifulSoup(vue('WikiGeneral.vue'), 'html.parser')
for c in g.find_all(string=lambda s: isinstance(s, Comment)):
    c.extract()
card_text = g.find('v-card-text')
for el in card_text.find_all('div', class_='card-title'):
    el.name = 'h4'
for el in card_text.find_all('caption'):
    el.name = 'p'
    el.string = el.get_text(strip=True)
    el.wrap(g.new_tag('em'))
    table = el.find_parent('table')
    table.insert_before(el.parent.extract())
for el in card_text.find_all('v-simple-table'):
    el.name = 'table'
for el in card_text.find_all(['v-row', 'v-col', 'v-card', 'section', 'div']):
    el.unwrap()
for el in card_text.find_all(True):
    el.attrs = {k: v for k, v in el.attrs.items() if k in ('colspan', 'rowspan')}
general = re.sub(r'\s*\n\s*', ' ', card_text.decode_contents()).strip()
general = re.sub(r'>\s+<', '><', general)
general = re.sub(r'(</ol>|</ul>|</p>)<strong>([^<]+)</strong>', r'\1<p><strong>\2</strong></p>', general)
general = re.sub(r'<p>\s+', '<p>', general).replace(' </p>', '</p>')

out = {
    'articles': [
        {'group': 'magic', 'title': 'Тренировка заклинаний и ритуалов', 'html': general},
        {'group': 'mechanics', 'title': 'НПС', 'html': npc},
    ],
    'schools': schools,
    'spells': spells,
    'effects': effects,
}
OUT.write_text(json.dumps(out, ensure_ascii=False), encoding='utf8')
print('школ', len(schools), 'заклинаний', len(spells), 'эффектов', len(effects), 'иконок', sum(1 for e in effects if e['icon']))
for s in schools:
    print(' ', s['name'], sum(1 for x in spells if x['school'] == s['id']))
print('НПС', len(npc), 'общее', len(general))
