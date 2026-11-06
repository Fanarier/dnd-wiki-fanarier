<template>
  <div ref="box" class="sm" :class="[{ grabbing: panning }, toolClass]" @wheel.prevent="onWheel" @mousedown="e => e.button === 1 && e.preventDefault()" @contextmenu.prevent
       @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @pointerleave="onLeave" @dblclick="onDbl">
    <!-- местность: плитки на холсте под всем остальным -->
    <canvas ref="cv" class="sm-tiles" />
    <svg v-if="size.w" :width="size.w" :height="size.h" class="sm-svg">
      <defs>
        <!-- туман: облачная текстура постоянного экранного размера, края разведанного размыты -->
        <pattern id="sm-fog" patternUnits="userSpaceOnUse" width="384" height="384" :patternTransform="`scale(${px})`">
          <rect width="384" height="384" fill="#4a4f52" />
          <image :href="fogUrl" width="384" height="384" opacity=".32" />
        </pattern>
        <filter id="sm-soft" filterUnits="userSpaceOnUse" :x="vb.x" :y="vb.y" :width="vb.w" :height="vb.h"><feGaussianBlur :stdDeviation="fogBlur" /></filter>
        <mask id="sm-fog-mask" maskUnits="userSpaceOnUse" :x="vb.x" :y="vb.y" :width="vb.w" :height="vb.h">
          <rect :x="vb.x" :y="vb.y" :width="vb.w" :height="vb.h" fill="#fff" />
          <g filter="url(#sm-soft)" fill="#000">
            <template v-for="(e, i) in settlement.explored" :key="i">
              <circle v-if="e.r" :cx="e.x" :cy="e.y" :r="e.r" />
              <polygon v-else-if="e.points" :points="e.points.map(p => p.join(',')).join(' ')" />
            </template>
          </g>
        </mask>
        <pattern id="sm-cobble" patternUnits="userSpaceOnUse" width="2.4" height="2.4">
          <rect width="2.4" height="2.4" fill="#86817a" />
          <rect x="0.1" y="0.1" width="1.05" height="1.0" rx="0.25" fill="#aaa598" />
          <rect x="1.25" y="0.1" width="1.05" height="1.0" rx="0.25" fill="#a39e92" />
          <rect x="0.65" y="1.25" width="1.05" height="1.0" rx="0.25" fill="#b0ab9e" />
          <rect x="-0.5" y="1.25" width="1.05" height="1.0" rx="0.25" fill="#a39e92" />
          <rect x="1.8" y="1.25" width="1.05" height="1.0" rx="0.25" fill="#aaa598" />
        </pattern>
        <pattern id="sm-furrows" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(-8)">
          <rect width="3" height="3" fill="#c9b85a" />
          <rect width="3" height="1.1" fill="#a6963e" />
        </pattern>
        <filter id="sm-glow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" :stdDeviation="5 * px" flood-color="#ffe9a8" flood-opacity="1" /></filter>
      </defs>

      <g :transform="`translate(${view.x} ${view.y}) scale(${view.k})`">
        <!-- край карты -->
        <rect x="0" y="0" :width="WORLD" :height="WORLD" class="sm-world" vector-effect="non-scaling-stroke" />

        <!-- дороги: слоями по всем сразу (тени → кромки → покрытие с разметкой), главная ложится поверх второстепенной,
             поэтому перекрёстки сливаются; там, где дорога упирается в другую, — плавный раструб -->
        <g class="sm-roads">
          <defs>
            <mask v-for="r in roadsDraw.filter(x => x.bands.length)" :id="'rm-' + r.id" :key="'mk' + r.id" maskUnits="userSpaceOnUse" x="-3000" y="-3000" :width="WORLD + 6000" :height="WORLD + 6000">
              <rect x="-3000" y="-3000" :width="WORLD + 6000" :height="WORLD + 6000" fill="#fff" />
              <path v-for="(b, i) in r.bands" :key="i" :d="b.d" fill="none" stroke="#000" :stroke-width="b.w" stroke-linecap="butt" />
            </mask>
          </defs>
          <path v-for="r in roadsDraw.filter(x => isSel('road', x.id))" :key="'g' + r.id" :d="r.d" class="rd" stroke="rgba(255, 236, 170, .55)" :stroke-width="r.st.edge.w + 8 * px" />
          <template v-for="r in roadsDraw" :key="'s' + r.id">
            <path :d="r.d" class="rd bt" :stroke="r.st.shadow.c" :stroke-width="r.st.shadow.w" :mask="r.mask" />
            <circle v-for="(c, i) in r.caps" :key="i" :cx="c[0]" :cy="c[1]" :r="r.st.shadow.w / 2" :fill="r.st.shadow.c" />
          </template>
          <template v-for="r in roadsDraw" :key="'e' + r.id">
            <path v-for="(f, i) in r.flares" :key="i" :d="f" :fill="r.st.edge.c" :stroke="r.st.edge.c" :stroke-width="r.st.edge.w - r.st.fill.w" stroke-linejoin="round" />
            <path :d="r.d" class="rd bt" :stroke="r.st.edge.c" :stroke-width="r.st.edge.w" :mask="r.mask" />
            <circle v-for="(c, i) in r.caps" :key="'c' + i" :cx="c[0]" :cy="c[1]" :r="r.st.edge.w / 2" :fill="r.st.edge.c" />
          </template>
          <!-- покрытие и разметка — дорога за дорогой: главная (и та, в которую упираются) ложится поверх -->
          <template v-for="r in roadsDraw" :key="'f' + r.id">
            <path v-for="(f, i) in r.flares" :key="i" :d="f" :fill="r.st.fill.c" />
            <path :d="r.d" class="rd bt" :stroke="r.st.fill.c" :stroke-width="r.st.fill.w" :mask="r.mask" />
            <circle v-for="(c, i) in r.caps" :key="'c' + i" :cx="c[0]" :cy="c[1]" :r="r.st.fill.w / 2" :fill="r.st.fill.c" />
            <path v-for="(l, i) in r.marks" :key="'x' + i" :d="l.d" class="rd bt" :stroke="l.c" :stroke-width="l.w" :stroke-dasharray="l.dash" :stroke-dashoffset="l.dashOff" :mask="r.mask" />
          </template>
          <path v-for="r in roadsDraw" :key="'h' + r.id" :d="r.d" class="sm-road-hit" :class="{ movable: editRoad?.id === r.id }" :data-lid="r.id" :stroke-width="Math.max(ROAD_TYPES[r.type]?.w || 4, 14 * px)"
                @pointerenter="hover = { kind: 'road', item: r }" @pointerleave="hover = null" @click.stop="pick('road', r)" />
        </g>
        <!-- стены: построенное — частокол или камень, ещё не построенное — пунктиром; проёмы ворот и калиток вырезаны -->
        <g class="sm-walls">
          <!-- полоса для щелчка по стене — под воротами и башнями, чтобы их можно было тянуть -->
          <path v-for="w in wallsDraw" :key="'h' + w.id" :d="w.dAll" class="sm-road-hit" :class="{ movable: editRoad?.id === w.id }" :data-lid="w.id" :stroke-width="Math.max(w.w, 14 * px)"
                @pointerenter="hover = { kind: 'wall', item: w }" @pointerleave="hover = null" @click.stop="pick('wall', w)" />
          <template v-for="w in wallsDraw" :key="w.id">
            <path v-if="isSel('wall', w.id)" :d="w.dAll" class="rd" stroke="rgba(255, 236, 170, .55)" :stroke-width="w.w + 8 * px" />
            <path v-for="(d, i) in w.plan" :key="'p' + i" :d="d" class="rd sm-wall-plan" :stroke-width="w.w" :stroke-dasharray="`${3 * px} ${2.5 * px}`" />
            <!-- тень, тело, верх: частокол — брёвна торцами, камень — кладка и зубцы снаружи -->
            <path v-for="(d, i) in w.done" :key="'s' + i" :d="d" class="rd" :stroke="'rgba(0, 0, 0, .28)'" :stroke-width="w.w * 1.15" :transform="`translate(${w.sh} ${w.sh * 1.4})`" />
            <path v-for="(d, i) in w.done" :key="'e' + i" :d="d" class="rd" :stroke="w.st.edge" :stroke-width="w.w + w.st.edgeW" />
            <path v-for="(d, i) in w.done" :key="'b' + i" :d="d" class="rd" :stroke="w.st.body" :stroke-width="w.w" />
            <template v-if="w.near && w.type !== 'stone'">
              <path v-for="(d, i) in w.done" :key="'l' + i" :d="d" class="rd logs" stroke="#8a5f33" :stroke-width="w.w * 0.86" :stroke-dasharray="`0.001 ${w.w * 0.9}`" />
              <path v-for="(d, i) in w.done" :key="'h' + i" :d="d" class="rd logs" stroke="#c09257" :stroke-width="w.w * 0.34" :stroke-dasharray="`0.001 ${w.w * 0.9}`" :transform="`translate(${-w.w * 0.12} ${-w.w * 0.12})`" />
              <path v-for="(d, i) in w.done" :key="'r' + i" :d="d" class="rd logs" stroke="#5a3a1c" :stroke-width="w.w * 0.12" :stroke-dasharray="`0.001 ${w.w * 0.9}`" />
            </template>
            <template v-else-if="w.near">
              <path v-for="(d, i) in w.done" :key="'k' + i" :d="d" class="rd" stroke="#b3aea2" :stroke-width="w.w * 0.46" />
              <path v-for="(d, i) in w.done" :key="'j' + i" :d="d" class="rd" stroke="#6f6b63" :stroke-width="w.w" stroke-dasharray="0.12 1.35" />
              <path v-for="(d, i) in w.merlons" :key="'m' + i" :d="d" class="rd" stroke="#d3cec1" :stroke-width="w.w * 0.26" stroke-dasharray="0.95 0.6" />
            </template>
            <template v-else><path v-for="(d, i) in w.done" :key="'t' + i" :d="d" class="rd" :stroke="w.st.top" :stroke-width="w.w * 0.55" :stroke-dasharray="w.st.dash" /></template>
            <g v-for="f in w.feats" :key="f.id" class="sm-wfeat" :class="[f.kind, { plan: !f.built, movable: master && !toolActive }]" :transform="`translate(${f.x} ${f.y}) rotate(${f.deg})`" :data-feat="f.id" :data-wall="w.id"
               @pointerenter="hover = { kind: 'wallFeature', item: f, wall: w }" @pointerleave="hover = null" @click.stop="pick('wall', w)">
              <!-- невидимая область захвата: за ворота и башню легко ухватиться -->
              <rect class="sm-feat-hit" :x="-Math.max(f.len || f.side, 14 * px) / 2 - 1" :y="-Math.max(f.post * 1.5, f.side / 2, 8 * px)" :width="Math.max(f.len || f.side, 14 * px) + 2" :height="Math.max(f.post * 3, f.side, 16 * px)" />
              <!-- башня: деревянная — квадрат с шатровой крышей, каменная — круглая с зубцами -->
              <template v-if="f.kind === 'tower' && w.type === 'stone'">
                <circle :cx="w.sh" :cy="w.sh * 1.4" :r="f.side / 2 * 1.05" fill="rgba(0, 0, 0, .3)" />
                <circle :r="f.side / 2" :fill="w.st.body" :stroke="w.st.edge" :stroke-width="Math.max(0.3, 1.2 * px)" />
                <circle :r="f.side * 0.42" fill="none" stroke="#d3cec1" :stroke-width="f.side * 0.13" :stroke-dasharray="`${f.side * 0.2} ${f.side * 0.13}`" />
                <circle :r="f.side * 0.3" fill="#a9a498" stroke="#6f6b63" :stroke-width="Math.max(0.1, 0.6 * px)" />
              </template>
              <template v-else-if="f.kind === 'tower'">
                <rect :x="-f.side / 2 + w.sh" :y="-f.side / 2 + w.sh * 1.4" :width="f.side" :height="f.side" fill="rgba(0, 0, 0, .3)" />
                <rect :x="-f.side / 2" :y="-f.side / 2" :width="f.side" :height="f.side" :rx="f.side / 14" fill="#5a3a1c" :stroke="w.st.edge" :stroke-width="Math.max(0.3, 1.2 * px)" />
                <path v-for="(t, i) in ROOF" :key="i" :d="t.d(f.side * 0.46)" :fill="t.c" />
                <circle r="0.25" fill="#3a2614" />
              </template>
              <template v-else>
                <rect v-for="sx in [-1, 1]" :key="'sh' + sx" :x="sx * f.len / 2 - f.post / 2 + w.sh" :y="-f.post / 2 + w.sh * 1.4" :width="f.post" :height="f.post" fill="rgba(0, 0, 0, .28)" />
                <!-- створки: две у ворот, одна у калитки; доски поперёк -->
                <g v-if="w.near">
                  <rect v-for="(l, i) in f.leaves" :key="'lf' + i" :x="l.x" :y="-f.leafT / 2" :width="l.w" :height="f.leafT" fill="#8a5a2c" stroke="#3a2614" :stroke-width="0.08" />
                  <line v-for="(l, i) in f.leaves" :key="'pl' + i" :x1="l.x" :x2="l.x + l.w" y1="0" y2="0" stroke="#5e3d1c" :stroke-width="f.leafT" :stroke-dasharray="`0.06 ${0.32}`" />
                </g>
                <line v-else :x1="-f.len / 2 + f.post / 2" :x2="f.len / 2 - f.post / 2" y1="0" y2="0" class="sm-door" :stroke-width="Math.max(0.35, w.w * 0.45)" />
                <rect v-for="sx in [-1, 1]" :key="sx" :x="sx * f.len / 2 - f.post / 2" :y="-f.post / 2" :width="f.post" :height="f.post" :rx="f.post / 8" :fill="w.type === 'stone' ? '#a19c90' : '#6e4b28'" :stroke="w.st.edge" :stroke-width="Math.max(0.1, 0.8 * px)" />
              </template>
            </g>
          </template>

        </g>
        <!-- дорога упирается в стену, а проёма нет — мастеру подсказка; щелчок ставит ворота -->
        <g v-if="master && !lineTool">
          <g v-for="(c, i) in needGates" :key="'ng' + i" class="sm-needgate" :transform="`translate(${c.x} ${c.y})`" @click.stop="emit('needGate', { wallId: c.wall.id, s: c.s })"
             @pointerenter="hover = { kind: 'needGate' }" @pointerleave="hover = null">
            <circle :r="9 * px" vector-effect="non-scaling-stroke" />
            <text :y="4 * px" :style="{ fontSize: 12 * px + 'px' }">!</text>
          </g>
        </g>
        <!-- куда встанут ворота, калитка или башня -->
        <g v-if="featureAim" class="sm-wfeat aim" :transform="`translate(${featureAim.x} ${featureAim.y}) rotate(${featureAim.deg})`">
          <rect v-if="tool.wallFeature === 'tower'" :x="-featureAim.side / 2" :y="-featureAim.side / 2" :width="featureAim.side" :height="featureAim.side" vector-effect="non-scaling-stroke" />
          <line v-else :x1="-featureAim.len / 2" :x2="featureAim.len / 2" y1="0" y2="0" :stroke-width="Math.max(1, 6 * px)" />
        </g>

        <!-- новая дорога или стена, пока её рисуют; кольцо — куда прилипнет точка -->
        <template v-if="lineTool">
          <path v-if="draft.length" :d="draftD" fill="none" class="sm-draft" :class="{ wall: tool.wall }" :stroke-width="draftW" />
          <circle v-for="(p, i) in draft" :key="i" :cx="p[0]" :cy="p[1]" :r="4 * px" class="sm-draft-pt" vector-effect="non-scaling-stroke" />
          <circle v-if="snapHint" :cx="snapHint[0]" :cy="snapHint[1]" :r="8 * px" class="sm-snap" vector-effect="non-scaling-stroke" />
        </template>
        <!-- какое дерево срубим -->
        <circle v-if="tool === 'fell' && fellTarget" :cx="fellTarget.x" :cy="fellTarget.y" :r="Math.max(fellTarget.r + 0.6, 6 * px)" class="sm-fell" vector-effect="non-scaling-stroke" />

        <!-- постройки в настоящем размере (издалека — не меньше значка) -->
        <g v-for="b in placedView" :key="b.id" class="sm-item" :class="[{ sel: isSel('building', b.id), dragging: b.id === dragId, bad: b.id === dragId && dragBad.length, building: b.state === 'construction', onroad: overRoad.has(b.id) }, b.damage ? 'dmg dmg-' + b.damage : '']"
           :transform="`translate(${b.x} ${b.y})`" :data-id="b.id" data-kind="building"
           @pointerenter="hover = { kind: 'building', item: b }" @pointerleave="hover = null" @click.stop="pick('building', b)">
          <template v-if="b.type === 'plaza'">
            <circle :r="shown(b) / 2 + 0.8" fill="rgba(0, 0, 0, .25)" :transform="`translate(0.8 1.1)`" />
            <circle :r="shown(b) / 2" :fill="view.k > 0.6 ? 'url(#sm-cobble)' : '#9a958a'" class="sm-plaza" vector-effect="non-scaling-stroke" />
            <circle :r="shown(b) * 0.36" fill="none" stroke="#bdb8ab" :stroke-width="shown(b) * 0.025" stroke-dasharray="2 1.2" />
            <rect v-for="a in [45, 135, 225, 315]" :key="a" :x="-shown(b) * 0.06" :y="-shown(b) * 0.4" :width="shown(b) * 0.12" :height="shown(b) * 0.035" fill="#7a5530" :transform="`rotate(${a})`" />
            <circle :r="shown(b) * 0.15" fill="#c9c4b7" stroke="#4c4a45" :stroke-width="shown(b) * 0.018" />
            <circle :r="shown(b) * 0.115" fill="#4f9fd0" />
            <circle :r="shown(b) * 0.03" fill="#e9e4d6" class="sm-fountain" />
          </template>
          <template v-else-if="b.type === 'field'">
            <rect :x="-shown(b) / 2" :y="-shown(b) / 2" :width="shown(b)" :height="shown(b)" :rx="shown(b) / 14" fill="url(#sm-furrows)" class="sm-field" vector-effect="non-scaling-stroke" />
            <image :href="iconUrl('wheat')" :x="-icon(b) / 2" :y="-icon(b) / 2" :width="icon(b)" :height="icon(b)" />
          </template>
          <template v-else>
            <rect :x="-shown(b) / 2" :y="-shown(b) / 2" :width="shown(b)" :height="shown(b)" :rx="shown(b) / 8" class="sm-plate" :class="{ personal: BUILDINGS[b.type]?.personal }"
                  :style="{ '--cat': CATEGORIES[BUILDINGS[b.type]?.cat]?.color }" vector-effect="non-scaling-stroke" />
            <image :href="iconUrl(tierOf(b)?.icon)" :x="-icon(b) / 2" :y="-icon(b) / 2" :width="icon(b)" :height="icon(b)" />
          </template>
          <text v-if="b.name && shown(b) * view.k > 34" :y="shown(b) / 2 + 13 * px" class="sm-label name" :style="labelStyle">{{ b.name }}</text>
          <g v-if="b.state === 'construction'" :transform="`translate(0 ${shown(b) / 2 + 5 * px})`">
            <rect :x="-shown(b) / 2" :y="-2.5 * px" :width="shown(b)" :height="5 * px" :rx="2.5 * px" class="sm-prog-bg" />
            <rect :x="-shown(b) / 2" :y="-2.5 * px" :width="shown(b) * Math.min(1, (b.progress || 0) / (BUILDINGS[b.type]?.cost || 100))" :height="5 * px" :rx="2.5 * px" class="sm-prog" />
          </g>
          <!-- повреждение: трещины по плашке и значок степени в углу; руины — серые -->
          <g v-if="b.damage && DAMAGE[b.damage]" class="sm-dmg" :style="{ '--dc': DAMAGE[b.damage].color }">
            <path :d="crackPath(b)" class="sm-crack" vector-effect="non-scaling-stroke" />
            <g :transform="`translate(${shown(b) / 2} ${-shown(b) / 2})`">
              <circle :r="7.5 * px" class="sm-dmg-dot" vector-effect="non-scaling-stroke" />
              <text :y="3.6 * px" :style="{ fontSize: (b.damage === 'major' ? 8 : 10) * px + 'px' }">{{ DAMAGE_MARK[b.damage] }}</text>
            </g>
          </g>
          <!-- ремонт -->
          <g v-if="b.repair && b.damage" :transform="`translate(0 ${shown(b) / 2 + 5 * px})`">
            <rect :x="-shown(b) / 2" :y="-2.5 * px" :width="shown(b)" :height="5 * px" :rx="2.5 * px" class="sm-prog-bg" />
            <rect :x="-shown(b) / 2" :y="-2.5 * px" :width="shown(b) * Math.min(1, (b.repair.progress || 0) / repairWork(b))" :height="5 * px" :rx="2.5 * px" class="sm-prog repair" />
          </g>
        </g>

        <!-- входы выбранной постройки: видны только у выбранной; мастер тянет по краю, правой кнопкой или двойным щелчком — убрать -->
        <g v-if="doorsView" class="sm-doors">
          <g v-for="d in doorsView.list" :key="d.i" :transform="`translate(${d.x} ${d.y}) rotate(${d.deg})`" :data-door="d.i" :class="{ edit: master }"
             @pointerenter="hover = { kind: 'door' }" @pointerleave="hover = null" @contextmenu.prevent.stop>
            <rect :x="-doorsView.w / 2" :y="-doorsView.t / 2" :width="doorsView.w" :height="doorsView.t" :rx="doorsView.t / 4" class="sm-door-plate" />
            <line :x1="0" :x2="0" :y1="-doorsView.t / 2" :y2="doorsView.t / 2" class="sm-door-line" />
          </g>
        </g>

        <!-- приказы на рассмотрении: будущие постройки и разведка -->
        <g v-for="g in ghosts" :key="g.id" class="sm-ghost" :transform="`translate(${g.x} ${g.y})`">
          <circle v-if="g.explore" :r="g.r" class="sm-ghost-explore" vector-effect="non-scaling-stroke" />
          <template v-else>
            <rect :x="-ghostSide(g) / 2" :y="-ghostSide(g) / 2" :width="ghostSide(g)" :height="ghostSide(g)" :rx="ghostSide(g) / 8" class="sm-ghost-plate" vector-effect="non-scaling-stroke" />
            <image :href="iconUrl(BUILDINGS[g.type]?.icon)" :x="-ghostSide(g) * 0.39" :y="-ghostSide(g) * 0.39" :width="ghostSide(g) * 0.78" :height="ghostSide(g) * 0.78" opacity=".55" />
          </template>
          <text :y="(g.explore ? g.r : ghostSide(g) / 2) + 13 * px" class="sm-label ghost" :style="labelStyle">приказ</text>
        </g>

        <!-- ручки выбранной дороги: точки тянуть, середины — добавить точку, двойной щелчок по точке — убрать -->
        <g v-if="editRoad" class="sm-handles">
          <circle v-for="m in editMids" :key="'m' + m.i" :cx="m.p[0]" :cy="m.p[1]" :r="5 * px" class="sm-handle mid" :data-m="m.i" vector-effect="non-scaling-stroke"
                  @pointerenter="hover = { kind: 'mid' }" @pointerleave="hover = null" />
          <circle v-for="(p, i) in editRoad.points" :key="'v' + i" :cx="p[0]" :cy="p[1]" :r="(i === 0 || i === editRoad.points.length - 1 ? 8 : 6.5) * px" class="sm-handle"
                  :class="{ end: i === 0 || i === editRoad.points.length - 1, picked: pointSel === i }" :data-h="i" vector-effect="non-scaling-stroke"
                  @pointerenter="hover = { kind: 'point' }" @pointerleave="hover = null" @contextmenu.prevent.stop />
          <circle v-if="handleSnap" :cx="handleSnap[0]" :cy="handleSnap[1]" :r="11 * px" class="sm-snap" vector-effect="non-scaling-stroke" />
        </g>

        <!-- курсор инструмента -->
        <g v-if="cursor && toolActive && !lineTool && !tool?.wallFeature && !tool?.march" :transform="`translate(${cursor.x} ${cursor.y})`" class="sm-cursor" :class="{ bad: cursorBad.length }">
          <template v-if="placeType">
            <rect :x="-placeShown / 2" :y="-placeShown / 2" :width="placeShown" :height="placeShown" :rx="placeShown / 8" class="sm-ghost-plate" vector-effect="non-scaling-stroke" />
            <image :href="iconUrl(BUILDINGS[placeType]?.icon)" :x="-placeShown * 0.39" :y="-placeShown * 0.39" :width="placeShown * 0.78" :height="placeShown * 0.78" opacity=".8" />
          </template>
          <circle v-else-if="tool !== 'fell'" :r="brushR" class="sm-brush" :class="brushClass" vector-effect="non-scaling-stroke" />
        </g>

        <!-- туман неразведанного -->
        <rect :x="vb.x" :y="vb.y" :width="vb.w" :height="vb.h" fill="url(#sm-fog)" mask="url(#sm-fog-mask)" class="sm-fog" />
        <!-- аванпосты — поверх тумана: свои, их видно всегда; кругом — рабочая округа -->
        <g v-for="o in outpostsView" :key="o.id" class="sm-item" :class="{ sel: isSel('outpost', o.id) }" :transform="`translate(${o.x} ${o.y})`"
           :data-id="o.id" data-kind="outpost" @pointerenter="hover = { kind: 'outpost', item: o }" @pointerleave="hover = null" @click.stop="pick('outpost', o)">
          <circle r="150" class="sm-outpost-ring" :class="o.state" vector-effect="non-scaling-stroke" />
          <rect :x="-22 * px" :y="-22 * px" :width="44 * px" :height="44 * px" :rx="7 * px" class="sm-plate outpost" vector-effect="non-scaling-stroke" />
          <image :href="iconUrl(OUTPOSTS[o.type]?.icon)" :x="-17 * px" :y="-17 * px" :width="34 * px" :height="34 * px" />
          <text :y="40 * px" class="sm-label" :style="labelStyle">{{ OUTPOSTS[o.type]?.label }}</text>
        </g>

        <!-- отряды в округе: сколько осталось пройти и сам отряд (поверх тумана — свои) -->
        <polyline v-for="m in squadsView.filter(x => x.rest)" :key="'r' + m.id" :points="m.rest" class="sm-march-route" :stroke="m.color" vector-effect="non-scaling-stroke" />
        <!-- прокладка пути: щёлкнутые точки, найденный путь, линия к курсору -->
        <g v-if="tool?.march" class="sm-march-draft">
          <polyline v-if="marchPathPts && !marchDrag" :points="marchPathPts" class="sm-march-plan" vector-effect="non-scaling-stroke" />
          <polyline v-if="marchDrag" :points="[marchFrom, ...marchShown].map(p => p.join(',')).join(' ')" class="sm-march-aim" vector-effect="non-scaling-stroke" />
          <line v-if="marchAim && !marchDrag" v-bind="marchAim" class="sm-march-aim" vector-effect="non-scaling-stroke" />
          <!-- ручки: точки тянуть, двойной щелчок — убрать; кружок посередине — вставить точку -->
          <circle v-for="(p, i) in marchMids" :key="'m' + i" :cx="p[0]" :cy="p[1]" :r="4 * px" class="sm-handle mid" :data-mm="i" vector-effect="non-scaling-stroke" />
          <circle v-for="(p, i) in marchShown" :key="i" :cx="p[0]" :cy="p[1]" :r="6 * px" class="sm-draft-pt sm-march-pt" :class="{ exit: marchExit && i === marchShown.length - 1 }" :data-mp="i" vector-effect="non-scaling-stroke" />
        </g>
        <g v-for="m in squadsView" :key="m.id" class="sm-item sm-squad" :class="{ sel: isSel('squad', m.id), moving: m.moving }" :transform="`translate(${m.x} ${m.y})`"
           @pointerenter="hover = { kind: 'squad', item: m }" @pointerleave="hover = null" @click.stop="pick('squad', m)">
          <circle :r="15 * px" :fill="m.color" class="sm-squad-dot" vector-effect="non-scaling-stroke" />
          <path :d="ICONS[m.icon] || ICONS.flag" :transform="`translate(${-10 * px} ${-10 * px}) scale(${(20 / 24) * px})`" fill="#1b1408" />
          <text :y="31 * px" class="sm-label" :style="labelStyle">{{ m.name }}</text>
        </g>

        <!-- издалека — подпись поселения -->
        <g v-if="view.k < 0.09" class="sm-town" :transform="`translate(${CENTER} ${CENTER})`">
          <circle :r="5 * px" class="sm-town-dot" vector-effect="non-scaling-stroke" />
          <text :y="-11 * px" class="sm-label town" :style="{ fontSize: 17 * px + 'px', strokeWidth: 5 * px + 'px' }">{{ settlement.name }}</text>
        </g>
      </g>
    </svg>
    <!-- жители, сумерки и огни: свой холст поверх карты -->
    <canvas ref="lifeCv" class="sm-life" />
    <!-- часы поселения: мастер ставит паузу и скорость, как в RimWorld -->
    <div class="sm-clock" :class="{ night: clockView.dark }" @pointerdown.stop @dblclick.stop>
      <span class="ck-ico" :title="clockView.part">{{ clockView.icon }}</span><b>{{ clockView.time }}</b><small>день {{ clockView.day }}</small>
      <template v-if="master">
        <button v-for="sp in CLOCK_SPEEDS" :key="sp.v" type="button" :class="{ on: clockView.speed === sp.v }" :title="sp.title" @click.stop="emit('clock', sp.v)">{{ sp.label }}</button>
      </template>
      <em v-else-if="!clockView.speed" title="Мастер поставил время на паузу">пауза</em>
    </div>
    <!-- куда сошлось много народу: щёлкни — карта туда -->
    <div v-if="crowds.length" class="sm-crowds" @pointerdown.stop>
      <button v-for="(g, i) in crowds" :key="i" type="button" :class="{ riot: g.icon === '✊' }" :disabled="!g.at" @click.stop="g.at && focusAt(g.at.x, g.at.y, 2.5)"><span>{{ g.icon }}</span>{{ g.text }}</button>
    </div>

    <!-- подсказки -->
    <div v-if="wallDraftInfo" class="sm-tip" :style="tipPos">
      <b>{{ wallDraftInfo.title }}</b>
      <span v-for="(l, i) in wallDraftInfo.lines" :key="i">{{ l }}</span>
    </div>
    <div v-else-if="cursor && toolActive && cursorBad.length" class="sm-tip bad" :style="tipPos">Сюда нельзя: {{ cursorBad.join(', ') }}</div>
    <div v-else-if="dragId && dragBad.length" class="sm-tip bad" :style="tipPos">Сюда нельзя: {{ dragBad.join(', ') }}</div>
    <div v-else-if="hover && tip && !toolActive" class="sm-tip" :style="tipPos">
      <b>{{ tip.title }}</b>
      <span v-for="(l, i) in tip.lines" :key="i">{{ l }}</span>
    </div>

    <!-- что под курсором и масштаб -->
    <div class="sm-status">
      <span v-if="place">{{ place }}</span>
      <span class="sm-scale"><i :style="{ width: scaleBar.px + 'px' }" />{{ scaleBar.label }}</span>
    </div>
    <div class="sm-ctrl">
      <button title="Приблизить" @click="zoomBy(1.5)">+</button>
      <button title="Отдалить" @click="zoomBy(1 / 1.5)">−</button>
      <button title="К поселению" @click="fit">⌂</button>
      <button title="Вся округа (≈17×17 км)" @click="fitAll">⤢</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { BUILDINGS, CATEGORIES, OUTPOSTS, SIZES, JOBS, RES, ROAD_TYPES, DAMAGE, repairWork, placementProblems, footprint, roadCurve, nearestRoad, roadJunctions, priceText, tierOf, iconSrc } from '../shared/settlement.js'
