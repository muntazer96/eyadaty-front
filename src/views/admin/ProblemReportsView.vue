<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '../../services/api'
import PageHeader from '../../components/common/Pageheader.vue'
import EmptyState from '../../components/common/Emptystate.vue'
import { useNotifications } from '../../composables/useNotifications'
import { getErrorMessage } from '../../utils/errors'
import type { ApiResponse, ProblemReportItem, ProblemReportPagination } from '../../types/api'

const { success: showSuccess, error: showError } = useNotifications()

const items = ref<ProblemReportItem[]>([])
const selected = ref<ProblemReportItem | null>(null)
const loading = ref(false)
const saving = ref(false)
const page = ref(1)
const pageSize = 10
const totalPages = ref(1)
const totalItems = ref(0)
const statusFilter = ref('')
const sourceFilter = ref('')
const search = ref('')
const statusForm = ref({ status: 'Open', adminNotes: '' })

const statusOptions = [
  { value: '', label: 'الكل' },
  { value: 'Open', label: 'مفتوح' },
  { value: 'InProgress', label: 'قيد المتابعة' },
  { value: 'Resolved', label: 'تم الحل' },
  { value: 'Closed', label: 'مغلق' },
]

const sourceOptions = [
  { value: '', label: 'كل المصادر' },
  { value: 'App', label: 'التطبيق' },
  { value: 'DoctorWeb', label: 'ويب الطبيب' },
]

function statusLabel(status: string) {
  return statusOptions.find((item) => item.value === status)?.label ?? status
}

