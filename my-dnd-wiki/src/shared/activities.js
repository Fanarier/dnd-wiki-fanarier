// Журнал деятельностей: статусы, типы и разбор чисел из того, как их пишут в таблице («20 часов», «42+1», «Н/Д»)
export const ACT_STATUS = {
  pending: { name: 'на проверке', color: '#f0b54f' },
  done: { name: 'учтено', color: '#7ed07a' },
  fail: { name: 'провал', color: '#ff7a6b' },
  cond: { name: 'условие', color: '#7fb4ff' },
  cancel: { name: 'отменено', color: '#8f8574' }
}
export const ACT_TYPES = { repeat: { name: 'Повторяемая', icon: '↻' }, unique: { name: 'Уникальная', icon: '★' } }

// первое число в тексте («20 часов» → 20, «1,6» → 1.6); нет числа — 0
export function num(v) {
  const m = String(v ?? '').replace(/(\d),(\d)/g, '$1.$2').match(/-?\d+(?:\.\d+)?/)
  return m ? Number(m[0]) : 0
}
// очки тренировки из результата: «42» или «42+1» → 43; словами — не угадываем
export function ptsOf(result) {
  const s = String(result ?? '').trim()
  return /^\d+(\s*\+\s*\d+)*$/.test(s) ? s.split('+').reduce((n, x) => n + Number(x), 0) : 0
}
export const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d

// справочник деятельностей из таблиц вики («Повторяемые деятельности», «Уникальные деятельности»):
// название, длительность и выносливость в час — для подсказок при вводе
export function activityCatalog(articles) {
  if (typeof DOMParser === 'undefined') return []
  const out = []
  for (const a of articles.filter(x => x.group === 'activities')) {
    const type = /повторя/i.test(a.title) ? 'repeat' : /уникал/i.test(a.title) ? 'unique' : ''
    if (!type) continue
    const doc = new DOMParser().parseFromString(a.html, 'text/html')
    for (const tr of doc.querySelectorAll('tr')) {
      const cells = [...tr.children].map(td => (td.querySelector('p') || td).textContent.replace(/\s+/g, ' ').trim())
      if (cells.length < 3 || /^деятельност/i.test(cells[0]) || !/^-?\d/.test(cells[2])) continue
      out.push({ name: cells[0], dur: cells[1], rate: num(cells[2]), type })
    }
  }
  return out
}
