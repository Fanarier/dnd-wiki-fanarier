# Персонажи из таблицы «Персонажи GATE H&A.xlsx», у которых ещё нет листа на сайте → server/seed/characters.json.
# Сервер при запуске один раз заводит по ним листы (без игрока, с привязкой к карточке героя и её портретом).
# Таблица у всех персонажей устроена одинаково, но строки чуть гуляют — поэтому ищем по подписям, а не по номерам строк.
# Запуск: python tools/characters-xlsx-to-json.py "путь/к/Персонажи GATE H&A.xlsx"
import json
import re
import sys
from pathlib import Path

import openpyxl

SRC = sys.argv[1]
OUT = Path(__file__).resolve().parent.parent / 'server' / 'seed' / 'characters.json'
NAMES = ['Белатор Светозаров', 'Джилл', 'Орвилл Солес', 'Азиэль Астарот']

ATTRS = {'Сила': 'Str', 'Ловкость': 'Dex', 'Телосложение': 'Con', 'Интеллект': 'Int', 'Мудрость': 'Wis', 'Харизма': 'Cha'}
SAVE_ABBR = {'СИЛ': 'Str', 'ЛОВ': 'Dex', 'ТЕЛ': 'Con', 'ИНТ': 'Int', 'МУД': 'Wis', 'ХАР': 'Cha'}
SKILLS = {'атлетика': 'Ath', 'акробатика': 'Acr', 'ловкость рук': 'Slh', 'скрытность': 'Stl', 'выдержка': 'End', 'анализ': 'Ana',
          'история': 'His', 'магия': 'Mag', 'природа': 'Nat', 'религия': 'Rel', 'технология': 'Tec', 'внимание': 'Att', 'выживание': 'Sur',
          'медицина': 'Med', 'проницательность': 'Ins', 'уход за животным': 'Ani', 'наставничество': 'Men', 'выступление': 'Prf',
          'устрашение': 'Itm', 'обман': 'Dec', 'очарование': 'Chr', 'убеждение': 'Prs'}
LEVEL = {'нет': 0, 'базовое': 1, 'базовый': 1, 'обычный': 1, 'эксперт': 2, 'экспертное': 2, 'легенда': 3, 'легендарное': 3, 'мастер': 3, 'мифическое': 3, 'полное': 3, 'носитель': 3}
LANG_WORDS = {'полное', 'носитель', 'разговорный', 'письменный', 'базовое знание'}
SLOT = {'голова': 'HeadItem', 'тело': 'BodyItem', 'руки': 'HandsItem', 'ноги': 'LegsItem', 'кулон': 'AmuletItem', 'амулет': 'AmuletItem', 'щит': 'ShieldItem'}


def txt(v):
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return re.sub(r'\s+', ' ', str(v).replace('\xa0', ' ')).strip()


def num(v, default=0):
    """первое число в ячейке: «460 (база 400)» → 460, «149,330/165,000» → 149330, «.+.7» → 7, «= 19+7» → 26"""
    s = txt(v)
    if re.fullmatch(r'=\s*[\d\s+\-]+', s):
        try:
            return int(eval(s.lstrip('= ').replace(' ', '')))  # только цифры и + − — так считают в самой таблице
        except Exception:
            pass
    m = re.search(r'-?\d[\d,\s]*', s.replace('.+.', '+'))
    if not m:
        return default
    return int(re.sub(r'[,\s]', '', m.group(0)) or default)


def qty(name):
    """«Сухпаёк х2», «2 клешни», «Плащ х1» → (название, количество)"""
    m = re.search(r'\s*[xх×]\s*(\d+)\s*$', name, re.I)
    if m:
        return name[:m.start()].strip(), int(m.group(1))
    return name, 1


def find(ws, text):
    for row in ws.iter_rows(min_row=1, max_row=3):
        for c in row:
            if txt(c.value) == text:
                return c.column
    return None


