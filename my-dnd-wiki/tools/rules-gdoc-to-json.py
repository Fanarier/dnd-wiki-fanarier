# Вики «Heroes & Adventures» (Google Docs, часть 1 и вкладки рас из части 2) → server/seed/rules.json.
# Первый перенос; дальше правила правятся мастером на сайте.
#   python tools/rules-gdoc-to-json.py <папка с html вкладок> <tree.txt>
# html вкладок: export?format=html&tab=t.<id>, файл <id>.html (вкладки части 2 — p2-<id>.html);
# tree.txt — список вкладок «группа индекс  Название  [t.id]» в порядке документа.
import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag

SRC = Path(sys.argv[1])
TREE = Path(sys.argv[2])
OUT = Path(__file__).resolve().parent.parent / 'server' / 'seed' / 'rules.json'

GROUPS = {0: 'mechanics', 1: 'workplaces', 2: 'activities', 3: 'classes', 4: 'races'}
# цвета документа → читаемые на тёмном фоне; чёрный и почти чёрный — обычный текст
COLORS = {'#6aa84f': '#7ed07a', '#38761d': '#6cc35a', '#e69138': '#f0a24f', '#f1c232': '#f1c232', '#3c78d8': '#6fa8ff',
          '#9900ff': '#c27bff', '#1c4587': '#7fa6e8', '#45818e': '#6fc3d1', '#a64d79': '#e07ab0', '#1155cc': '#6fa8ff',
          '#ff0000': '#ff6b5e', '#0000ff': '#6fa8ff', '#00ff00': '#7ed07a', '#ff9900': '#f0a24f', '#9900ff': '#c27bff'}
PLAIN = {'#000000', '#141414', '#121212', '#ffffff', '#434343', '#666666', '#222222', '#1f1f1f'}


def styles_of(soup):
    css = soup.style.string if soup.style else ''
    return {m.group(1): m.group(2) for m in re.finditer(r'\.(c\d+)\{([^}]*)\}', css or '')}


def span_style(el, cls):
    st = ';'.join(cls.get(c, '') for c in el.get('class', [])) + ';' + (el.get('style') or '')
    bold = re.search(r'font-weight:(700|bold)', st) is not None
    ital = 'font-style:italic' in st
    und = 'text-decoration:underline' in st
    col = re.findall(r'(?<![-\w])color:(#[0-9a-f]{6})', st)
    col = col[-1] if col else None
    bg = re.findall(r'background-color:(#[0-9a-f]{6})', st)
    bg = bg[-1] if bg else None
    return bold, ital, und, col, bg


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def inline(el, cls):
    """содержимое абзаца → HTML: жирный, курсив, цвет, ссылки"""
    out = []
    for ch in el.children:
        if isinstance(ch, NavigableString):
            out.append(esc(str(ch)))
            continue
        if not isinstance(ch, Tag):
            continue
        if ch.name == 'br':
            out.append('<br>')
            continue
        if ch.name == 'a':
            href = ch.get('href', '')
            m = re.search(r'[?&]q=([^&]+)', href)
            if m and 'google.com/url' in href:
                from urllib.parse import unquote
                href = unquote(m.group(1))
            txt = inline(ch, cls)
            out.append(f'<a href="{esc(href)}">{txt}</a>' if href.startswith('http') else txt)
            continue
        if ch.name == 'img':
            continue
        if ch.name == 'span':
            txt = inline(ch, cls)
            if not txt.strip():
                out.append(txt)
                continue
            bold, ital, und, col, bg = span_style(ch, cls)
            if col and col not in PLAIN:
                txt = f'<span style="color:{COLORS.get(col, col)}">{txt}</span>'
            if bg == '#00ffff':
                txt = f'<mark>{txt}</mark>'
            if und:
                txt = f'<u>{txt}</u>'
            if ital:
                txt = f'<em>{txt}</em>'
            if bold:
                txt = f'<strong>{txt}</strong>'
            out.append(txt)
            continue
        out.append(inline(ch, cls))
    return ''.join(out).replace('\xa0', ' ')


def text_of(el):
    return re.sub(r'\s+', ' ', el.get_text(' ')).replace('\xa0', ' ').strip()


def block(el, cls):
    """блок документа → HTML"""
    if el.name == 'p':
        h = inline(el, cls).strip()
        return f'<p>{h}</p>' if h else ''
    if el.name in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
        h = inline(el, cls).strip()
        lvl = 'h3' if el.name in ('h1', 'h2') else 'h4'
        return f'<{lvl}>{h}</{lvl}>' if h else ''
    if el.name in ('ul', 'ol'):
        items = ''.join(f'<li>{inline(li, cls).strip()}</li>' for li in el.find_all('li', recursive=False) if text_of(li))
        return f'<{el.name}>{items}</{el.name}>' if items else ''
    if el.name == 'table':
        rows = []
        for tr in el.find_all('tr'):
            cells = []
            for td in tr.find_all('td', recursive=False):
                inner = ''.join(block(c, cls) for c in td.children if isinstance(c, Tag))
                attrs = ''.join(f' {a}="{td.get(a)}"' for a in ('colspan', 'rowspan') if td.get(a) and td.get(a) != '1')
                cells.append(f'<td{attrs}>{inner}</td>')
            rows.append('<tr>' + ''.join(cells) + '</tr>')
        return '<table><tbody>' + ''.join(rows) + '</tbody></table>'
    if el.name == 'div':
        return ''.join(block(c, cls) for c in el.children if isinstance(c, Tag))
    return ''