import { WALL_TYPES, WALL_FEATURES, wallLength, wallPrice, wallWork, pointAt, slice, nearestWall, openings, roadCrossings, wallDefense, wallCurve } from '../shared/walls.js'
import { WORLD, CENTER, makeTerrain, BIOME_LABEL } from '../shared/terrainGen.js'
import { createTileStore } from './tiles.js'
import { TILE, MAX_Z, treeAt } from './tileRender.js'
import { fogTexture } from '../map/fogTexture.js'
import { store } from '../map/store.js'
import { ICONS } from '../map/icons.js'
import { cargoOf } from '../shared/army.js'
import { marchCtx, planPath, marchState, marchTiming, msPerMeter, densify, edgePoint, EDGE } from '../shared/march.js'
import { squadAt, spotLabel } from './march.js'
import { createLifeLayer } from './lifeLayer.js'
import { simplifyLine } from '../shared/geo.js'
import { buildCast, dayPlans, personAt, ACTS, jobLabel, snapshotAt, gatherings } from '../shared/life.js'
import { clockMin, clockOf, dayTime, partOfDay, darkness, CLOCK_SPEEDS, DAY_MIN } from '../shared/clock.js'
import { RACES } from '../shared/settlement.js'

const props = defineProps({
  settlement: { type: Object, required: true },
  calc: { type: Object, required: true },
  selected: { type: Object, default: null }, // { kind: building | outpost | road, id }
  // инструмент: 'move' — двигать; { place: тип } — новая постройка; { placeExisting: id, type } — из списка «не расставлены»;
  // { explore: true } — точка разведки; 'fog-add' / 'fog-erase' — туман; 'cut' / 'grow' — вырубить / вернуть лес; { road: тип } — дорога;
  // { wall: вид } — стена; { wallFeature: gate | wicket | tower } — фрагмент на стене; { march: id отряда, auto } — повести отряд
  tool: { type: [String, Object], default: null },
  ghosts: { type: Array, default: () => [] },
  brush: { type: Number, default: 60 }, // радиус кисти, м
  master: Boolean
})
const emit = defineEmits(['select', 'moved', 'placed', 'explore', 'fog', 'cut', 'fell', 'road', 'roadEdit', 'wall', 'wallFeature', 'needGate', 'ready', 'march', 'clock', 'person', 'doors', 'featureMove'])

