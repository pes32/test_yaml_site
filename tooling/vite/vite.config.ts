import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  base: '/frontend/dist/',
  publicDir: false,
  resolve: {
    alias: [
      {
        find: 'vue',
        replacement: resolve(__dirname, 'node_modules/vue/dist/vue.esm-bundler.js')
      }
    ]
  },
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false
  },
  build: {
    manifest: true,
    outDir: resolve(__dirname, '../../frontend/dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        page: resolve(__dirname, 'src/entry/page.ts'),
        debug: resolve(__dirname, 'src/entry/debug.ts')
      }
    }
  }
});