def article(soup):
    cls = styles_of(soup)
    body = soup.body
    html = ''.join(block(c, cls) for c in body.children if isinstance(c, Tag))
    return re.sub(r'(<p></p>)+', '', html)


# ---------- расы: таблица «Ур | навык | описание»; уровень 0 — базовые навыки, дальше Х (сразу) и 1–3 (выбор) ----------
MARK = re.compile(r'^\s*(Х|X|х|x|\d{1,2})\s*[)\]–.\-]\s*')


def split_marked(td, cls):
    """абзацы ячейки → {метка: [html абзацев]}; абзацы без метки — к предыдущей"""
    out, cur = {}, None
    # пункты бывают и отдельными абзацами, и строками одного абзаца через перенос
    pieces = []
    for p in td.find_all(['p', 'li']):
        for h in re.split(r'<br\s*/?>', inline(p, cls)):
            pieces.append(h.strip())
    for h in pieces:
        t = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', h)).replace('&amp;', '&').strip()
        if not t:
            continue
        m = MARK.match(t)
        if m:
            cur = m.group(1).upper().replace('X', 'Х')
            # убрать метку из html (она в начале текста, возможно внутри тегов)
            h = re.sub(r'^((?:<[^>]+>)*)\s*(Х|X|х|x|\d{1,2})\s*[)\]–.\-]\s*', r'\1', h, count=1)
            out.setdefault(cur, [])
        elif cur is None:
            cur = '_'
            out.setdefault(cur, [])
        out[cur].append(f'<p>{h}</p>')
    return out


def plain_name(html):
    t = re.sub(r'<[^>]+>', '', ''.join(html))
    return re.sub(r'\s+', ' ', t).strip()


def parse_race(soup, title):
    cls = styles_of(soup)
    race = {'name': title, 'intro': '', 'base': [], 'levels': [], 'outro': ''}
    body = soup.body
    tables = body.find_all('table', recursive=False)
    if not tables:
        race['intro'] = article(soup)
        return race
    first = tables[0]
    before, after, seen = [], [], False
    for c in body.children:
        if not isinstance(c, Tag):
            continue
        if c is first:
            seen = True
            continue
        if c.name == 'table' and seen:
            continue
        (after if seen else before).append(block(c, cls))
    race['intro'] = re.sub(r'(<p></p>)+', '', ''.join(before))
    race['outro'] = re.sub(r'(<p></p>)+', '', ''.join(after))
    for table in tables:
        for tr in table.find_all('tr'):
            tds = tr.find_all('td', recursive=False)
            if len(tds) < 3:
                continue
            lv = text_of(tds[0])
            if not re.fullmatch(r'\d{1,2}', lv):
                continue
            names = split_marked(tds[1], cls)
            descs = split_marked(tds[2], cls)
            lv = int(lv)
            items = []
            for k in names:
                if k == '_':
                    continue
                nm = plain_name(names[k])
                d = ''.join(descs.get(k, []))
                # описание «Физподготовка: текст» — название в начале уже есть в заголовке навыка
                d = re.sub(r'^<p>((?:<[^>]+>)*)' + re.escape(nm) + r'\s*((?:</[^>]+>)*)\s*[:.]\s*', r'<p>\1\2', d, count=1)
                items.append({'k': k, 'name': nm, 'html': d})
            if lv == 0:
                race['base'] = [{'name': i['name'], 'html': i['html']} for i in items]
            else:
                auto = next((i for i in items if i['k'] == 'Х'), None)
                opts = [i for i in items if i['k'] != 'Х']
                race['levels'].append({'lv': lv, 'auto': {'name': auto['name'], 'html': auto['html']} if auto else None,
                                       'options': [{'name': o['name'], 'html': o['html']} for o in opts]})
    return race


# ---------- классы: вступление, таблица навыков по уровням, архетипы со своими таблицами ----------
SKILL_TYPES = ('Пассивный навык', 'Активный навык', 'Ультимативный навык', 'Реакция', 'Бонусное действие')


def parse_skill_row(tds, cls):
    lv = text_of(tds[0])
    if not re.fullmatch(r'\d{1,2}', lv):
        return None
    ps = [text_of(p) for p in tds[1].find_all('p') if text_of(p)]
    if not ps:
        return None
    # название, перенесённое на вторую строку («Использование» / «заклинаний»), — склеиваем
    while len(ps) > 1 and ps[1][:1].islower():
        ps[0] = ps[0] + ' ' + ps.pop(1)
    name = ps[0]
    # строки таблиц внутри архетипа («30 Хиты 12 Броня» у дракона) — не навыки
    if re.match(r'^\d', name):
        return None
    kind = next((p for p in ps[1:] if 'навык' in p.lower() or p in SKILL_TYPES), '')
    tags = [p for p in ps[1:] if p != kind]
    desc = ''.join(block(c, cls) for c in tds[2].children if isinstance(c, Tag)) if len(tds) > 2 else ''
    return {'lv': int(lv), 'name': name, 'kind': kind, 'tags': tags, 'html': re.sub(r'(<p></p>)+', '', desc)}


