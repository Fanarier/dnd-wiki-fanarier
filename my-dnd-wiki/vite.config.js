import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// номер сборки — добавляется к адресам слоёв карты, чтобы Cloudflare не отдавал старые копии после деплоя,
// и кладётся в dist/build.json: сервер сообщает его браузерам, а открытые старые вкладки предлагают обновиться
const BUILD = Date.now().toString(36)
const buildId = {
  name: 'build-id',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'build.json', source: JSON.stringify({ build: BUILD }) }) }
}

// В разработке API и WebSocket проксируются на `npm run server` (порт 3001)
export default defineConfig({
  plugins: [vue(), buildId],
  define: { __BUILD__: JSON.stringify(BUILD) },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '/usericons': 'http://127.0.0.1:3001',
      '/portraits': 'http://127.0.0.1:3001',
      '/arts': 'http://127.0.0.1:3001',
      '/ws': { target: 'ws://127.0.0.1:3001', ws: true }
    }
  }
})
