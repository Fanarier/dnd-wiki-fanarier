<template>
  <div class="st" :class="{ wide }">
    <!-- ================= ОБЗОР ================= -->
    <template v-if="tab === 'overview'">
      <h3>Основная информация<button v-if="master" class="ed" @click="emit('edit', 'overview')">✎ Править</button></h3>
      <div class="tiles">
        <div v-for="x in overview" :key="x.label" class="tile" :class="x.cls" :title="x.hint">
          <img :src="icon(x.icon)" alt="" /><span>{{ x.label }}</span><b>{{ x.value }}</b>
        </div>
      </div>

      <h3>Управление</h3>
      <div id="sgov" class="gov" :class="{ flash: flash === 'gov' }">
        <div class="gov-col">
          <small>Глава поселения</small>
          <div class="person big">
            <img v-if="headCover" :src="headCover" alt="" /><span v-else>{{ initial(head?.name) }}</span>
          </div>
          <router-link v-if="head" class="hero-link" :to="{ path: '/wiki', query: { hero: head.id } }" title="Карточка героя">{{ head.name }}</router-link>
          <b v-else>—</b>
        </div>
        <div class="gov-col wide">
          <small>Управляющие</small>
          <div class="gov-row">
            <div v-for="(m, i) in managerSlots" :key="i" class="gov-m">
              <div class="person" :class="{ empty: !m }" :style="m ? { '--fr': ASSET_FRAMES[m.frame] } : null">
                <img v-if="m && face(m)" :src="face(m)" alt="" /><span v-else-if="m">{{ initial(m.name) }}</span>
              </div>
              <router-link v-if="m?.heroId" class="hero-link sm" :to="{ path: '/wiki', query: { hero: m.heroId } }">{{ m.name }}</router-link>
              <small v-else>{{ m?.name || 'свободно' }}</small>
            </div>
          </div>
        </div>
      </div>
      <p v-if="deciders.length" class="muted">Решения принимают: {{ deciders.join(', ') }}</p>

      <h3>Постройки <small>{{ builtCount }}</small></h3>
      <div class="bcount">
        <button v-for="b in buildingList" :key="b.type" class="bc" :title="b.label" @click="pickFirst(b.type)">
          <img :src="icon(b.icon)" alt="" /><span>{{ b.label }}</span><b>×{{ b.n }}</b>
        </button>
      </div>
    </template>

    <!-- ================= РЕСУРСЫ ================= -->
    <template v-else-if="tab === 'resources'">
      <h3>Ресурсы <small>в день · нажми на строку — откуда и куда</small><button v-if="master" class="ed" @click="emit('edit', 'resources')">✎ Править</button></h3>
      <p class="muted">За день на склад приходит прирост, со склада уходит расход. Если расход больше — разницу берём из запаса; кончился запас — в журнал придёт нехватка.<template v-if="s.day"> Прошло дней: {{ s.day }}.</template></p>
      <!-- прирост и расход «давят» друг на друга: доля полосы — сколько от общего оборота у каждой стороны -->
      <div class="tug-list">
        <template v-for="r in resRows" :key="r.key">
          <div class="tug" :class="{ deficit: r.bal < 0, empty: r.bal < 0 && r.stock < -r.bal, idle: !r.gain && !r.use, open: openRes === r.key }"
               @click="openRes = openRes === r.key ? null : r.key">
            <div class="tug-head">
              <span class="tug-name"><i class="rdot" :style="{ background: r.color }" />{{ r.label }}</span>
              <small v-if="r.bal < 0" class="from">со склада {{ fmt(-r.bal) }}/день · {{ r.stock >= -r.bal ? `хватит на ${Math.floor(r.stock / -r.bal)} дн.` : 'не хватает!' }}</small>
              <small v-else-if="r.bal > 0" class="to">на склад +{{ fmt(r.bal) }}/день</small>
              <span class="tug-stock">запас
                <input v-if="master" class="stock-in" type="number" min="0" :value="r.stock" :title="`Сколько «${r.label}» на складе`"
                       @click.stop @keydown.enter="$event.target.blur()" @change="setStock(r.key, $event.target.value)" />
                <b v-else>{{ fmt(r.stock) }}</b>
              </span>
            </div>
            <div v-if="r.gain || r.use" class="tug-bar" :title="`Прирост ${Math.round(r.share)}% · расход ${100 - Math.round(r.share)}%`">
              <div class="tug-g" :style="{ width: r.share + '%' }"><b v-if="r.gain">+{{ fmt(r.gain) }}</b></div>
              <div class="tug-u"><b v-if="r.use">−{{ fmt(r.use) }}</b></div>
              <i class="tug-seam" :class="r.bal > 0 ? 'push-r' : r.bal < 0 ? 'push-l' : ''" :style="{ left: r.share + '%' }" />
              <span class="tug-flag" :class="r.bal > 0 ? 'up' : r.bal < 0 ? 'down' : ''" :style="{ left: Math.min(92, Math.max(8, r.share)) + '%' }">
                {{ r.bal > 0 ? '+' : r.bal < 0 ? '−' : '' }}{{ fmt(Math.abs(r.bal || 0)) }}/д
              </span>
            </div>
            <div v-else class="tug-bar none">не добывается и не тратится</div>
          </div>
          <div v-if="openRes === r.key" class="tug-parts">
            <div v-for="p in calc.gain[r.key]?.parts || []" :key="'g' + p.label" class="pl plus"><span>{{ p.label }}</span><b>+{{ fmt(p.value) }}</b></div>
            <div v-for="p in calc.use[r.key]?.parts || []" :key="'u' + p.label" class="pl minus"><span>{{ p.label }}</span><b>−{{ fmt(p.value) }}</b></div>
            <div v-if="!calc.gain[r.key] && !calc.use[r.key]" class="muted">Пока не добывается и не тратится</div>
          </div>
        </template>
      </div>
      <p class="muted note">«Быт» — дрова, посуда, одежда и починка: каждый житель тратит его в день по норме своей расы (вкладка «Жители»), он берётся из Дерева. Строки «Поправка» и «Стройка (из старой таблицы)» — то, что старая таблица учитывала вручную; мастер может их менять или убрать. Новые стройки платят свою цену со склада один раз, когда их закладывают.</p>
    </template>

    <!-- ================= ЖИТЕЛИ ================= -->
    <template v-else-if="tab === 'residents'">
      <h3>Жители <small>{{ calc.population }} · взрослых {{ calc.adults }}, детей {{ calc.kids }}</small><button v-if="master" class="ed" @click="emit('edit', 'residents')">✎ Править</button></h3>
      <div class="cards">
      <div v-for="r in s.races" :key="r.race" class="race">
        <div class="race-top" @click="openRace = openRace === r.race ? null : r.race">
          <!-- общая иконка расы: ей рисуются воины в гарнизоне, отрядах и лечебнице -->
          <span class="race-ico-w">
            <button type="button" class="race-ico" :class="{ glyph: isGlyph(s.raceIcons?.[r.race]), set: master }" :style="{ '--fc': RACE_COLORS[r.race] }"
                    :title="master ? 'Выбрать общую иконку расы' : RACES[r.race]?.label" @click.stop="master && (iconRace = iconRace === r.race ? null : r.race)">
              <img v-if="s.raceIcons?.[r.race]" :src="s.raceIcons[r.race]" alt="" /><span v-else>{{ RACES[r.race]?.label[0] }}</span>
            </button>
            <IconPick v-if="iconRace === r.race" :settlement-id="s.id" :current="s.raceIcons?.[r.race] || ''" :title="`Иконка: ${RACES[r.race]?.label}`" @pick="setRaceIcon(r.race, $event)" @close="iconRace = null" />
          </span>
          <div class="race-name">{{ RACES[r.race]?.label }}<small>{{ (r.male || 0) + (r.female || 0) + (r.kids || 0) }}</small></div>
          <div class="mfk"><span class="m" title="Мужчины"><i>♂</i>{{ r.male || 0 }}</span><span class="f" title="Женщины"><i>♀</i>{{ r.female || 0 }}</span><span class="k" title="Дети"><i>дети</i>{{ r.kids || 0 }}</span></div>
        </div>
        <div class="cats">
          <span v-for="(c, k) in RESIDENT_CATS" :key="k" :style="{ color: c.color }">{{ c.label }}: <b>{{ r[k] || 0 }}</b></span>
        </div>
        <div v-if="openRace === r.race" class="race-more">
          <div class="chips"><span v-for="tr in RACES[r.race].traits" :key="tr" class="chip">{{ tr }}</span></div>
          <ul class="pm"><li v-for="p in RACES[r.race].plus" :key="p" class="p">{{ p }}</li><li v-for="m in RACES[r.race].minus" :key="m" class="m">{{ m }}</li></ul>
          <div class="norms">
            На жителя в день: овощи {{ RACES[r.race].veg }}, мясо {{ RACES[r.race].meat }}, питьевая вода {{ RACES[r.race].drink }}, быт {{ RACES[r.race].life }} ·
            боевой: военный {{ RACES[r.race].war }}, оборона {{ RACES[r.race].def }}
          </div>
        </div>
      </div>
      </div>
      <p class="muted note">Нажми на расу — свойства, качества и нормы. «Боевые» и «Важные» — отметки поверх работы, а не отдельные люди.</p>
    </template>

    <!-- ================= РАБОТЫ ================= -->
    <template v-else-if="tab === 'jobs'">
      <h3>Рабочие места<button v-if="master" class="ed" @click="emit('edit', 'jobs')">✎ Править</button></h3>
      <div class="cards">
      <div v-for="j in jobList" :id="'sjob-' + j.key" :key="j.key" class="job" :class="{ flash: flash === 'job:' + j.key }">
        <div class="job-top">
          <img :src="icon(JOBS[j.key].icon)" alt="" />
          <b>{{ JOBS[j.key].label }}</b>
          <span class="job-n">{{ j.workers }} / {{ j.places }}</span>
        </div>
        <div class="bar"><i :style="{ width: (j.places ? (j.workers / j.places) * 100 : 0) + '%' }" /></div>
        <div class="job-eff">
          <span v-if="j.supply !== null && j.supply !== undefined" :class="{ warn: j.supply < 100 }">Ресурсы для работы: {{ j.supply }}%</span>
          <span v-for="(o, k) in j.out" :key="k" :class="{ minus: o.base < 0 }">{{ o.base < 0 ? 'Тратит' : 'Даёт' }} {{ RES[k]?.label }}: {{ fmt(Math.abs(o.base)) }}<template v-if="o.bonus"> +{{ fmt(o.bonus) }}</template></span>
          <span v-for="e in j.effects" :key="e.label">{{ e.label }}: {{ e.value }}</span>
        </div>
        <div v-if="j.specialists.length" class="specs">
          <small>Специалисты</small>
          <div class="spec-list">
            <div v-for="(sp, i) in j.specialists" :key="i" class="spec">
              <button type="button" class="person sm" :class="{ empty: !sp, glyph: isGlyph(sp?.icon), act: sp && (sp.id || master) }"
                      :title="!sp ? 'свободно' : sp.id ? `${sp.name} — открыть в «Активах»` : master ? `${sp.name} — выбрать значок` : sp.name"
                      :style="sp?.frame ? { '--fr': ASSET_FRAMES[sp.frame] } : null" @click="specClick(j.key, i, sp)">
                <img v-if="specFace(sp)" :src="specFace(sp)" alt="" /><span v-else-if="sp">{{ initial(sp.name) }}</span>
              </button>
              <span class="spec-name" :class="{ none: !sp }">{{ sp?.name || 'свободно' }}</span>
              <div v-if="picker && picker.job === j.key && picker.i === i" class="spec-pick" @click.stop>
                <div class="spec-pick-h">Значок для «{{ sp.name }}»<button type="button" class="x" @click="picker = null">×</button></div>
                <div class="spec-icons">
                  <button v-for="ic in SPEC_ICONS" :key="ic" type="button" :class="{ on: sp.icon === `/settlement/${ic}.png` }" :title="ic" @click="setSpecIcon(j.key, i, `/settlement/${ic}.png`)">
                    <img :src="`/settlement/${ic}.png`" alt="" />
                  </button>
                </div>
                <div class="spec-acts">
                  <label class="mini">{{ uploading ? 'Загружаю…' : 'Загрузить свою картинку' }}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden @change="uploadSpecIcon(j.key, i, $event)" /></label>
                  <button v-if="sp.icon" type="button" class="mini" @click="setSpecIcon(j.key, i, '')">Убрать значок</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </template>

    <!-- ================= АКТИВЫ ================= -->
    <template v-else-if="tab === 'assets'">
      <h3>Активы в работе<button v-if="master" class="ed" @click="emit('edit', 'assets')">✎ Править</button></h3>
 <div class="cards">
      <div v-for="a in s.assets" :id="'sasset-' + a.id" :key="a.id" class="asset" :class="{ flash: flash === 'asset:' + a.id }" :style="{ '--fr': ASSET_FRAMES[a.frame] || '#8a6630' }">
        <div class="person" :class="{ hex: a.companion }"><img v-if="face(a)" :src="face(a)" alt="" /><span v-else>{{ initial(a.name) }}</span></div>
        <div class="asset-body">
          <b>{{ a.name }}<small v-if="a.companion">компаньон</small>
            <router-link v-if="heroOf(a)" class="hero-link card" :to="{ path: '/wiki', query: { hero: a.heroId } }">карточка героя →</router-link></b>
          <!-- чем занят: работа и аванпост — ссылкой туда, где он трудится -->
          <div class="asset-busy">
            <template v-for="o in occupation(a)" :key="o.text">
              <button v-if="o.go" type="button" class="busy-link" @click="goTo(o.go)">⚙ {{ o.text }} <i>{{ o.go.map ? 'на карте →' : '→' }}</i></button>
              <span v-else class="busy-txt" :class="{ idle: o.idle }">{{ o.idle ? '◌' : '⚙' }} {{ o.text }}</span>
            </template>
          </div>
          <div class="asset-cols">
            <div><small>Пассивно</small><span v-for="p in a.passive" :key="p.text">{{ p.text }}</span></div>
            <div v-if="a.role?.effects?.length"><small>{{ a.role.kind === 'manager' ? 'Управляющий' : 'Специалист' }}</small><span v-for="p in a.role.effects" :key="p.text">{{ p.text }}</span></div>
          </div>
          <div v-if="a.note" class="asset-note" :style="{ color: a.note.color }">{{ a.note.text }}</div>
        </div>
      </div>
      </div>
    </template>

    <!-- ================= АВАНПОСТЫ ================= -->
    <template v-else-if="tab === 'outposts'">
      <h3>Аванпосты <small>{{ s.outposts.length }} из {{ s.stats?.outpostSlots || s.outposts.length }}</small><button v-if="master" class="ed" @click="emit('edit', 'outposts')">✎ Править</button></h3>
      <div class="cards">
      <div v-for="o in s.outposts" :id="'sout-' + o.id" :key="o.id" class="outpost" :class="[o.state, { flash: flash === 'out:' + o.id }]" @click="emit('pick', { kind: 'outpost', id: o.id })">
        <img :src="icon(OUTPOSTS[o.type]?.icon)" alt="" />
        <div>
          <b>{{ OUTPOSTS[o.type]?.label }}<small v-if="o.state === 'depleting'" class="dep">вырабатывается</small></b>
          <span>Рабочие: {{ o.workers }} из {{ o.places }} · специалист: {{ o.specialist || '—' }}</span>
          <span>{{ Object.entries(o.yields || {}).map(([k, v]) => `${RES[k]?.label} +${v}`).join(' · ') }}</span>
        </div>
      </div>
      <div v-for="n in Math.max(0, (s.stats?.outpostSlots || 0) - s.outposts.length)" :key="'e' + n" class="outpost empty">Свободный слот аванпоста</div>
      </div>
    </template>

    <!-- ================= ЖУРНАЛ ================= -->
    <template v-else-if="tab === 'journal'">
      <h3>Журнал поселения<button v-if="master" class="ed" @click="newEv = newEv ? null : blankEvent()">＋ Событие</button></h3>
      <div v-if="newEv" class="evform">
        <input v-model="newEv.title" placeholder="Заголовок: «Дикие Варги!»" />
        <div class="evrow">
          <select v-model="newEv.type"><option v-for="(t, k) in EVENT_TYPES" :key="k" :value="k">{{ t.label }}</option></select>
          <label v-for="(d, k) in EVENT_DURATIONS" :key="k" class="chk"><input v-model="newEv.duration" type="checkbox" :value="k" /> {{ d.label }}</label>
        </div>
        <div class="evrow"><label class="chk">Срок <input v-model="newEv.deadline" type="date" /></label></div>
        <textarea v-model="newEv.text" rows="3" placeholder="Что случилось — от лица жителей" />
        <input v-model="newEv.effect" placeholder="Влияние: «Угроза +45» (необязательно)" />
        <div class="evrow end"><button class="btn" @click="newEv = null">Отмена</button><button class="btn primary" :disabled="!newEv.title" @click="addEvent">Добавить и оповестить главу</button></div>
      </div>
      <!-- заготовки событий: видит только мастер -->
      <section v-if="master" class="sugg">
        <div class="sugg-head">
          <b>Заготовки событий</b><small>видишь только ты · сайт предлагает по положению дел</small>
          <button class="btn" :disabled="(s.suggestions?.length || 0) >= 8" @click="rollSuggestion">🎲 Придумать</button>
        </div>
        <p v-if="!s.suggestions?.length" class="muted">Пока пусто. Заготовки появляются при «Прошёл день» (примерно одна на три дня) или по кнопке.</p>
        <div class="cards">
        <div v-for="g in s.suggestions || []" :key="g.id" class="ev sg" :style="{ '--ec': EVENT_TYPES[g.type]?.color }">
          <template v-if="sgEdit?.id === g.id">
            <input v-model="sgEdit.title" />
            <textarea v-model="sgEdit.text" rows="3" />
            <input v-model="sgEdit.effect" placeholder="Влияние (текст для главы)" />
          </template>
          <template v-else>
            <div class="ev-top">
              <img :src="icon(EVENT_TYPES[g.type]?.icon)" alt="" /><b>{{ g.title }}</b>
              <span class="ev-type">{{ EVENT_TYPES[g.type]?.label }}</span>
              <span v-for="d in g.duration || []" :key="d" class="ev-dur" :style="{ background: EVENT_DURATIONS[d]?.color }">{{ EVENT_DURATIONS[d]?.label }}</span>
              <span class="ev-date">день {{ g.day }}</span>
            </div>
            <p>{{ g.text }}</p>
            <div v-if="g.effect" class="ev-eff">{{ g.effect }}</div>
          </template>
          <label v-if="g.apply" class="chk apply"><input v-model="applyOn[g.id]" type="checkbox" /> применить сразу: {{ applyText(g.apply) }}</label>
          <div class="evrow end">
            <button class="btn danger" @click="dropSuggestion(g)">Отбросить</button>
            <button v-if="sgEdit?.id !== g.id" class="btn" @click="sgEdit = { id: g.id, title: g.title, text: g.text, effect: g.effect }">Править</button>
            <button class="btn primary" @click="releaseSuggestion(g)">В журнал</button>
          </div>
        </div>
        </div>
      </section>
      <div class="journal">
      <div v-for="e in events" :key="e.id" class="ev" :style="{ '--ec': EVENT_TYPES[e.type]?.color }">
        <div class="ev-top">
          <img :src="icon(EVENT_TYPES[e.type]?.icon)" alt="" />
          <b>{{ e.title }}</b>
          <span class="ev-type">{{ EVENT_TYPES[e.type]?.label }}</span>
          <span v-for="d in e.duration || []" :key="d" class="ev-dur" :style="{ background: EVENT_DURATIONS[d]?.color }">{{ EVENT_DURATIONS[d]?.label }}</span>
          <span v-if="e.deadline" class="ev-date">до {{ date(e.deadline) }}</span>
        </div>
        <p>{{ e.text }}</p>
        <div v-if="e.effect" class="ev-eff">{{ e.effect }}</div>
        <div v-if="decEdit === e.id" class="ev-dec edit">
          <small>Решение</small>
          <textarea v-model="decText" rows="3" placeholder="Что прикажет глава?" />
          <div class="evrow end"><button class="btn" @click="decEdit = null">Отмена</button><button class="btn primary" @click="decide(e)">Сохранить решение</button></div>
        </div>
        <div v-else class="ev-dec" :class="{ none: !e.decision }">
          <small>Решение<template v-if="e.decidedBy"> · {{ e.decidedBy }}</template></small>{{ e.decision || (e.duration?.includes('decide') ? 'ждёт решения главы' : '—') }}
          <button v-if="master || (decider && (e.decision || e.duration?.includes('decide')))" class="ev-act" @click="decEdit = e.id; decText = e.decision || ''">{{ e.decision ? 'изменить' : 'решить' }}</button>
          <button v-if="master" class="ev-act del" @click="removeEvent(e)">удалить событие</button>
        </div>
      </div>
      </div>
    </template>
    <!-- ================= ПРИКАЗЫ ================= -->
    <template v-else-if="tab === 'orders'">
      <h3>Приказы главы</h3>
      <div v-if="decider" class="evform">
        <p class="muted">Построить и разведать — кнопками на карте, починить — в карточке повреждённой постройки. Здесь — назначить рабочих или свободный приказ. Мастер одобрит или отклонит.</p>
        <div class="evrow">
          <select v-model="ord.job"><option v-for="(j, k) in c.jobs" :key="k" :value="k">{{ JOBS[k].label }} ({{ j.workers }}/{{ j.places }})</option></select>
          <input v-model.number="ord.count" type="number" min="0" class="num" />
          <button class="btn primary" :disabled="!ord.job" @click="sendOrder('workers')">Назначить</button>
        </div>
        <textarea v-model="ord.text" rows="2" placeholder="Свободный приказ: «Наймите мастеров в Ширатори»" />
        <div class="evrow end"><button class="btn primary" :disabled="!ord.text" @click="sendOrder('free')">Отдать приказ</button></div>
      </div>
      <p v-else-if="!master" class="muted">Приказы отдают игроки, которых выбрал мастер.</p>
      <div v-if="!orders.length" class="muted">Приказов пока нет</div>
      <div class="cards">
      <div v-for="o in orders" :key="o.id" class="ord" :class="o.status">
        <div class="ord-top">
          <b>{{ orderTitle(o) }}</b>
          <span class="ord-st">{{ { pending: 'ждёт мастера', approved: 'одобрен', rejected: 'отклонён' }[o.status] }}</span>
        </div>
        <span class="muted">{{ o.byName }} · {{ date(o.createdAt) }}</span>
        <div v-if="o.kind === 'repair'" class="ord-price">
          <small>{{ o.status === 'approved' ? (o.paid ? 'Оплачено' : 'Чинят бесплатно') : 'Цена ремонта' }}</small>
          <PriceChips :price="o.status === 'approved' ? o.paid : repairPrice(orderBuilding(o) || o.repair)" :stock="o.status === 'pending' ? s.stock || {} : null" />
        </div>
        <div v-if="o.kind === 'build'" class="ord-price">
          <small>{{ o.status === 'approved' ? (o.paid ? 'Оплачено' : 'Заложено бесплатно') : 'Цена' }}</small>
          <PriceChips :price="o.status === 'approved' ? o.paid : BUILDINGS[o.build.type]?.price" :stock="o.status === 'pending' ? s.stock || {} : null" />
        </div>
        <p v-if="o.text">{{ o.text }}</p>
        <p v-if="o.reply" class="reply">Мастер: {{ o.reply }}</p>
        <input v-if="o.status === 'pending' && master" v-model="replies[o.id]" class="reply-in" placeholder="Ответ главе (необязательно)" />
        <div v-if="o.status === 'pending' && master" class="evrow end">
          <button class="btn primary" :disabled="!affordable(o)" :title="affordable(o) ? '' : 'На складе не хватает — можно заложить бесплатно'" @click="judge(o, 'approve')">Одобрить</button>
          <button v-if="o.kind === 'build' || o.kind === 'repair'" class="btn" @click="judge(o, 'approve', true)">Бесплатно</button>
          <button class="btn danger" @click="judge(o, 'reject')">Отклонить</button>
        </div>
        <button v-else-if="o.status === 'pending' && o.by === store.me?.id" class="ev-act" @click="cancelOrder(o)">отменить приказ</button>
      </div>
      </div>
    </template>

    <!-- ================= ВОЙСКО И ЛЕЧЕНИЕ ================= -->
    <GarrisonTab v-else-if="tab === 'garrison'" :settlement="s" :calc="c" :master="master" :decider="decider" @edit="emit('edit', $event)" @battle="emit('battle', $event)" />
    <SquadsTab v-else-if="tab === 'squads'" :settlement="s" :master="master" :decider="decider" @edit="emit('edit', $event)" @battle="emit('battle', $event)" />
    <HospitalTab v-else-if="tab === 'hospital'" :settlement="s" :calc="c" :master="master" :decider="decider" />

    <!-- ================= ИСТОРИЯ ================= -->
    <SettlementHistory v-else-if="tab === 'history'" :settlement="s" :wide="wide" />
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { store, heroCover, heroPortraitUrl, act, toast, uploadSettlementPortrait } from '../map/store.js'
import { SPEC_ICONS, isGlyph } from './specIcons.js'
import { RESOURCES, RES, RACES, RESIDENT_CATS, BUILDINGS, JOBS, OUTPOSTS, EVENT_TYPES, EVENT_DURATIONS, ASSET_FRAMES, DAMAGE, shortFor, repairPrice, explored as isExplored } from '../shared/settlement.js'
import { WORLD } from '../shared/terrainGen.js'
import { applyText } from '../shared/settlementEvents.js'
import PriceChips from './PriceChips.vue'
import SettlementHistory from './SettlementHistory.vue'
import GarrisonTab from './GarrisonTab.vue'
import IconPick from './IconPick.vue'
import { RACE_COLORS } from './armyFaces.js'
import SquadsTab from './SquadsTab.vue'
import HospitalTab from './HospitalTab.vue'

