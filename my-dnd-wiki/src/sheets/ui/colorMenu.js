// Палитра для покраски полей (правый щелчок по полю) и выбора цвета листа — одна на страницу
import { reactive } from 'vue'
import { edit } from '../sheetState.js'

export const PALETTE = ['#E7C56F', '#FF7A6B', '#FF9A4E', '#FFD166', '#7EE06A', '#2FD6B4', '#4FD8FF', '#7C9CFF', '#B9A6FF', '#C47AFF', '#FF7AC0', '#F2F2F2']
export const colorMenu = reactive({ open: false, x: 0, y: 0, path: '', value: '', title: '' })

export function openColorMenu(e, path, value, title = 'Цвет текста') {
  Object.assign(colorMenu, { open: true, x: Math.min(e.clientX, innerWidth - 230), y: Math.min(e.clientY, innerHeight - 170), path, value: value || '', title })
}
export function pickColor(c) {
  edit(colorMenu.path, c || '', { now: true })
  colorMenu.open = false
}
