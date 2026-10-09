<template>
  <aside class="info ui-panel" v-if="item">
    <header class="info-head">
      <div class="info-badge" :style="{ color: accent }">
        <img v-if="headImg" :src="headImg" alt="" class="badge-img" />
        <Icon v-else :name="headIcon" :size="22" />
      </div>
      <div class="info-titles">
        <div class="ui-kicker">{{ kindLabel }}</div>
        <h2 class="ui-title">{{ (type === 'labels' ? item.text : type === 'quests' ? item.type : type === 'notes' ? 'Заметка' : item.name) || 'Без названия' }}</h2>
      </div>
      <button class="ui-btn icon ghost" title="Закрыть (Esc)" @click="store.selection = null"><Icon name="close" /></button>
    </header>

    <div class="info-body ui-scroll">
      <!-- ======= Просмотр (видят все) ======= -->
      <div class="chips">
        <span v-if="item.onlyYou" class="ui-chip gold">✦ Видно только тебе</span>
        <span v-else-if="item.hidden" class="ui-chip warn"><Icon name="eyeOff" :size="13" /> Скрыто от игроков<template v-if="item.revealTo?.length"> · открыто {{ item.revealTo.length }}</template></span>
        <template v-if="type === 'cities'">
          <span v-if="item.port" class="ui-chip"><Icon name="anchor" :size="13" /> Порт</span>
          <span v-if="settlement" class="ui-chip">{{ settlePop }} жителей</span>
          <span v-else-if="item.population" class="ui-chip">≈ {{ item.population.toLocaleString('ru-RU') }} жителей</span>
        </template>
        <template v-if="type === 'routes'">
          <div class="ui-field"><span>Цвет линии</span>
            <div class="swatches">
              <button v-for="c in ROUTE_COLORS" :key="c" type="button" class="sw" :class="{ on: form.color === c }" :style="{ background: c }" @click="form.color = c" />
              <input v-model="form.color" type="color" class="sw color-in" title="Свой цвет" />
            </div>
          </div>
          <div class="ui-field"><span>Остановки ({{ form.stops.length }})</span>
            <div class="stops-edit">
              <div v-for="(st, i) in form.stops" :key="st.id" class="st-row" :class="{ on: store.selectedStop === st.id }">
                <div class="st-top" @click="store.selectedStop = st.id">
                  <img :src="markIcon(st.icon).src" alt="" class="st-ico" />
                  <span class="st-n">{{ i + 1 }}</span>
                  <input v-model="st.name" class="ui-input" maxlength="80" @focus="store.selectedStop = st.id" />
                  <button type="button" class="ui-btn icon ghost small" :title="st.hidden ? 'Скрыта от игроков' : 'Видна игрокам'" @click="st.hidden = !st.hidden">
                    <Icon :name="st.hidden ? 'eyeOff' : 'eye'" :size="15" />
                  </button>
                  <button type="button" class="ui-btn icon ghost small danger" title="Удалить остановку" @click="form.stops.splice(i, 1)"><Icon name="delete" :size="15" /></button>
                </div>
                <template v-if="store.selectedStop === st.id">
                  <IconPicker v-model="st.icon" />
                  <textarea v-model="st.description" class="ui-input" rows="2" placeholder="Что здесь происходит (видят все)" />
                </template>
              </div>
            </div>
          </div>
          <button type="button" class="ui-btn small" @click="addStop"><Icon name="plus" :size="15" /> Добавить остановку (клик по линии)</button>
          <div class="hint"><Icon name="help" :size="14" /> Тяни жёлтые точки на карте, чтобы поправить линию. Отряд ставится на маршрут в карточке отряда.</div>
        </template>

        <template v-if="type === 'roads'">
          <span class="ui-chip">{{ fmtKm(roadLen) }}</span>
          <span class="ui-chip">≈ {{ gameDays(roadLen) }} пути</span>
        </template>
        <template v-if="type === 'anomalies'">
          <span class="ui-chip" :class="{ gold: anomaly.active }">{{ anomalyStatus }}</span>
          <span v-if="item.kind === 'zone'" class="ui-chip">радиус ≈ {{ fmtKm(item.radius) }}</span>
        </template>
      </div>

      <button v-if="type === 'cities' && state" class="link-row" @click="select('states', state.id)">
        <i class="swatch" :style="{ background: state.color }" /> {{ state.name }}
      </button>
      <!-- у поселения игроков есть своя мини-карта -->
      <router-link v-if="settlement" :to="`/settlement/${settlement.id}`" class="ui-btn primary small enter-settle">
        <img src="/settlement/medieval-village-01.png" alt="" /> Войти в поселение
      </router-link>

      <!-- отряд: в пути -->
      <div v-if="type === 'parties'" class="journey-box">
        <template v-if="journey">
          <div class="j-line">
            <span>{{ journey.waiting ? 'Выступит' : 'В пути' }}</span>
            <b>{{ journey.waiting ? fmtDateTime(item.journey.startAt) : Math.round(journey.progress * 100) + '%' }}</b>
          </div>
          <div class="ui-progress"><i :style="{ width: journey.progress * 100 + '%' }" /></div>
          <div class="j-line ui-muted">
            <span>Прибытие: {{ fmtDateTime(item.journey.endAt) }}</span>
            <span v-if="!journey.waiting">ещё {{ fmtDuration(item.journey.endAt - store.now) }}</span>
          </div>
          <div v-if="item.journey.label" class="ui-muted">{{ item.journey.label }}</div>
          <!-- точки интереса похода и когда отряд будет у каждой -->
          <ol v-if="item.journey.stops?.length" class="pois">
            <li v-for="(st, i) in item.journey.stops" :key="i" :class="{ passed: journey.progress >= st.s }">
              <b>{{ st.name || (i === item.journey.stops.length - 1 ? 'Цель' : `Точка ${i + 1}`) }}</b>
              <span>{{ journey.progress >= st.s ? 'пройдено' : fmtDateTime(item.journey.startAt + (item.journey.endAt - item.journey.startAt) * st.s) }}</span>
            </li>
          </ol>
          <button class="ui-btn small" @click="replay"><Icon name="play" :size="16" /> Показать маршрут</button>
        </template>
        <div v-else class="ui-muted">Отряд стоит на месте<template v-if="onRoute && curStop">: <b>{{ curStop.name }}</b></template>.</div>
        <div class="ui-muted small">Темп: {{ item.pace ? `${item.pace} км/день` : `по умолчанию (${store.data.settings.paceKmPerDay} км/день)` }}</div>
      </div>

      <!-- отряд поселения: кто идёт, что везёт (секретное задание игрокам не приходит) -->
      <div v-if="type === 'parties' && squadInfo" class="squad-box">
        <div class="sb-h"><b>Отряд поселения «{{ squadInfo.settlement.name }}»</b>
          <router-link :to="{ path: `/settlement/${squadInfo.settlement.id}`, query: { tab: 'squads' } }">открыть →</router-link></div>
        <div class="sb-row"><span>Командир</span><b>{{ squadInfo.commander || '—' }}</b></div>
        <div class="sb-row"><span>Воинов</span><b>{{ squadInfo.total }} · сила {{ squadInfo.power }}</b></div>
        <div class="sb-units"><span v-for="u in squadInfo.units" :key="u.key" class="ui-chip">{{ u.name }}{{ u.count > 1 ? ' ×' + u.count : '' }}</span></div>
        <div v-if="squadInfo.cargo" class="sb-row"><span>Обоз</span><b>{{ squadInfo.cargo }}</b></div>
        <div v-if="squadInfo.task" class="sb-row"><span>Задание</span><b>{{ squadInfo.task }}</b></div>
        <div v-for="m in squadInfo.meters" :key="m.label" class="sb-meter"><span>{{ m.label }}</span><div class="ui-progress"><i :style="{ width: m.value + '%' }" /></div><b>{{ m.value }}%</b></div>
      </div>

      <div v-if="type === 'parties' && master && store.data.routes.length" class="route-box">
        <div class="ui-kicker">Движение по маршруту</div>
        <select v-model="stepRouteId" class="ui-input">
          <option v-for="r in store.data.routes" :key="r.id" :value="r.id">{{ r.name || 'Маршрут' }} · {{ r.stops.length }} ост.</option>
        </select>
        <template v-if="stepRoute">
          <div v-if="!stepRoute.stops.length" class="ui-muted small">На маршруте нет остановок — добавь их в карточке маршрута.</div>
          <template v-else>
            <div class="stop-now">
              <span class="ui-muted">Сейчас:</span>
              <b>{{ onRoute && curStop ? curStop.name : 'не на маршруте' }}</b>
              <span v-if="nextStop" class="ui-muted">→ {{ nextStop.name }}</span>
            </div>
            <div class="ui-row step-row">
              <button type="button" class="ui-btn small" :disabled="!prevStop" title="К предыдущей остановке" @click="step(prevStop)"><Icon name="left" :size="16" /></button>
              <button type="button" class="ui-btn primary small" :disabled="!nextStop && onRoute" @click="step(onRoute ? nextStop : stepRoute.stops[0])">
                <Icon name="play" :size="16" /> {{ onRoute ? 'Дальше' : 'Поставить на начало' }}
              </button>
            </div>
            <div class="ui-row step-row">
              <select v-model="stepMode" class="ui-input">
                <option value="session">Показ на сессии</option>
                <option value="pace">По темпу отряда</option>
                <option value="hours">Своё время</option>
              </select>
              <input v-if="stepMode === 'session'" v-model.number="stepSec" type="number" min="1" max="120" class="ui-input" title="секунд" />
              <input v-if="stepMode === 'hours'" v-model.number="stepHours" type="number" min="0.05" step="0.5" class="ui-input" title="часов" />
            </div>
            <div class="ui-muted small">{{ stepHint }}</div>
            <label class="ui-check"><input v-model="stepFollow" type="checkbox" /> Камера всех игроков следит за отрядом</label>
            <select class="ui-input" :value="''" @change="step(stepRoute.stops.find(st => st.id === $event.target.value)); $event.target.value = ''">
              <option value="" disabled>Перейти к остановке…</option>
              <option v-for="st in stepRoute.stops" :key="st.id" :value="st.id">{{ st.name }}</option>
            </select>
          </template>
        </template>
      </div>
      <button v-if="type === 'parties' && master" class="ui-btn small show-all" @click="showParty"><Icon name="eye" :size="16" /> Показать отряд всем</button>

      <!-- личная заметка -->
      <div v-if="type === 'notes'" class="note-edit">
        <template v-if="item.ownerId === store.me?.id">
          <textarea v-model="noteText" class="ui-input" rows="4" placeholder="Что здесь? «тут торговец обманул»" @change="saveNote({ text: noteText })" />
          <div class="swatches">
            <button v-for="c in NOTE_COLORS" :key="c" type="button" class="sw" :class="{ on: item.color === c }" :style="{ background: c }" @click="saveNote({ color: c })" />
          </div>
          <label class="ui-check"><input type="checkbox" :checked="item.share === 'group'" @change="saveNote({ share: $event.target.checked ? 'group' : 'self' })" /> Показать моему отряду</label>
          <button class="ui-btn danger small" @click="deleteNote"><Icon name="delete" :size="15" /> Удалить заметку</button>
        </template>
        <template v-else>
          <p class="ui-desc">{{ item.text || 'Без текста' }}</p>
          <div class="ui-muted small">Заметка {{ item.ownerName || 'союзника' }}</div>
        </template>
      </div>

      <!-- заказ гильдии -->
      <div v-if="type === 'quests'" class="quest-view">
        <div class="chips">
          <span class="ui-chip" :style="{ background: (QUEST_STATUS[item.status] || {}).color, color: '#fff' }">{{ (QUEST_STATUS[item.status] || {}).label }}</span>
          <span v-if="item.status === 'available'" class="ui-chip" :style="{ color: URGENCY[item.urgency]?.color }">{{ URGENCY[item.urgency]?.label }}</span>
          <span class="ui-chip">ранг: {{ RANKS.find(r => r.key === item.rank)?.label }}</span>
        </div>
        <p class="ui-desc">{{ item.description }}</p>
        <div class="ui-muted small">Награда: {{ rewardText(item.reward) || '—' }}</div>
        <ul v-if="item.tasks?.length" class="q-tasks">
          <li v-for="(t, i) in item.tasks" :key="i" :class="{ main: t.main }">{{ t.text }}</li>
        </ul>
        <div class="ui-row q-btns">
          <router-link :to="{ path: '/wiki', query: { quest: item.id } }" class="ui-btn small primary">Открыть на доске заказов</router-link>
          <button v-if="master" class="ui-btn small" @click="unpinQuest">Убрать с карты</button>
        </div>
      </div>

      <!-- маршрут: остановки (видят все) -->
      <div v-if="type === 'routes'" class="stops-view">
        <div class="ui-muted small">{{ fmtKm(routeLen) }} · ≈ {{ gameDays(routeLen) }} пути</div>
        <ol>
          <li v-for="st in item.stops" :key="st.id" :class="{ on: store.selectedStop === st.id }" @click="store.selectedStop = st.id">
            <img :src="markIcon(st.icon).src" alt="" />
            <div><b>{{ st.name }}</b><div v-if="st.description" class="ui-desc small">{{ st.description }}</div></div>
          </li>
        </ol>
      </div>

      <!-- государство: города -->
      <div v-if="type === 'states'" class="state-cities">
        <div v-if="capital" class="link-row" @click="select('cities', capital.id)"><Icon name="crown" :size="16" /> Столица: {{ capital.name }}</div>
        <div class="ui-muted small">Известных поселений: {{ stateCities.length }}</div>
        <div class="city-list">
          <button v-for="c in stateCities.slice(0, 14)" :key="c.id" class="ui-chip city-chip" @click="select('cities', c.id)">{{ c.name }}</button>
        </div>
      </div>

      <div v-if="type === 'anomalies' && (item.activeFrom || item.activeTo)" class="ui-muted small times">
        <div v-if="item.activeFrom">Появляется: {{ fmtDateTime(item.activeFrom) }}</div>
        <div v-if="item.activeTo">Исчезает: {{ fmtDateTime(item.activeTo) }}</div>
        <div v-if="item.toX != null">Движется по карте</div>
      </div>

      <p v-if="item.description && !master" class="ui-desc">{{ item.description }}</p>
      <p v-else-if="!master" class="ui-muted">Описания пока нет.</p>

      <!-- ======= Редактор мастера ======= -->
      <form v-if="master && form" class="editor" @submit.prevent="save">
        <hr class="ui-divider" />
        <div class="ui-kicker editor-title"><Icon name="edit" :size="14" /> Редактирование</div>

        <label v-if="type !== 'labels'" class="ui-field"><span>Название</span><input v-model="form.name" class="ui-input" maxlength="80" /></label>

        <!-- Подпись: свободная (labels) или подпись территории (states.label) -->
        <template v-if="type === 'labels'">
          <label class="ui-field"><span>Текст</span><input v-model="form.text" class="ui-input" maxlength="120" /></label>
          <label class="ui-field"><span>Стиль</span>
            <select v-model="form.style" class="ui-input">
              <option value="land">Суша (тёмный)</option><option value="sea">Море (светлый курсив)</option>
              <option value="region">Регион (разрядка)</option><option value="danger">Опасность (красный)</option>
            </select>
          </label>
        </template>
        <div v-if="lab" class="label-box">
          <div class="ui-kicker">{{ type === 'states' ? 'Подпись территории на карте' : 'Вид подписи' }}</div>
          <label class="ui-field"><span>Размер: {{ Math.round(lab.size) }}</span>
            <input v-model.number="lab.size" type="range" min="4" max="80" step="0.5" @input="preview" @change="saveLabel" />
          </label>
          <label class="ui-field"><span>Наклон: {{ Math.round(lab.angle) }}°</span>
            <input v-model.number="lab.angle" type="range" min="-180" max="180" @input="preview" @change="saveLabel" />
          </label>
          <label class="ui-field"><span>Изгиб: {{ bendText }}</span>
            <input v-model.number="lab.bend" type="range" min="-0.012" max="0.012" step="0.0002" @input="preview" @change="saveLabel" />
          </label>
          <label class="ui-check"><input v-model="lab.wrap" type="checkbox" @change="preview(); saveLabel()" /> В две строки</label>
          <div class="hint"><Icon name="help" :size="14" /> Подпись можно перетащить мышью прямо на карте. Ползунки сохраняются сразу.</div>
        </div>

        <template v-if="type === 'cities'">
          <div class="ui-row">
            <label class="ui-field"><span>Тип</span>
              <select v-model="form.type" class="ui-input"><option v-for="(t, k) in CITY_TYPES" :key="k" :value="k">{{ t.label }}</option></select>
            </label>
            <label class="ui-field"><span>Население</span><input v-model.number="form.population" type="number" min="0" class="ui-input" /></label>
          </div>
          <label class="ui-field"><span>Государство</span>
            <select v-model="form.stateId" class="ui-input">
              <option :value="null">— нейтральные земли —</option>
              <option v-for="s in store.data.states" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="ui-check"><input v-model="form.port" type="checkbox" /> Порт</label>
        </template>

        <template v-if="type === 'states'">
          <label class="ui-field"><span>Цвет</span><input v-model="form.color" type="color" class="ui-input" /></label>
          <div class="ui-muted small">Цвет здесь — для подсветки и легенды; раскраска самой карты берётся из FMG.</div>
        </template>

        <template v-if="type === 'roads'">
          <label class="ui-field"><span>Тип</span>
            <select v-model="form.type" class="ui-input"><option v-for="(t, k) in ROAD_TYPES" :key="k" :value="k">{{ t.label }}</option></select>
          </label>
          <div class="hint"><Icon name="help" :size="14" /> Тяни жёлтые точки на карте, чтобы изменить трассу.</div>
        </template>

        <template v-if="type === 'anomalies'">
          <div class="ui-row">
            <label class="ui-field"><span>Вид</span>
              <select v-model="form.kind" class="ui-input" @change="form.effect = form.kind === 'zone' ? 'storm' : 'quest'">
                <option value="zone">Зона-аномалия</option><option value="point">Метка</option>
              </select>
            </label>
            <label class="ui-field"><span>{{ form.kind === 'zone' ? 'Эффект' : 'Тип метки' }}</span>
              <select v-model="form.effect" class="ui-input">
                <template v-if="form.kind === 'zone'">
                  <option v-for="(e, k) in ZONE_EFFECTS" :key="k" :value="k">{{ e.label }}</option>
                </template>
                <template v-else>
                  <option v-if="form.effect?.startsWith('u:')" :value="form.effect">Своя: {{ markIcon(form.effect).label }}</option>
                  <optgroup v-for="(list, g) in pointGroups" :key="g" :label="g">
                    <option v-for="[k, e] in list" :key="k" :value="k">{{ e.label }}</option>
                  </optgroup>
                </template>
              </select>
            </label>
          </div>
          <template v-if="form.kind === 'point'">
            <IconPicker v-model="form.effect" />
            <label class="ui-field size-field"><span>Размер на карте: ×{{ (form.size || 1).toFixed(1) }}</span>
              <input v-model.number="form.size" type="range" min="0.5" max="5" step="0.1" />
            </label>
          </template>
          <label v-if="form.kind === 'zone'" class="ui-field"><span>Радиус: {{ fmtKm(form.radius) }}</span>
            <input v-model.number="form.radius" type="range" min="4" max="250" />
          </label>
          <div class="ui-row">
            <label class="ui-field"><span>Появится</span><input v-model="form.activeFromStr" type="datetime-local" class="ui-input" /></label>
            <label class="ui-field"><span>Исчезнет</span><input v-model="form.activeToStr" type="datetime-local" class="ui-input" /></label>
          </div>
          <div class="ui-row move-row">
            <button type="button" class="ui-btn small" @click="pickTarget"><Icon name="arrow" :size="15" /> {{ item.toX != null ? 'Изменить' : 'Задать' }} движение</button>
            <button v-if="item.toX != null" type="button" class="ui-btn small" @click="clearMove">Убрать движение</button>
          </div>
          <div class="hint"><Icon name="help" :size="14" /> Движение идёт от точки «появится» к «исчезнет» — укажи обе даты.</div>
        </template>

        <template v-if="type === 'parties'">
          <div class="ui-field"><span>Цвет</span>
            <div class="swatches">
              <button v-for="c in PARTY_COLORS" :key="c" type="button" class="sw" :class="{ on: form.color === c }" :style="{ background: c }" @click="form.color = c" />
            </div>
          </div>
          <div class="ui-field"><span>Значок</span>
            <div class="swatches">
              <button v-for="ic in PARTY_ICONS" :key="ic" type="button" class="sw icon" :class="{ on: form.icon === ic }" @click="form.icon = ic"><Icon :name="ic" :size="18" /></button>
            </div>
          </div>
          <div class="ui-field"><span>Темп отряда, км за игровой день</span>
            <div class="ui-row">
              <select class="ui-input" :value="PACE_PRESETS.find(p => p.km === form.pace) ? form.pace : (form.pace ? 'custom' : '')"
                      @change="form.pace = $event.target.value === '' ? null : ($event.target.value === 'custom' ? (form.pace || 40) : Number($event.target.value))">
                <option value="">По умолчанию ({{ store.data.settings.paceKmPerDay }})</option>
                <option v-for="p in PACE_PRESETS" :key="p.km" :value="p.km">{{ p.label }} — {{ p.km }}</option>
                <option value="custom">Свой…</option>
              </select>
              <input v-model.number="form.pace" type="number" min="1" class="ui-input pace-in" placeholder="км" />
            </div>
          </div>
          <div v-if="roster.length" class="ui-field"><span>Игроки в отряде (видят общие заметки друг друга)</span>
            <div class="pick-players">
              <button v-for="p in roster" :key="p.id" type="button" class="pp" :class="{ on: form.members.includes(p.id) }" @click="togglePlayer(form.members, p.id)">
                <img v-if="p.avatar" :src="avatarUrl(p.avatar)" alt="" /><i v-else :style="{ background: p.color }" />{{ p.character }}
              </button>
            </div>
          </div>
          <div class="ui-row move-row">
            <button v-if="!item.journey" type="button" class="ui-btn primary small" @click="planJourney"><Icon name="journey" :size="16" /> Отправить в путь</button>
            <template v-else>
              <button type="button" class="ui-btn small" @click="planJourney"><Icon name="journey" :size="16" /> Новый маршрут</button>
              <button type="button" class="ui-btn danger small" @click="stopJourney"><Icon name="stop" :size="16" /> Остановить</button>
            </template>
          </div>
        </template>

        <label v-if="type !== 'labels'" class="ui-field"><span>Описание (видят все)</span><textarea v-model="form.description" class="ui-input" rows="4" /></label>
        <label v-if="type !== 'labels'" class="ui-field"><span><Icon name="lock" :size="12" /> Заметки мастера (игроки не видят)</span><textarea v-model="form.secret" class="ui-input" rows="3" /></label>
        <label class="ui-check"><input v-model="form.hidden" type="checkbox" /> Скрыть от игроков</label>
        <div v-if="form.hidden && 'revealTo' in form && roster.length" class="ui-field reveal">
          <span>…но открыть только им (что узнал их персонаж):</span>
          <div class="pick-players">
            <button v-for="p in roster" :key="p.id" type="button" class="pp" :class="{ on: form.revealTo.includes(p.id) }" @click="togglePlayer(form.revealTo, p.id)">
              <img v-if="p.avatar" :src="avatarUrl(p.avatar)" alt="" /><i v-else :style="{ background: p.color }" />{{ p.character }}
            </button>
          </div>
        </div>

        <div class="editor-actions">
          <button type="submit" class="ui-btn primary" :disabled="saving"><Icon name="check" :size="16" /> Сохранить</button>
          <button v-if="type !== 'states'" type="button" class="ui-btn danger" @click="remove"><Icon name="delete" :size="16" /> Удалить</button>
        </div>
        <div v-if="['cities', 'anomalies', 'parties'].includes(type)" class="hint"><Icon name="help" :size="14" /> Объект можно перетащить мышью прямо на карте.</div>
      </form>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import Icon from './Icon.vue'