const props = defineProps({ tab: String, settlement: Object, calc: Object, master: Boolean, decider: Boolean, wide: Boolean })
const emit = defineEmits(['pick', 'edit', 'tab', 'battle'])
const base = () => `/api/settlements/${props.settlement.id}`
const s = computed(() => props.settlement)
const c = computed(() => props.calc)
const icon = n => `/settlement/${n || 'help'}.png`
const initial = n => (n || '?').trim()[0]?.toUpperCase() || '?'
const fmt = v => (Math.round(v * 10) / 10).toLocaleString('ru-RU')
const date = d => new Date(d).toLocaleDateString('ru-RU')

/* обзор */
const overview = computed(() => {
  const x = c.value, st = s.value.stats || {}
  return [
    { label: 'Тип поселения', value: s.value.kind, icon: 'medieval-village-01' },
    { label: 'Свободные поселенцы', value: x.free, icon: 'person-free' },
    { label: 'Занятые поселенцы', value: x.busy, icon: 'person' },
    { label: 'Недоступные поселенцы', value: x.unavailable, icon: 'person-unavailable' },
    { label: 'Разведано земли', value: exploredArea.value, icon: 'annexation', hint: 'Сколько округи открыто от тумана (вся округа ≈300 км²)' },
    { label: 'Аванпосты', value: `${s.value.outposts?.length || 0}/${st.outpostSlots || 0}`, icon: 'gold-mine' },
    { label: 'Повреждённые постройки', value: x.damaged.length, icon: 'hazard-sign', cls: x.damaged.length ? 'warn' : '',
      hint: x.damaged.length ? x.damaged.map(b => `${b.name || BUILDINGS[b.type]?.label}: ${DAMAGE[b.damage].short}${b.repair ? ' (чинят)' : ''}`).join(', ') : 'Всё целое' },
    { label: 'Жильё (дома)', value: `${x.houses.used}/${x.houses.cap}`, icon: 'house', cls: x.houses.used >= x.houses.cap ? 'warn' : '' },
    { label: 'Общее жильё', value: `${x.housing.used}/${x.housing.cap}`, icon: 'block-house' },
    { label: 'Гостевые места', value: `${x.guests.used}/${x.guests.cap}`, icon: 'tavern-sign' },
    { label: 'Торговые места', value: `${x.trade.used}/${x.trade.cap}`, icon: 'cash' },
    { label: 'Военный потенциал', value: x.war.total, icon: 'target-arrows', hint: `Боевые жители: ${x.war.races}, активы: ${x.war.assets}` },
    { label: 'Досуг', value: x.leisure.total, icon: 'tavern-sign' },
    { label: 'Защита', value: x.defense.total, icon: 'palisade', hint: `Боевые жители: ${x.defense.races}, стража: ${x.defense.guards}, постройки: ${x.defense.buildings}, стены: ${x.defense.walls || 0}, активы: ${x.defense.assets}` },

  ]
})
// площадь разведанного: считаем по сетке точек (круги разведки сильно перекрываются)
const exploredArea = computed(() => {
  const N = 140, cell = WORLD / N
  let n = 0
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (isExplored(s.value, [(i + 0.5) * cell, (j + 0.5) * cell])) n++
  const km2 = (n * cell * cell) / 1e6
  return `${km2 < 10 ? km2.toFixed(1).replace('.', ',') : Math.round(km2)} км²`
})
const head = computed(() => store.data.heroes?.find(h => h.id === s.value.headHeroId) || null)
const headCover = computed(() => { const g = heroCover(head.value); return g ? heroPortraitUrl(g.thumb || g.file) : '' })
const managerSlots = computed(() => Array.from({ length: s.value.managerSlots || 2 }, (_, i) => s.value.assets?.find(a => a.id === s.value.managers?.[i]) || null))
const deciders = computed(() => (s.value.deciders || []).map(id => store.data.roster?.find(p => p.id === id)?.character).filter(Boolean))
const builtCount = computed(() => (s.value.buildings || []).filter(b => b.state === 'built').length)
const buildingList = computed(() => Object.entries(c.value.count).map(([type, n]) => ({ type, n, ...BUILDINGS[type] })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)))
function pickFirst(type) {
  const b = s.value.buildings.find(x => x.type === type && BUILDINGS[type].size !== 'settlement')
  if (b) emit('pick', { kind: 'building', id: b.id })
}

