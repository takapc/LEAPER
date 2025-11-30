import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/proxy': {
        target: 'https://ukaru-eigo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/proxy/, '/leap-modified-list/'),
      },
    },
  },
})

