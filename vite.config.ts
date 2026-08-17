import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  // GitHub Pages serves this project from https://<user>.github.io/localia/
  base: command === 'build' ? '/localia/' : '/',
}))