/* ресурсы */
const openRes = ref(null)
const resRows = computed(() => RESOURCES.map(r => {
  const gain = c.value.gain[r.key]?.total || 0, use = c.value.use[r.key]?.total || 0
  // доля прироста в общем обороте — граница, где прирост и расход «упираются» друг в друга
  return { ...r, gain, use, bal: c.value.balance[r.key], stock: s.value.stock?.[r.key] || 0, share: gain + use ? (gain / (gain + use)) * 100 : 50 }
}))
// мастер ставит запас прямо в таблице
function setStock(key, v) {
  const n = Math.max(0, Math.round((Number(v) || 0) * 10) / 10)
  act('PATCH', base(), { stock: { ...(s.value.stock || {}), [key]: n } }, `Запас «${RES[key]?.label}»: ${fmt(n)}`).catch(() => null)
}

/* жители */
const openRace = ref(null)
const iconRace = ref(null)
function setRaceIcon(race, url) {
  const icons = { ...(s.value.raceIcons || {}) }
  if (url) icons[race] = url
  else delete icons[race]
  iconRace.value = null
  act('PATCH', base(), { raceIcons: icons }, url ? `Иконка расы «${RACES[race]?.label}» поставлена` : 'Иконка убрана').catch(() => null)
}

/* работы */
const jobList = computed(() => Object.entries(c.value.jobs).map(([key, j]) => ({ key, ...j })))

