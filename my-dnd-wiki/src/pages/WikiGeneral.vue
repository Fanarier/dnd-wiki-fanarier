<template>
  <v-card class="pa-4" elevation="4">
    <v-card-title>
      <div>
        <h2>Общее — Тренировка заклинаний и ритуалов</h2>
        <div class="subtitle-1">Краткая памятка и подробные правила по тренировке, обучению школ и уровням сложности освоения.</div>
      </div>
    </v-card-title>

    <v-card-text>
      <!-- Quick reference -->
      <v-row class="mb-4" align="stretch">
        <v-col cols="12" md="4">
          <v-card outlined class="pa-3 quick-card">
            <div class="card-title">Длительность и выносливость</div>
            <ul>
              <li><strong>Тренировка заклинания:</strong> 1 день — <strong>2 выносливости</strong>.</li>
              <li><strong>Ритуал:</strong> 2 дня — <strong>4 выносливости</strong>.</li>
            </ul>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <v-card outlined class="pa-3 quick-card">
            <div class="card-title">Требуемые очки</div>
            <ul>
              <li><strong>Освоение заклинания:</strong> 50 очков тренировки.</li>
              <li><strong>Освоение ритуала:</strong> 100 очков тренировки.</li>
            </ul>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <v-card outlined class="pa-3 quick-card">
            <div class="card-title">Владение школой</div>
            <ul>
              <li><strong>Базовое:</strong> 100 очков → открывает 1–3 круги</li>
              <li><strong>Экспертное:</strong> 200 очков → открывает 4–6 круги</li>
              <li><strong>Легендарное:</strong> 400 очков → открывает 7–9 круги</li>
            </ul>
          </v-card>
        </v-col>
      </v-row>

      <!-- How to train -->
      <section class="mb-4">
        <h3>Как проходят тренировки</h3>
        <p class="lead">
          Тренировка — деятельность, дающая прогресс в очках тренировки. Для освоения заклинания/ритуала нужно накопить соответствующее количество очков.
          Тренировка занимает 1 день и 2 выносливости; ритуал — 2 дня и 4 выносливости.
        </p>

        <ol>
          <li><strong>Выбор цели:</strong> определите заклинание или ритуал и убедитесь, что вы изучили соответствующую школу.</li>
          <li><strong>Проведение сессии:</strong> проведите тренировку (1 день / 2 выносливости) или ритуал (2 дня / 4 выносливости), применив бонусы.</li>
          <li><strong>Накопление очков:</strong> суммируйте очки; при достижении порога — заклинание/ритуал освоен.</li>
        </ol>

        <v-row>
          <v-col cols="12" md="6">
            <v-card outlined class="pa-3">
              <strong>Проверки обучения</strong>
              <p>Для изучения школы используется бросок: <em>к20 + Модификатор Магии + Бонусы обучения</em>. Очки обучения накапливаются по результатам таких проверок.</p>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <v-card outlined class="pa-3">
              <strong>Практические советы</strong>
              <ul>
                <li>Планируйте несколько подряд дней для ритуалов (они занимают 2 дня).</li>
                <li>Используйте предметы и эффекты, дающие бонусы к обучению и к освоению заклинаний.</li>
              </ul>
            </v-card>
          </v-col>
        </v-row>
      </section>

      <!-- Parameters -->
      <section class="mb-4">
        <h3>Параметры магии и модификаторы</h3>
        <p><strong>Дальность:</strong> по умолчанию равна вашему радиусу обзора; если у заклинания указана иная дальность — она в описании заклинания.</p>
        <p><strong>Атаки:</strong> каждое атакующее заклинание требует бросок кости атаки, если иное не указано.</p>
        <p><strong>КММ (Классовый Модификатор Магии):</strong> у каждого класса, использующего магию, КММ берётся из одной характеристики (Сила, Телосложение, Интеллект, Харизма, Ловкость, Мудрость). Этот модификатор влияет на урон и сложность заклинаний; указан в описании класса/архетипа.</p>
      </section>

      <!-- Difficulty levels -->
      <section class="mb-4">
        <h3>Уровни сложности освоения</h3>
        <p>Шкала сложности (диапазоны итоговой проверки):</p>
        <ul>
          <li><strong>Легко:</strong> 0–7</li>
          <li><strong>Средне:</strong> 8–14</li>
          <li><strong>Сложно:</strong> 15–22</li>
          <li><strong>Очень сложно:</strong> 23–26</li>
          <li><strong>Невероятно сложно:</strong> 27–30</li>
          <li><strong>Невозможно:</strong> 30+</li>
        </ul>
        <p>Проверка освоения для заклинания из изученного круга: <em>к10 + Модификатор Магии + Бонусы тренировки</em>.</p>
        <p class="muted">Пояснение к таблице: колонка «Количество заклинаний» показывает примерную плотность заклинаний в круге; «Ожидаемая сложность» — ориентир для ГМа и игрока.</p>

        <!-- Полная таблица сложности -->
        <div class="table-wrap">
          <table class="magic-table">
            <caption class="table-caption">Соответствие количества заклинаний круга и ориентировочной сложности освоения</caption>
            <thead>
              <tr>
                <th>Круг</th>
                <th>Количество заклинаний</th>
                <th>Ожидаемая сложность</th>
              </tr>
            </thead>
            <tbody>
              <!-- Базовая -->
              <tr><td>Базовая</td><td>Любое</td><td>Легко</td></tr>

              <!-- Круг 1 -->
              <tr><td>1</td><td>1–5</td><td>Легко</td></tr>
              <tr><td>1</td><td>6–9</td><td>Легко</td></tr>
              <tr><td>1</td><td>11–14</td><td>Средне</td></tr>
              <tr><td>1</td><td>15–19</td><td>Средне</td></tr>
              <tr><td>1</td><td>20–24</td><td>Сложно</td></tr>
              <tr><td>1</td><td>25+</td><td>Очень сложно</td></tr>

              <!-- Круг 2 -->
              <tr><td>2</td><td>1–5</td><td>Легко</td></tr>
              <tr><td>2</td><td>6–9</td><td>Легко</td></tr>
              <tr><td>2</td><td>11–14</td><td>Средне</td></tr>
              <tr><td>2</td><td>15–19</td><td>Сложно</td></tr>
              <tr><td>2</td><td>20–24</td><td>Сложно</td></tr>
              <tr><td>2</td><td>25+</td><td>Очень сложно</td></tr>

              <!-- Круг 3 -->
              <tr><td>3</td><td>1–5</td><td>Легко</td></tr>
              <tr><td>3</td><td>6–9</td><td>Средне</td></tr>
              <tr><td>3</td><td>11–14</td><td>Сложно</td></tr>
              <tr><td>3</td><td>15–19</td><td>Очень сложно</td></tr>
              <tr><td>3</td><td>20–24</td><td>Очень сложно</td></tr>
              <tr><td>3</td><td>25+</td><td>Невероятно сложно</td></tr>

              <!-- Круг 4 -->
              <tr><td>4</td><td>1–5</td><td>Легко</td></tr>
              <tr><td>4</td><td>6–9</td><td>Средне</td></tr>
              <tr><td>4</td><td>11–14</td><td>Сложно</td></tr>
              <tr><td>4</td><td>15–19</td><td>Очень сложно</td></tr>
              <tr><td>4</td><td>20–24</td><td>Очень сложно</td></tr>
              <tr><td>4</td><td>25+</td><td>Невероятно сложно</td></tr>

              <!-- Круг 5 -->
              <tr><td>5</td><td>1–5</td><td>Средне</td></tr>
              <tr><td>5</td><td>6–9</td><td>Сложно</td></tr>
              <tr><td>5</td><td>11–14</td><td>Сложно</td></tr>
              <tr><td>5</td><td>15–19</td><td>Очень сложно</td></tr>
              <tr><td>5</td><td>20–24</td><td>Невероятно сложно</td></tr>
              <tr><td>5</td><td>25+</td><td>Невозможно</td></tr>

              <!-- Круг 6 -->
              <tr><td>6</td><td>1–5</td><td>Средне</td></tr>
              <tr><td>6</td><td>6–9</td><td>Сложно</td></tr>
              <tr><td>6</td><td>11–14</td><td>Сложно</td></tr>
              <tr><td>6</td><td>15–19</td><td>Очень сложно</td></tr>
              <tr><td>6</td><td>20–24</td><td>Невероятно сложно</td></tr>
              <tr><td>6</td><td>25+</td><td>Невозможно</td></tr>

              <!-- Круг 7 -->
              <tr><td>7</td><td>1–5</td><td>Сложно</td></tr>
              <tr><td>7</td><td>6–9</td><td>Очень сложно</td></tr>
              <tr><td>7</td><td>11–14</td><td>Невероятно сложно</td></tr>
              <tr><td>7</td><td>15–19</td><td>Невозможно</td></tr>
              <tr><td>7</td><td>20–24</td><td>Невозможно</td></tr>
              <tr><td>7</td><td>25+</td><td>Невозможно</td></tr>

              <!-- Круг 8 -->
              <tr><td>8</td><td>1–5</td><td>Очень сложно</td></tr>
              <tr><td>8</td><td>6–9</td><td>Невероятно сложно</td></tr>
              <tr><td>8</td><td>11–14</td><td>Невозможно</td></tr>
              <tr><td>8</td><td>15–19</td><td>Невозможно</td></tr>
              <tr><td>8</td><td>20–24</td><td>Невозможно</td></tr>
              <tr><td>8</td><td>25+</td><td>Невозможно</td></tr>

              <!-- Круг 9 -->
              <tr><td>9</td><td>1–5</td><td>Невероятно сложно</td></tr>
              <tr><td>9</td><td>6–9</td><td>Невозможно</td></tr>
              <tr><td>9</td><td>11–14</td><td>Невозможно</td></tr>
              <tr><td>9</td><td>15–19</td><td>Невозможно</td></tr>
              <tr><td>9</td><td>20–24</td><td>Невозможно</td></tr>
              <tr><td>9</td><td>25+</td><td>Невозможно</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Attitudes -->
      <section class="mb-4">
        <h3>Отношение к магии обитателей Анкарии</h3>
        <p class="lead">Чем выше круг — тем сильнее влияние на мир и серьёзнее отношение жителей.</p>

        <v-simple-table class="magic-table">
          <thead>
            <tr><th>Круг</th><th>Влияние на мир</th><th>Отношение жителей</th></tr>
          </thead>
          <tbody>
            <tr><td>Базовая</td><td>Нет</td><td>«Хм. Это даже ребёнок может»</td></tr>
            <tr><td>Первый</td><td>Нет</td><td>Обычная магия — в школе учат</td></tr>
            <tr><td>Второй</td><td>Нет</td><td>Чуть сложнее — нужна практика</td></tr>
            <tr><td>Третий</td><td>Незначительно</td><td>Сложно, но доступно</td></tr>
            <tr><td>Четвёртый</td><td>Незначительно</td><td>Требует усилий и времени</td></tr>
            <tr><td>Пятый</td><td>Умеренно</td><td>Для талантливых и упорных</td></tr>
            <tr><td>Шестой</td><td>Умеренно</td><td>Магия для героев</td></tr>
            <tr><td>Седьмой</td><td>Значительно</td><td>На это способны единицы</td></tr>
            <tr><td>Восьмой</td><td>Значительно</td><td>Магия легенд и мифов</td></tr>
            <tr><td>Девятый</td><td>Колоссально</td><td>Божественный уровень</td></tr>
          </tbody>
        </v-simple-table>
      </section>

      <!-- Schools -->
      <section>
        <h3>Магические школы</h3>
        <p>Тип школы подсказывает её доступность и примерную сложность изучения на старте кампании.</p>

        <v-simple-table class="magic-table">
          <thead><tr><th>Название</th><th>Тип</th><th>Знак в игровом мире</th></tr></thead>
          <tbody>
            <tr><td>Огонь</td><td>Базовая</td><td>[иконка/фото]</td></tr>
            <tr><td>Вода</td><td>Базовая</td><td>[иконка/фото]</td></tr>
            <tr><td>Воздух</td><td>Базовая</td><td>[иконка/фото]</td></tr>
            <tr><td>Земля</td><td>Базовая</td><td>[иконка/фото]</td></tr>
            <tr><td>Магма</td><td>Продвинутая</td><td>[иконка/фото]</td></tr>
            <tr><td>Лед</td><td>Продвинутая</td><td>[иконка/фото]</td></tr>
            <tr><td>Молния</td><td>Продвинутая</td><td>[иконка/фото]</td></tr>
            <tr><td>Природа</td><td>Продвинутая</td><td>[иконка/фото]</td></tr>
            <tr><td>Свет</td><td>Основная</td><td>[иконка/фото]</td></tr>
            <tr><td>Тьма</td><td>Основная</td><td>[иконка/фото]</td></tr>
            <tr><td>Порядок</td><td>Основная</td><td>[иконка/фото]</td></tr>
            <tr><td>Хаос</td><td>Основная</td><td>[иконка/фото]</td></tr>
            <tr><td>Призыв</td><td>Основная</td><td>[иконка/фото]</td></tr>
            <tr><td>Зачарование</td><td>Основная</td><td>[иконка/фото]</td></tr>
            <tr><td>Разум</td><td>Основная</td><td>[иконка/фото]</td></tr>
            <tr><td>Аркана</td><td>Основная</td><td>[иконка/фото]</td></tr>
          </tbody>
        </v-simple-table>
      </section>

    </v-card-text>
  </v-card>
