import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  // GitHub Pages serves this project from https://<user>.github.io/localia/
  base: command === 'build' ? '/localia/' : '/',
  worker: {
    // The agent worker uses dynamic imports internally (onnxruntime-web); the
    // default IIFE worker format doesn't support that.
    format: 'es',
  },
  optimizeDeps: {
    // Let the worker load this at runtime as-is rather than pre-bundling it.
    exclude: ['@huggingface/transformers'],
  },
}))