/* активы: связь с карточками героев (портрет берётся из карточки, если своего нет) */
const heroOf = a => (a.heroId && store.data.heroes?.find(h => h.id === a.heroId)) || null
function face(a) {
  if (a.portrait) return a.portrait
  const g = heroCover(heroOf(a))
  return g ? heroPortraitUrl(g.thumb || g.file) : ''
}
/* чем занят актив: управляющий, специалист на работе, аванпост или что вписал мастер */
function occupation(a) {
  const list = []
  if (s.value.managers?.includes(a.id)) list.push({ text: 'Управляет поселением', go: { tab: 'overview', focus: 'gov', el: 'sgov' } })
  for (const [k, j] of Object.entries(s.value.jobs || {})) {
    if ((j.specialists || []).slice(0, JOBS[k]?.spec || 0).includes(a.id)) list.push({ text: `Специалист: ${JOBS[k].label.toLowerCase()}`, go: { tab: 'jobs', focus: 'job:' + k, el: 'sjob-' + k } })
  }
  for (const o of s.value.outposts || []) {
    if (o.specialist && (o.specialist === a.id || o.specialist === a.name)) {
      list.push({ text: `Аванпост «${OUTPOSTS[o.type]?.label || 'аванпост'}»`, go: { tab: 'outposts', focus: 'out:' + o.id, el: 'sout-' + o.id, map: o.x != null, pick: { kind: 'outpost', id: o.id } } })
    }
  }
  if (a.busy) list.push({ text: a.busy })
  if (!list.length) list.push({ text: a.companion ? 'Рядом с хозяином' : 'Свободен', idle: true })
  return list
}
// перейти туда, где работает: вкладка + подсветка; аванпост — ещё и выбрать на карте
const flash = ref(null)
let flashTimer = null
async function goTo(go) {
  emit('tab', go.tab)
  if (go.pick) emit('pick', go.pick)
  flash.value = go.focus
  await nextTick()
  setTimeout(() => {
    const el = document.getElementById(go.el)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // плавная прокрутка иногда не доезжает (картинки ещё грузятся) — догоняем сразу
    setTimeout(() => {
      const r = el?.getBoundingClientRect()
      if (r && (r.top < 0 || r.bottom > innerHeight)) el.scrollIntoView({ block: 'center' })
    }, 800)
  }, 60)
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { flash.value = null }, 2600)
}

