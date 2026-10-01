import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// В разработке API и WebSocket проксируются на `npm run server` (порт 3001)
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': { target: 'ws://localhost:3001', ws: true }
    }
  }
})