</template>

<script setup>
import { defineProps } from 'vue'
const props = defineProps({ content: { type: Object, required: false } })
</script>

<style scoped>
h2 { margin: 0 0 8px }
h3 { margin-top: 12px }
.lead { color: rgba(0,0,0,0.72); margin-bottom: 8px }
.muted { color: rgba(0,0,0,0.56); font-size: 0.95rem }

.quick-card .card-title { font-weight: 700; margin-bottom: 6px; }

.table-wrap { overflow-x: auto; border-radius: 10px; }
.magic-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  box-shadow: 0 6px 16px rgba(0,0,0,0.04);
  border-radius: 8px;
  overflow: hidden;
  background: var(--v-theme-surface);
}
.magic-table caption.table-caption { text-align: left; padding: 10px 14px; font-weight: 700; color: var(--v-theme-on-surface); }
.magic-table thead th {
  position: sticky; top: 0; z-index: 2;
  padding: 12px 16px; text-align: left; font-weight: 700;
  background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent);
}
.magic-table tbody tr:nth-child(odd) { background: rgba(0,0,0,0.02); }
.magic-table th, .magic-table td { padding: 12px 16px; vertical-align: middle; border-bottom: 1px solid rgba(0,0,0,0.04); }
.magic-table tbody tr:hover { background: rgba(0,0,0,0.04); transform: translateY(-1px); }

@media (max-width: 600px) {
  .magic-table th, .magic-table td { padding: 10px 8px; font-size: 0.92rem; }
  .lead, .muted { color: rgba(0,0,0,0.78); }
}

/* dark theme tweaks (Vuetify variables will adjust colors) */
.theme--dark .magic-table tbody tr:nth-child(odd) { background: rgba(255,255,255,0.02) }
.theme--dark .lead, .theme--dark .muted { color: rgba(255,255,255,0.85) }
</style>