def parse(ws):
    cell = lambda r, c: ws.cell(r, c).value
    # у Орвилла всё сдвинуто на колонку вправо — сдвиг считаем по заголовку «Персонаж» (обычно в M)
    off = (find(ws, 'Персонаж') or 13) - 13
    letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    col = {ch: i + 1 + off for i, ch in enumerate(letters)}
    col.update({'AA': 27 + off, 'AB': 28 + off})
    rows = range(1, 160)
    d = {'CharacterName': ws.title, 'Stats': {}, 'HpData': {}, 'Trait4': {}, 'Trait9': {}, 'Trait18': {}, 'Skills': [], 'PassiveSkills': [],
         'Attacks': [], 'Proficiencies': [], 'Inventory': [], 'Resources': [], 'HumanoidTraits': [], 'JournalEntries': []}

    # --- шапка: подписи в M, значения в N ---
    mn = {}
    for r in rows:
        k = txt(cell(r, col['M']))
        if k:
            mn.setdefault(k.lower().rstrip(': '), (r, cell(r, col['N'])))
    get = lambda *keys: next((mn[k][1] for k in keys if k in mn), None)
    d['Class'] = txt(get('класс'))
    d['Subclass'] = txt(get('архетип'))
    d['Race'] = txt(get('раса'))
    d['Level'] = num(get('уровень'))
    d['Experience'] = num(get('опыт'))
    hits_key = next((k for k in mn if k.startswith('хиты')), None)
    hits = num(mn[hits_key][1]) if hits_key else 0
    d['Hits'] = str(hits) if hits else ''
    d['HpData'] = {'Current': hits, 'Max': hits}
    # броня «17+3(шмот)» — складываем числа
    arm = txt(get('броня'))
    d['Defense'] = sum(int(x) for x in re.findall(r'\d+', arm.split('(')[0])) if arm else 0
    d['Evasion'] = num(get('уклонение'))
    d['Mastery'] = str(num(get('бм')))
    mana = txt(get('мана'))
    d['Mana'] = str(num(mana.split('/')[-1])) if mana else ''
    d['Vision'] = num(get('пассивное зрение'))
    d['Hearing'] = num(get('пассивный слух'))
    d['Aura'] = num(get('пассивная аура'))

    # ресурсы — всё между «Мана» и «Пассивное зрение» вида «11/14»
    if 'мана' in mn and 'пассивное зрение' in mn:
        COLORS = ['#E6C25A', '#C48BFF', '#5FD3FF', '#FF7A6B', '#7EE06A']
        for r in range(mn['мана'][0] + 1, mn['пассивное зрение'][0]):
            k, v = txt(cell(r, col['M'])), txt(cell(r, col['N']))
            m = re.fullmatch(r'(\d+)/.*?(\d+)\)?', v.replace(' ', ''))
            if k and m:
                d['Resources'].append({'Id': f'r{len(d["Resources"]) + 1}', 'Name': k, 'Current': int(m.group(1)), 'Max': int(m.group(2)),
                                       'Color': COLORS[len(d['Resources']) % len(COLORS)], 'ResetOn': 'long', 'Style': 'number' if int(m.group(2)) > 20 else 'pips', 'Notes': '', 'Icon': '✦'})

    # --- характеристики: O «Сила+10(спас)», P значение ---
    saves = set()
    hw = []
    for r in rows:
        o = txt(cell(r, col['O']))
        if not o:
            continue
        name = re.split(r'[+(\-\s]', o)[0]
        if name in ATTRS and cell(r, col['P']) is not None:
            d['Stats'][ATTRS[name] + 'Base'] = num(cell(r, col['P']))
        m = re.match(r'Спасбросок\s+([А-ЯЁ]{3})', o)
        if m and m.group(1) in SAVE_ABBR:
            saves.add(SAVE_ABBR[m.group(1)])
        if o.startswith('Инициатива'):
            d['Initiative'] = num(cell(r, col['P']))
        if o.startswith('Скорость'):
            d['Speed'] = num(cell(r, col['P']))
        if o.startswith(('Вес', 'Рост')):
            hw.append(f"{o.rstrip(': ')} {txt(cell(r, col['P']))}")
    for a in saves:
        d['Stats'][a + 'SaveProf'] = True
    if hw:
        d['HeightWeight'] = ', '.join(hw)

    # --- навыки (M — название, N — владение, P — тренировки) и владения/языки ниже ---
    skills_done = False
    for r in rows:
        k = txt(cell(r, col['M']))
        if not k or r <= mn.get('пассивная аура', (0,))[0]:
            continue
        key = next((SKILLS[s] for s in SKILLS if k.lower().startswith(s)), None)
        lvl = txt(cell(r, col['N']))
        if key and not skills_done and key + 'P' not in d['Stats']:
            d['Stats'][key + 'P'] = LEVEL.get(lvl.lower(), 0)
            t = cell(r, col['P'])
            if isinstance(t, (int, float)):
                d['Stats'][key + 'T'] = int(t)
            if key == 'Men':
                skills_done = True
            continue
        if skills_done or (not key and lvl):
            skills_done = True
            if '??' in k:
                continue
            is_lang = lvl.lower() in LANG_WORDS or k == 'Общий' or k.lower().endswith(('ский', 'ий язык'))
            d['Proficiencies'].append({'TypeIndex': 1 if is_lang else 0, 'Description': f'{k} ({lvl})' if lvl else k, 'Rating': LEVEL.get(lvl.lower(), 1)})

    # --- черты (W/X) и треугольник развития (Z/AA) ---
    for r in rows:
        for c in range(20, 30):
            w, x = txt(cell(r, c)), txt(cell(r, c + 1))
            m = re.match(r'Черта (\d+) уровня', w)
            if m and m.group(1) in ('4', '9', '18'):
                d['Trait' + m.group(1)] = {'Name': x, 'Description': x, 'IsAcquired': bool(x)}
            elif w.startswith('Черта гуманоида') and x:
                d['HumanoidTraits'].append({'Name': x, 'Description': '', 'IsAcquired': True})
        z = txt(cell(r, col['Z']))
        dev = {'Тело': 'BodyDev', 'Интеллект': 'MindDev', 'Разум': 'MindDev', 'Дух': 'SpiritDev'}.get(z)
        if dev:
            d[dev] = min(8, num(cell(r, col['AA'])))

    # --- навыки класса / расы / заклинания: таблицы с заголовком в U ---
    section = None
    race_actives = {}
    for r in rows:
        u = txt(cell(r, col['U']))
        if u in ('Навыки класса', 'Навыки расы', 'Заклинания'):
            section = u
            continue
        if not section or not u:
            continue
        parts = [('Досягаемость', txt(cell(r, col['V']))), ('Эффект', txt(cell(r, col['W']))), ('Перезарядка', txt(cell(r, col['X']))), ('Затраты', txt(cell(r, col['Y'])))]
        desc = '\n'.join(f'{a}: {b}' for a, b in parts if b)
        if section == 'Заклинания':
            desc = 'Заклинание.\n' + desc
        item = {'SkillName': u, 'CategoryIndex': 1 if section == 'Навыки расы' else 0, 'Description': desc, 'IsActiveSymbol': False}
        d['Skills'].append(item)
        if section == 'Навыки расы':
            race_actives[u.lower()] = item

    # --- расовые навыки по уровням (S «Уровень N», T основной, U дополнительный, V бонусный) ---
    for r in rows:
        m = re.match(r'Уровень (\d+)', txt(cell(r, col['S'])))
        if not m:
            continue
        lv = m.group(1)
        for c, kind in (('T', 'основной'), ('U', 'дополнительный'), ('V', 'бонусный')):
            nm = txt(cell(r, col[c]))
            if not nm or nm.startswith('Черта'):
                continue
            if nm.lower() in race_actives:
                race_actives[nm.lower()]['Description'] = f'Расовый навык {lv} уровня ({kind}).\n' + race_actives[nm.lower()]['Description']
            else:
                d['PassiveSkills'].append({'SkillName': nm, 'CategoryIndex': 1, 'Description': f'Расовый навык {lv} уровня ({kind}).', 'IsActiveSymbol': False})

    # --- атаки: S «Природное оружие» / «Оружие», T название, U кубы, V тип, W вид, X–Y стихии ---
    weapons = []
    for r in rows:
        s = txt(cell(r, col['S']))
        if s in ('Природное оружие', 'Оружие') and txt(cell(r, col['T'])):
            name = txt(cell(r, col['T'])).strip('"«»')
            dice = txt(cell(r, col['U']))
            m = re.search(r'\d+\s*[кd]\s*\d+', name)
            if m and not dice:
                name, dice = name[:m.start()].strip() or name, name[m.start():].strip()
            extra = ', '.join(x for x in (txt(cell(r, col['V'])), txt(cell(r, col['W'])), txt(cell(r, col['X'])), txt(cell(r, col['Y']))) if x)
            d['Attacks'].append({'AttackType': name, 'Description': f"{dice} {extra}".strip(), 'IsActive': s == 'Оружие'})
            if s == 'Оружие':
                weapons.append(name)

    # --- снаряжение по слотам и карманы ---
    rings = ['Ring1Item', 'Ring2Item']
    orn = ['Ornament1Item', 'Ornament2Item']
    pockets = []
    for r in rows:
        s, t = txt(cell(r, col['S'])), txt(cell(r, col['T']))
        sl = s.lower()
        if not s or not t:
            continue
        if sl in SLOT:
            d[SLOT[sl]] = {'Name': t}
        elif sl == 'кольцо' and rings:
            d[rings.pop(0)] = {'Name': t}
        elif sl == 'одежда' and orn:
            d[orn.pop(0)] = {'Name': t}
        elif sl.startswith('пояс'):
            d['BeltItem'] = {'Name': s, 'Stats': t}
        elif sl == 'карман':
            g = re.search(r'(\d+)\s*золот', t)
            if g:
                d['GoldCoins'] = d.get('GoldCoins', 0) + int(g.group(1))
            else:
                pockets.append(t)
    for i, w in enumerate(weapons[:2]):
        d[f'Weapon{i + 1}Item'] = {'Name': w}

    # --- инвентарь (E/F) и личный склад (H/I) ---
    def items(cname, sname, stored):
        out = []
        for r in range(2, 160):
            nm = txt(cell(r, col[cname]))
            if not nm:
                continue
            st = txt(cell(r, col[sname]))
            name, q = qty(nm)
            out.append({'Name': name, 'Quantity': q, 'Rarity': 'Обычный', 'Description': '', 'Notes': '' if st in ('', 'В наличии') else st, 'Equipped': False, 'Stored': stored, 'ImageFile': ''})
        return out
    inv_col = (find(ws, 'Предметы в инвентаре') or 5) - off
    d['Inventory'] = items(letters[inv_col - 1], letters[inv_col], False) + [{'Name': p, 'Quantity': 1, 'Rarity': 'Обычный', 'Description': 'В кармане', 'Notes': '', 'Equipped': False, 'Stored': False, 'ImageFile': ''} for p in pockets] + items(letters[inv_col + 2], letters[inv_col + 3], True)
    return d