/* специалисты: актив ведёт в «Активы», мастер по имени выбирает значок */
const picker = ref(null)
const specFace = sp => (!sp ? '' : sp.icon || (sp.id ? face(sp) : ''))
function specClick(job, i, sp) {
  if (!sp) return
  if (sp.id) return goTo({ tab: 'assets', focus: 'asset:' + sp.id, el: 'sasset-' + sp.id })
  if (props.master) picker.value = picker.value?.job === job && picker.value.i === i ? null : { job, i }
}
function setSpecIcon(key, i, url) {
  const job = s.value.jobs?.[key] || {}
  const specIcons = [...(job.specIcons || [])]
  for (let n = specIcons.length; n < i; n++) specIcons[n] = null
  specIcons[i] = url || null
  picker.value = null
  act('PATCH', base(), { jobs: { ...s.value.jobs, [key]: { ...job, specIcons } } }, url ? 'Значок специалиста поставлен' : 'Значок убран').catch(() => null)
}
const uploading = ref(false)
async function uploadSpecIcon(key, i, e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  uploading.value = true
  try { const r = await uploadSettlementPortrait(s.value.id, file, 'Значок специалиста'); if (r) setSpecIcon(key, i, r.url) } catch (err) { toast(err.message, 'error') } finally { uploading.value = false }
}


/* журнал: новое событие, решения */
const newEv = ref(null)
const blankEvent = () => ({ title: '', type: 'message', duration: ['decide'], deadline: '', text: '', effect: '' })
async function addEvent() {
  await act('POST', `${base()}/events`, newEv.value, 'Событие в журнале, глава оповещён')
  newEv.value = null
}
const decEdit = ref(null)
const decText = ref('')
async function decide(e) {
  await act('POST', `${base()}/events/${e.id}/decision`, { text: decText.value }, 'Решение записано')
  decEdit.value = null
}
function removeEvent(e) {
  if (!confirm(`Удалить событие «${e.title}»?`)) return
  act('PATCH', base(), { events: s.value.events.filter(x => x.id !== e.id) }, 'Удалено')
}

/* приказы */
const ord = ref({ job: 'farmer', count: 0, text: '' })
const replies = ref({})
const orders = computed(() => [...(s.value.orders || [])].sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0) || b.createdAt - a.createdAt))
function orderTitle(o) {
  if (o.kind === 'build') return `Построить «${BUILDINGS[o.build.type]?.label}»`
  if (o.kind === 'workers') return `${JOBS[o.workers.job]?.label}: назначить ${o.workers.count} рабочих`
  if (o.kind === 'explore') return 'Разведать участок'
  if (o.kind === 'train') return `Обучить ${o.train.count} × ${RACES[o.train.race]?.label} (сезон, ${120} дн.)`
  if (o.kind === 'repair') {
    const b = orderBuilding(o)
    return `${o.repair.damage === 'ruined' ? 'Отстроить' : 'Починить'} «${b?.name || BUILDINGS[o.repair.type]?.label}» (${DAMAGE[o.repair.damage]?.short})`
  }
  return 'Приказ'
}
async function sendOrder(kind) {
  const body = kind === 'workers' ? { kind, job: ord.value.job, count: ord.value.count, text: ord.value.text } : { kind, text: ord.value.text }
  await act('POST', `${base()}/orders`, body, 'Приказ отправлен мастеру')
  ord.value.text = ''
}
const judge = (o, action, free = false) => act('POST', `${base()}/orders/${o.id}/${action}`, { reply: replies.value[o.id] || '', free }, action === 'approve' ? 'Приказ одобрен' : 'Приказ отклонён').catch(() => null)
const orderBuilding = o => (s.value.buildings || []).find(b => b.id === o.repair?.id)
const affordable = o => (o.kind === 'repair' ? !shortFor(s.value.stock, repairPrice(orderBuilding(o) || o.repair)).length
  : o.kind !== 'build' || !shortFor(s.value.stock, BUILDINGS[o.build.type]?.price).length)

