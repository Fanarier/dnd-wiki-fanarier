// Фоновый поток: рисует плитки карты поселения
import { renderTile, TILE } from './tileRender.js'

const mk = (w, h) => new OffscreenCanvas(w, h)
self.onmessage = ({ data }) => {
  try {
    const c = renderTile(data.terrain, data.z, data.x, data.y, data.clearings, mk(TILE, TILE), mk)
    const bmp = c.transferToImageBitmap()
    self.postMessage({ id: data.id, bmp }, [bmp])
  } catch (e) {
    self.postMessage({ id: data.id, error: String(e?.message || e) })
  }
}
