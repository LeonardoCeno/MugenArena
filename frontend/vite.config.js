import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  root: '.',
  base: './',
  plugins: [vue()],
  server: {
    proxy: {
      '/backend': {
        target: process.env.VITE_PHP_PROXY ?? 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '.',
    emptyOutDir: false,
    assetsDir: 'src/assets-built',
    rollupOptions: {
      input: './index.html',
    },
  },
})