import IconPicker from './IconPicker.vue'
import { store, isMaster, act, findSelected, fmtKm, fmtDuration, fmtDateTime, km, toast, markIcon, sendFollow, avatarUrl } from './store.js'
import { CITY_TYPES, ROAD_TYPES, ZONE_EFFECTS, POINT_EFFECTS, PARTY_ICONS, PARTY_COLORS, PACE_PRESETS, ROUTE_COLORS, QUEST_STATUS, RANKS, GUILDS } from '../shared/catalog.js'
import { URGENCY, rewardText } from '../shared/quests.js'
import { polyLength, journeyState, anomalyState } from '../shared/geo.js'
import { squadUnits, power, cargoTotal, cargoOf } from '../shared/army.js'

const master = isMaster
const item = computed(() => findSelected())
const type = computed(() => store.selection?.type)
const select = (t, id) => { store.selection = { type: t, id } }

const KIND = { cities: 'Поселение', states: 'Народ / государство', roads: 'Дорога', anomalies: 'Аномалия', parties: 'Отряд', labels: 'Подпись', routes: 'Маршрут', quests: 'Заказ гильдии', notes: 'Личная заметка' }

// метки по разделам легенды
const pointGroups = Object.entries(POINT_EFFECTS).reduce((acc, [k, e]) => {
  (acc[e.group] ||= []).push([k, e])
  return acc
}, {})
const headImg = computed(() => {
  const it = item.value
  if (type.value === 'anomalies' && it.kind === 'point') return markIcon(it.effect).src
  if (type.value === 'cities' && it.type === 'capital') return '/icons/elven-castle.png'
  return null
})
const kindLabel = computed(() => {
  const it = item.value
  if (type.value === 'cities') return CITY_TYPES[it.type]?.label || 'Поселение'
  if (type.value === 'roads') return ROAD_TYPES[it.type]?.label || 'Дорога'
  if (type.value === 'anomalies') return it.kind === 'zone' ? (ZONE_EFFECTS[it.effect]?.label || 'Аномалия') : markIcon(it.effect).label
  return KIND[type.value]
})
const headIcon = computed(() => {
  const it = item.value
  if (type.value === 'cities') return CITY_TYPES[it.type]?.icon || 'home'
  if (type.value === 'states') return 'states'
  if (type.value === 'roads') return 'roadType'
  if (type.value === 'anomalies') return it.kind === 'zone' ? 'zone' : POINT_EFFECTS[it.effect]?.icon || 'anomaly'
  if (type.value === 'parties') return it.icon || 'sword'
  if (type.value === 'labels') return 'label'
  if (type.value === 'routes') return 'ship'
  if (type.value === 'quests' || type.value === 'notes') return 'note'
  return 'map'
})
const accent = computed(() => {
  const it = item.value
  if (type.value === 'quests') return GUILDS.find(g => g.name === it.guild)?.color
  if (type.value === 'states' || type.value === 'parties') return it.color
  if (type.value === 'anomalies') return ((it.kind === 'zone' ? ZONE_EFFECTS : POINT_EFFECTS)[it.effect] || {}).color
  return 'var(--gold)'
})