def parse_class(soup, title):
    cls = styles_of(soup)
    body = soup.body
    k = {'name': title, 'intro': '', 'skills': [], 'archetypes': [], 'outro': ''}
    blocks = [c for c in body.children if isinstance(c, Tag)]
    intro, i = [], 0
    while i < len(blocks) and blocks[i].name != 'table':
        intro.append(block(blocks[i], cls))
        i += 1
    k['intro'] = re.sub(r'(<p></p>)+', '', ''.join(intro))
    cur = None  # архетип, в который пишем
    pending_title = None
    tail = []
    for el in blocks[i:]:
        if el.name == 'table':
            rows = [r.find_all('td', recursive=False) for r in el.find_all('tr')]
            target = k['skills'] if cur is None else cur['skills']
            for tds in rows:
                if len(tds) < 2:
                    continue
                head = text_of(tds[0])
                # первая строка таблицы архетипа: «Клятва | описание архетипа»
                if cur is not None and not re.fullmatch(r'\d{1,2}', head) and head and head not in ('Ур',) and not cur['about']:
                    cur['about'] = re.sub(r'(<p></p>)+', '', ''.join(block(c, cls) for c in tds[-1].children if isinstance(c, Tag)))
                    continue
                s = parse_skill_row(tds, cls)
                if s:
                    target.append(s)
            continue
        t = text_of(el)
        m = re.match(r'Навыки архетипа\s*[“"«](.+?)[”"»]', t)
        if m:
            cur = {'name': m.group(1).strip(), 'about': '', 'skills': []}
            k['archetypes'].append(cur)
            continue
        h = block(el, cls)
        if h and cur is None:
            tail.append(h)
        elif h and cur is not None and not cur['skills']:
            cur['about'] += h
    k['outro'] = re.sub(r'(<p></p>)+', '', ''.join(tail))
    return k


# ---------- сборка ----------
tabs = []
for line in TREE.read_text(encoding='utf8').splitlines()[1:]:
    m = re.match(r'\s*(\d+)\s+(\d+)\s+(.*?)\s+\[(t\.[a-z0-9]+)\]', line)
    if m:
        tabs.append((int(m.group(1)), int(m.group(2)), m.group(3).strip(), m.group(4)[2:]))

out = {'articles': [], 'races': [], 'classes': []}
INFO_RACE = {'Инфо о расах', 'Треугольник развития', 'Базовые характеристики', 'Коэффициенты'}
for g, i, title, tid in tabs:
    f = SRC / f'{tid}.html'
    soup = BeautifulSoup(f.read_text(encoding='utf8'), 'html.parser')
    empty = not text_of(soup.body)
    group = GROUPS[g]
    if group == 'races' and title not in INFO_RACE:
        r = parse_race(soup, title)
        r.update({'id': 'r-' + tid[:8], 'order': i, 'empty': empty})
        out['races'].append(r)
    elif group == 'classes' and not title.startswith('Инфо'):
        c = parse_class(soup, title)
        c.update({'id': 'k-' + tid[:8], 'order': i, 'empty': empty})
        out['classes'].append(c)
    else:
        out['articles'].append({'id': 'a-' + tid[:8], 'group': group, 'title': title, 'order': i, 'html': article(soup)})

# эльфы из части 2 (лунный эльф и дроу)
for fid, title in (('p2-eecfvs3q9vix', 'Лунный эльф'), ('p2-3yx9wmoa5dgj', 'Дроу')):
    f = SRC / f'{fid}.html'
    if f.exists():
        r = parse_race(BeautifulSoup(f.read_text(encoding='utf8'), 'html.parser'), title)
        r.update({'id': 'r-' + fid[3:11], 'order': 100 + len(out['races']), 'empty': False})
        out['races'].append(r)

OUT.write_text(json.dumps(out, ensure_ascii=False), encoding='utf8')
print('статей', len(out['articles']), 'рас', len(out['races']), 'классов', len(out['classes']), '→', OUT, round(OUT.stat().st_size / 1024), 'КБ')
for r in out['races']:
    print(f"  раса {r['name']}: база {len(r['base'])}, уровней {len(r['levels'])}, вариантов {[len(l['options']) for l in r['levels']]}{' (пусто)' if r['empty'] else ''}")
for c in out['classes']:
    print(f"  класс {c['name']}: навыков {len(c['skills'])}, архетипов {len(c['archetypes'])} {[ (a['name'], len(a['skills'])) for a in c['archetypes']]}{' (пусто)' if c['empty'] else ''}")
