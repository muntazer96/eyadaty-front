<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import api from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import { getErrorMessage } from '../utils/errors'
import { specializationIcon, specializationIconOptions } from '../utils/specializationIcons'
import EmptyState from '../components/common/Emptystate.vue'
import PageHeader from '../components/common/Pageheader.vue'
import type { ApiResponse, PageResult, SpecializationItem } from '../types/api'

type DialogMode = 'create' | 'edit'

const { success: showSuccess, error: showError } = useNotifications()

const specializations = ref<SpecializationItem[]>([])
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = ref(12)
const totalPages = ref(1)
const totalItems = ref(0)
const dialogOpen = ref(false)
const deleteOpen = ref(false)
const dialogMode = ref<DialogMode>('create')
const selected = ref<SpecializationItem | null>(null)

const form = reactive({
  name: '',
  normalizedName: '',
  iconName: specializationIconOptions[0]?.value ?? '',
})

function resetForm() {
  Object.assign(form, {
    name: '',
    normalizedName: '',
    iconName: specializationIconOptions[0]?.value ?? '',
  })
}

function openCreate() {
  selected.value = null
  dialogMode.value = 'create'
  resetForm()
  dialogOpen.value = true
}

function openEdit(item: SpecializationItem) {
  selected.value = item
  dialogMode.value = 'edit'
  Object.assign(form, {
    name: item.name,
    normalizedName: item.normalizedName,
    iconName: item.iconName,
  })
  dialogOpen.value = true
}

function openDelete(item: SpecializationItem) {
  selected.value = item
  deleteOpen.value = true
}

