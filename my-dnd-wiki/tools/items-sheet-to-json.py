# Таблица уникальных предметов (Google Sheets «Предметы», вкладки по героям + «Общее») → server/seed/items.json.
# Вкладки выгружаются в CSV: https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=<gid>
# Запуск: python tools/items-sheet-to-json.py <папка с t<gid>.csv>
# Сервер вписывает каждую вещь один раз: в лист хозяина (если вещь уже там лежит — под тем же или похожим
# названием — ей добавляется карточка, иначе кладётся новая), «Общее» — в вики «Предметы».
import csv, json, os, sys

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'server', 'seed', 'items.json')

# вкладка → хозяин (имя листа); на двоих — по каждой вещи отдельно (кто её носит в листе или по требованиям)
TABS = {
    '0': None,  # Хироши и Касуми — см. BY_ITEM
    '1177847413': 'Элиас Виан',
    '587810015': None,  # Цуруя и Долор
    '1510971390': 'Löwe Rotesherz',
    '971934017': 'Белатор Светозаров',
    '443295819': 'Энди',
    '926668895': 'Азиэль Астарот',  # Азиэль и Азазэль: у Азазэля листа нет, вещи лежат у Азиэля
    '131642554': 'Орвилл Солес',
    '405056523': 'wiki',  # Общее
}
BY_ITEM = {
    'Катэкири Ясутсура': 'Хироши Мунэакира',
    'Перстень благочестия': 'Хироши Мунэакира',
    'Том астроманта': 'Касуми Аои',
    'Черный похититель звезд': 'Касуми Аои',
    'Последний вздох': 'Цуруя Варабихимэ',
    'Пояс драконьего гладиатора': 'Долор',
    'Кольцо здоровья': 'Долор',
}
# в листе вещь записана под другим названием
ALIAS = {
    'Катэкири Ясутсура': 'Оникири Ясутсура',
    'Пронзатель небес': 'Драконий лук',
    'Когти Алисфизы Астарот': 'Когти Астарот',
}
# последняя строка характеристик — чья работа (народ или мастер)
ORIGINS = {'Кицунэ', 'Драконы', 'Дворфы', 'Они', 'Древние', 'Тифлинги', 'Вампиры', 'Белатор'}
NONE = {'нет', ''}

def cell(r, i):
    return r[i].strip() if i < len(r) else ''

out = []
for gid, owner in TABS.items():
    rows = list(csv.reader(open(os.path.join(SRC, f't{gid}.csv'), encoding='utf8')))
    starts = [i for i, r in enumerate(rows) if cell(r, 6) == 'Название']
    for k, s in enumerate(starts):
        block = rows[s:(starts[k + 1] if k + 1 < len(starts) else len(rows))]
        name = cell(block[0], 7)
        if not name:
            continue  # пустая заготовка
        meta = {cell(r, 6): cell(r, 7) for r in block[1:7]}
        card = {'Type1': meta.get('Тип основной', ''), 'Type2': meta.get('Тип дополнительный', ''), 'Attune': meta.get('Сложность настройки', ''),
                'Kind': meta.get('Вид', ''), 'Origin': '', 'Chars': [], 'Comps': [], 'Reqs': [], 'Passive': [], 'Active': []}
        if card['Attune'].lower() == 'нет':
            card['Attune'] = ''
        for r in block[1:]:
            for col, key in ((9, 'Comps'), (10, 'Reqs'), (12, 'Passive'), (13, 'Active')):
                v = cell(r, col)
                if v.lower() not in NONE:
                    card[key].append(v)
        ch = next((i for i, r in enumerate(block) if cell(r, 6) == 'Характеристики'), None)
        if ch is not None:
            chars = [(cell(r, 6), cell(r, 7)) for r in block[ch + 1:] if cell(r, 6)]
            if chars and not chars[-1][1] and chars[-1][0] in ORIGINS:
                card['Origin'] = chars.pop()[0]
            card['Chars'] = [{'K': a, 'V': b} for a, b in chars]
        to = BY_ITEM.get(name, owner)
        if not to:
            sys.exit(f'нет хозяина: {name}')
        out.append({'key': f'{gid}:{name}', 'to': None if to == 'wiki' else to, 'shared': to == 'wiki', 'match': ALIAS.get(name, name),
                    'item': {'Name': name, 'Rarity': meta.get('Редкость', ''), 'Card': card}})

json.dump(out, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(len(out), 'предметов →', os.path.normpath(OUT))
for e in out:
    print(f"  {e['to'] or 'ВИКИ (общее)':22} {e['item']['Name']}" + (f"  ⇐ «{e['match']}»" if e['match'] != e['item']['Name'] else ''))
