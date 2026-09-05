import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // y-monaco imports deep ESM path which is blocked by package exports.
      // Alias it to the actual file in node_modules so Vite can resolve it.
      'monaco-editor/esm/vs/editor/editor.api.js': path.resolve(
        __dirname,
        'node_modules/monaco-editor/esm/vs/editor/editor.api.js'
      ),
    },
  },
  optimizeDeps: {
    include: ['y-monaco'],
  },
})
