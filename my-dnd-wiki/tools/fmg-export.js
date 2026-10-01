/*
  Экспорт карты из Azgaar Fantasy Map Generator для сайта Анкарии.

  Как пользоваться:
  1. Открой карту в FMG (azgaar.github.io/Fantasy-Map-Generator), дождись загрузки.
  2. Открой консоль браузера (F12 → Console), вставь весь этот файл, нажми Enter.
  3. Скачается anacaria-fmg-bundle.json.
  4. В папке my-dnd-wiki выполни:
       node tools/import-fmg.cjs путь/к/anacaria-fmg-bundle.json
     (добавь --reset-db, чтобы пересоздать базу из карты; без флага обновятся только слои)
*/
(async () => {
  Layers.hide('cultures', 'provinces', 'religions')
  Layers.show('states', 'biomes', 'heightmap', 'relief', 'borders', 'rivers', 'labels', 'lakes')
  await new Promise(r => setTimeout(r, 3000))

  const svg = document.getElementById('map')
  const defs = svg.querySelector('defs').cloneNode(true)
  defs.querySelector('#defs-emblems')?.remove()
  const ser = new XMLSerializer()
  const defsStr = ser.serializeToString(defs)
  const W = 2048, H = 1024
  const grab = ids => ids.map(id => {
    const e = document.getElementById(id)
    if (!e) return ''
    const c = e.cloneNode(true)
    c.removeAttribute('style')
    c.querySelectorAll('[style*="display: none"]').forEach(x => x.remove())
    return ser.serializeToString(c)
  }).join('')
  const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defsStr}${body}</svg>`

  const files = {
    'base.svg': wrap(grab(['ocean', 'landmass', 'lakes', 'coastline', 'ice'])),
    'heights.svg': wrap(grab(['terrs'])),
    'biomes.svg': wrap(grab(['biomes'])),
    'rivers.svg': wrap(grab(['rivers'])),
    'relief.svg': wrap(grab(['terrain'])),
    'states.svg': wrap(grab(['regions'])),
    'borders.svg': wrap(grab(['borders'])),
    'labels.svg': wrap(grab(['labels']))
  }
  const data = {
    meta: { W, H },
    states: pack.states.map(s => ({ i: s.i, name: s.name, fullName: s.fullName, color: s.color, removed: !!s.removed, capital: s.capital, form: s.formName, pole: s.pole })),
    paths: [...document.querySelectorAll('#statesBody path')].map(p => ({ id: p.id, d: p.getAttribute('d'), fill: p.getAttribute('fill') })),
    burgs: pack.burgs.filter(b => b && b.i && !b.removed).map(b => ({ i: b.i, name: b.name, x: b.x, y: b.y, state: b.state, capital: b.capital, port: b.port, population: b.population, group: b.group, citadel: b.citadel, walls: b.walls, temple: b.temple })),
    routes: pack.routes.map(r => ({ i: r.i, group: r.group, name: r.name, points: r.points.map(p => [p[0], p[1]]) }))
  }
  const blob = new Blob([JSON.stringify({ files, data })], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'anacaria-fmg-bundle.json'
  a.click()
})()