function statusColor(status: string) {
  if (status === 'Resolved') return 'success'
  if (status === 'InProgress') return 'info'
  if (status === 'Closed') return 'default'
  return 'warning'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

async function loadReports() {
  loading.value = true
  try {
    const response = await api.get<ApiResponse<ProblemReportPagination>>('/ProblemReport', {
      params: {
        page: page.value,
        pageSize,
        status: statusFilter.value || undefined,
        source: sourceFilter.value || undefined,
        search: search.value || undefined,
      },
    })
    items.value = response.data.data.items
    totalPages.value = response.data.data.totalPages || 1
    totalItems.value = response.data.data.totalItems
  } catch (e) {
    showError(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function openDetails(item: ProblemReportItem) {
  selected.value = item
  statusForm.value = { status: item.status, adminNotes: item.adminNotes ?? '' }
}

async function updateStatus() {
  if (!selected.value) return
  saving.value = true
  try {
    const response = await api.put<ApiResponse<ProblemReportItem>>(`/ProblemReport/${selected.value.id}/status`, statusForm.value)
    showSuccess(response.data.message)
    selected.value = response.data.data
    await loadReports()
  } catch (e) {
    showError(getErrorMessage(e))
  } finally {
    saving.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout>
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadReports()
  }, 400)
}

onMounted(loadReports)
</script>

<template>
  <div class="problem-reports-page">
    <PageHeader title="بلاغات المشاكل" subtitle="متابعة البلاغات المرسلة من التطبيق وويب الطبيب" />

    <v-card elevation="0" class="filters-card">
      <div class="filters-row">
        <div class="filter-field filter-field--search">
          <label class="filter-label">بحث</label>
          <div class="search-wrap">
            <v-icon icon="mdi-magnify" size="18" class="search-icon" />
            <input
              v-model="search"
              class="search-input"
              placeholder="ابحث بعنوان المشكلة أو المرسل"
              @input="onSearchInput"
            />
            <button
              v-if="search"
              type="button"
              class="search-clear"
              aria-label="مسح البحث"
              @click="search = ''; page = 1; loadReports()"
            >
              <v-icon icon="mdi-close" size="16" />
            </button>
          </div>
        </div>
        <div class="filter-field">
          <label class="filter-label">الحالة</label>
          <v-select
            v-model="statusFilter"
            :items="statusOptions"
            item-title="label"
            item-value="value"
            class="filter-select"
            variant="outlined"
            density="compact"
            hide-details
            @update:model-value="page = 1; loadReports()"
          />
        </div>
        <div class="filter-field">
          <label class="filter-label">المصدر</label>
          <v-select
            v-model="sourceFilter"
            :items="sourceOptions"
            item-title="label"
            item-value="value"
            class="filter-select"
            variant="outlined"
            density="compact"
            hide-details
            @update:model-value="page = 1; loadReports()"
          />
        </div>
        <v-btn color="primary" variant="outlined" prepend-icon="mdi-refresh" :loading="loading" @click="loadReports">
          تحديث
        </v-btn>
      </div>
    </v-card>

    <v-card elevation="0" class="table-card">
      <v-skeleton-loader v-if="loading" type="table-row@5" />

      <EmptyState
        v-else-if="!items.length"
        icon="mdi-alert-circle-outline"
        title="لا توجد بلاغات"
        description="ستظهر هنا البلاغات فور إرسالها"
      />

      <div v-else class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>المشكلة</th>
              <th>المرسل</th>
              <th>المصدر</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" @click="openDetails(item)">
              <td>
                <div class="title-cell">
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.description }}</span>
                </div>
              </td>
              <td>
                <div class="reporter-cell">
                  <span>{{ item.doctorName || item.reporterName }}</span>
                  <small v-if="item.reporterPhone" dir="ltr">{{ item.reporterPhone }}</small>
                </div>
              </td>
              <td>{{ sourceOptions.find((option) => option.value === item.source)?.label ?? item.source }}</td>
              <td>
                <v-chip size="small" :color="statusColor(item.status)" variant="tonal">
                  {{ statusLabel(item.status) }}
                </v-chip>
              </td>
              <td>{{ formatDate(item.createdAt) }}</td>
              <td>
                <v-btn icon size="small" variant="tonal" color="primary" @click.stop="openDetails(item)">
                  <v-icon icon="mdi-eye" size="16" />
                </v-btn>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="totalPages > 1" class="pagination-row">
        <v-pagination v-model="page" :length="totalPages" :total-visible="5" @update:model-value="loadReports" />
        <span>{{ totalItems }} بلاغ</span>
      </div>
    </v-card>

    <v-dialog :model-value="!!selected" max-width="760" @update:model-value="value => { if (!value) selected = null }">
      <v-card v-if="selected" class="details-dialog">
        <v-card-title class="details-title">
          <v-icon icon="mdi-alert-circle-outline" color="primary" />
          {{ selected.title }}
        </v-card-title>
        <v-card-text>
          <div class="details-grid">
            <div><strong>المرسل</strong><span>{{ selected.doctorName || selected.reporterName }}</span></div>
            <div><strong>الهاتف</strong><span dir="ltr">{{ selected.reporterPhone || '-' }}</span></div>
            <div><strong>المصدر</strong><span>{{ selected.source }}</span></div>
            <div><strong>التاريخ</strong><span>{{ formatDate(selected.createdAt) }}</span></div>
          </div>
          <p class="description-box">{{ selected.description }}</p>
          <p v-if="selected.deviceInfo" class="meta-box" dir="ltr">{{ selected.deviceInfo }}</p>
          <div class="form-field">
            <label class="form-label">حالة البلاغ</label>
            <v-select
              v-model="statusForm.status"
              :items="statusOptions.filter((item) => item.value)"
              item-title="label"
              item-value="value"
              class="form-select"
              variant="outlined"
              density="compact"
              hide-details
            />
          </div>
          <div class="form-field">
            <label class="form-label">ملاحظات الإدارة</label>
            <textarea v-model="statusForm.adminNotes" class="form-textarea" rows="3" />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="selected = null">إغلاق</v-btn>
          <v-btn color="primary" :loading="saving" @click="updateStatus">حفظ</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.problem-reports-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.filters-card,
.table-card {
  border: 1px solid var(--color-border) !important;
  border-radius: var(--radius-lg) !important;
}

.filters-card {
  padding: var(--spacing-lg);
}

.filters-row {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 170px 170px auto;
  gap: var(--spacing-md);
  align-items: end;
}

.filter-field,
.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-label,
.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.filter-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.search-wrap {
  position: relative;
}

.search-icon {
  position: absolute;
  right: 10px;
  top: 50%;
  z-index: 1;
  color: var(--color-text-muted);
  transform: translateY(-50%);
  pointer-events: none;
}

[dir='rtl'] .search-icon {
  right: auto;
  left: 10px;
}

.search-input {
  width: 100%;
  padding-inline: 40px !important;
}

.search-clear {
  position: absolute;
  left: 6px;
  top: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  transform: translateY(-50%);
}

.search-clear:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

[dir='rtl'] .search-clear {
  right: 6px;
  left: auto;
}

.filter-select,
.form-select,
.form-textarea {
  width: 100%;
}

.form-textarea {
  resize: vertical;
}

.table-card {
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th,
.data-table td {
  padding: 12px 16px;
  text-align: right;
  border-bottom: 1px solid var(--color-border-light);
}

.data-table th {
  background: var(--color-background);
  color: var(--color-text-muted);
  font-weight: 800;
}

.data-table tbody tr {
  cursor: pointer;
}

.data-table tbody tr:hover {
  background: var(--color-primary-soft);
}

.title-cell,
.reporter-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.title-cell span,
.reporter-cell small {
  max-width: 420px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pagination-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}

.details-dialog {
  border-radius: var(--radius-lg) !important;
}

.details-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-weight: 900;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.details-grid div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.details-grid strong {
  color: var(--color-text-muted);
  font-size: 12px;
}

.description-box,
.meta-box {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  white-space: pre-wrap;
}

.meta-box {
  color: var(--color-text-muted);
  font-size: 12px;
}

@media (max-width: 900px) {
  .filters-row,
  .details-grid {
    grid-template-columns: 1fr;
  }
}
</style>