async function loadSpecializations() {
  loading.value = true
  try {
    const response = await api.get<ApiResponse<PageResult<SpecializationItem>>>('/Specialization/paged', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        search: search.value.trim() || undefined,
      },
    })
    specializations.value = response.data.data.items
    totalPages.value = response.data.data.totalPages
    totalItems.value = response.data.data.totalItems
  } catch (error: any) {
    showError(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function applySearch() {
  page.value = 1
  loadSpecializations()
}

async function changePage(nextPage: number) {
  page.value = nextPage
  await loadSpecializations()
}

async function saveSpecialization() {
  if (!form.name.trim() || !form.normalizedName.trim() || !form.iconName.trim()) {
    showError('يرجى ملء جميع الحقول المطلوبة.')
    return
  }

  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      normalizedName: form.normalizedName.trim(),
      iconName: form.iconName.trim(),
    }

    const response = dialogMode.value === 'create'
      ? await api.post<ApiResponse<SpecializationItem>>('/Specialization', payload)
      : await api.put<ApiResponse<SpecializationItem>>(`/Specialization/${selected.value?.id}`, payload)

    showSuccess(response.data.message)
    dialogOpen.value = false
    page.value = dialogMode.value === 'create' ? 1 : page.value
    await loadSpecializations()
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function deleteSpecialization() {
  if (!selected.value) return

  deleting.value = true
  try {
    const response = await api.delete<ApiResponse<object>>(`/Specialization/${selected.value.id}`)
    showSuccess(response.data.message)
    deleteOpen.value = false
    selected.value = null
    await loadSpecializations()
    if (!specializations.value.length && page.value > 1) {
      page.value -= 1
      await loadSpecializations()
    }
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    deleting.value = false
  }
}

onMounted(loadSpecializations)
</script>

<template>
  <div class="specializations-page">
    <PageHeader title="إدارة الاختصاصات" subtitle="إضافة وتعديل وحذف اختصاصات الأطباء">
      <template #actions>
        <v-btn variant="outlined" color="primary" prepend-icon="mdi-refresh" :loading="loading" @click="loadSpecializations">
          تحديث
        </v-btn>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
          إضافة اختصاص
        </v-btn>
      </template>
    </PageHeader>

    <div class="toolbar">
      <div class="search-box">
        <v-icon icon="mdi-magnify" size="18" />
        <input
          v-model="search"
          type="search"
          placeholder="بحث بالاسم أو الرمز أو الأيقونة"
          @keyup.enter="applySearch"
        />
      </div>
      <v-btn color="primary" prepend-icon="mdi-magnify" :loading="loading" @click="applySearch">
        بحث
      </v-btn>
      <div class="count-pill">
        <v-icon icon="mdi-stethoscope" size="18" />
        <span>{{ totalItems }} اختصاص</span>
      </div>
    </div>

    <div v-if="loading && !specializations.length" class="grid">
      <v-skeleton-loader v-for="i in 8" :key="i" type="article" />
    </div>

    <EmptyState
      v-else-if="!specializations.length"
      icon="mdi-stethoscope"
      title="لا توجد اختصاصات"
      description="أضف اختصاصاً جديداً ليظهر في القوائم الخاصة بالأطباء وطلبات التحويل."
    />

    <template v-else>
      <div class="grid">
        <div v-for="item in specializations" :key="item.id" class="specialization-card">
          <div class="card-head">
            <div class="icon-box">
              <v-icon :icon="specializationIcon(item.iconName)" size="24" />
            </div>
            <div class="actions">
              <v-btn icon="mdi-pencil" size="small" variant="text" color="primary" @click="openEdit(item)" />
              <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="openDelete(item)" />
            </div>
          </div>

          <h3>{{ item.name }}</h3>
          <p>{{ item.normalizedName }}</p>
          <span class="icon-name">{{ item.iconName }}</span>
        </div>
      </div>

      <div v-if="totalPages > 1" class="pagination-wrap">
        <v-pagination
          :model-value="page"
          :length="totalPages"
          :total-visible="7"
          rounded="circle"
          @update:model-value="changePage"
        />
      </div>
    </template>

    <v-dialog v-model="dialogOpen" max-width="560">
      <v-card>
        <v-card-title class="dialog-title">
          <v-icon :icon="dialogMode === 'create' ? 'mdi-plus' : 'mdi-pencil'" color="primary" size="22" />
          {{ dialogMode === 'create' ? 'إضافة اختصاص' : 'تعديل اختصاص' }}
        </v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <div class="form-fields">
            <div class="form-field">
              <label class="form-label">اسم الاختصاص</label>
              <input v-model="form.name" class="form-input" maxlength="200" required />
            </div>
            <div class="form-field">
              <label class="form-label">الاسم الموحد</label>
              <input v-model="form.normalizedName" class="form-input" maxlength="200" required />
            </div>
            <div class="form-field">
              <label class="form-label">رمز الأيقونة</label>
              <div class="icon-picker">
                <button
                  v-for="option in specializationIconOptions"
                  :key="option.value"
                  type="button"
                  class="icon-choice"
                  :class="{ 'icon-choice--selected': form.iconName === option.value }"
                  @click="form.iconName = option.value"
                >
                  <v-icon :icon="option.icon" size="22" />
                  <span>{{ option.value }}</span>
                </button>
              </div>
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="dialog-actions">
          <v-btn variant="outlined" :disabled="saving" @click="dialogOpen = false">تراجع</v-btn>
          <v-btn color="primary" prepend-icon="mdi-content-save" :loading="saving" @click="saveSpecialization">
            حفظ
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteOpen" max-width="420">
      <v-card>
        <v-card-title class="dialog-title">
          <v-icon icon="mdi-alert-circle" color="error" size="22" />
          حذف الاختصاص
        </v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          سيتم حذف اختصاص <strong>{{ selected?.name }}</strong> من القوائم المتاحة. البيانات القديمة المرتبطة به ستبقى محفوظة.
        </v-card-text>
        <v-divider />
        <v-card-actions class="dialog-actions">
          <v-btn variant="outlined" :disabled="deleting" @click="deleteOpen = false">تراجع</v-btn>
          <v-btn color="error" prepend-icon="mdi-delete" :loading="deleting" @click="deleteSpecialization">
            حذف
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.specializations-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.search-box {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
  min-width: 220px;
  padding: 0 12px;
  height: 42px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
}

.search-box input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  font-family: var(--font-family-primary);
  font-size: 14px;
}

.count-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  height: 42px;
  padding: 0 14px;
  border-radius: var(--radius-md);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--spacing-md);
}

.pagination-wrap {
  display: flex;
  justify-content: center;
  padding: var(--spacing-md) 0;
}

.specialization-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-height: 176px;
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.icon-box {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  color: var(--color-primary);
  background: var(--color-primary-soft);
}

.actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.specialization-card h3 {
  margin: var(--spacing-sm) 0 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--color-text);
  line-height: 1.45;
}

.specialization-card p {
  flex: 1;
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.icon-name {
  align-self: flex-start;
  max-width: 100%;
  padding: 4px 9px;
  border-radius: var(--radius-sm);
  background: var(--color-background);
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) !important;
  font-size: 16px !important;
  font-weight: 800;
}

.dialog-body {
  padding: var(--spacing-lg) !important;
  color: var(--color-text);
  line-height: 1.8;
}

.dialog-actions {
  justify-content: flex-end;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) !important;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-family-primary);
  font-size: 14px;
  outline: none;
}

.form-input:focus {
  border-color: var(--color-primary);
}

.icon-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--spacing-sm);
  max-height: 280px;
  overflow-y: auto;
  padding: var(--spacing-sm);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
}

.icon-choice {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-family-primary);
  font-size: 12px;
  font-weight: 700;
  text-align: start;
  cursor: pointer;
}

.icon-choice:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.icon-choice--selected {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.icon-choice span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 700px) {
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .search-box,
  .count-pill {
    width: 100%;
  }
}
</style>
