import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 1. Auth and AI Chat go to the Node.js backend on port 5051
      '/api/auth': { target: 'http://localhost:5051', changeOrigin: true },
      '/api/ai': { target: 'http://localhost:5051', changeOrigin: true },

      // 2. Hardware metrics and health check go to the Python backend on port 5050
      '/api/hardware': { target: 'http://127.0.0.1:5050', changeOrigin: true },
      '/api/health': { target: 'http://127.0.0.1:5050', changeOrigin: true },
      '/api/llm': { target: 'http://127.0.0.1:5050', changeOrigin: true },
    },
  },
})