const settlement = computed(() => (type.value === 'cities' ? store.data.settlements?.find(s => s.cityId === item.value.id) : null))
// у поселения игроков жителей считает само поселение
const settlePop = computed(() => (settlement.value?.races || []).reduce((n, r) => n + (r.male || 0) + (r.female || 0) + (r.kids || 0), 0))
const state = computed(() => (type.value === 'cities' && item.value.stateId ? store.data.states.find(s => s.id === item.value.stateId) : null))
const stateCities = computed(() => (type.value === 'states' ? store.data.cities.filter(c => c.stateId === item.value.id) : []))
const capital = computed(() => (type.value === 'states' ? store.data.cities.find(c => c.id === item.value.capitalId) : null))
const roadLen = computed(() => (type.value === 'roads' ? polyLength(item.value.points) : 0))
const routeLen = computed(() => (type.value === 'routes' ? polyLength(item.value.points) : 0))
const journey = computed(() => (type.value === 'parties' ? journeyState(item.value.journey, store.now) : null))
// отряд на карте — это отряд поселения: показываем, кто в нём и что везёт
const squadInfo = computed(() => {
  const link = type.value === 'parties' && item.value?.squad
  if (!link) return null
  const st = (store.data.settlements || []).find(x => x.id === link.settlementId)
  const q = st?.army?.squads?.find(x => x.id === link.squadId)
  if (!q) return null
  const units = squadUnits(st, q, store.data.heroes || [])
  const cmd = units.find(u => u.line === 'cmd')
  const cargo = cargoOf(q).filter(Boolean).map(c => `${c.label} ×${c.count}`).join(', ')
  return {
    settlement: st, commander: cmd?.name, total: units.reduce((n, u) => n + u.count, 0), power: units.reduce((n, u) => n + power(u), 0),
    units: units.filter(u => u.line !== 'cmd').map((u, i) => ({ key: i, name: u.name, count: u.count })),
    cargo: cargo ? `${cargo} · везёт ${cargoTotal(q)}` : '', task: q.task,
    meters: [{ label: 'Задание', value: q.taskProgress ?? 0 }, { label: 'Готовность', value: q.ready ?? 100 }, { label: 'Усталость', value: q.fatigue ?? 0 }]
  }
})
const anomaly = computed(() => (type.value === 'anomalies' ? anomalyState(item.value, store.now) : {}))
const anomalyStatus = computed(() => (anomaly.value.upcoming ? 'Ещё не проявилась' : anomaly.value.expired ? 'Угасла' : 'Активна'))

