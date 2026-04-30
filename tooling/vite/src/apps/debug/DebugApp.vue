<template>
  <div class="container-fluid mt-3">
    <div class="page-shell u-wide">
      <div class="page-content-column u-wide">
        <diagnostics-panel :diagnostics="diagnostics"></diagnostics-panel>

        <error-panel
          v-for="entry in visibleErrors"
          :key="'debug-error-' + entry.scope"
          :error="entry.item"
          @dismiss="dismissScopeError(entry.scope)"
        >
        </error-panel>

        <ul class="nav nav-tabs page-tabs" role="tablist">
          <li class="nav-item">
            <a
              class="nav-link"
              :class="{ active: activeTab === 0 }"
              href="#"
              role="tab"
              @click.prevent="activeTab = 0"
            >
              API
            </a>
          </li>
          <li class="nav-item">
            <a
              class="nav-link"
              :class="{ active: activeTab === 1 }"
              href="#"
              role="tab"
              @click.prevent="activeTab = 1"
            >
              Log
            </a>
          </li>
          <li class="nav-item">
            <a
              class="nav-link"
              :class="{ active: activeTab === 2 }"
              href="#"
              role="tab"
              @click.prevent="activeTab = 2"
            >
              Yaml
            </a>
          </li>
          <li class="nav-item">
            <a
              class="nav-link"
              :class="{ active: activeTab === 3 }"
              href="#"
              role="tab"
              @click.prevent="activeTab = 3"
            >
              SQL
            </a>
          </li>
        </ul>

        <div class="tab-content page-tab-content u-wide page-tab-content--with-tabs">
          <div
            v-if="activeTab === 0"
            class="tab-pane"
            :class="{ active: activeTab === 0, show: activeTab === 0 }"
          >
            <div class="card page-section-card">
              <div class="card-header page-section-header">
                <h5>Структура API</h5>
              </div>
              <div class="card-body">
                <pre v-if="apiLoading" class="text-muted">Загрузка...</pre>
                <pre v-else-if="apiError" class="text-danger">{{ apiError.message }}</pre>
                <pre v-else style="margin: 0; white-space: pre-wrap; word-break: break-all">{{ apiText }}</pre>
              </div>
            </div>
          </div>

          <div
            v-if="activeTab === 1"
            class="tab-pane"
            :class="{ active: activeTab === 1, show: activeTab === 1 }"
          >
            <div class="card page-section-card">
              <div class="card-header page-section-header d-flex justify-content-between align-items-center">
                <h5>Лог (последние 1000 строк)</h5>
                <button
                  type="button"
                  class="widget-button inline-flex-center"
                  :disabled="logsLoading"
                  @click="loadLogs"
                >
                  Обновить
                </button>
              </div>
              <div class="card-body" style="max-height: 70vh; overflow-y: auto">
                <pre v-if="logsLoading && !logLines.length" class="text-muted">Загрузка...</pre>
                <pre v-else-if="logError" class="text-danger">{{ logError.message }}</pre>
                <pre v-else style="margin: 0; white-space: pre-wrap; word-break: break-all">{{ logText }}</pre>
              </div>
            </div>
          </div>

          <div
            v-if="activeTab === 2"
            class="tab-pane"
            :class="{ active: activeTab === 2, show: activeTab === 2 }"
          >
            <div class="card page-section-card">
              <div class="card-header page-section-header">
                <h5>Зарегистрированные страницы (YAML)</h5>
              </div>
              <div class="card-body">
                <pre v-if="pagesLoading" class="text-muted">Загрузка...</pre>
                <pre v-else-if="pagesError" class="text-danger">{{ pagesError.message }}</pre>
                <div v-else class="pages-list">
                  <div v-for="p in pages" :key="p.name" class="pages-line">
                    {{ p.name }} {{ p.title }}
                    <a :href="p.url" class="pages-url">{{ p.url }}</a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="activeTab === 3"
            class="tab-pane"
            :class="{ active: activeTab === 3, show: activeTab === 3 }"
          >
            <div class="card page-section-card">
              <div class="card-header page-section-header d-flex justify-content-between align-items-center">
                <h5>SQL (только SELECT)</h5>
                <button
                  type="button"
                  class="widget-button inline-flex-center"
                  :disabled="sqlLoading || !canRunSql"
                  @click="runSql"
                >
                  Выполнить
                </button>
              </div>
              <div class="card-body">
                <div class="text-muted mb-2">
                  Только одиночные SELECT-запросы. Иные комманды, комментарии или сложные запросы запрещены.
                </div>
                <textarea
                  v-model="sqlQuery"
                  class="form-control mb-3"
                  rows="6"
                  placeholder="SELECT * FROM your_table LIMIT 20"
                  @keydown="onSqlKeydown"
                ></textarea>

                <pre v-if="sqlLoading" class="text-muted">Выполнение...</pre>
                <pre v-else-if="sqlError" class="text-danger">{{ sqlError.message }}</pre>

                <div v-else-if="sqlResult">
                  <div class="text-muted mb-2">{{ sqlSummary }}</div>
                  <div v-if="!sqlRows.length" class="text-muted">Запрос выполнен, строк не найдено.</div>
                  <table v-else class="table table-striped mb-0">
                    <thead>
                      <tr>
                        <th v-for="(column, columnIndex) in sqlColumns" :key="'sql-head-' + columnIndex">
                          {{ column }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, rowIndex) in sqlRows" :key="'sql-row-' + rowIndex">
                        <td
                          v-for="(column, columnIndex) in sqlColumns"
                          :key="'sql-cell-' + rowIndex + '-' + columnIndex"
                        >
                          {{ formatSqlCell(row[column]) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div v-else class="text-muted">
                  Введите SELECT-запрос к пользовательской таблице и нажмите кнопку или Ctrl/Cmd + Enter.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import DiagnosticsPanel from '../../../../../frontend/js/widgets/common/DiagnosticsPanel.vue';
import ErrorPanel from '../../../../../frontend/js/widgets/common/ErrorPanel.vue';
import { useDebugApp } from '../../../../../frontend/js/debug.ts';

defineOptions({
  name: 'DebugApp'
});

const {
  activeTab,
  apiError,
  apiLoading,
  apiText,
  canRunSql,
  diagnostics,
  dismissScopeError,
  formatSqlCell,
  logError,
  logLines,
  logText,
  loadLogs,
  logsLoading,
  onSqlKeydown,
  pages,
  pagesError,
  pagesLoading,
  publicSurface,
  runSql,
  sqlColumns,
  sqlError,
  sqlLoading,
  sqlQuery,
  sqlResult,
  sqlRows,
  sqlSummary,
  visibleErrors
} = useDebugApp();

defineExpose(publicSurface);
</script>
