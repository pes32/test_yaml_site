import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const WIDGET_FIELD_CORE_MATCHERS = [
  '/frontend/js/widgets/common/Md3Field.vue',
  /\/frontend\/js\/widgets\/composables\/useWidgetField\.(js|ts)$/
];

function matchesChunkMatcher(id: string, matcher: string | RegExp) {
  if (typeof matcher === 'string') {
    return id.endsWith(matcher);
  }

  return matcher.test(id);
}
function matchesAnyChunkMatcher(id: string, matchers: Array<string | RegExp>) {
  return matchers.some((matcher) => matchesChunkMatcher(id, matcher));
}

export default defineConfig({
  root: __dirname,
  base: '/frontend/dist/',
  publicDir: false,
  plugins: [vue()],
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
      output: {
        manualChunks(id) {
          const normalized = id.split('\\').join('/');

          if (normalized.includes('/node_modules/vue/')) {
            return 'vendor-vue';
          }

          if (matchesAnyChunkMatcher(normalized, WIDGET_FIELD_CORE_MATCHERS)) {
            return 'widget-field-core';
          }

          if (
            normalized.endsWith('/frontend/js/widgets/common/DropdownChevronIcon.vue') ||
            normalized.endsWith('/frontend/js/widgets/common/SortIcons.vue') ||
            normalized.endsWith('/frontend/js/shared/number_utils.ts') ||
            normalized.endsWith('/frontend/js/shared/icon_helpers.ts')
          ) {
            return 'widget-shared';
          }

          if (normalized.includes('/frontend/js/runtime/')) {
            return 'app-runtime';
          }
          if (normalized.includes('/frontend/js/widgets/table/')) {
            return 'widget-table';
          }

          if (
            normalized.includes('/frontend/js/widgets/voc/') ||
            normalized.includes('/frontend/js/widgets/split-button/') ||
            normalized.endsWith('/frontend/js/widgets/ListWidget.vue') ||
            normalized.endsWith('/frontend/js/widgets/SplitButtonWidget.vue')
          ) {
            return 'widget-choice';
          }

          if (normalized.includes('/frontend/js/widgets/datetime/')) {
            return 'widget-datetime';
          }

          return undefined;
        }
      },
      input: {
        page: resolve(__dirname, 'src/entry/page.ts'),
        debug: resolve(__dirname, 'src/entry/debug.ts')
      }
    }
  }
});