const fogUrl = fogTexture()
const iconUrl = iconSrc
const sideOf = type => SIZES[BUILDINGS[type]?.size]?.side || 0
// на экране постройка не меньше 14 px, иначе её не видно издалека
const shown = b => Math.max(sideOf(b.type), 14 * px.value)
const icon = b => Math.min(shown(b) * 0.78, Math.max(shown(b) * 0.6, 34 * px.value))
const ghostSide = g => Math.max(sideOf(g.type), 14 * px.value)
// повреждения: значок степени и трещины (чем хуже, тем больше), в размер плашки
const DAMAGE_MARK = { minor: '!', medium: '!!', major: '!!!', ruined: '✕' }
const CRACKS = [
  [[-0.5, -0.18], [-0.22, -0.05], [-0.3, 0.12], [-0.06, 0.3]],
  [[0.5, 0.1], [0.24, 0.0], [0.3, -0.2], [0.08, -0.36], [0.14, -0.5]],
  [[-0.1, 0.5], [0.02, 0.28], [-0.12, 0.14], [0.06, -0.02]]
]
function crackPath(b) {
  const n = { minor: 1, medium: 2, major: 3, ruined: 3 }[b.damage] || 0
  const h = shown(b)
  return CRACKS.slice(0, n).map(c => 'M' + c.map(([x, y]) => `${(x * h).toFixed(2)} ${(y * h).toFixed(2)}`).join(' L')).join(' ')
}
const placed = computed(() => (props.settlement.buildings || []).filter(b => b.x != null && sideOf(b.type) > 0))
const toolActive = computed(() => !!props.tool && props.tool !== 'move')
const toolClass = computed(() => (props.tool === 'move' ? 'tool-move' : toolActive.value ? 'tool-paint' : ''))
const placeType = computed(() => props.tool?.place || props.tool?.type || null)
const placeShown = computed(() => Math.max(sideOf(placeType.value), 14 * px.value))
const brushR = computed(() => (props.tool?.explore ? 300 : props.brush))
const brushClass = computed(() => ({ erase: props.tool === 'fog-erase', cut: props.tool === 'cut', grow: props.tool === 'grow' }))
const cursor = ref(null)
const cursorBad = computed(() => {
  if (!cursor.value || !placeType.value || BUILDINGS[placeType.value]?.size === 'settlement') return []
  return placementProblems(props.settlement, { id: props.tool?.placeExisting || '_new', type: placeType.value, x: cursor.value.x, y: cursor.value.y })
})

/* ---------- вид: k — пикселей на метр ---------- */
const box = ref(null)
const cv = ref(null)
const size = reactive({ w: 0, h: 0 })
const view = reactive({ x: 0, y: 0, k: 0.3 })
const px = computed(() => 1 / view.k) // метров в экранном пикселе
const K_MAX = 4
const kMin = () => Math.min(size.w, size.h) / WORLD * 0.9
const labelStyle = computed(() => ({ fontSize: 12 * px.value + 'px', strokeWidth: 4 * px.value + 'px' }))
// видимая часть мира с запасом — для тумана и его размытия
const vb = computed(() => {
  const x0 = -view.x / view.k, y0 = -view.y / view.k, w = size.w / view.k, h = size.h / view.k
  return { x: x0 - w * 0.25, y: y0 - h * 0.25, w: w * 1.5, h: h * 1.5 }
})
const fogBlur = computed(() => Math.min(60, 26 * px.value))
function fitBox(x0, y0, x1, y1) {
  const pad = 40
  const k = Math.max(kMin(), Math.min(K_MAX, Math.min((size.w - pad * 2) / (x1 - x0), (size.h - pad * 2) / (y1 - y0))))
  Object.assign(view, { k, x: size.w / 2 - ((x0 + x1) / 2) * k, y: size.h / 2 - ((y0 + y1) / 2) * k })
}
// к поселению: разведанное ядро и постройки
function fit() {
  const core = (props.settlement.explored || []).filter(e => e.r && Math.hypot(e.x - CENTER, e.y - CENTER) < 2500)
  let x0 = CENTER - 1200, y0 = CENTER - 1200, x1 = CENTER + 1200, y1 = CENTER + 1200
  for (const e of core) { x0 = Math.min(x0, e.x - e.r); y0 = Math.min(y0, e.y - e.r); x1 = Math.max(x1, e.x + e.r); y1 = Math.max(y1, e.y + e.r) }
  fitBox(x0, y0, x1, y1)
}
const fitAll = () => fitBox(0, 0, WORLD, WORLD)
function zoomAt(sx, sy, f) {
  const k = Math.max(kMin(), Math.min(K_MAX, view.k * f))
  view.x = sx - ((sx - view.x) / view.k) * k
  view.y = sy - ((sy - view.y) / view.k) * k
  view.k = k
}
const zoomBy = f => zoomAt(size.w / 2, size.h / 2, f)
function onWheel(e) {
  const rc = box.value.getBoundingClientRect()
  zoomAt(e.clientX - rc.left, e.clientY - rc.top, Math.exp(-e.deltaY * 0.0015))
}
const toWorld = (cx, cy) => {
  const rc = box.value.getBoundingClientRect()
  return { x: Math.round(((cx - rc.left - view.x) / view.k) * 10) / 10, y: Math.round(((cy - rc.top - view.y) / view.k) * 10) / 10 }
}
const scaleBar = computed(() => {
  const raw = 110 * px.value
  const p = 10 ** Math.floor(Math.log10(raw))
  const nice = [5, 2, 1].map(m => m * p).find(v => v <= raw) || p
  return { px: Math.round(nice * view.k), label: nice >= 1000 ? `${nice / 1000} км` : `${nice} м` }
})

/* ---------- плитки местности ---------- */
const tiles = createTileStore(() => scheduleDraw())
let drawPending = false, readySent = false
function scheduleDraw() {
  if (drawPending) return
  drawPending = true
  requestAnimationFrame(() => { drawPending = false; drawTiles() })
}
function drawTiles() {
  const c = cv.value
  if (!c || !size.w) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = Math.round(size.w * dpr), H = Math.round(size.h * dpr)
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
  const g = c.getContext('2d')
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.fillStyle = '#161a1f'
  g.fillRect(0, 0, W, H)
  const k = view.k
  const z = Math.max(0, Math.min(MAX_Z, Math.ceil(Math.log2((WORLD * k * dpr) / TILE) - 0.3)))
  const x0 = -view.x / k, y0 = -view.y / k, x1 = (size.w - view.x) / k, y1 = (size.h - view.y) / k
  const range = zz => {
    const T = WORLD / 2 ** zz, n = 2 ** zz
    return [Math.max(0, Math.floor(x0 / T)), Math.min(n - 1, Math.floor(x1 / T)), Math.max(0, Math.floor(y0 / T)), Math.min(n - 1, Math.floor(y1 / T))]
  }
  // сначала дешёвые крупные плитки (подложка, пока грузятся мелкие), потом нужные — от центра экрана к краям
  const list = []
  for (let zz = 0; zz <= Math.min(2, z - 1); zz++) { const [a, b, c2, d] = range(zz); for (let y = c2; y <= d; y++) for (let x = a; x <= b; x++) list.push({ z: zz, x, y }) }
  const [a, b, c2, d] = range(z)
  const T = WORLD / 2 ** z
  const cx = (x0 + x1) / 2 / T, cy = (y0 + y1) / 2 / T
  const main = []
  for (let y = c2; y <= d; y++) for (let x = a; x <= b; x++) main.push({ z, x, y })
  main.sort((p, q) => Math.hypot(p.x + 0.5 - cx, p.y + 0.5 - cy) - Math.hypot(q.x + 0.5 - cx, q.y + 0.5 - cy))
  const world = tileWorld.value
  const got = tiles.want(world, [...list, ...main])
  g.setTransform(dpr * k, 0, 0, dpr * k, dpr * view.x, dpr * view.y)
  g.imageSmoothingEnabled = true
  const ov = 0.6 / (k * dpr) // плитки чуть внахлёст — без швов
  let missing = 0
  for (const t of got) {
    if (t.z !== z) continue
    if (t.img) { g.drawImage(t.img, t.x * T - ov, t.y * T - ov, T + ov * 2, T + ov * 2); continue }
    missing++
    const an = tiles.ancestor(world, t.z, t.x, t.y)
    if (!an) continue
    const TA = WORLD / 2 ** an.z, s = TILE / TA
    g.drawImage(an.img, (t.x * T - an.x * TA) * s, (t.y * T - an.y * TA) * s, T * s, T * s, t.x * T - ov, t.y * T - ov, T + ov * 2, T + ov * 2)
  }
  if (!missing && !readySent) { readySent = true; emit('ready') }
}
watch(() => [view.x, view.y, view.k, size.w, size.h], scheduleDraw)
// что плитки должны знать, кроме местности: вырубки, дороги и постройки (под ними деревьев нет)
const tileWorld = computed(() => ({
  terrain: props.settlement.terrain,
  clearings: props.settlement.clearings || [],
  roads: [
    ...(props.settlement.roads || []).map(r => ({ w: ROAD_TYPES[r.type]?.w || 4, pts: roadCurve(r) })),
    ...(props.settlement.walls || []).map(w => ({ w: (WALL_TYPES[w.type]?.w || 1.2) + 1, pts: w.points }))
  ].map(r => {
    const xs = r.pts.map(p => p[0]), ys = r.pts.map(p => p[1])
    return { ...r, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }
  }),
  boxes: placed.value.map(b => footprint(b))
}))
watch(tileWorld, scheduleDraw)

/* ---------- дороги ---------- */
const pathOf = pts => (pts.length < 2 ? '' : 'M' + pts.map(p => `${Math.round(p[0] * 100) / 100} ${Math.round(p[1] * 100) / 100}`).join(' L'))
// пока тянут: { kind: road | wall, id, points, others: { id: points } } — others — примыкающие линии, чьи концы идут следом
const roadEdit = ref(null)
const edited = (kind, x) => {
  const e = roadEdit.value
  if (e?.kind !== kind) return x
  if (e.id === x.id) return { ...x, points: e.points }
  return e.others?.[x.id] ? { ...x, points: e.others[x.id] } : x
}
const roadsView = computed(() => (props.settlement.roads || []).map(r => edited('road', r)))
// пока тянут ворота по стене — их место на лету
const featDrag = ref(null) // { wallId, id, s, start, moved }
const wallsView = computed(() => (props.settlement.walls || []).map(w => {
  const x = edited('wall', w), fd = featDrag.value
  return fd?.moved && fd.wallId === x.id ? { ...x, features: (x.features || []).map(f => (f.id === fd.id ? { ...f, s: fd.s } : f)) } : x
}))

