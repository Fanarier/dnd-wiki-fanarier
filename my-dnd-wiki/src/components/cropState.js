// Окно обрезки картинки перед загрузкой: cropImage(file) открывает ImageCropper (он один на всё приложение, в App.vue)
// и ждёт, пока человек выберет кадр. Возвращает картинку (Blob) или null, если он передумал.
// aspect — ширина к высоте: 1 — квадрат size×size (значки, аватарки), 3 — полоса size×size/3 (обложка профиля).
import { reactive } from 'vue'

export const crop = reactive({ file: null, title: '', size: 512, aspect: 1, resolve: null })

export function cropImage(file, { title = 'Обрезка картинки', size = 512, aspect = 1 } = {}) {
  if (!file?.type?.startsWith('image/') || file.type.includes('svg')) return Promise.reject(new Error('Нужна картинка PNG, JPG, GIF или WebP'))
  crop.resolve?.(null) // если окно уже было открыто — прежнее ожидание закрываем
  return new Promise(resolve => Object.assign(crop, { file, title, size, aspect, resolve }))
}

export function finishCrop(blob) {
  const r = crop.resolve
  Object.assign(crop, { file: null, resolve: null })
  r?.(blob)
}
