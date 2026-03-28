import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/qlab': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../qlab/static/qlab',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'qlab.js',
        chunkFileNames: 'qlab-[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'qlab.css'
          return 'assets/[name][extname]'
        },
      },
    },
  },
})
