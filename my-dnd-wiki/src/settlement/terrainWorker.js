// Фоновый поток: рисует местность поселения, пока на экране крутится загрузка
import { paintTerrainBlob } from './terrainPainter.js'

self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ id: data.id, blob: await paintTerrainBlob(data.s, data.scale) })
  } catch (e) {
    self.postMessage({ id: data.id, error: String(e?.message || e) })
  }
}
