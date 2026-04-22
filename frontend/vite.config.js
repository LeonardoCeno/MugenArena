import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  root: '.',
  base: './',
  plugins: [vue()],
  build: {
    outDir: '.',
    emptyOutDir: false,
    assetsDir: 'src/assets-built',
    rollupOptions: {
      input: './index.html',
    },
  },
})