/* заготовки событий */
const sgEdit = ref(null)
const applyOn = ref({})
const rollSuggestion = () => act('POST', `${base()}/suggestions`).catch(() => null)
const dropSuggestion = g => act('DELETE', `${base()}/suggestions/${g.id}`).catch(() => null)
async function releaseSuggestion(g) {
  const edit = sgEdit.value?.id === g.id ? sgEdit.value : {}
  const body = { title: edit.title ?? g.title, text: edit.text ?? g.text, effect: edit.effect ?? g.effect, apply: applyOn.value[g.id] ?? g.applyOn }
  await act('POST', `${base()}/suggestions/${g.id}/accept`, body, 'Событие в журнале, глава оповещён').catch(() => null)
  sgEdit.value = null
}
const cancelOrder = o => act('DELETE', `${base()}/orders/${o.id}`, undefined, 'Приказ отменён')

/* журнал: новые сверху, нерешённые — выше */
const events = computed(() => [...(s.value.events || [])].sort((a, b) => (!a.decision && a.duration?.includes('decide') ? -1 : 0) - (!b.decision && b.duration?.includes('decide') ? -1 : 0) || b.createdAt - a.createdAt))
</script>

<style scoped>
.st h3 { margin: 18px 0 8px; font: 700 22px var(--a-serif); color: var(--a-gold-2); }
.st h3:first-child { margin-top: 2px; }
.st h3 small { font: 600 12px var(--a-sans); color: var(--a-muted); margin-left: 6px; }
.muted { color: var(--a-muted); font-size: 12px; }
.ed { float: right; margin-top: 4px; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.ed:hover { background: rgba(231, 197, 111, .18); }
.tug-list { display: grid; gap: 6px; }
.tug { padding: 8px 10px 10px; border-radius: 12px; border: 1px solid var(--a-line-2); background: rgba(255, 255, 255, .02); cursor: pointer; transition: background .15s, border-color .15s; }
.tug:hover, .tug.open { background: rgba(231, 197, 111, .05); border-color: rgba(231, 197, 111, .25); }
.tug.idle { opacity: .6; }
.tug.empty { border-color: rgba(255, 107, 91, .45); }
.tug-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; font-size: 13px; }
.tug-name { font-weight: 700; }
.tug-head small { font-size: 11px; font-weight: 700; }
.tug-head .from { color: #ffb36b; }
.tug.empty .tug-head .from { color: #ff8a7a; }
.tug-head .to { color: #9be07a; }
.tug-stock { margin-left: auto; display: flex; align-items: center; gap: 6px; color: var(--a-muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
.tug-stock b { color: var(--a-gold-2); font-size: 14px; text-transform: none; letter-spacing: 0; }
.tug-bar { position: relative; display: flex; height: 22px; border-radius: 7px; background: #c0293a; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .35); }
.tug-bar.none { display: block; height: auto; padding: 3px 10px; background: rgba(255, 255, 255, .04); color: var(--a-muted); font-size: 11.5px; font-style: italic; margin-top: -10px; }
.tug-g { flex: none; height: 100%; border-radius: 7px 0 0 7px; background: linear-gradient(180deg, #7ee06a, #46b23a); transition: width .8s cubic-bezier(.3, 1.3, .5, 1); overflow: hidden; }
.tug-u { flex: 1; min-width: 0; height: 100%; border-radius: 0 7px 7px 0; background: linear-gradient(180deg, #e0485a, #a81f30); overflow: hidden; text-align: right; }
.tug-g b, .tug-u b { display: inline-block; padding: 0 8px; line-height: 22px; font-size: 12px; font-weight: 800; color: #fff; text-shadow: 0 1px 2px rgba(0, 0, 0, .55); white-space: nowrap; }
.tug-seam { position: absolute; top: -3px; bottom: -3px; width: 4px; margin-left: -2px; border-radius: 2px; background: #fff3d6; box-shadow: 0 0 10px #fff3d6, 0 0 2px #000; transition: left .8s cubic-bezier(.3, 1.3, .5, 1); }
/* перевешивающая сторона «давит» на шов */
.tug-seam.push-r { animation: push-r 1.6s ease-in-out infinite; }
.tug-seam.push-l { animation: push-l 1.6s ease-in-out infinite; }
.tug-flag { position: absolute; bottom: calc(100% + 5px); transform: translateX(-50%); padding: 1px 7px; border-radius: 6px; background: #4a5568; color: #fff; font-size: 11px; font-weight: 800; white-space: nowrap; transition: left .8s cubic-bezier(.3, 1.3, .5, 1); }
.tug-flag::after { content: ''; position: absolute; left: 50%; top: 100%; margin-left: -5px; border: 5px solid transparent; border-top-color: inherit; border-top-color: #4a5568; }
.tug-flag.up { background: #2f8a3e; } .tug-flag.up::after { border-top-color: #2f8a3e; }
.tug-flag.down { background: #b3263a; } .tug-flag.down::after { border-top-color: #b3263a; }
.tug-parts { margin: -2px 6px 4px; padding: 6px 10px; border-left: 2px solid rgba(231, 197, 111, .3); }
@keyframes push-r { 50% { transform: translateX(3px); } }
@keyframes push-l { 50% { transform: translateX(-3px); } }
@media (prefers-reduced-motion: reduce) { .tug-seam { animation: none !important; } }
.res td.st { color: var(--a-gold-2); font-weight: 700; }
.res td small.from { display: block; margin: 1px 0 0 17px; color: #ffb36b; font-size: 10.5px; font-weight: 700; }
.res tr.empty td small.from { color: #ff8a7a; }
.res td.g { color: #9be07a; font-weight: 700; }
.res td.u { color: #ff9b8f; font-weight: 700; }
.res th.g { color: #9be07a; } .res th.u { color: #ff9b8f; } .res th.st { color: var(--a-gold-2); }
.stock-in { width: 68px; padding: 3px 6px; border-radius: 7px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-gold-2); font: 700 13px var(--a-sans); text-align: right; }
.stock-in:focus { outline: none; border-color: var(--a-gold); }
.evform { display: grid; gap: 6px; padding: 10px 12px; margin-bottom: 10px; border-radius: 12px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .05); }
.evform input, .evform select, .evform textarea, .ev-dec textarea, .ord input { min-width: 0; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); font: 500 13px var(--a-sans); resize: vertical; }
.evrow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.evrow.end { justify-content: flex-end; }
.evrow input:not(.num) { flex: 1; }
.num { width: 70px; }
.chk { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #d9cdb0; font-weight: 600; }
.btn { padding: 6px 12px; border-radius: 9px; border: 1px solid var(--a-line); background: rgba(255, 255, 255, .05); color: var(--a-text); font: 700 12.5px var(--a-sans); cursor: pointer; }
.btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
.btn.danger { color: #ff9b8f; border-color: rgba(255, 107, 94, .4); }
.btn:disabled { opacity: .5; cursor: default; }
.ev-act { margin-left: 8px; padding: 0; border: 0; background: none; color: var(--a-gold); font: 700 11.5px var(--a-sans); text-decoration: underline dotted; cursor: pointer; }
.ev-act.del { color: #ff9b8f; }
.ev-dec.edit { display: grid; gap: 6px; }
.ord { display: grid; gap: 3px; padding: 10px 12px; margin-bottom: 8px; border-radius: 12px; border: 1px solid var(--a-line-2); background: rgba(255, 255, 255, .02); }
.ord.pending { border-color: rgba(231, 197, 111, .45); }
.ord.rejected { opacity: .65; }
.ord-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.ord-top b { font: 700 17px var(--a-serif); color: var(--a-gold-2); }
.ord-st { font-size: 11.5px; font-weight: 800; color: var(--a-muted); }
.ord.pending .ord-st { color: #ffb36b; } .ord.approved .ord-st { color: #9be07a; } .ord.rejected .ord-st { color: #ff9b8f; }
.ord p { margin: 2px 0; font-size: 13px; color: #d9cdb0; }
.ord .reply { color: var(--a-gold-2); }
.note { margin-top: 10px; line-height: 1.5; }

.tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.tile { display: grid; grid-template-columns: 22px 1fr auto; align-items: center; gap: 8px; padding: 6px 9px; border-radius: 9px; background: rgba(255, 255, 255, .03); border: 1px solid var(--a-line-2); font-size: 12.5px; }
.tile img { width: 22px; height: 22px; }
.tile span { color: #b9ab8a; }
.tile b { color: var(--a-text); }
.tile.ok b { color: #9be07a; }
.tile.warn b { color: #ffb36b; }

.gov { display: flex; gap: 10px; }
.gov-col { display: grid; justify-items: center; gap: 4px; padding: 10px; border-radius: 12px; border: 1px solid var(--a-line); background: rgba(255, 255, 255, .02); text-align: center; }
.gov-col.wide { flex: 1; }
.gov-col small { color: var(--a-muted); font-weight: 700; font-size: 11px; }
.gov-row { display: flex; gap: 14px; justify-content: center; }
.gov-m { display: grid; justify-items: center; gap: 3px; }
.person { --fr: #8a6630; width: 52px; height: 52px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; border: 2px solid var(--fr); background: #2a2218; color: #f3d99a; font: 700 22px var(--a-serif); flex: none; }
.person img { width: 100%; height: 100%; object-fit: cover; }
.person.big { width: 64px; height: 64px; --fr: #e6c27a; }
.person.sm { width: 34px; height: 34px; font-size: 15px; }
.person.empty { border: 2px dashed rgba(255, 255, 255, .25); background: none; }
.person.hex { border-radius: 0; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }

.bcount { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 5px; }
.bc { display: grid; grid-template-columns: 22px 1fr auto; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 9px; border: 1px solid var(--a-line-2); background: rgba(255, 255, 255, .03); color: var(--a-text); font: 600 12px var(--a-sans); text-align: left; cursor: pointer; }
.bc:hover { border-color: var(--a-line); background: rgba(231, 197, 111, .06); }
.bc img { width: 22px; height: 22px; padding: 2px; border-radius: 5px; background: #d6d2c8; }
.bc span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc b { color: var(--a-gold-2); }

.res { width: 100%; border-collapse: collapse; font-size: 13px; }
.res th { text-align: right; color: var(--a-muted); font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; padding: 4px 8px; border-bottom: 1px solid var(--a-line); }
.res th:first-child, .res td:first-child { text-align: left; }
.res td { text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--a-line-2); }
.res tbody tr:not(.parts) { cursor: pointer; }
.res tbody tr:not(.parts):hover { background: rgba(231, 197, 111, .05); }
.res tr.idle td { color: #6d675b; }
.res tr.deficit td:first-child { color: #ffcf9a; }
.res tr.empty td:first-child { color: #ff8a7a; }
.res tr.idle td, .res tr.idle td.g, .res tr.idle td.u { color: #6d675b; font-weight: 600; }
.rdot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 8px; }
.res tr.parts td { background: rgba(0, 0, 0, .2); padding: 6px 12px 8px 26px; }
.pl { display: flex; justify-content: space-between; font-size: 12px; padding: 1px 0; }
.pl.plus b { color: #9be07a; } .pl.minus b { color: #ff9b8f; }
.pl span { color: #b9ab8a; }

.race { padding: 10px 12px; border-radius: 12px; border: 1px solid var(--a-line-2); background: rgba(255, 255, 255, .02); margin-bottom: 8px; }
.race-ico-w { position: relative; flex: none; }
.race-ico { --fc: #c9b88f; width: 40px; height: 40px; padding: 0; border-radius: 50%; overflow: hidden; display: grid; place-items: center; border: 2px solid #fff3d6; background: var(--fc); color: #1b140c; font: 700 18px var(--a-serif); cursor: default; }
.race-ico.set { cursor: pointer; }
.race-ico.set:hover { box-shadow: 0 0 0 3px rgba(231, 197, 111, .45); }
.race-ico img { width: 100%; height: 100%; object-fit: cover; }
.race-ico.glyph { background: #d6d2c8; }
.race-ico.glyph img { object-fit: contain; padding: 6px; box-sizing: border-box; }
.race-top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 4px 12px; cursor: pointer; }
.race-name { flex: 1; font: 700 19px var(--a-serif); color: var(--a-gold-2); }
.race-name small { margin-left: 8px; font: 700 12px var(--a-sans); color: var(--a-muted); }
.mfk { display: flex; gap: 12px; font-weight: 800; font-size: 16px; color: #d9cdb0; }
.mfk span { display: inline-flex; align-items: baseline; gap: 3px; }
.mfk i { font-style: normal; font-size: 17px; }
.mfk .k i { font-size: 11px; font-weight: 700; letter-spacing: .03em; }
.mfk .m i { color: #8fc7ff; } .mfk .f i { color: #ff9ec7; } .mfk .k i { color: #ffe08a; }
.cats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px 10px; margin-top: 6px; font-size: 12px; font-weight: 600; }
.cats b { color: inherit; }
.race-more { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--a-line); font-size: 12.5px; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { padding: 2px 8px; border-radius: 99px; background: rgba(231, 197, 111, .1); border: 1px solid var(--a-line); color: var(--a-gold-2); font-size: 11px; font-weight: 700; }
.pm { margin: 6px 0; padding-left: 16px; }
.pm .p { color: #9be07a; } .pm .m { color: #ff9b8f; }
.norms { color: #b9ab8a; }

.job { padding: 10px 12px; border-radius: 12px; border: 1px solid var(--a-line-2); background: rgba(255, 255, 255, .02); margin-bottom: 8px; }
.job-top { display: flex; align-items: center; gap: 8px; }
.job-top img { width: 26px; height: 26px; padding: 2px; border-radius: 6px; background: #d6d2c8; }
.job-top b { font: 700 18px var(--a-serif); color: var(--a-gold-2); }
.job-n { margin-left: auto; font-weight: 800; color: #d9cdb0; }
.bar { height: 5px; margin: 6px 0; border-radius: 99px; background: rgba(255, 255, 255, .07); overflow: hidden; }
.bar i { display: block; height: 100%; background: linear-gradient(90deg, #a87a33, #f2d58f); }
.job-eff { display: grid; gap: 1px; font-size: 12.5px; color: #d9cdb0; }
.job-eff .warn { color: #ffb36b; }
.job-eff .minus { color: #ff9b8f; }
.specs { display: grid; gap: 4px; margin-top: 7px; }
.spec-list { display: flex; flex-wrap: wrap; gap: 6px 14px; }
.spec { position: relative; display: flex; align-items: center; gap: 7px; }
.spec .person { padding: 0; cursor: default; }
.spec .person.act { cursor: pointer; transition: transform .15s, box-shadow .15s; }
.spec .person.act:hover { transform: scale(1.1); box-shadow: 0 0 0 3px rgba(231, 197, 111, .35); }
.spec .person.glyph { background: #d6d2c8; }
.spec .person.glyph img { object-fit: contain; padding: 4px; }
.spec-name { font-size: 12.5px; font-weight: 700; color: #d9cdb0; }
.spec-name.none { color: var(--a-muted); font-weight: 600; font-style: italic; }
.spec-pick { position: absolute; z-index: 20; top: calc(100% + 6px); left: 0; width: min(300px, 80vw); padding: 10px; border-radius: 12px; background: #17130e; border: 1px solid #8a6630; box-shadow: 0 16px 40px rgba(0, 0, 0, .6); }
.spec-pick-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 12px; font-weight: 800; color: var(--a-gold-2); }
.spec-pick-h .x { border: 0; background: none; color: var(--a-muted); font-size: 20px; cursor: pointer; }
.spec-icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(34px, 1fr)); gap: 4px; max-height: 180px; overflow-y: auto; }
.spec-icons button { aspect-ratio: 1; padding: 4px; border-radius: 7px; border: 2px solid transparent; background: #d6d2c8; cursor: pointer; }
.spec-icons button:hover { border-color: #e6c27a; }
.spec-icons button.on { border-color: #9be07a; }
.spec-icons img { width: 100%; height: 100%; object-fit: contain; }
.spec-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.spec-acts .mini { cursor: pointer; }
.asset-busy { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 3px 0 2px; }
.busy-link { padding: 2px 9px; border-radius: 99px; border: 1px solid rgba(231, 197, 111, .4); background: rgba(231, 197, 111, .1); color: #f3d99a; font: 700 12px var(--a-sans); cursor: pointer; }
.busy-link:hover { background: rgba(231, 197, 111, .22); }
.busy-link i { font-style: normal; color: #a8936c; }
.busy-txt { font-size: 12px; font-weight: 700; color: #d9cdb0; }
.busy-txt.idle { color: var(--a-muted); font-style: italic; }
/* подсветка места, куда перешли из «Активов» */
.flash { animation: s-flash 1.3s ease 2; }
@keyframes s-flash { 50% { box-shadow: 0 0 0 2px #f3d99a, 0 0 24px rgba(243, 217, 154, .45); } }
.specs small { color: var(--a-muted); font-weight: 700; font-size: 11px; }
.spec-names { font-size: 12px; color: #b9ab8a; }

.asset { display: flex; gap: 12px; padding: 10px 12px; margin-bottom: 8px; border-radius: 12px; border: 2px solid var(--fr); background: rgba(255, 255, 255, .02); }
.asset .person { --fr: inherit; width: 58px; height: 58px; border-color: var(--fr); }
.asset-body { flex: 1; min-width: 0; }
.asset-body > b { display: block; font: 700 19px var(--a-serif); color: var(--a-gold-2); }
.asset-body > b small { margin-left: 8px; font: 700 11px var(--a-sans); color: var(--a-muted); }
.asset-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
.asset-cols div { display: grid; gap: 1px; font-size: 12.5px; color: #d9cdb0; align-content: start; }
.asset-cols small { color: var(--a-muted); font-weight: 800; font-size: 11px; }
.asset-note { margin-top: 4px; font-size: 12.5px; font-weight: 700; }

.outpost { display: flex; gap: 12px; align-items: center; padding: 10px 12px; margin-bottom: 8px; border-radius: 12px; border: 1px solid var(--a-line-2); background: rgba(255, 255, 255, .02); cursor: pointer; }
.outpost:hover { border-color: var(--a-line); }
.outpost img { width: 42px; height: 42px; padding: 4px; border-radius: 9px; background: #cfc6b2; }
.outpost div { display: grid; gap: 1px; font-size: 12.5px; color: #d9cdb0; }
.outpost b { font: 700 18px var(--a-serif); color: var(--a-gold-2); }
.outpost .dep { margin-left: 8px; color: #ff9b4a; font: 700 11px var(--a-sans); }
.outpost.empty { justify-content: center; border-style: dashed; color: var(--a-muted); font-size: 12.5px; cursor: default; min-height: 60px; }

.ev { padding: 10px 12px; margin-bottom: 8px; border-radius: 12px; border: 1px solid var(--a-line-2); border-left: 4px solid var(--ec); background: rgba(255, 255, 255, .02); }
.ev-top { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ev-top img { width: 22px; height: 22px; }
.ev-top b { font: 700 18px var(--a-serif); color: var(--a-gold-2); margin-right: 4px; }
.ev-type { color: var(--ec); font-size: 12px; font-weight: 800; }
.ev-dur { padding: 1px 7px; border-radius: 6px; color: #fff; font-size: 11px; font-weight: 700; }
.ev-date { margin-left: auto; color: var(--a-muted); font-size: 12px; font-weight: 700; }
.ev p { margin: 6px 0; font-size: 13px; line-height: 1.5; color: #d9cdb0; font-style: italic; }
.ev-eff { font-size: 12px; color: var(--ec); font-weight: 700; }
.ev-dec { margin-top: 6px; padding: 6px 9px; border-radius: 8px; background: rgba(231, 197, 111, .07); border: 1px solid var(--a-line); font-size: 12.5px; color: var(--a-text); }
.ev-dec small { display: block; color: var(--a-muted); font-weight: 800; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; }
.ev-dec.none { color: #ffb36b; }

/* большой формат: списки в несколько колонок, крупнее шрифт */
.st.wide { font-size: 14px; }
.st.wide h3 { font-size: 26px; }
.st.wide .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 10px; align-items: start; }
.st.wide .cards > * { margin-bottom: 0; }
.st.wide .tiles { grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); }
.st.wide .tile { font-size: 14px; padding: 9px 12px; }
.st.wide .journal { max-width: 920px; }
.st.wide .ev p, .st.wide .ord p { font-size: 14px; }
.st.wide .res { font-size: 14px; }
.st.wide .res td { padding: 8px 12px; }
.st.wide .bcount { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
.st.wide .asset-cols div, .st.wide .job-eff, .st.wide .cats { font-size: 13.5px; }
.hero-link { color: var(--a-gold-2); font-weight: 800; text-decoration: underline dotted; text-underline-offset: 3px; }
.hero-link.sm { font-size: 11px; color: var(--a-gold); }
.hero-link.card { margin-left: 8px; font: 700 11.5px var(--a-sans); color: var(--a-gold); }
.ord .reply-in { margin-top: 4px; }
.ord-price { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ord-price small { color: var(--a-muted); font-weight: 800; font-size: 11px; }
.sugg { margin-bottom: 14px; padding: 10px 12px; border-radius: 14px; border: 1px dashed rgba(159, 208, 255, .45); background: rgba(80, 140, 220, .06); }
.sugg-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; margin-bottom: 8px; }
.sugg-head b { font: 700 18px var(--a-serif); color: #9fd0ff; }
.sugg-head b { flex: 1; }
.sugg-head small { order: 3; flex-basis: 100%; color: var(--a-muted); font-size: 11.5px; font-weight: 600; }
.ev.sg { display: grid; gap: 5px; background: rgba(13, 16, 23, .5); }
.ev.sg input, .ev.sg textarea { min-width: 0; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); font: 500 13px var(--a-sans); resize: vertical; }
.ev.sg p { margin: 2px 0; }
.chk.apply { color: #9fd0ff; }
</style>
