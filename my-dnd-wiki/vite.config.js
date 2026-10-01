import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// В разработке API и WebSocket проксируются на `npm run server` (порт 3001)
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '/usericons': 'http://127.0.0.1:3001',
      '/ws': { target: 'ws://127.0.0.1:3001', ws: true }
    }
  }
})