/* ---------- стены ---------- */
// шатровая крыша деревянной башни сверху: четыре ската разного тона
const ROOF = [
  { c: '#a46b3c', d: h => `M0 0 L${-h} ${-h} L${h} ${-h} Z` },
  { c: '#7a4f2a', d: h => `M0 0 L${h} ${-h} L${h} ${h} Z` },
  { c: '#5f3d1f', d: h => `M0 0 L${h} ${h} L${-h} ${h} Z` },
  { c: '#8d5b31', d: h => `M0 0 L${-h} ${h} L${-h} ${-h} Z` }
]
const WALL_STYLE = {
  palisade: { edge: '#2c1f12', body: '#7a5530', top: '#b0844f', edgeW: 0.5, dash: '0.3 0.14' },
  stone: { edge: '#34322e', body: '#8f8b82', top: '#c2bdb1', edgeW: 0.7, dash: '1.1 0.8' }
}
const wallsDraw = computed(() => wallsView.value.map(w => {
  const t = WALL_TYPES[w.type] || WALL_TYPES.palisade
  const len = wallLength(w.points), built = Math.min(len, w.built ?? len)
  // режем стену проёмами, каждую часть — на построенное и нет
  const pieces = []
  let a = 0
  for (const [g0, g1] of openings(w).sort((x, y) => x[0] - y[0])) { if (g0 > a) pieces.push([a, g0]); a = Math.max(a, g1) }
  if (a < len) pieces.push([a, len])
  // по плавной линии: метры вдоль ломаной пересчитываем в метры вдоль кривой
  const curve = wallCurve(w.points), sc = len ? wallLength(curve) / len : 1
  const donePts = [], plan = []
  for (const [p0, p1] of pieces) {
    if (built > p0) donePts.push(slice(curve, p0 * sc, Math.min(p1, built) * sc))
    if (built < p1) plan.push(pathOf(slice(curve, Math.max(p0, built) * sc, p1 * sc)))
  }
  const wpx = Math.max(t.w, 3 * px.value)
  // вблизи — брёвна, кладка, зубцы; издалека — простая полоса
  const near = view.k * t.w >= 5
  // зубцы — с внешней стороны: у кольца это снаружи, у открытой стены — слева по ходу
  let area = 0
  for (let i = 0; i < w.points.length; i++) { const a = w.points[i], b = w.points[(i + 1) % w.points.length]; area += a[0] * b[1] - b[0] * a[1] }
  const outer = area > 0 ? -1 : 1
  const merlons = near && w.type === 'stone' ? donePts.map(p => pathOf(offsetLine(p, outer * t.w * 0.37))) : []
  const feats = (w.features || []).map(f => {
    const p = pointAt(curve, f.s * sc), d = WALL_FEATURES[f.kind]
    const side = Math.max((d.side || 5) * (w.type === 'stone' ? 1.2 : 1), 10 * px.value)
    const post = Math.max(wpx * (w.type === 'stone' ? 1.6 : 1.5), 0.6)
    const inner = Math.max(0, (d.len || 0) - post)
    const leaves = f.kind === 'gate' ? [{ x: -inner / 2, w: inner / 2 - 0.05 }, { x: 0.05, w: inner / 2 - 0.05 }] : [{ x: -inner / 2, w: inner }]
    return { ...f, x: p.x, y: p.y, deg: (p.angle * 180) / Math.PI, len: d.len, side, post, leaves, leafT: Math.max(0.3, t.w * 0.5), built: (f.state || 'built') === 'built' && built >= f.s }
  })
  return { ...w, len, built, w: wpx, near, sh: Math.max(0.35, t.w * 0.35), dAll: pathOf(curve), done: donePts.map(pathOf).filter(Boolean), merlons, plan: plan.filter(Boolean), feats, st: WALL_STYLE[w.type] || WALL_STYLE.palisade }
}))
// дорога пересекает стену без ворот
const needGates = computed(() => roadCrossings(wallsView.value, roadsView.value, roadCurve).filter(c => !c.gate))
// куда встанет фрагмент: ближайшая точка стены под курсором
const featureAim = computed(() => {
  const k = props.tool?.wallFeature
  if (!k || !cursor.value) return null
  const q = nearestWall(wallsView.value, cursor.value.x, cursor.value.y)
  if (!q || q.dist > Math.max(14 * px.value, 6)) return null
  const p = pointAt(q.wall.points, q.s), d = WALL_FEATURES[k]
  return { wallId: q.wall.id, s: q.s, x: p.x, y: p.y, deg: (p.angle * 180) / Math.PI, len: d.len, side: Math.max(d.side || 5, 10 * px.value) }
})
// что будет стоить стена, которую рисуют
const fmtPrice = pr => priceText(pr) || 'бесплатно'
const wallDraftInfo = computed(() => {
  const type = props.tool?.wall
  if (!type || !draft.value.length || !cursor.value) return null
  const pts = [...draft.value, snapHint.value || [cursor.value.x, cursor.value.y]]
  const len = wallLength(pts)
  const days = Math.ceil(wallWork(type, len) / 25)
  return {
    title: `${WALL_TYPES[type].label}: ${fmtLen(len)}`,
    lines: [`Цена: ${fmtPrice(wallPrice(type, len))}`, `Стройка ≈ ${days} дн. (без слесарей)`, `Защита +${Math.round(len * WALL_TYPES[type].defense)}`]
  }
})
// оформление вида дороги: ширины в метрах, но не тоньше нескольких пикселей издалека.
// marks — разметка поверх покрытия: линии со смещением от оси off (м) — колеи, булыжник, доски, перила; вблизи подробнее
function roadStyle(type) {
  const w = ROAD_TYPES[type]?.w || 4, p = px.value, k = view.k
  const m = (meters, pixels) => Math.max(meters, pixels * p)
  switch (type) {
    case 'trail': return { shadow: { c: 'rgba(40, 30, 18, .22)', w: m(w + 1.4, 3) }, edge: { c: '#9a7d55', w: m(w + 0.5, 2.2) }, fill: { c: '#c4a676', w: m(w, 1.4) },
      marks: k > 2 ? [{ off: 0, c: 'rgba(120, 92, 56, .35)', w: w * 0.4, dash: '0.22 0.7' }] : [] }
    case 'tract': return { shadow: { c: 'rgba(30, 22, 12, .35)', w: m(w + 4, 4.6) }, edge: { c: '#5e472c', w: m(w + 1.6, 3.4) }, fill: { c: '#977652', w: m(w, 2.6) },
      marks: k > 0.5 ? [{ off: 0, c: '#a6865f', w: w * 0.22 }, ...[-1, 1].flatMap(sg => [{ off: sg * w * 0.32, c: '#7a5d3a', w: w * 0.09 }, { off: sg * w * 0.12, c: '#83653f', w: w * 0.07 }])] : [] }
    case 'paved': return { shadow: { c: 'rgba(20, 20, 18, .35)', w: m(w + 3.5, 4.2) }, edge: { c: '#4c4a45', w: m(w + 1.4, 3.2) }, fill: { c: k > 1.2 ? '#86817a' : '#9a958a', w: m(w, 2.4) },
      // булыжник: ряды камней вразбежку на тёмном растворе, по краям — бордюр
      marks: k > 1.2 ? [
        ...[-0.38, -0.23, -0.08, 0.08, 0.23, 0.38].map((f, i) => ({ off: f * w, c: i % 2 ? '#a39e92' : '#aca79b', w: w * 0.13, dash: '0.68 0.12', dashOff: [0, 0.4, 0.15, 0.55, 0.28, 0.7][i] })),
        ...[-1, 1].map(sg => ({ off: sg * w * 0.47, c: '#bdb8ab', w: w * 0.06 }))
      ] : [] }
    case 'bridge': return { shadow: { c: 'rgba(10, 8, 4, .45)', w: m(w + 3, 4.4) }, edge: { c: '#3b2a18', w: m(w + 1.6, 3.4) }, fill: { c: '#a77d4c', w: m(w, 2.6) },
      marks: k > 0.8 ? [{ off: 0, c: '#7a5a34', w: w * 0.94, dash: '0.12 0.42' }, ...[-1, 1].map(sg => ({ off: sg * w * 0.47, c: '#4a3420', w: w * 0.1 }))] : [] }
    default: return { shadow: { c: 'rgba(40, 30, 18, .32)', w: m(w + 3, 3.6) }, edge: { c: '#6b5235', w: m(w + 1.2, 2.8) }, fill: { c: '#a3835a', w: m(w, 2) },
      // грунтовка: две колеи и травка посередине
      marks: k > 0.6 ? [...[-1, 1].map(sg => ({ off: sg * w * 0.24, c: '#8a6c47', w: w * 0.13 })), ...(k > 1.5 ? [{ off: 0, c: 'rgba(118, 146, 66, .45)', w: w * 0.12, dash: '0.5 1.1' }] : [])] : [] }
  }
}
// ломаная, сдвинутая вбок на d метров (влево по ходу — минус)
function offsetLine(pts, d) {
  if (!d || pts.length < 2) return pts
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
    return [p[0] - (dy / l) * d, p[1] + (dx / l) * d]
  })
}
// отрезать от ломаной кусок длиной cut с начала (end = 0) или с конца (end = 1)
const trimEnd = (pts, end, cut) => (end ? trimStart([...pts].reverse(), cut).reverse() : trimStart(pts, cut))
// дорога упирается в постройку — обрываем у края плашки, как подъезд к двери
function trimAtBuilding(pts, end, buildings) {
  const tip = end ? pts[pts.length - 1] : pts[0]
  const inside = (b, p, pad) => Math.abs(p[0] - b.x) <= b.h + pad && Math.abs(p[1] - b.y) <= b.h + pad
  const b = buildings.find(q => inside(q, tip, 1))
  if (!b) return null
  const seq = end ? [...pts].reverse() : pts
  let i = 1
  while (i < seq.length && inside(b, seq[i], 0)) i++
  if (i >= seq.length) return null // дорога целиком под постройкой — не трогаем
  // точная граница между seq[i-1] (внутри) и seq[i] (снаружи)
  let lo = 0, hi = 1
  const at = u => [seq[i - 1][0] + (seq[i][0] - seq[i - 1][0]) * u, seq[i - 1][1] + (seq[i][1] - seq[i - 1][1]) * u]
  for (let n = 0; n < 12; n++) { const mid = (lo + hi) / 2; if (inside(b, at(mid), 0)) lo = mid; else hi = mid }
  const out = [at(hi), ...seq.slice(i)]
  return end ? out.reverse() : out
}
// точка на ломаной на расстоянии dist от начала
function pointAlong(pts, dist) {
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (dist <= seg) { const u = seg ? dist / seg : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u] }
    dist -= seg
  }
  return pts[pts.length - 1]
}
// отрезать от начала ломаной кусок длиной cut
function trimStart(pts, cut) {
  let i = 1
  while (i < pts.length) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (cut < seg) { const u = cut / seg; return [[pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u], ...pts.slice(i)] }
    cut -= seg
    i++
  }
  return pts.slice(-1)
}
const f2 = p => `${Math.round(p[0] * 100) / 100} ${Math.round(p[1] * 100) / 100}`
// раструб примыкания: оба угла между кромкой главной дороги и второстепенной скругляются (как на картах).
// J — точка примыкания на оси главной, tI — направление главной там, wN / wI — ширина второстепенной и главной
// edge — прижать точку к настоящей кромке главной (на изгибе кромка не прямая, иначе вылезает шип)
function flarePath(curve, end, J, tI, wN, wI, edge = p => p) {
  const pts = end ? [...curve].reverse() : curve
  const P = pointAlong(pts, wI / 2 + Math.max(wN * 2, 4))
  let dx = P[0] - J[0], dy = P[1] - J[1]
  const len = Math.hypot(dx, dy)
  if (len < 0.05) return null
  dx /= len; dy /= len
  const nx = -dy, ny = dx, h = wN / 2
  const tl = Math.hypot(tI[0], tI[1]) || 1
  const ix = tI[0] / tl, iy = tI[1] / tl
  // кромка главной со стороны, откуда пришла второстепенная
  const sg = Math.sign(dx * -iy + dy * ix) || 1
  const ex = J[0] - iy * sg * (wI / 2), ey = J[1] + ix * sg * (wI / 2)
  const r = Math.min(Math.max(wN * 0.55, 1), 3) // радиус скругления
  const side = k => {
    // пересечение кромки второстепенной (смещение k·h) с кромкой главной: E + tI·u = J + n·k·h + d·v
    const bx = J[0] + nx * k * h - ex, by = J[1] + ny * k * h - ey
    const det = ix * -dy - iy * -dx
    if (Math.abs(det) < 0.15) return null // почти параллельно — раструб не нужен
    let u = (bx * -dy - by * -dx) / det
    // острый угол: кромки сходятся далеко — длинный клин травы не заливаем, скругляем у самого стыка
    const lim = h + wI / 2 + r
    if (Math.abs(u) > lim) u = Math.sign(u) * lim
    const Cx = ex + ix * u, Cy = ey + iy * u
    // скругление уходит по кромке главной прочь от стыка (иначе на остром угле — крючок)
    const away = Math.sign(u) || k
    return { S: edge([Cx + ix * away * r, Cy + iy * away * r]), C: edge([Cx, Cy]), Q: [Cx + dx * r, Cy + dy * r] }
  }
  const a = side(1), b = side(-1)
  if (!a || !b) return null
  return `M${f2(J)} L${f2(a.S)} Q${f2(a.C)} ${f2(a.Q)} L${f2(b.Q)} Q${f2(b.C)} ${f2(b.S)} Z`
}
// где дороги одного вида пересекаются «крестом» (не концом): точка и направления обеих
const roadCrosses = computed(() => {
  const roads = roadsView.value, CELL = 40, cells = new Map(), out = [], seen = new Set()
  const curves = roads.map(r => roadCurve(r))
  curves.forEach((c, ri) => {
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1], b = c[i]
      for (let gx = Math.floor(Math.min(a[0], b[0]) / CELL); gx <= Math.floor(Math.max(a[0], b[0]) / CELL); gx++) {
        for (let gy = Math.floor(Math.min(a[1], b[1]) / CELL); gy <= Math.floor(Math.max(a[1], b[1]) / CELL); gy++) {
          const k = gx * 8192 + gy
          if (!cells.has(k)) cells.set(k, [])
          cells.get(k).push([ri, a, b])
        }
      }
    }
  })
  for (const list of cells.values()) {
    for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
      const [ri, a, b] = list[x], [rj, c, d] = list[y]
      if (ri === rj || roads[ri].type !== roads[rj].type) continue
      const den = (a[0] - b[0]) * (c[1] - d[1]) - (a[1] - b[1]) * (c[0] - d[0])
      if (Math.abs(den) < 1e-9) continue
      const t = ((a[0] - c[0]) * (c[1] - d[1]) - (a[1] - c[1]) * (c[0] - d[0])) / den, u = -((a[0] - b[0]) * (a[1] - c[1]) - (a[1] - b[1]) * (a[0] - c[0])) / den
      if (t < 0 || t > 1 || u < 0 || u > 1) continue
      const X = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
      const key = `${ri}:${rj}:${Math.round(X[0] / 3)}:${Math.round(X[1] / 3)}`
      if (seen.has(key)) continue
      seen.add(key)
      // у конца любой из дорог — это примыкание, им занят раструб
      const w = ROAD_TYPES[roads[ri].type]?.w || 4
      const nearEnd = cv => [cv[0], cv[cv.length - 1]].some(p => Math.hypot(p[0] - X[0], p[1] - X[1]) < w * 1.5 + 2)
      if (nearEnd(curves[ri]) || nearEnd(curves[rj])) continue
      const n1 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n2 = Math.hypot(d[0] - c[0], d[1] - c[1]) || 1
      out.push({ a: roads[ri].id, b: roads[rj].id, X, d1: [(b[0] - a[0]) / n1, (b[1] - a[1]) / n1], d2: [(d[0] - c[0]) / n2, (d[1] - c[1]) / n2] })
    }
  }
  return out
})
// скругления четырёх углов перекрёстка: между кромками двух дорог (ширина w), радиус r
function crossFillets(X, d1, d2, w, r) {
  const h = w / 2, out = []
  const n1 = [-d1[1], d1[0]], n2 = [-d2[1], d2[0]]
  const det = -d1[0] * d2[1] + d2[0] * d1[1]
  if (Math.abs(det) < 0.2) return out // почти вдоль — углов нет
  for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
    const P = [n2[0] * s2 * h - n1[0] * s1 * h, n2[1] * s2 * h - n1[1] * s1 * h]
    let t = (P[0] * -d2[1] - -d2[0] * P[1]) / det, u = (d1[0] * P[1] - d1[1] * P[0]) / det
    const lim = w + r
    t = Math.max(-lim, Math.min(lim, t)); u = Math.max(-lim, Math.min(lim, u))
    const C = [X[0] + n1[0] * s1 * h + d1[0] * t, X[1] + n1[1] * s1 * h + d1[1] * t]
    const S = [C[0] + d1[0] * Math.sign(t) * r, C[1] + d1[1] * Math.sign(t) * r]
    const Q = [C[0] + d2[0] * Math.sign(u) * r, C[1] + d2[1] * Math.sign(u) * r]
    out.push(`M${f2(X)} L${f2(S)} Q${f2(C)} ${f2(Q)} Z`)
  }
  return out
}
const roadsDraw = computed(() => {
  const roads = roadsView.value
  const juncs = roadJunctions(roads)
  // плашки построек (полсторны) — к ним дороги подходят «к двери»
  const plates = placed.value.map(b => ({ x: b.x, y: b.y, h: sideOf(b.type) / 2 }))
  const rank = r => ROAD_TYPES[r.type]?.rank || 0
  // кто главнее на стыке: при равном виде позже рисуем ту, в которую упираются, — её разметка ляжет поверх раструба
  const into = new Map()
  for (const j of juncs) if (rank(j.into) >= rank(j.road)) into.set(j.into, (into.get(j.into) || 0) + 1)
  const list = roads.map(r => {
    const st = roadStyle(r.type)
    const full = roadCurve(r)
    let curve = full
    const flares = [], caps = [], joinEnds = [], bands = []
    // полосы дорог попроще рангом, что проходят через точку P (их участок рядом) — для вычитания из конца главной
    const bandsAt = (P, rk, self) => {
      let n = 0
      for (const o of roads) {
        if (o === self || rank(o) >= rk) continue
        const so = roadStyle(o.type)
        const near = roadCurve(o).filter(p => Math.hypot(p[0] - P[0], p[1] - P[1]) < 40)
        if (near.length > 1 && near.some(p => Math.hypot(p[0] - P[0], p[1] - P[1]) < so.fill.w / 2 + 1.5)) { bands.push({ d: pathOf(near), w: so.fill.w }); n++ }
      }
      return n
    }
    for (const end of [0, 1]) {
      const tip = end ? full[full.length - 1] : full[0]
      const j = juncs.find(x => x.road === r && x.end === end)
      if (j) {
        const sti = roadStyle(j.into.type)
        const ci = roadCurve(j.into)
        // упёрлись в конец другой дороги — это угол или продолжение: круглый стык;
        // если дальше идёт дорога попроще (мостовая → грунтовка), главная обрывается ровно, без колпачка
        const atEnd = [ci[0], ci[ci.length - 1]].some(p => Math.hypot(p[0] - j.x, p[1] - j.y) < sti.fill.w / 2 + 0.5)
        if (atEnd) {
          if (rank(j.into) >= rank(r)) caps.push(tip)
          // главная продолжается дорогой попроще: вычитаем полосы простых дорог у стыка — край ложится по их кромке
          else bandsAt(tip, rank(r), r)
          // колеи обрезаем только на стыке двух одинаковых дорог (иначе крестик); у мостовой булыжник идёт до края
          if (j.into.type === r.type) joinEnds.push(end)
          continue
        }
        if (rank(j.into) >= rank(r)) {
          // примыкание к дороге не ниже рангом — плавный раструб, сама дорога кончается под покрытием главной
          const q = nearestRoad([j.into], j.x, j.y)
          const tI = q ? [ci[q.seg][0] - ci[q.seg - 1][0], ci[q.seg][1] - ci[q.seg - 1][1]] : [1, 0]
          const edge = P => {
            const q2 = nearestRoad([j.into], P[0], P[1])
            if (!q2) return P
            const ex = P[0] - q2.x, ey = P[1] - q2.y, l = Math.hypot(ex, ey) || 1
            return [q2.x + (ex / l) * sti.fill.w / 2, q2.y + (ey / l) * sti.fill.w / 2]
          }
          const fp = flarePath(full, j.end, [j.x, j.y], tI, st.fill.w, sti.fill.w, edge)
          if (fp) flares.push(fp)
          curve = trimEnd(curve, end, sti.fill.w / 2 * 0.9)
        } else {
          // главная дорога кончается на второстепенной: доводим до оси и вычитаем полосу второстепенной —
          // край мостовой ложится точно по кромке грунтовки, под любым углом
          if (!bandsAt([j.x, j.y], rank(r), r)) curve = trimEnd(curve, end, sti.fill.w / 2)
        }
        continue
      }
      const cut = trimAtBuilding(curve, end, plates)
      if (cut) curve = cut
      else caps.push(tip) // тупик — круглый конец
    }
    // разметка у стыка «конец в конец» обрывается чуть раньше — колеи двух дорог не перекрещиваются крестиком
    let mc = curve
    for (const end of joinEnds) if (mc.length > 1) mc = trimEnd(mc, end, st.fill.w * 0.55)
    const marks = st.marks.map(mk => ({ ...mk, d: pathOf(offsetLine(mc, mk.off)) }))
    return { ...r, st, flares, caps, marks, bands, mask: bands.length ? `url(#rm-${r.id})` : undefined, d: pathOf(curve), rank: rank(r), order: rank(r) * 1000 + (into.get(r) || 0) }
  }).sort((a, b) => a.order - b.order)
  // скругления перекрёстков — к той из двух, что рисуется раньше: вторая ляжет поверх, а колеи первой останутся
  const idx = new Map(list.map((r, i) => [r.id, i]))
  for (const c of roadCrosses.value) {
    const ia = idx.get(c.a), ib = idx.get(c.b)
    if (ia == null || ib == null) continue
    const first = list[Math.min(ia, ib)]
    first.flares.push(...crossFillets(c.X, c.d1, c.d2, first.st.fill.w, Math.min(Math.max(first.st.fill.w * 0.6, 1), 3)))
  }
  return list
})
// постройки, под которыми проходит дорога (не подъезд, а прямо насквозь) — мастеру подсвечиваем
const overRoad = computed(() => {
  if (!props.master) return new Set()
  const out = new Set()
  for (const b of placed.value) {
    const h = sideOf(b.type) / 2 - 0.5
    if (h <= 0) continue
    for (const r of roadsView.value) {
      const c = roadCurve(r)
      // точка дороги внутри плашки, и это не один из концов (подъезд)
      if (c.some((p, i) => i > 2 && i < c.length - 3 && Math.abs(p[0] - b.x) < h && Math.abs(p[1] - b.y) < h)) { out.add(b.id); break }
    }
  }
  return out
})
const roadLen = pts => pts.reduce((n, p, i) => (i ? n + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0)
const fmtHours = ms => (ms >= 3600000 ? `${(ms / 3600000).toFixed(1).replace('.', ',')} ч` : `${Math.max(1, Math.round(ms / 60000))} мин`)
const fmtLen = m => (m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1).replace('.', ',')} км` : `${Math.round(m)} м`)
// рисование новой дороги: щелчки ставят точки, двойной щелчок или Enter — готово, Backspace — убрать точку, Esc — отмена
const draft = ref([])
const lineTool = computed(() => !!(props.tool?.road || props.tool?.wall))
const draftPts = computed(() => (snapHint.value || cursor.value ? [...draft.value, snapHint.value || [cursor.value.x, cursor.value.y]] : draft.value))
const draftD = computed(() => pathOf(props.tool?.wall ? draftPts.value : roadCurve({ type: props.tool?.road, points: draftPts.value })))
const draftW = computed(() => Math.max(props.tool?.wall ? WALL_TYPES[props.tool.wall]?.w || 1.2 : ROAD_TYPES[props.tool?.road]?.w || 4, 3 * px.value))
watch(() => props.tool, () => { draft.value = [] })
// прилипание: к концам дорог (продолжить), иначе — к любой точке дороги (примыкание); null — не прилипло
function snapTo(w) {
  const tol = 12 * px.value
  let best = null, bd = tol
  // стену цепляем к концам и линиям других стен (продолжить, примкнуть, замкнуть кольцо)
  if (props.tool?.wall) {
    for (const x of wallsView.value) for (const p of [x.points[0], x.points[x.points.length - 1]]) {
      const d = Math.hypot(p[0] - w.x, p[1] - w.y)
      if (d < bd) { bd = d; best = [p[0], p[1]] }
    }
    // замкнуть свою же стену на первую точку
    if (draft.value.length > 2) { const p = draft.value[0]; if (Math.hypot(p[0] - w.x, p[1] - w.y) < bd) best = [p[0], p[1]] }
    if (best) return best
    const q = nearestWall(wallsView.value, w.x, w.y)
    return q && q.dist < tol ? [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10] : null
  }
  for (const r of roadsView.value) for (const p of [r.points[0], r.points[r.points.length - 1]]) {
    const d = Math.hypot(p[0] - w.x, p[1] - w.y)
    if (d < bd) { bd = d; best = [p[0], p[1]] }
  }
  if (best) return best
  const q = nearestRoad(roadsView.value, w.x, w.y)
  if (q && q.dist < Math.max(tol, (ROAD_TYPES[q.road.type]?.w || 4) / 2)) return [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10]
  return null
}
const snap = w => snapTo(w) || [w.x, w.y]
const snapHint = computed(() => (lineTool.value && cursor.value ? snapTo(cursor.value) : null))
// инструмент «срубить дерево»: ближайшее к курсору дерево или куст
const fellTarget = computed(() => (props.tool === 'fell' && cursor.value ? treeAt(props.settlement.terrain, props.settlement.clearings, cursor.value.x, cursor.value.y, 6 * px.value) : null))
function finishRoad() {
  const pts = draft.value.filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 2 * px.value)
  if (pts.length >= 2) emit(props.tool.wall ? 'wall' : 'road', { type: props.tool.wall || props.tool.road, points: pts })
  draft.value = []
}
// правка выбранной дороги
const editRoad = computed(() => {
  const kind = props.selected?.kind
  if (!props.master || (kind !== 'road' && kind !== 'wall') || toolActive.value) return null
  return (kind === 'wall' ? wallsView.value : roadsView.value).find(r => r.id === props.selected.id) || null
})
// кружки «вставить точку» — только на отрезках, заметных на экране
const editMids = computed(() => {
  const pts = editRoad.value?.points || []
  return pts.slice(1).map((p, i) => ({ i, p: [(p[0] + pts[i][0]) / 2, (p[1] + pts[i][1]) / 2], len: Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]) }))
    .filter(m => m.len * view.k >= 34 && cursor.value && Math.hypot(m.p[0] - cursor.value.x, m.p[1] - cursor.value.y) * view.k < 60)
})
// входы выбранной постройки: смещения от центра, лежат на краю плашки
const doorDrag = ref(null)
let lastDoorClick = null
const onEdge = (b, dx, dy) => {
  const h = sideOf(b.type) / 2
  if (Math.abs(dx) >= Math.abs(dy)) return [Math.sign(dx || 1) * h, Math.round(Math.max(-h, Math.min(h, dy)) * 10) / 10]
  return [Math.round(Math.max(-h, Math.min(h, dx)) * 10) / 10, Math.sign(dy || 1) * h]
}
const doorsView = computed(() => {
  if (props.selected?.kind !== 'building') return null
  const b0 = (props.settlement.buildings || []).find(x => x.id === props.selected.id)
  if (!b0 || b0.x == null || !sideOf(b0.type)) return null
  const b = { ...b0, doors: doorDrag.value ? doorDrag.value.doors : b0.doors || [] }
  if (!b.doors.length) return null
  const h = sideOf(b.type) / 2
  const list = b.doors.map(([dx, dy], i) => ({ i, x: b.x + dx, y: b.y + dy, deg: Math.abs(Math.abs(dx) - h) < 0.01 ? 90 : 0 }))
  return { b, list, w: Math.max(3.5, 16 * px.value), t: Math.max(1.1, 6 * px.value) }
})
function removeDoor(i) {
  const b = doorsView.value?.b
  if (!b) return
  emit('doors', { id: b.id, doors: b.doors.filter((_, k) => k !== i) })
}
// выбранная точка дороги: Delete или Backspace — убрать; правая кнопка или двойной щелчок по точке — тоже
const pointSel = ref(null)
watch(() => props.selected?.id, () => { pointSel.value = null })
function removePoint(i) {
  const r = editRoad.value
  if (!r) return
  if (r.points.length <= 2) { pointSel.value = null; return }
  emit('roadEdit', { kind: props.selected.kind, id: r.id, points: r.points.filter((_, k) => k !== i) })
  pointSel.value = null
}
let lastPointClick = null // { i, t } — свой двойной щелчок: после перерисовки браузерный dblclick теряется
let handle = null // { i, follow, start, mid } — тянут точку; пока не сдвинули на несколько пикселей — это щелчок
let lineMove = null // { start, orig, follow } — тянут линию целиком
let freehand = null // { from, start } — рисуют дорогу мышью
const handleSnap = ref(null)
const linesOf = kind => (kind === 'wall' ? wallsView.value : roadsView.value)
const sameKind = () => (props.selected?.kind === 'wall' ? props.settlement.walls || [] : props.settlement.roads || [])
// к точке прилипает конец другой линии того же вида, иначе — сама линия; skip — кого не учитывать
function snapPoint(w, kind, skip) {
  const tol = 12 * px.value
  const lines = linesOf(kind).filter(x => !skip.has(x.id))
  let best = null, bd = tol
  for (const x of lines) for (const p of [x.points[0], x.points[x.points.length - 1]]) {
    const d = Math.hypot(p[0] - w.x, p[1] - w.y)
    if (d < bd) { bd = d; best = [p[0], p[1]] }
  }
  if (best) return best
  const q = kind === 'wall' ? nearestWall(lines, w.x, w.y) : nearestRoad(lines, w.x, w.y)
  return q && q.dist < tol ? [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10] : null
}
// концы других линий, что лежат на этой линии (стыки) — двигаются вместе с ней
function followersOf(kind, line, near) {
  const out = []
  const curve = kind === 'wall' ? line.points : roadCurve(line)
  for (const x of sameKind()) {
    if (x.id === line.id) continue
    x.points.forEach((p, k) => {
      if (k !== 0 && k !== x.points.length - 1) return
      const d = near ? Math.hypot(p[0] - near[0], p[1] - near[1]) : Math.min(...curve.slice(1).map((a, i) => segDistPt(p, curve[i], a)))
      if (d < (near ? 1.5 : 2.5 + (ROAD_TYPES[x.type]?.w || 2) / 2)) out.push({ id: x.id, end: k, orig: [...p], pts: x.points })
    })
  }
  return out
}
function segDistPt([x, y], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy
  const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0
  return Math.hypot(x - ax - t * dx, y - ay - t * dy)
}
// сдвинуть концы примыкающих линий
function moveFollowers(follow, f) {
  const others = {}
  for (const q of follow) {
    const pts = (others[q.id] || q.pts).map(p => [...p])
    pts[q.end === 0 ? 0 : pts.length - 1] = f(q.orig)
    others[q.id] = pts
  }
  return others
}
// упростить ломаную, нарисованную мышью
const simplify = simplifyLine

/* ---------- отряды в округе ---------- */
const squadsView = computed(() => {
  const ms = props.settlement.marches || {}
  return (props.settlement.army?.squads || []).flatMap(q => {
    const m = ms[q.id]
    if (!m || m.away) return []
    const st = m.move ? marchState(m.move, store.now) : null
    const x = st ? st.x : m.x, y = st ? st.y : m.y
    const rest = st && !st.done ? [[x, y], ...m.move.path.slice(st.i)].map(p => p.join(',')).join(' ') : ''
    return [{ id: q.id, name: q.name, color: q.color || '#e6c27a', icon: cargoOf(q).some(c => c && c.kind !== 'other') ? 'horse' : 'flag', x, y, rest, moving: !!st, move: m.move, st }]
  })
})
// повести отряд: щелчки — точки пути; у края карты — выход на карту мира. Путь — в обход (поиск пути) или напрямую
const marchDraft = ref([])
const marchExit = ref(false)
const marchFrom = ref(null)
watch(() => props.tool?.march, qid => {
  marchDraft.value = []
  marchExit.value = false
  const p = qid && squadAt(props.settlement, qid)
  marchFrom.value = p ? [p.x, p.y] : null
}, { immediate: true })
const marchCtxNow = computed(() => (props.tool?.march ? marchCtx(props.settlement) : null))
const marchPath = computed(() => {
  if (!props.tool?.march || !marchFrom.value || !marchDraft.value.length) return null
  return planPath(marchCtxNow.value, [marchFrom.value, ...marchDraft.value], props.tool.auto !== false) || 'blocked'
})
const marchPathPts = computed(() => (Array.isArray(marchPath.value) ? marchPath.value.map(p => p.join(',')).join(' ') : ''))
const marchAim = computed(() => {
  if (!props.tool?.march || marchExit.value || !cursor.value || !marchFrom.value) return null
  const a = marchDraft.value.at(-1) || marchFrom.value
  return { x1: a[0], y1: a[1], x2: cursor.value.x, y2: cursor.value.y }
})
// для подсказки на странице: сколько идти, куда, можно ли
const marchInfo = computed(() => {
  if (!props.tool?.march) return null
  const p = marchPath.value
  if (!p) return { empty: true }
  if (p === 'blocked') return { blocked: true }
  const cum = marchTiming(marchCtxNow.value, densify(p), msPerMeter(store.data.settings))
  return { ms: cum.at(-1) / (props.tool.speed || 1), exit: marchExit.value, label: marchExit.value ? 'на карту мира' : spotLabel(props.settlement, p.at(-1)) }
})
const nearEdge = w => Math.min(w.x, w.y, WORLD - w.x, WORLD - w.y) < Math.max(EDGE * 3, 30 * px.value)
// точка прилипает к аванпосту под курсором
const marchSnap = w => { const o = (props.settlement.outposts || []).find(o => Math.hypot(o.x - w.x, o.y - w.y) < 30 * px.value); return o ? [o.x, o.y] : [w.x, w.y] }
function addMarchPoint(w) {
  if (marchExit.value) return
  if (nearEdge(w)) {
    marchDraft.value = [...marchDraft.value, edgePoint(w.x, w.y)]
    marchExit.value = true
    return
  }
  marchDraft.value = [...marchDraft.value, marchSnap(w)]
}
// правка точек: тянуть (i) или вставить новую посередине отрезка (ins — куда вставить)
const marchDrag = ref(null) // { i, p }
const marchShown = computed(() => (marchDrag.value ? marchDraft.value.map((p, i) => (i === marchDrag.value.i ? marchDrag.value.p : p)) : marchDraft.value))
const marchMids = computed(() => {
  if (!marchFrom.value || marchDrag.value) return []
  const pts = [marchFrom.value, ...marchDraft.value]
  return pts.slice(1).map((p, i) => [(p[0] + pts[i][0]) / 2, (p[1] + pts[i][1]) / 2])
})
function commitMarchDrag() {
  const { i, p } = marchDrag.value
  marchDrag.value = null
  const w = { x: p[0], y: p[1] }, last = i === marchDraft.value.length - 1
  const list = [...marchDraft.value]
  // последняя точка у края — выход на карту мира; увели от края — обычная точка
  if (last && nearEdge(w)) { list[i] = edgePoint(w.x, w.y); marchExit.value = true } else { list[i] = nearEdge(w) ? list[i] : marchSnap(w); if (last) marchExit.value = false }
  marchDraft.value = list
}
function removeMarchPoint(i) {
  if (i === marchDraft.value.length - 1) marchExit.value = false
  marchDraft.value = marchDraft.value.filter((_, k) => k !== i)
}
function undoMarchPoint() {
  marchDraft.value = marchDraft.value.slice(0, -1)
  marchExit.value = false
}
function finishMarch() {
  const p = marchPath.value
  if (!Array.isArray(p) || p.length < 2) return
  emit('march', { qid: props.tool.march, path: p, exit: marchExit.value, label: marchInfo.value?.label || '', speed: props.tool.speed || 1 })
}

/* ---------- выбор, перетаскивание ---------- */
const isSel = (kind, id) => props.selected?.kind === kind && props.selected?.id === id
function pick(kind, item) {
  if (moved || toolActive.value) return
  emit('select', isSel(kind, item.id) ? null : { kind, id: item.id })
}
const dragId = ref(null)
const dragKind = ref(null)
const dragPos = ref(null)
const dragBad = computed(() => {
  if (!dragId.value || !dragPos.value || dragKind.value !== 'building') return []
  const b = props.settlement.buildings.find(x => x.id === dragId.value)
  return b ? placementProblems(props.settlement, { ...b, ...dragPos.value }) : []
})
const outpostsView = computed(() => (props.settlement.outposts || []).map(o => (o.id === dragId.value && dragPos.value ? { ...o, ...dragPos.value } : o)))
const placedView = computed(() => placed.value.map(b => (b.id === dragId.value && dragPos.value ? { ...b, ...dragPos.value } : b)))

const pointers = new Map()
const drag = ref(false)
const panning = ref(false)
let moved = false, pinch = null, painted = []
function onDown(e) {
  const mouse = e.pointerType === 'mouse'
  if (mouse && e.button > 2) return
  // мышью карту двигают зажатым колёсиком (или правой кнопкой), левая — выбирать и ставить; пальцем — как обычно
  const panBtn = mouse && e.button !== 0
  if (mouse && e.button === 2 && doorsView.value && props.master) {
    const dd = e.target.closest?.('[data-door]')
    if (dd) { removeDoor(+dd.dataset.door); return }
  }
  if (mouse && e.button === 2 && editRoad.value) {
    const h = e.target.closest?.('[data-h]')
    if (h) { removePoint(+h.dataset.h); return }
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: !mouse || panBtn })
  moved = false
  drag.value = true
  if (panBtn) {
    e.preventDefault()
    panning.value = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    return
  }
  if (pointers.size !== 1) {
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) } }
    return
  }
  // точки пути отряда: тянуть или вставить новую
  const mp = props.tool?.march && e.target.closest?.('[data-mp], [data-mm]')
  if (mp) {
    if (mp.dataset.mm != null) {
      const i = +mp.dataset.mm, p = marchMids.value[i]
      marchDraft.value = [...marchDraft.value.slice(0, i), p, ...marchDraft.value.slice(i)]
      marchDrag.value = { i, p }
    } else marchDrag.value = { i: +mp.dataset.mp, p: marchDraft.value[+mp.dataset.mp] }
    pointers.get(e.pointerId).pan = false
    e.currentTarget.setPointerCapture?.(e.pointerId)
    return
  }
  // ворота, калитку, башню тянут вдоль их стены
  const ft = props.master && !toolActive.value && e.target.closest?.('[data-feat]')
  if (ft) {
    featDrag.value = { wallId: ft.dataset.wall, id: ft.dataset.feat, s: null, start: [e.clientX, e.clientY], moved: false }
    pointers.get(e.pointerId).pan = false
    e.currentTarget.setPointerCapture?.(e.pointerId)
    return
  }
  // вход постройки тянут по её краю
  const dr = props.master && e.target.closest?.('[data-door]')
  if (dr && doorsView.value) {
    doorDrag.value = { i: +dr.dataset.door, doors: doorsView.value.b.doors.map(d => [...d]), moved: false, start: [e.clientX, e.clientY] }
    pointers.get(e.pointerId).pan = false
    e.currentTarget.setPointerCapture?.(e.pointerId)
    return
  }
  // ручки дороги: точку тянуть (стыки других дорог в этой точке — следом), середину — вставить новую точку
  const h = e.target.closest?.('[data-h], [data-m]')
  if (h && editRoad.value) {
    const kind = props.selected.kind
    const pts = editRoad.value.points.map(p => [...p])
    if (h.dataset.m != null) handle = { i: +h.dataset.m + 1, mid: true, follow: [], start: [e.clientX, e.clientY], kind, base: pts }
    else {
      const i = +h.dataset.h
      handle = { i, follow: followersOf(kind, editRoad.value, pts[i]), end: i === 0 || i === pts.length - 1, start: [e.clientX, e.clientY], kind, base: pts }
    }
    pointers.get(e.pointerId).pan = false
    e.currentTarget.setPointerCapture?.(e.pointerId)
    return
  }
  // выбранную дорогу или стену тянут целиком за тело; примыкающие дороги тянутся концами следом
  const lid = e.target.closest?.('[data-lid]')?.dataset.lid
  if (lid && editRoad.value && lid === editRoad.value.id && mouse) {
    const kind = props.selected.kind
    lineMove = { start: toWorld(e.clientX, e.clientY), orig: editRoad.value.points.map(p => [...p]), follow: followersOf(kind, editRoad.value) }
    roadEdit.value = { kind, id: editRoad.value.id, points: lineMove.orig, others: {} }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    return
  }
  // дорогу или стену рисуют мышью: зажал левую кнопку и ведёшь
  if (lineTool.value && mouse) freehand = { from: draft.value.length, start: toWorld(e.clientX, e.clientY) }
  // мастер тянет постройку или аванпост
  if (props.tool === 'move') {
    const g = e.target.closest?.('.sm-item[data-id]')
    if (g) {
      dragId.value = g.dataset.id
      dragKind.value = g.dataset.kind
      dragPos.value = null
      e.currentTarget.setPointerCapture?.(e.pointerId)
      return
    }
  }
  // кисти рисуют сразу
  if (['fog-add', 'fog-erase', 'cut', 'grow'].includes(props.tool)) {
    painted = [toWorld(e.clientX, e.clientY)]
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
}
function onMove(e) {
  const rc = box.value?.getBoundingClientRect()
  if (rc) mouse.value = { x: e.clientX - rc.left, y: e.clientY - rc.top }
  if (box.value) { cursor.value = toWorld(e.clientX, e.clientY); describe() }
  const p = pointers.get(e.pointerId)
  // житель под курсором — подсказка (если не над постройкой и т. п.)
  if (!p && life && !toolActive.value && rc && (!hover.value || hover.value.kind === 'person')) {
    const id = life.hit(e.clientX - rc.left, e.clientY - rc.top)
    hover.value = id ? { kind: 'person', item: id } : null
  }
  if (!p) return
  if (featDrag.value) {
    const fd = featDrag.value
    if (!fd.moved && Math.hypot(e.clientX - fd.start[0], e.clientY - fd.start[1]) < 4) return
    const w = (props.settlement.walls || []).find(x => x.id === fd.wallId)
    const f = w?.features?.find(x => x.id === fd.id)
    if (!w || !f) return
    const c = toWorld(e.clientX, e.clientY), q = nearestWall([w], c.x, c.y)
    const half = (WALL_FEATURES[f.kind]?.len || 0) / 2, len = wallLength(w.points)
    featDrag.value = { ...fd, s: Math.round(Math.max(half, Math.min(len - half, q.s)) * 10) / 10, moved: true }
    moved = true
    return
  }
  if (doorDrag.value) {
    const dd = doorDrag.value
    if (!dd.moved && Math.hypot(e.clientX - dd.start[0], e.clientY - dd.start[1]) < 4) return
    const b = doorsView.value.b, w = toWorld(e.clientX, e.clientY)
    const doors = dd.doors.map(d => [...d])
    doors[dd.i] = onEdge(b, w.x - b.x, w.y - b.y)
    doorDrag.value = { ...dd, doors, moved: true }
    moved = true
    return
  }
  if (handle && !roadEdit.value) {
    if (Math.hypot(e.clientX - handle.start[0], e.clientY - handle.start[1]) < 5) return
    // потянули — теперь это правка: середина становится новой точкой
    const pts = handle.base.map(p => [...p])
    if (handle.mid) pts.splice(handle.i, 0, [(pts[handle.i - 1][0] + pts[handle.i][0]) / 2, (pts[handle.i - 1][1] + pts[handle.i][1]) / 2])
    roadEdit.value = { kind: handle.kind, id: editRoad.value.id, points: pts, others: {} }
  }
  if (handle && roadEdit.value) {
    const w = toWorld(e.clientX, e.clientY)
    // конец прилипает к другим линиям того же вида (кроме тех, что идут следом)
    const skip = new Set([roadEdit.value.id, ...handle.follow.map(q => q.id)])
    const sn = handle.end ? snapPoint(w, roadEdit.value.kind, skip) : null
    const p = sn || [Math.round(w.x * 10) / 10, Math.round(w.y * 10) / 10]
    handleSnap.value = sn
    const pts = roadEdit.value.points.map(q => [...q])
    pts[handle.i] = p
    roadEdit.value = { ...roadEdit.value, points: pts, others: moveFollowers(handle.follow, () => p) }
    moved = true
    return
  }
  if (lineMove) {
    const w = toWorld(e.clientX, e.clientY)
    let dx = w.x - lineMove.start.x, dy = w.y - lineMove.start.y
    // концы прилипают к другим линиям — тогда сдвиг подгоняем под прилипший конец
    const skip = new Set([roadEdit.value.id, ...lineMove.follow.map(q => q.id)])
    handleSnap.value = null
    for (const k of [0, lineMove.orig.length - 1]) {
      const p = lineMove.orig[k], sn = snapPoint({ x: p[0] + dx, y: p[1] + dy }, roadEdit.value.kind, skip)
      if (sn) { dx = sn[0] - p[0]; dy = sn[1] - p[1]; handleSnap.value = sn; break }
    }
    const mv = p => [Math.round((p[0] + dx) * 10) / 10, Math.round((p[1] + dy) * 10) / 10]
    roadEdit.value = { ...roadEdit.value, points: lineMove.orig.map(mv), others: moveFollowers(lineMove.follow, mv) }
    if (Math.abs(dx) + Math.abs(dy) > 0.3) moved = true
    return
  }
  if (freehand) {
    const w = toWorld(e.clientX, e.clientY)
    const pts = draft.value, last = pts[pts.length - 1]
    if (pts.length === freehand.from) { if (Math.hypot(w.x - freehand.start.x, w.y - freehand.start.y) * view.k > 6) draft.value = [...pts, snap(freehand.start), [w.x, w.y]] }
    else if (Math.hypot(w.x - last[0], w.y - last[1]) >= Math.max(2, 10 * px.value)) draft.value = [...pts, [w.x, w.y]]
    if (draft.value.length > freehand.from) moved = true
    return
  }
  if (marchDrag.value) {
    const w = toWorld(e.clientX, e.clientY)
    marchDrag.value = { ...marchDrag.value, p: [w.x, w.y] }
    moved = true
    return
  }
  if (dragId.value) {
    const w = toWorld(e.clientX, e.clientY)
    dragPos.value = { x: w.x, y: w.y }
    moved = true
    return
  }
  if (painted.length && pointers.size === 1) {
    const w = toWorld(e.clientX, e.clientY), last = painted[painted.length - 1]
    if (Math.hypot(w.x - last.x, w.y - last.y) > props.brush * 0.5) painted.push(w)
    moved = true
    return
  }
  const dx = e.clientX - p.x, dy = e.clientY - p.y
  p.x = e.clientX
  p.y = e.clientY
  if (Math.abs(dx) + Math.abs(dy) > 1) moved = true
  if (pointers.size === 2 && pinch) {
    const [a, b] = [...pointers.values()]
    const d = Math.hypot(a.x - b.x, a.y - b.y)
    zoomAt((a.x + b.x) / 2 - rc.left, (a.y + b.y) / 2 - rc.top, d / pinch.d)
    pinch.d = d
  } else if (pointers.size === 1) {
    if (!drag.value || !p.pan) return
    if (moved) panning.value = true
    view.x += dx
    view.y += dy
    if (moved) e.currentTarget.setPointerCapture?.(e.pointerId)
  }
}
function onUp(e) {
  const up = e.type === 'pointerup'
  if (featDrag.value) {
    const fd = featDrag.value
    featDrag.value = null
    if (up && fd.moved) emit('featureMove', { wallId: fd.wallId, id: fd.id, s: fd.s })
    else if (up) { const w = wallsDraw.value.find(x => x.id === fd.wallId); if (w) pick('wall', w) }
    return release(e)
  }
  if (doorDrag.value) {
    const dd = doorDrag.value
    doorDrag.value = null
    if (up && dd.moved) emit('doors', { id: doorsView.value.b.id, doors: dd.doors })
    else if (up) {
      // двойной щелчок по входу — убрать
      const now = Date.now()
      if (lastDoorClick && lastDoorClick.i === dd.i && now - lastDoorClick.t < 450) { lastDoorClick = null; removeDoor(dd.i) } else lastDoorClick = { i: dd.i, t: now }
    }
    return release(e)
  }
  if (handle && !roadEdit.value) {
    const hd = handle
    handle = null
    if (up && !hd.mid) {
      const now = Date.now()
      if (lastPointClick && lastPointClick.i === hd.i && now - lastPointClick.t < 450) { lastPointClick = null; removePoint(hd.i) }
      else { lastPointClick = { i: hd.i, t: now }; pointSel.value = hd.i }
    }
    return release(e)
  }
  if ((handle || lineMove) && roadEdit.value) {
    if (up && moved) emit('roadEdit', { kind: roadEdit.value.kind, id: roadEdit.value.id, points: roadEdit.value.points, others: roadEdit.value.others })
    handle = null
    lineMove = null
    handleSnap.value = null
    roadEdit.value = null
    return release(e)
  }
  if (freehand) {
    const f = freehand
    freehand = null
    if (moved && up) {
      // конец штриха прилипает, линию упрощаем; если рисовали с нуля — сразу готово
      const w = toWorld(e.clientX, e.clientY)
      const stroke = [...draft.value.slice(f.from), snap(w)]
      draft.value = [...draft.value.slice(0, f.from), ...simplify(stroke, Math.max(0.8, 2.5 * px.value))]
      if (f.from === 0 && draft.value.length >= 2) finishRoad()
      return release(e)
    }
  }
  if (marchDrag.value) {
    commitMarchDrag()
    return release(e)
  }
  if (dragId.value) {
    if (up && dragPos.value && !dragBad.value.length) emit('moved', { id: dragId.value, kind: dragKind.value, ...dragPos.value })
    dragId.value = null
    dragPos.value = null
    return release(e)
  }
  if (painted.length) {
    if (up) emit(props.tool === 'cut' || props.tool === 'grow' ? 'cut' : 'fog', { erase: props.tool === 'fog-erase' || props.tool === 'grow', points: painted, r: props.brush })
    painted = []
    return release(e)
  }
  const primary = (e.button === 0 && !pointers.get(e.pointerId)?.pan) || e.pointerType !== 'mouse'
  if (!moved && up && primary && toolActive.value && pointers.size === 1) {
    const w = toWorld(e.clientX, e.clientY)
    if (props.tool === 'fell') { const tr = treeAt(props.settlement.terrain, props.settlement.clearings, w.x, w.y, 6 * px.value); if (tr) emit('fell', tr) }
    else if (props.tool.road || props.tool.wall) draft.value = [...draft.value, snap(w)]
    else if (props.tool.wallFeature) { if (featureAim.value) emit('wallFeature', { wallId: featureAim.value.wallId, s: featureAim.value.s, kind: props.tool.wallFeature }) }
    else if (placeType.value && !cursorBad.value.length) emit('placed', { type: placeType.value, id: props.tool.placeExisting, ...w })
    else if (props.tool.explore) emit('explore', w)
    else if (props.tool.march && !e.target.closest?.('[data-mp], [data-mm]')) addMarchPoint(w)
  }
  // клик по пустому месту снимает выбор
  if (!moved && primary && !toolActive.value && up && e.target.closest && !e.target.closest('.sm-item, .sm-road-hit, .sm-handle, .sm-ctrl')) {
    // щелчок по жителю — показать, кто это
    const rc = box.value.getBoundingClientRect()
    const id = life?.hit(e.clientX - rc.left, e.clientY - rc.top)
    personSel.value = id || null
    if (id) emit('person', id)
    else emit('select', null)
  }
  release(e)
}
function release(e) {
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinch = null
  if (!pointers.size) { drag.value = false; panning.value = false }
  setTimeout(() => { moved = false })
}
function onDbl(e) {
  if (lineTool.value) { finishRoad(); return }
  if (props.tool?.march) {
    const mp = e.target.closest?.('[data-mp]')
    if (mp) removeMarchPoint(+mp.dataset.mp)
    else finishMarch()
    return
  }
  // двойной щелчок по точке убирает её — это ловит onUp (два щелчка подряд), здесь ничего не делаем
}
function onLeave() { hover.value = null; cursor.value = null; place.value = '' }
function onKey(e) {
  if (editRoad.value && pointSel.value != null && (e.key === 'Delete' || e.key === 'Backspace') && !e.target?.closest?.('input, textarea, select, [contenteditable]')) {
    e.preventDefault()
    removePoint(pointSel.value)
    return
  }
  if (props.tool?.march && !e.target?.closest?.('input, textarea, select, [contenteditable]')) {
    if (e.key === 'Enter') finishMarch()
    else if (e.key === 'Backspace') { undoMarchPoint(); e.preventDefault() }
    return
  }
  if (!lineTool.value || e.target?.closest?.('input, textarea, select, [contenteditable]')) return
  if (e.key === 'Enter') finishRoad()
  else if (e.key === 'Backspace') { draft.value = draft.value.slice(0, -1); e.preventDefault() }
  else if (e.key === 'Escape') draft.value = []
}

/* ---------- подсказки ---------- */
const mouse = ref({ x: 0, y: 0 })
const hover = ref(null)
const tipPos = computed(() => ({ left: Math.min(mouse.value.x + 16, size.w - 230) + 'px', top: Math.min(mouse.value.y + 16, size.h - 120) + 'px' }))
const tip = computed(() => {
  const h = hover.value
  if (!h) return null
  if (h.kind === 'outpost') {
    const o = h.item
    return { title: `Аванпост «${OUTPOSTS[o.type]?.label}»`, lines: [`Рабочие: ${o.workers} из ${o.places}`, Object.entries(o.yields || {}).map(([k, v]) => `${RES[k]?.label} +${v}`).join(', '), `${fmtLen(Math.hypot(o.x - CENTER, o.y - CENTER))} от поселения`] }
  }
  if (h.kind === 'squad') {
    const m = h.item
    return { title: `Отряд «${m.name}»`, lines: m.st && !m.st.done ? [`Идёт: ${m.move.label}`, `Осталось ≈ ${fmtHours(m.st.left)}`] : ['Стоит в округе'] }
  }
  if (h.kind === 'road') return { title: h.item.name || ROAD_TYPES[h.item.type]?.label, lines: [`Длина: ${fmtLen(roadLen(h.item.points))}`] }
  if (h.kind === 'door') return { title: 'Вход', lines: props.master ? ['Сюда входят и отсюда выходят жители', 'Тяни по краю — передвинуть', 'Правая кнопка или двойной щелчок — убрать'] : ['Сюда входят и отсюда выходят жители'] }
  if (h.kind === 'point') return { title: 'Точка дороги', lines: ['Тяни — передвинуть', 'Убрать: правая кнопка, двойной щелчок или щёлкни и нажми Delete'] }
  if (h.kind === 'mid') return { title: 'Новая точка', lines: ['Потяни — появится точка'] }
  if (h.kind === 'needGate') return { title: 'Дорога упирается в стену', lines: ['Щёлкни — поставить ворота'] }
  if (h.kind === 'wall' || h.kind === 'wallFeature') {
    const w = h.kind === 'wall' ? h.item : h.wall, t = WALL_TYPES[w.type] || WALL_TYPES.palisade
    const lines = [`Длина: ${fmtLen(w.len)}`, w.built < w.len - 0.1 ? `Стройка: ${fmtLen(w.built)} из ${fmtLen(w.len)}` : 'Построена', `Защита +${wallDefense([{ ...w, id: '_' }])}`]
    if (h.kind === 'wallFeature') return { title: WALL_FEATURES[h.item.kind].label + (h.item.built ? '' : ' (строится)'), lines: [`На стене: ${w.name || t.label.toLowerCase()}`, ...(props.master ? ['Тяни — передвинуть вдоль стены'] : [])] }
    return { title: w.name || t.label, lines }
  }
  if (h.kind === 'person') {
    const info = personInfo(h.item)
    return info ? { title: info.p.name, lines: [`${RACES[info.p.race]?.label || ''}${info.p.kid ? ', ребёнок' : ''} · ${info.p.age} лет`, `Работа: ${jobLabel(info.p)}`, `Сейчас: ${info.act}`] } : null
  }
  const b = h.item, d = tierOf(b) || BUILDINGS[b.type]
  const lines = [`${CATEGORIES[d.cat]?.label} · ${SIZES[d.size]?.label}${SIZES[d.size]?.area ? ' (' + SIZES[d.size].area + ')' : ''}`]
  for (const [j, n] of Object.entries(d.jobs || {})) lines.push(`${JOBS[j]?.label || j}: ${n} мест`)
  if (d.housing) lines.push(`Жильё: ${d.housing}`)
  if (overRoad.value.has(b.id)) lines.push('⚠ Стоит прямо на дороге — передвинь постройку или дорогу')
  if (b.damage && DAMAGE[b.damage]) {
    lines.push(`${DAMAGE[b.damage].label} — работает на ${Math.round(DAMAGE[b.damage].work * 100)}%`)
    if (b.repair) lines.push(`Ремонт: ${Math.floor(b.repair.progress || 0)} из ${repairWork(b)}`)
  }
  return { title: b.name || d.label, lines, bad: overRoad.value.has(b.id) }
})
// строка состояния: местность под курсором и расстояние до поселения
const place = ref('')
let describeTimer = 0
function describe() {
  if (describeTimer) return
  describeTimer = setTimeout(() => {
    describeTimer = 0
    const c = cursor.value
    if (!c) return
    if (c.x < 0 || c.y < 0 || c.x > WORLD || c.y > WORLD) { place.value = 'за краем округи'; return }
    const gen = makeTerrain(props.settlement.terrain)
    gen.setClearings(props.settlement.clearings || [])
    const code = gen.sample(c.x, c.y, {}).code
    place.value = `${BIOME_LABEL[code]} · ${fmtLen(Math.hypot(c.x - CENTER, c.y - CENTER))} от центра`
  }, 60)
}

/* ---------- жизнь: жители и часы ---------- */
const lifeCv = ref(null)
const personSel = ref(null)
let life = null, clockTimer = 0
const clockNow = ref(Date.now())
const clockView = computed(() => {
  const t = clockMin(props.settlement, clockNow.value + (store.clockOffset || 0)), dt = dayTime(t), pd = partOfDay(dt.of)
  return { time: dt.text, day: dt.day, icon: pd.icon, part: pd.label, dark: darkness(dt.of) > 0.3, speed: clockOf(props.settlement).speed || 0 }
})
// сборища — раз в секунду вместе с часами
const crowds = computed(() => {
  const t = clockMin(props.settlement, clockNow.value + (store.clockOffset || 0)), day = Math.floor(t / DAY_MIN)
  const cast = buildCast(props.settlement)
  return gatherings(cast, snapshotAt(cast, dayPlans(cast, day), t - day * DAY_MIN), t - day * DAY_MIN)
})
// кто это и что делает сейчас
function personInfo(id) {
  const cast = buildCast(props.settlement)
  const p = cast.people.find(x => x.id === id)
  if (!p) return null
  const t = clockMin(props.settlement, Date.now() + (store.clockOffset || 0)), day = Math.floor(t / DAY_MIN)
  const st = personAt(dayPlans(cast, day)[id], t - day * DAY_MIN)
  return { p, st, act: p.away ? `ушёл с отрядом «${p.away}»` : ACTS[st?.act]?.label || 'дома' }
}
// показать жителя на карте (из вкладки «Жизнь»)
function focusPerson(id) {
  const info = personInfo(id)
  if (!info?.st) return false
  personSel.value = id
  // внутри постройки — показываем саму постройку (на ней значок, сколько народу внутри)
  const pl = info.st.hidden && info.st.sg?.place && buildCast(props.settlement).byId[info.st.sg.place]
  if (pl) { focusAt(pl.x, pl.y, 4); return true }
  if (info.st.hidden) return false
  const k = Math.max(view.k, 5)
  Object.assign(view, { k, x: size.w / 2 - info.st.x * k, y: size.h / 2 - info.st.y * k })
  scheduleDraw()
  return true
}
function focusAt(x, y, k = 3) {
  Object.assign(view, { k: Math.max(view.k, k), x: size.w / 2 - x * Math.max(view.k, k), y: size.h / 2 - y * Math.max(view.k, k) })
  scheduleDraw()
}
const onVis = () => (document.hidden ? life?.stop() : life?.start())

let ro = null
onMounted(() => {
  life = createLifeLayer(lifeCv.value, () => ({ s: props.settlement, view, size, offset: store.clockOffset || 0, selected: personSel.value }))
  life.start()
  clockTimer = setInterval(() => { clockNow.value = Date.now() }, 1000)
  document.addEventListener('visibilitychange', onVis)
  ro = new ResizeObserver(([e]) => {
    const first = !size.w
    size.w = e.contentRect.width
    size.h = e.contentRect.height
    if (first) fit()
    scheduleDraw()
  })
  ro.observe(box.value)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  life?.stop()
  clearInterval(clockTimer)
  document.removeEventListener('visibilitychange', onVis)
  ro?.disconnect()
  tiles.destroy()
  window.removeEventListener('keydown', onKey)
})
defineExpose({ fit, fitAll, finishRoad, draft, finishMarch, undoMarchPoint, marchInfo, marchDraft, focusPerson, focusAt, personSel, pointSel })
</script>

<style scoped>
.sm { position: relative; overflow: hidden; background: #161a1f; touch-action: none; cursor: default; user-select: none; }
.sm.grabbing { cursor: grabbing; }
.sm-tiles { position: absolute; inset: 0; width: 100%; height: 100%; }
.sm-life { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.sm-clock { position: absolute; z-index: 2; left: 50%; bottom: 48px; transform: translateX(-50%); white-space: nowrap; display: flex; align-items: center; gap: 6px; padding: 5px 9px; border-radius: 11px; background: rgba(23, 19, 14, .9); border: 1px solid #8a6630; color: #e9dfc8; font: 700 12.5px 'Manrope', sans-serif; box-shadow: 0 6px 18px rgba(0, 0, 0, .45); }
.sm-clock b { font: 700 17px 'Cormorant Garamond', Georgia, serif; color: #f3d99a; font-variant-numeric: tabular-nums; }
.sm-clock small { color: #a8936c; font-weight: 700; }
.sm-clock em { font-style: normal; color: #ffb36b; font-size: 11.5px; }
.sm-clock.night { border-color: #4f5c8a; }
.sm-crowds { position: absolute; z-index: 2; right: 10px; bottom: 190px; display: grid; justify-items: end; gap: 4px; max-width: min(320px, 70%); }
.sm-crowds button { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(23, 19, 14, .88); color: #e9dfc8; font: 700 12px 'Manrope', sans-serif; cursor: pointer; text-align: left; animation: sm-crowd-in .35s ease-out; }
.sm-crowds button:disabled { cursor: default; }
.sm-crowds button.riot { border-color: rgba(255, 107, 91, .7); color: #ffc2bb; }
@keyframes sm-crowd-in { from { opacity: 0; transform: translateX(10px); } }
.sm-clock button { min-width: 26px; padding: 2px 6px; border-radius: 7px; border: 1px solid rgba(231, 197, 111, .25); background: none; color: #d9cdb0; font: 700 11.5px 'Manrope', sans-serif; cursor: pointer; }
.sm-clock button.on { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border-color: transparent; }
.sm-svg { position: relative; display: block; }
.sm-world { fill: none; stroke: rgba(231, 197, 111, .55); stroke-width: 2; stroke-dasharray: 2 10; stroke-linecap: round; pointer-events: none; }
.sm-fog { pointer-events: none; opacity: .86; }
.rd { fill: none; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
.rd.bt { stroke-linecap: butt; }
.sm-roads path:not(.sm-road-hit) { pointer-events: none; }
.sm-road-hit { fill: none; stroke: transparent; stroke-linecap: round; stroke-linejoin: round; cursor: pointer; pointer-events: stroke; }
.sm-snap { fill: rgba(255, 243, 196, .2); stroke: #fff3c4; stroke-width: 2; pointer-events: none; }
.sm-fell { fill: rgba(224, 180, 124, .18); stroke: #e0b47c; stroke-width: 2; stroke-dasharray: 4 3; pointer-events: none; }
.sm-draft { stroke: rgba(243, 217, 154, .75); stroke-dasharray: 6 4; stroke-linecap: round; stroke-linejoin: round; }
.sm-draft.wall { stroke: rgba(176, 132, 79, .85); stroke-dasharray: none; stroke-linecap: butt; }
.sm-walls .rd { stroke-linecap: butt; stroke-linejoin: round; }
.sm-walls .rd.logs { stroke-linecap: round; }
.sm-wall-plan { stroke: rgba(243, 217, 154, .55); }
.sm-wfeat { cursor: pointer; }
.sm-wfeat.plan { opacity: .55; }
.sm-wfeat.movable { cursor: grab; }
.sm-feat-hit { fill: transparent; pointer-events: all; }
.sm-door { stroke: #c49a5a; }
.sm-wfeat.aim { pointer-events: none; }
.sm-wfeat.aim rect { fill: rgba(155, 224, 122, .35); stroke: #9be07a; stroke-width: 2; }
.sm-wfeat.aim line { stroke: rgba(155, 224, 122, .85); }
.sm-needgate { cursor: pointer; }
.sm-needgate circle { fill: rgba(224, 40, 30, .85); stroke: #fff; stroke-width: 2; animation: sm-ng 1.4s ease-in-out infinite; }
.sm-needgate text { fill: #fff; font-weight: 900; text-anchor: middle; pointer-events: none; }
@keyframes sm-ng { 50% { opacity: .55; } }
.sm-draft-pt { fill: #f3d99a; stroke: #3a2a14; stroke-width: 1.5; }
.sm-draft-pt.exit { fill: #6fd6e8; }
.sm-march-pt { cursor: grab; }
/* отряды в округе */
.sm-squad { cursor: pointer; }
.sm-squad-dot { stroke: #1b1408; stroke-width: 2; filter: drop-shadow(0 1px 3px rgba(0, 0, 0, .6)); }
.sm-squad.sel .sm-squad-dot { stroke: #fff3c4; stroke-width: 3; filter: url(#sm-glow); }
.sm-squad.moving .sm-squad-dot { animation: sm-squad-pulse 2.4s ease-in-out infinite; }
@keyframes sm-squad-pulse { 50% { stroke: #fff3c4; } }
.sm-march-route { fill: none; stroke-width: 3; stroke-dasharray: 7 6; stroke-linecap: round; stroke-linejoin: round; opacity: .85; pointer-events: none; }
.sm-march-plan { fill: none; stroke: #c7e07a; stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; filter: drop-shadow(0 0 2px rgba(0, 0, 0, .8)); }
.sm-march-aim { stroke: rgba(199, 224, 122, .6); stroke-width: 2; stroke-dasharray: 4 5; pointer-events: none; }
.sm-item { cursor: pointer; }
.sm-plate { fill: #d6d2c8; stroke: var(--cat, #8a7a5a); stroke-width: 2.5; }
.sm-plate.outpost { fill: #cfc6b2; stroke: #6b5127; }
.sm-plate.personal { fill: #e9e2cf; stroke: #e6c27a; stroke-width: 3; }
.sm-field { stroke: #7d6c2c; stroke-width: 2; }
.sm-item:hover .sm-plate { filter: brightness(1.08); }
.sm-item.sel .sm-plate, .sm-item.sel .sm-field { filter: url(#sm-glow); stroke: #fff3c4; stroke-width: 3; }
.sm-outpost-ring { fill: rgba(255, 240, 200, .08); stroke: rgba(255, 236, 190, .7); stroke-width: 1.5; stroke-dasharray: 5 5; }
.sm-outpost-ring.depleting { stroke: #ff8a3d; }
.sm-label { font-family: 'Manrope', sans-serif; font-weight: 800; text-anchor: middle; fill: #fff6e0; paint-order: stroke; stroke: rgba(30, 22, 12, .85); pointer-events: none; }
.sm-label.town { fill: #f3d99a; font-family: 'Cormorant Garamond', Georgia, serif; }
.sm-town-dot { fill: #f3d99a; stroke: #3a2a14; stroke-width: 2; }
.sm-town { pointer-events: none; }
.sm-tip { position: absolute; z-index: 3; width: max-content; max-width: 230px; display: grid; gap: 2px; padding: 8px 11px; border-radius: 10px; background: rgba(23, 19, 14, .95); border: 1px solid #8a6630; color: #d9cdb0; font: 600 12px 'Manrope', sans-serif; pointer-events: none; box-shadow: 0 8px 22px rgba(0, 0, 0, .5); }
.sm-tip b { color: #f3d99a; font: 700 15px 'Cormorant Garamond', Georgia, serif; }
.sm-ctrl { position: absolute; right: 12px; bottom: 12px; display: grid; gap: 6px; }
.sm-ctrl button { width: 34px; height: 34px; border-radius: 10px; border: 1px solid #8a6630; background: rgba(23, 19, 14, .9); color: #f3d99a; font: 700 18px 'Manrope', sans-serif; cursor: pointer; }
.sm-ctrl button:hover { background: rgba(60, 46, 28, .95); }
.sm-status { position: absolute; left: 12px; bottom: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; max-width: calc(100% - 70px); padding: 5px 10px; border-radius: 9px; background: rgba(13, 16, 23, .78); color: #d9cdb0; font: 600 11.5px 'Manrope', sans-serif; pointer-events: none; }
.sm-scale { display: inline-flex; align-items: center; gap: 6px; }
.sm-scale i { display: inline-block; height: 6px; border: 2px solid #f3d99a; border-top: 0; }
.sm.tool-move .sm-item { cursor: move; }
.sm.tool-paint { cursor: crosshair; }
.sm-item.dragging { opacity: .9; }
.sm-item.bad .sm-plate { stroke: #ff4a3d; fill: #f3c6c0; }
/* мастеру: постройка стоит прямо на дороге */
.sm-item.onroad .sm-plate { stroke: #ff4a3d; stroke-dasharray: 5 3; }
.sm-item.building .sm-plate { stroke-dasharray: 6 4; fill: #c9c2b2; opacity: .88; }
.sm-prog-bg { fill: rgba(20, 16, 10, .75); }
.sm-prog { fill: #e6c27a; }
.sm-prog.repair { fill: #6fd6e8; }
.sm-dmg { pointer-events: none; }
.sm-crack { fill: none; stroke: #2b2118; stroke-width: 2; stroke-linejoin: round; opacity: .85; }
.sm-dmg-dot { fill: var(--dc); stroke: #1b140c; stroke-width: 1.5; }
.sm-dmg text { fill: #1b140c; font-weight: 900; text-anchor: middle; font-family: 'Manrope', sans-serif; }
.sm-item.dmg-ruined .sm-dmg text { fill: #fff; }
.sm-item.dmg-medium image, .sm-item.dmg-major image { filter: saturate(.55) brightness(.9); }
.sm-item.dmg-major .sm-plate { fill: #c4b9a6; }
.sm-item.dmg-ruined .sm-plate { fill: #57504a; stroke: #2b2621; stroke-dasharray: 5 3; }
.sm-item.dmg-ruined image { opacity: .35; filter: grayscale(1); }
.sm-ghost { pointer-events: none; }
.sm-ghost-plate { fill: rgba(243, 217, 154, .25); stroke: #f3d99a; stroke-width: 2; stroke-dasharray: 7 5; }
.sm-ghost-explore { fill: rgba(243, 217, 154, .12); stroke: #f3d99a; stroke-width: 2; stroke-dasharray: 8 6; }
.sm-label.ghost { fill: #f3d99a; }
.sm-handle { fill: #fff3c4; stroke: #3a2a14; stroke-width: 1.5; cursor: grab; }
.sm-handle.mid { fill: rgba(255, 243, 196, .55); }
.sm-handle.end { fill: #ffe08a; stroke-width: 2; }
.sm-plaza { stroke: #4c4a45; stroke-width: 2.5; }
.sm-fountain { animation: sm-fount 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes sm-fount { 50% { transform: scale(1.6); opacity: .7; } }
@media (prefers-reduced-motion: reduce) { .sm-fountain { animation: none; } }
.sm-door-plate { fill: #8a5a2c; stroke: #2a1a0c; stroke-width: 0.25; }
.sm-door-line { stroke: #f0d083; stroke-width: 0.25; }
.sm-doors g.edit { cursor: grab; }
.sm-doors g:hover .sm-door-plate { fill: #b07a3e; }
.sm-handle.picked { fill: #ff8a6b; stroke: #fff; stroke-width: 2.5; }
.sm-handle.mid { opacity: .8; }
.sm-road-hit.movable { cursor: move; }
.sm-cursor { pointer-events: none; }
.sm-cursor.bad .sm-ghost-plate { stroke: #ff4a3d; fill: rgba(255, 74, 61, .2); }
.sm-brush { fill: rgba(243, 217, 154, .14); stroke: #f3d99a; stroke-width: 2; stroke-dasharray: 6 5; }
.sm-brush.erase { fill: rgba(40, 44, 50, .35); stroke: #9aa3ad; }
.sm-brush.cut { fill: rgba(196, 150, 90, .2); stroke: #e0b47c; }
.sm-brush.grow { fill: rgba(90, 160, 80, .22); stroke: #8fd062; }
.sm-tip.bad { border-color: rgba(255, 107, 94, .7); color: #ffc2bb; }
@media (max-width: 700px) { .sm-status { font-size: 10.5px; } }
</style>
