// Окно обрезки картинки перед загрузкой: cropImage(file) открывает ImageCropper (он один на всё приложение, в App.vue)
// и ждёт, пока человек выберет кадр. Возвращает квадратную картинку (Blob) или null, если он передумал.
import { reactive } from 'vue'

export const crop = reactive({ file: null, title: '', size: 512, resolve: null })

export function cropImage(file, { title = 'Обрезка картинки', size = 512 } = {}) {
  if (!file?.type?.startsWith('image/') || file.type.includes('svg')) return Promise.reject(new Error('Нужна картинка PNG, JPG, GIF или WebP'))
  crop.resolve?.(null) // если окно уже было открыто — прежнее ожидание закрываем
  return new Promise(resolve => Object.assign(crop, { file, title, size, resolve }))
}

export function finishCrop(blob) {
  const r = crop.resolve
  Object.assign(crop, { file: null, resolve: null })
  r?.(blob)
}