def parse_ledger(ws):
    """у Азиэль своя таблица-журнал: блок «Имя / Уровень / Мана / ХП» в A–B и счёт предметов «получено/потрачено» в N–O"""
    cell = lambda r, c: ws.cell(r, c).value
    info = {txt(cell(r, 1)): (cell(r, 2), cell(r, 3)) for r in range(1, 120) if txt(cell(r, 1))}
    d = {'CharacterName': ws.title, 'Stats': {}, 'HpData': {}, 'Trait4': {}, 'Trait9': {}, 'Trait18': {}, 'Inventory': [], 'JournalEntries': []}
    d['Level'] = num(info.get('Уровень', (0,))[0])
    hp = num(info.get('ХП', (0,))[0])
    d['Hits'] = str(hp) if hp else ''
    d['HpData'] = {'Current': hp, 'Max': hp}
    d['Mana'] = str(num(info.get('Мана', (0,))[0])) or ''
    d['Stamina'] = txt(info.get('Выносливость', ('',))[0])
    # монеты: «2745.4132» — золото и серебро после точки
    coins = txt(cell(1, find(ws, 'Монеты') + 1)) if find(ws, 'Монеты') else ''
    m = re.match(r'(\d+)(?:\.(\d{1,2}))?', coins)
    if m:
        d['GoldCoins'] = int(m.group(1))
        d['SilverCoins'] = int((m.group(2) or '0').ljust(2, '0'))
    c0 = find(ws, 'Полученные/потраченные предметы')
    for r in range(2, 400):
        nm, q = txt(cell(r, c0)), cell(r, c0 + 1)
        if not nm or nm == 'Полученные/потраченные предметы':
            continue
        n = int(q) if isinstance(q, (int, float)) else 1 if q is None else num(q, 1)
        if n > 0:
            d['Inventory'].append({'Name': nm, 'Quantity': n, 'Rarity': 'Обычный', 'Description': '', 'Notes': '', 'Equipped': '(надето)' in nm, 'Stored': False, 'ImageFile': ''})
    notes = [f'{k}: {txt(v[0])}' + (f' ({txt(v[1])})' if txt(v[1]) else '') for k, v in info.items() if k in ('Статус', 'Расходы', 'Локация', 'Отношения', 'Очки генома')]
    if notes:
        d['JournalEntries'].append({'Id': 'xls-info', 'Title': 'Из таблицы персонажей', 'Content': '<p>' + '</p><p>'.join(notes) + '</p>', 'Tags': 'таблица', 'Date': ''})
    return d


wb = openpyxl.load_workbook(SRC, data_only=True)
out = {}
for name in NAMES:
    ws = wb[name]
    out[name] = parse(ws) if find(ws, 'Персонаж') else parse_ledger(ws)
    d = out[name]
    g = lambda k: len(d.get(k) or [])
    print(f"{name}: {d.get('Class', '')} / {d.get('Race', '')} ур.{d['Level']} хиты {d['Hits']}, навыков {g('Skills')}+{g('PassiveSkills')}, "
          f"атак {g('Attacks')}, владений {g('Proficiencies')}, предметов {g('Inventory')} (склад {sum(i['Stored'] for i in d['Inventory'])}), ресурсов {g('Resources')}")
OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf8')
print('записано', OUT)