function gameDays(px) {
  const d = km(px) / (store.data.settings.paceKmPerDay || 38)
  return d < 1 ? `${Math.max(1, Math.round(d * 24))} ч` : `${d.toFixed(1)} дн.`
}

/* ---------------- Форма ---------------- */
const form = ref(null)
const saving = ref(false)
const toLocal = ms => {
  if (ms == null) return ''
  const d = new Date(ms)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const fromLocal = s => (s ? new Date(s).getTime() : null)

const FIELDS = {
  cities: ['name', 'type', 'population', 'stateId', 'port', 'description', 'secret', 'hidden', 'revealTo'],
  states: ['name', 'color', 'description', 'secret', 'hidden', 'revealTo'],
  roads: ['name', 'type', 'description', 'hidden', 'revealTo'],
  anomalies: ['name', 'kind', 'effect', 'size', 'radius', 'description', 'secret', 'hidden', 'revealTo'],
  parties: ['name', 'color', 'icon', 'pace', 'members', 'description', 'secret', 'hidden', 'revealTo'],
  routes: ['name', 'color', 'stops', 'description', 'hidden', 'revealTo'],
  labels: ['text', 'style', 'hidden', 'revealTo']
}

/* ---------------- Подписи: ползунки меняют карту сразу и сохраняются при отпускании ---------------- */
const lab = ref(null)
const LABEL_KEYS = ['size', 'angle', 'bend', 'wrap']
watch(() => [store.selection?.type, store.selection?.id, master.value], () => {
  const it = item.value
  if (!it || !master.value) { lab.value = null; return }
  if (type.value === 'states') lab.value = it.label ? { ...it.label } : null
  else if (type.value === 'labels') lab.value = Object.fromEntries(LABEL_KEYS.map(k => [k, it[k] ?? 0]))
  else lab.value = null
}, { immediate: true })

const bendText = computed(() => {
  const b = lab.value?.bend || 0
  return Math.abs(b) < 0.0002 ? 'прямая' : (b > 0 ? 'дугой вверх ' : 'дугой вниз ') + Math.round(Math.abs(b) * 10000)
})

function preview() {
  const it = item.value
  if (!it || !lab.value) return
  if (type.value === 'states') it.label = { ...it.label, ...lab.value }
  else Object.assign(it, lab.value)
}

async function saveLabel() {
  const it = item.value
  if (!it || !lab.value) return
  const body = type.value === 'states' ? { label: it.label } : { ...lab.value }
  await act('PATCH', `/api/${type.value}/${it.id}`, body).catch(() => {})
}

function resetForm() {
  const it = item.value
  if (!it || !master.value || !FIELDS[type.value]) { form.value = null; return }
  const f = {}
  for (const k of FIELDS[type.value]) f[k] = it[k] ?? (k === 'secret' || k === 'description' ? '' : it[k])
  // списки — копией, чтобы правки не утекали в данные до «Сохранить»
  for (const k of ['revealTo', 'members']) if (k in f || FIELDS[type.value].includes(k)) f[k] = [...(it[k] || [])]
  if (type.value === 'routes') f.stops = it.stops.map(st => ({ ...st }))
  if (type.value === 'anomalies') f.size = it.size || 1
  if (type.value === 'anomalies') {
    f.activeFromStr = toLocal(it.activeFrom)
    f.activeToStr = toLocal(it.activeTo)
  }
  form.value = f
}
watch(() => [store.selection?.type, store.selection?.id, master.value], resetForm, { immediate: true })

async function save() {
  const body = {}
  for (const k of FIELDS[type.value]) body[k] = form.value[k]
  if (type.value === 'anomalies') {
    body.activeFrom = fromLocal(form.value.activeFromStr)
    body.activeTo = fromLocal(form.value.activeToStr)
    if (body.activeFrom && body.activeTo && body.activeTo <= body.activeFrom) return toast('«Исчезнет» должно быть позже «появится»', 'error')
  }
  saving.value = true
  try {
    await act('PATCH', `/api/${type.value}/${item.value.id}`, body, 'Сохранено')
  } catch { /* тост */ } finally {
    saving.value = false
  }
}

async function remove() {
  if (!confirm(`Удалить «${item.value.name || 'объект'}»? Это нельзя отменить.`)) return
  const { type: t, id } = store.selection
  await act('DELETE', `/api/${t}/${id}`, undefined, 'Удалено').catch(() => {})
  store.selection = null
}

function pickTarget() {
  store.pick = { purpose: 'anomalyTarget', id: item.value.id }
  toast('Кликни на карте, куда движется аномалия')
}
const clearMove = () => act('PATCH', `/api/anomalies/${item.value.id}`, { toX: null, toY: null }, 'Движение убрано').catch(() => {})

// последний выбранный тип метки — им ставятся следующие
watch(() => form.value?.effect, e => { if (e && type.value === 'anomalies' && form.value.kind === 'point') store.lastMark = e })

/* ---------------- Маршрут ---------------- */
function addStop() {
  store.pick = { purpose: 'routeStop', id: item.value.id }
  toast('Кликни на линию маршрута — там встанет остановка')
}
// новые остановки приходят с сервера — дописываем их в открытую форму, не теряя правок
watch(() => (type.value === 'routes' ? item.value?.stops.map(st => st.id).join() : ''), () => {
  if (type.value !== 'routes' || !form.value) return
  const have = new Set(form.value.stops.map(st => st.id))
  for (const st of item.value.stops) if (!have.has(st.id)) form.value.stops.push({ ...st })
  form.value.stops.sort((a, b) => a.s - b.s)
})

/* ---------------- Отряд на маршруте ---------------- */
const stepRouteId = ref(null)
watch(() => [store.selection?.id, store.data.routes.length], () => {
  if (type.value !== 'parties') return
  stepRouteId.value = item.value?.route?.routeId || stepRouteId.value || store.data.routes[0]?.id || null
}, { immediate: true })
const stepRoute = computed(() => store.data.routes.find(r => r.id === stepRouteId.value) || null)
const onRoute = computed(() => type.value === 'parties' && item.value.route?.routeId === stepRouteId.value)
const curStop = computed(() => (onRoute.value ? stepRoute.value?.stops.find(st => st.id === item.value.route.stop) : null))
const curIdx = computed(() => (curStop.value ? stepRoute.value.stops.indexOf(curStop.value) : -1))
const nextStop = computed(() => (onRoute.value && curIdx.value >= 0 ? stepRoute.value.stops[curIdx.value + 1] || null : null))
const prevStop = computed(() => (onRoute.value && curIdx.value > 0 ? stepRoute.value.stops[curIdx.value - 1] : null))

const stepMode = ref('session')
const stepSec = ref(6)
const stepHours = ref(2)
const stepFollow = ref(true)
const partyPace = () => item.value.pace || store.data.settings.paceKmPerDay || 38
function stepDuration(target) {
  if (stepMode.value === 'session') return Math.max(1, stepSec.value || 6) * 1000
  if (stepMode.value === 'hours') return Math.max(0.05, stepHours.value || 1) * 3600000
  const from = curStop.value
  const lenPx = from && target ? Math.abs(target.s - from.s) * polyLength(stepRoute.value.points) : 0
  return Math.max(1000, (km(lenPx) / partyPace()) * (store.data.settings.realHoursPerGameDay || 24) * 3600000)
}
const stepHint = computed(() => {
  if (!nextStop.value) return ''
  const ms = stepDuration(nextStop.value)
  return stepMode.value === 'session' ? `Отряд проплывёт до «${nextStop.value.name}» за ${Math.round(ms / 1000)} с — все увидят анимацию`
    : `В реальном времени: ${fmtDuration(ms)}`
})
async function step(target) {
  if (!target) return
  const body = { routeId: stepRoute.value.id, toStop: target.id, durationMs: Math.round(stepDuration(target)), follow: stepFollow.value }
  try {
    const p = await act('POST', `/api/parties/${item.value.id}/route-step`, body)
    if (stepFollow.value && p.journey) store.follow = { mode: 'party', partyId: p.id, until: p.journey.endAt + 1500 }
  } catch { /* тост */ }
}
function showParty() {
  const p = item.value
  const until = (p.journey && p.journey.endAt > store.now ? p.journey.endAt : store.now) + 3000
  sendFollow({ mode: 'party', partyId: p.id, until })
  store.follow = { mode: 'party', partyId: p.id, until }
  toast('Камера всех игроков летит к отряду')
}

const unpinQuest = () => act('PATCH', `/api/quests/${item.value.id}`, { loc: null }, 'Заказ убран с карты').catch(() => {})

/* ---------------- Игроки: секреты, отряд, заметки ---------------- */
const roster = computed(() => store.data.roster || [])
function togglePlayer(list, id) {
  const i = list.indexOf(id)
  i === -1 ? list.push(id) : list.splice(i, 1)
}
const NOTE_COLORS = ['#ffd166', '#ff9a4e', '#ff7ac0', '#7ee06a', '#4fd8ff', '#c47aff', '#f2f2f2']
const noteText = ref('')
watch(() => (type.value === 'notes' ? item.value?.id : null), () => { noteText.value = item.value?.text || '' }, { immediate: true })
const saveNote = patch => act('PATCH', `/api/notes/${item.value.id}`, patch).catch(() => {})
async function deleteNote() {
  await act('DELETE', `/api/notes/${item.value.id}`, undefined, 'Заметка удалена').catch(() => {})
  store.selection = null
}

function planJourney() {
  store.tool = 'select'
  store.journeyPlan = { partyId: item.value.id, waypoints: [], byRoad: true }
}
const stopJourney = () => act('POST', `/api/parties/${item.value.id}/stop`, {}, 'Отряд остановлен').catch(() => {})

function replay() {
  const j = item.value.journey
  store.replay = { path: j.path, t0: Date.now(), duration: Math.min(9000, 2500 + j.path.length * 120), color: item.value.color }
}
</script>

<style scoped>
.pois { list-style: none; margin: 6px 0; padding: 0; display: grid; gap: 3px; font-size: 12.5px; }
.pois li { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; border-bottom: 1px dashed rgba(255, 255, 255, .08); }
.pois li.passed { opacity: .5; }
.pois span { color: var(--muted, #9d978b); }
.squad-box { display: grid; gap: 5px; margin-top: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .06); font-size: 12.5px; }
.sb-h { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.sb-h b { color: var(--gold-2, #f3dc9e); }
.sb-h a { color: var(--gold-2, #f3dc9e); font-size: 12px; font-weight: 700; }
.sb-row { display: flex; justify-content: space-between; gap: 10px; }
.sb-row span, .sb-meter span { color: var(--muted, #9d978b); }
.sb-units { display: flex; flex-wrap: wrap; gap: 4px; }
.sb-meter { display: grid; grid-template-columns: 78px 1fr 38px; gap: 6px; align-items: center; }
.sb-meter b { text-align: right; }
.info { position: absolute; top: 76px; right: 16px; bottom: 16px; width: 360px; display: flex; flex-direction: column; overflow: hidden; z-index: 20; }
.info-head { display: flex; align-items: center; gap: 12px; padding: 16px 14px 12px 16px; border-bottom: 1px solid var(--line-2); }
.info-badge { width: 42px; height: 42px; flex: none; border-radius: 12px; display: grid; place-items: center; background: rgba(255, 255, 255, 0.06); border: 1px solid currentColor; }
.info-titles { flex: 1; min-width: 0; }
.info-titles h2 { margin: 0; font-size: 25px; line-height: 1.1; overflow-wrap: anywhere; }
.info-body { padding: 14px 16px 18px; flex: 1; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.chips:empty { display: none; }
.link-row { display: flex; align-items: center; gap: 8px; background: none; border: 0; color: var(--gold-2); font: 700 13.5px var(--sans); padding: 4px 0; cursor: pointer; margin-bottom: 6px; }
.link-row:hover { text-decoration: underline; }
.swatch { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
.small { font-size: 12.5px; }
.times { margin-bottom: 10px; display: grid; gap: 2px; }
.journey-box { display: grid; gap: 8px; padding: 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--line-2); margin-bottom: 12px; }
.j-line { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; }
.state-cities { margin-bottom: 12px; }
.enter-settle { display: flex; justify-content: center; gap: 8px; margin: 4px 0 12px; text-decoration: none; }
.enter-settle img { width: 20px; height: 20px; padding: 1px; border-radius: 5px; background: #d6d2c8; }
.city-list { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.city-chip { border: 0; cursor: pointer; }
.city-chip:hover { background: rgba(231, 197, 111, 0.2); }
.editor-title { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; color: var(--gold); }
.editor-actions { display: flex; gap: 8px; margin-top: 4px; }
.editor-actions .primary { flex: 1; }
.hint { display: flex; gap: 6px; align-items: flex-start; font-size: 12px; color: var(--muted); margin: 6px 0 10px; }
.move-row { margin-bottom: 8px; flex-wrap: wrap; }
.move-row > * { flex: 0 1 auto; }
.swatches { display: flex; flex-wrap: wrap; gap: 6px; }
.sw { width: 28px; height: 28px; border-radius: 8px; border: 2px solid transparent; cursor: pointer; display: grid; place-items: center; background: rgba(255, 255, 255, 0.06); color: var(--text); }
.q-tasks { margin: 8px 0; padding-left: 18px; font-size: 13px; }
.q-tasks li.main { color: var(--ok); }
.q-btns { margin: 10px 0; flex-wrap: wrap; }
.q-btns > * { flex: 0 1 auto; text-decoration: none; }
.pick-players { display: flex; flex-wrap: wrap; gap: 5px; }
.pp { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px 0 4px; border-radius: 99px; border: 1px solid var(--line-2); background: rgba(255, 255, 255, .04); color: var(--muted); font: 600 12px var(--sans); cursor: pointer; }
.pp img, .pp i { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; }
.pp.on { color: var(--gold-2); border-color: rgba(231, 197, 111, .5); background: rgba(231, 197, 111, .14); }
.reveal { margin-top: -4px; }
.note-edit { display: grid; gap: 10px; margin-bottom: 12px; }
.badge-img { max-width: 32px; max-height: 32px; }
.route-box { display: grid; gap: 8px; padding: 12px; border-radius: 12px; background: rgba(255, 74, 61, 0.06); border: 1px solid rgba(255, 74, 61, 0.25); margin-bottom: 10px; }
.route-box .ui-kicker { color: #ff9b8f; }
.route-box .ui-check { margin: 0; }
.stop-now { display: flex; flex-wrap: wrap; gap: 6px; font-size: 13px; }
.step-row { gap: 8px; }
.step-row .primary { flex: 3; }
.show-all { margin-bottom: 12px; }
.stops-view ol { list-style: none; margin: 8px 0 12px; padding: 0; display: grid; gap: 4px; }
.stops-view li { display: flex; gap: 10px; align-items: flex-start; padding: 6px 8px; border-radius: 9px; cursor: pointer; }
.stops-view li.on, .stops-view li:hover { background: rgba(255, 255, 255, 0.05); }
.stops-view img { width: 22px; height: 22px; flex: none; }
.stops-edit { display: grid; gap: 6px; }
.st-row { display: grid; gap: 6px; padding: 6px; border-radius: 10px; border: 1px solid var(--line-2); }
.st-row.on { border-color: rgba(231, 197, 111, 0.45); background: rgba(231, 197, 111, 0.05); }
.st-top { display: flex; align-items: center; gap: 6px; }
.st-top .ui-input { min-height: 32px; padding: 5px 8px; }
.st-top .ui-btn { flex: none; width: 30px; height: 30px; }
.st-ico { width: 24px; height: 24px; flex: none; }
.st-n { font: 800 11px var(--sans); color: var(--muted); width: 14px; text-align: center; flex: none; }
.color-in { padding: 0; overflow: hidden; }
.size-field { margin-top: 10px; }
.pace-in { max-width: 90px; }
.label-box { padding: 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--line-2); margin-bottom: 14px; }
.label-box .ui-kicker { margin-bottom: 10px; color: var(--gold); }
.sw.on { border-color: #fff; box-shadow: 0 0 0 2px rgba(231, 197, 111, 0.5); }

@media (max-width: 760px) {
  .info { top: auto; left: 8px; right: 8px; bottom: 8px; width: auto; max-height: 58vh; }
}
</style>
