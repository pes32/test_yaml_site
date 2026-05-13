<template>
  <div class="page-section page-section--bare page-section--box">
    <div class="card page-section-card u-wide">
      <div class="card-body page-section-body u-wide">
        <div class="row row--section">
          <div class="col-12 d-flex gap-2 flex-wrap">
            <button
              type="button"
              class="widget-button inline-flex-center db-backup-tab__button"
              :disabled="loadingKind === 'schema_only'"
              @click="downloadBackup('schema_only')"
            >
              Дамп структуры
            </button>
            <button
              type="button"
              class="widget-button inline-flex-center db-backup-tab__button"
              :disabled="loadingKind === 'full'"
              @click="downloadBackup('full')"
            >
              Полный дамп
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { asRecord } from '@frontend/shared/object_record.ts';

defineOptions({
  name: 'UserSettingsDbBackupTab',
});

const emit = defineEmits<{
  'backup-success': [];
  'backup-error': [text: string];
}>();

type BackupKind = 'schema_only' | 'full';

const loadingKind = ref<BackupKind | ''>('');

function filenameFromDisposition(disposition: string | null, fallback: string): string {
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition || '');
  return match ? decodeURIComponent(match[1].replace(/^"|"$/g, '')) : fallback;
}

async function errorFromResponse(response: Response): Promise<string> {
  try {
    const payload = asRecord(await response.json());
    const error = asRecord(payload.error);
    const base = String(error.message || payload.message || `HTTP ${response.status}`);
    const details = String(error.details || payload.details || '').trim();
    return details ? `${base}: ${details}` : base;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function downloadBackup(kind: BackupKind): Promise<void> {
  loadingKind.value = kind;
  try {
    const response = await fetch(`/api/admin/db-backup/${kind}`);
    if (!response.ok) {
      throw new Error(await errorFromResponse(response));
    }
    const blob = await response.blob();
    const fallback = kind === 'schema_only' ? 'schema.sql' : 'database.sql';
    const filename = filenameFromDisposition(response.headers.get('content-disposition'), fallback);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    emit('backup-success');
  } catch (err) {
    emit('backup-error', err instanceof Error ? err.message : String(err));
  } finally {
    loadingKind.value = '';
  }
}
</script>
