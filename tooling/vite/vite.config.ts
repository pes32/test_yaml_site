import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const repoFrontendApps = resolve(__dirname, '../../frontend/apps');
const repoFrontendJs = resolve(__dirname, '../../frontend/js');
const repoFrontendCss = resolve(__dirname, '../../frontend/css');

const WIDGET_FIELD_CORE_MATCHERS = [
  /[/\\]widgets[/\\]common[/\\]Md3Field\.vue$/,
  /[/\\]widgets[/\\]composables[/\\]useWidgetField\.(js|ts)$/
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
        find: '@frontend-css',
        replacement: repoFrontendCss
      },
      {
        find: '@apps',
        replacement: repoFrontendApps
      },
      {
        find: '@frontend',
        replacement: repoFrontendJs
      },
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
          // Vue shells live under frontend/apps/ (not frontend/js). Widget/runtime chunk rules use underFrontendJs only.
          const underFrontendJs =
            normalized.includes('/frontend/js/') || normalized.includes('/@frontend/');

          if (normalized.includes('/node_modules/vue/')) {
            return 'vendor-vue';
          }

          if (matchesAnyChunkMatcher(normalized, WIDGET_FIELD_CORE_MATCHERS)) {
            return 'widget-field-core';
          }

          if (
            underFrontendJs &&
            (normalized.endsWith('/widgets/common/DropdownChevronIcon.vue') ||
              normalized.endsWith('/widgets/common/SortIcons.vue') ||
              normalized.endsWith('/shared/number_utils.ts') ||
              normalized.endsWith('/shared/icon_helpers.ts'))
          ) {
            return 'widget-shared';
          }

          if (underFrontendJs && normalized.includes('/runtime/')) {
            return 'app-runtime';
          }
          if (underFrontendJs && normalized.includes('/widgets/table/')) {
            return 'widget-table';
          }

          if (
            (underFrontendJs && normalized.includes('/widgets/voc/')) ||
            (underFrontendJs && normalized.includes('/widgets/split-button/')) ||
            normalized.endsWith('/frontend/js/widgets/ListWidget.vue') ||
            normalized.endsWith('/@frontend/widgets/ListWidget.vue') ||
            normalized.endsWith('/frontend/js/widgets/SplitButtonWidget.vue') ||
            normalized.endsWith('/@frontend/widgets/SplitButtonWidget.vue')
          ) {
            return 'widget-choice';
          }

          if (underFrontendJs && normalized.includes('/widgets/datetime/')) {
            return 'widget-datetime';
          }

          return undefined;
        }
      },
      input: {
        page: resolve(__dirname, 'src/entry/page.ts'),
        user_settings: resolve(__dirname, 'src/entry/user_settings.ts')
      }
    }
  }
});
