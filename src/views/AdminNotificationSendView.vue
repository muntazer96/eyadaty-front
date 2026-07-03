<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import api from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import type { ApiResponse, DoctorItem, UserItem } from '../types/api'
import { getErrorMessage } from '../utils/errors'

type TargetType = 'doctor' | 'allDoctors' | 'user' | 'allUsers'

interface AdminSendNotificationResult {
  savedNotifications: number
  signalRSent: number
  pushSucceeded: number
  pushFailed: number
  missingDoctorIds: number[]
  missingUserIds: string[]
}

const { success: showSuccess, error: showError } = useNotifications()

const targetOptions = [
  { label: 'طبيب محدد أو مجموعة أطباء', value: 'doctor', icon: 'mdi-stethoscope' },
  { label: 'جميع الأطباء', value: 'allDoctors', icon: 'mdi-account-heart' },
  { label: 'مستخدم محدد أو مجموعة مستخدمين', value: 'user', icon: 'mdi-account' },
  { label: 'جميع المستخدمين', value: 'allUsers', icon: 'mdi-account-group' },
] as const

const form = reactive({
  title: '',
  message: '',
  targetType: 'doctor' as TargetType,
  doctorIds: [] as number[],
  userIds: [] as string[],
})

const doctorSearch = ref('')
const userSearch = ref('')
const doctorItems = ref<DoctorItem[]>([])
const userItems = ref<UserItem[]>([])
const doctorsLoading = ref(false)
const usersLoading = ref(false)
const sending = ref(false)
const lastResult = ref<AdminSendNotificationResult>()

const isDoctorTarget = computed(() => form.targetType === 'doctor')
const isUserTarget = computed(() => form.targetType === 'user')
const isBulkTarget = computed(() => form.targetType === 'allDoctors' || form.targetType === 'allUsers')
const selectedCount = computed(() => {
  if (form.targetType === 'doctor') return form.doctorIds.length
  if (form.targetType === 'user') return form.userIds.length
  return 0
})

const canSend = computed(() => {
  if (!form.title.trim() || !form.message.trim()) return false
  if (form.targetType === 'doctor') return form.doctorIds.length > 0
  if (form.targetType === 'user') return form.userIds.length > 0
  return true
})

const recipientSummary = computed(() => {
  if (form.targetType === 'allDoctors') return 'سيصل الإشعار إلى جميع الأطباء المرتبطين بحسابات فعالة.'
  if (form.targetType === 'allUsers') return 'سيصل الإشعار إلى جميع المستخدمين الفعالين.'
  if (form.targetType === 'doctor') return selectedCount.value ? `${selectedCount.value} طبيب محدد` : 'اختر طبيبا واحدا على الأقل'
  return selectedCount.value ? `${selectedCount.value} مستخدم محدد` : 'اختر مستخدما واحدا على الأقل'
})

function doctorLabel(doctor: DoctorItem) {
  const details = [doctor.specialization?.name, doctor.iraqiProvinceName].filter(Boolean).join(' - ')
  return details ? `${doctor.name} (${details})` : doctor.name
}

function userLabel(user: UserItem) {
  const name = user.name || user.userName || user.phoneNumber || user.id
  return user.phoneNumber ? `${name} (${user.phoneNumber})` : name
}

async function searchDoctors() {
  doctorsLoading.value = true
  try {
    const response = await api.get<ApiResponse<DoctorItem[]>>('/Doctor/items', {
      params: { name: doctorSearch.value.trim() || undefined },
    })
    doctorItems.value = response.data.data
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    doctorsLoading.value = false
  }
}

async function searchUsers() {
  usersLoading.value = true
  try {
    const response = await api.get<ApiResponse<UserItem[]>>('/User/items', {
      params: { search: userSearch.value.trim() || undefined },
    })
    userItems.value = response.data.data.filter((user) => user.userName?.toLowerCase() !== 'superadmin' && !user.isLocked)
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    usersLoading.value = false
  }
}

async function sendNotification() {
  if (!canSend.value) {
    showError('أكمل بيانات الإشعار والمستلمين قبل الإرسال.')
    return
  }

  sending.value = true
  lastResult.value = undefined
  try {
    const payload = {
      title: form.title.trim(),
      message: form.message.trim(),
      targetType: form.targetType,
      doctorIds: form.targetType === 'doctor' ? form.doctorIds : undefined,
      userIds: form.targetType === 'user' ? form.userIds : undefined,
    }

    const response = await api.post<ApiResponse<AdminSendNotificationResult>>('/Notification/admin/send', payload)
    lastResult.value = response.data.data
    showSuccess(response.data.message || 'تم إرسال الإشعار بنجاح.')
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    sending.value = false
  }
}

function resetForm() {
  form.title = ''
  form.message = ''
  form.doctorIds = []
  form.userIds = []
  lastResult.value = undefined
}

watch(() => form.targetType, (targetType) => {
  lastResult.value = undefined
  if (targetType !== 'doctor') form.doctorIds = []
  if (targetType !== 'user') form.userIds = []
  if (targetType === 'doctor' && doctorItems.value.length === 0) searchDoctors()
  if (targetType === 'user' && userItems.value.length === 0) searchUsers()
}, { immediate: true })
</script>

<template>
  <div class="admin-notification-page">
    <div class="page-top">
      <div>
        <p class="page-kicker">إشعارات الإدارة</p>
        <h1 class="page-title">إرسال إشعار</h1>
      </div>
      <div class="page-actions">
        <v-chip color="primary" variant="tonal" size="small">
          {{ recipientSummary }}
        </v-chip>
        <v-btn variant="outlined" color="primary" prepend-icon="mdi-refresh" @click="resetForm">
          تفريغ
        </v-btn>
      </div>
    </div>

    <div class="send-layout">
      <v-card elevation="0" class="form-card">
        <div class="card-toolbar">
          <v-icon icon="mdi-bell-plus" color="primary" size="20" />
          <strong>تفاصيل الإشعار</strong>
        </div>

        <div class="form-body">
          <div class="form-field">
            <label class="form-label">عنوان الإشعار <span class="required">*</span></label>
            <input v-model="form.title" class="form-input" maxlength="160" placeholder="مثال: تحديث مهم" />
          </div>

          <div class="form-field">
            <label class="form-label">نص الإشعار <span class="required">*</span></label>
            <textarea v-model="form.message" class="form-textarea" maxlength="1000" rows="5" placeholder="اكتب الرسالة التي ستظهر للمستلمين" />
          </div>

          <div class="form-field">
            <label class="form-label">المستلمون <span class="required">*</span></label>
            <v-item-group v-model="form.targetType" mandatory class="target-grid">
              <v-item
                v-for="option in targetOptions"
                :key="option.value"
                v-slot="{ isSelected, toggle }"
                :value="option.value"
              >
                <button
                  type="button"
                  class="target-option"
                  :class="{ 'target-option--active': isSelected }"
                  @click="toggle"
                >
                  <v-icon :icon="option.icon" size="22" />
                  <span>{{ option.label }}</span>
                </button>
              </v-item>
            </v-item-group>
          </div>

          <div v-if="isDoctorTarget" class="form-field">
            <label class="form-label">اختيار الأطباء <span class="required">*</span></label>
            <div class="lookup-row">
              <input v-model="doctorSearch" class="form-input" placeholder="ابحث باسم الطبيب" @keyup.enter="searchDoctors" />
              <v-btn color="primary" :loading="doctorsLoading" prepend-icon="mdi-magnify" @click="searchDoctors">
                بحث
              </v-btn>
            </div>
            <v-autocomplete
              v-model="form.doctorIds"
              :items="doctorItems"
              :item-title="doctorLabel"
              item-value="id"
              :menu-props="{ contentClass: 'recipient-menu', maxHeight: 320 }"
              multiple
              chips
              closable-chips
              class="recipient-select"
              variant="outlined"
              density="comfortable"
              hide-details
              :loading="doctorsLoading"
              placeholder="اختر طبيبا أو أكثر"
            >
              <template #selection="{ item, index }">
                <v-chip
                  v-if="index < 2"
                  size="small"
                  color="primary"
                  variant="tonal"
                  closable
                  @click:close="form.doctorIds = form.doctorIds.filter((id) => id !== item.raw.id)"
                >
                  {{ item.raw.name }}
                </v-chip>
                <span v-else-if="index === 2" class="more-selected">+{{ form.doctorIds.length - 2 }}</span>
              </template>

              <template #item="{ props, item }">
                <v-list-item v-bind="props" class="recipient-menu-item" :title="undefined" :subtitle="undefined">
                  <template #prepend>
                    <v-icon
                      :icon="form.doctorIds.includes(item.raw.id) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'"
                      color="primary"
                      size="24"
                    />
                  </template>
                  <v-list-item-title>{{ item.raw.name }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ item.raw.specialization?.name || '-' }} - {{ item.raw.iraqiProvinceName || '-' }}
                  </v-list-item-subtitle>
                </v-list-item>
              </template>
            </v-autocomplete>
          </div>

          <div v-if="isUserTarget" class="form-field">
            <label class="form-label">اختيار المستخدمين <span class="required">*</span></label>
            <div class="lookup-row">
              <input v-model="userSearch" class="form-input" placeholder="ابحث بالاسم أو رقم الهاتف" @keyup.enter="searchUsers" />
              <v-btn color="primary" :loading="usersLoading" prepend-icon="mdi-magnify" @click="searchUsers">
                بحث
              </v-btn>
            </div>
            <v-autocomplete
              v-model="form.userIds"
              :items="userItems"
              :item-title="userLabel"
              item-value="id"
              :menu-props="{ contentClass: 'recipient-menu', maxHeight: 320 }"
              multiple
              chips
              closable-chips
              class="recipient-select"
              variant="outlined"
              density="comfortable"
              hide-details
              :loading="usersLoading"
              placeholder="اختر مستخدما أو أكثر"
            >
              <template #selection="{ item, index }">
                <v-chip
                  v-if="index < 2"
                  size="small"
                  color="primary"
                  variant="tonal"
                  closable
                  @click:close="form.userIds = form.userIds.filter((id) => id !== item.raw.id)"
                >
                  {{ item.raw.name || item.raw.userName || item.raw.phoneNumber || item.raw.id }}
                </v-chip>
                <span v-else-if="index === 2" class="more-selected">+{{ form.userIds.length - 2 }}</span>
              </template>

              <template #item="{ props, item }">
                <v-list-item v-bind="props" class="recipient-menu-item" :title="undefined" :subtitle="undefined">
                  <template #prepend>
                    <v-icon
                      :icon="form.userIds.includes(item.raw.id) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'"
                      color="primary"
                      size="24"
                    />
                  </template>
                  <v-list-item-title>{{ item.raw.name || item.raw.userName || 'مستخدم' }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ item.raw.phoneNumber || item.raw.id }}
                  </v-list-item-subtitle>
                </v-list-item>
              </template>
            </v-autocomplete>
          </div>

          <v-alert v-if="isBulkTarget" type="warning" variant="tonal" density="comfortable" icon="mdi-alert">
            هذا الخيار يرسل الإشعار دفعة واحدة لكل المستلمين المطابقين.
          </v-alert>
        </div>

        <v-divider />

        <v-card-actions class="form-actions">
          <v-btn variant="outlined" @click="resetForm">تفريغ</v-btn>
          <v-btn color="primary" prepend-icon="mdi-send" :disabled="!canSend" :loading="sending" @click="sendNotification">
            إرسال الإشعار
          </v-btn>
        </v-card-actions>
      </v-card>

      <v-card elevation="0" class="summary-card">
        <div class="summary-icon">
          <v-icon icon="mdi-bell-ring" color="primary" size="26" />
        </div>
        <h2>معاينة الإرسال</h2>
        <p class="summary-title">{{ form.title || 'عنوان الإشعار' }}</p>
        <p class="summary-message">{{ form.message || 'سيظهر نص الإشعار هنا قبل الإرسال.' }}</p>

        <div class="summary-row">
          <span>نطاق الإرسال</span>
          <strong>{{ recipientSummary }}</strong>
        </div>
        <div class="summary-row">
          <span>عدد الأحرف</span>
          <strong>{{ form.message.length }} / 1000</strong>
        </div>

        <div v-if="lastResult" class="result-box">
          <div class="result-row">
            <span>المحفوظة</span>
            <strong>{{ lastResult.savedNotifications }}</strong>
          </div>
          <div class="result-row">
            <span>SignalR</span>
            <strong>{{ lastResult.signalRSent }}</strong>
          </div>
          <div class="result-row">
            <span>Push ناجحة</span>
            <strong>{{ lastResult.pushSucceeded }}</strong>
          </div>
          <div class="result-row">
            <span>Push فاشلة</span>
            <strong>{{ lastResult.pushFailed }}</strong>
          </div>
        </div>
      </v-card>
    </div>
  </div>
</template>

<style scoped>
.admin-notification-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.page-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
}

.page-kicker {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.page-title {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  color: var(--color-text);
}

.page-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.send-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--spacing-lg);
  align-items: start;
}

.form-card,
.summary-card {
  border: 1px solid var(--color-border) !important;
  border-radius: var(--radius-lg) !important;
  overflow: hidden;
}

.card-toolbar {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
}

.card-toolbar strong {
  color: var(--color-text);
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
}

.required {
  color: var(--color-error);
}

.form-input,
.form-textarea {
  width: 100%;
}

.lookup-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--spacing-md);
}

.target-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.target-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  min-height: 58px;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.target-option:hover,
.target-option--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.target-option span {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}

.recipient-select {
  width: 100%;
}

.recipient-select :deep(.v-field) {
  min-height: 48px;
  border-radius: 8px;
  background: var(--color-surface);
}

.recipient-select :deep(.v-field__input) {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 46px;
  padding: 6px 12px;
  overflow: hidden;
}

.recipient-select :deep(.v-autocomplete__selection) {
  max-width: min(260px, 42%);
  margin: 0;
}

.recipient-select :deep(.v-chip) {
  max-width: 100%;
  border-radius: 999px;
}

.recipient-select :deep(.v-chip__content) {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recipient-select :deep(.v-chip__close) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 0 0 18px !important;
  width: 18px !important;
  min-width: 18px !important;
  height: 18px !important;
  min-height: 18px !important;
  padding: 0 !important;
  margin-inline-start: 5px !important;
  border-radius: 0 !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--color-primary) !important;
  opacity: 0.85;
  overflow: visible;
  line-height: 1 !important;
  appearance: none !important;
}

.recipient-select :deep(.v-chip__close:hover) {
  background: transparent !important;
  box-shadow: none !important;
  color: var(--color-primary-dark) !important;
  opacity: 1;
}

.recipient-select :deep(.v-chip__close:focus),
.recipient-select :deep(.v-chip__close:focus-visible),
.recipient-select :deep(.v-chip__close:active) {
  background: transparent !important;
  box-shadow: none !important;
  outline: 0 !important;
}

.recipient-select :deep(.v-chip__close .v-icon) {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 18px !important;
  min-width: 18px !important;
  height: 18px !important;
  min-height: 18px !important;
  margin: 0 !important;
  font-size: 18px !important;
  line-height: 18px !important;
  transform: none !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.recipient-select :deep(.v-chip__close::before),
.recipient-select :deep(.v-chip__close::after),
.recipient-select :deep(.v-chip__close .v-icon::before),
.recipient-select :deep(.v-chip__close .v-icon::after) {
  background: transparent !important;
  box-shadow: none !important;
}

.recipient-select :deep(.v-chip__close .v-btn__overlay),
.recipient-select :deep(.v-chip__close .v-btn__underlay),
.recipient-select :deep(.v-chip__close .v-icon__svg),
.recipient-select :deep(.v-chip__close .v-ripple__container) {
  background: transparent !important;
  box-shadow: none !important;
}

.recipient-select :deep(.v-chip__close .v-btn__overlay),
.recipient-select :deep(.v-chip__close .v-btn__underlay),
.recipient-select :deep(.v-chip__close .v-ripple__container) {
  display: none !important;
}

.recipient-select :deep(input) {
  min-width: 120px;
}

.more-selected {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--color-background);
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
}

:global(.recipient-menu) {
  border: 1px solid var(--color-border);
  border-radius: 8px !important;
  box-shadow: var(--shadow-lg) !important;
}

:global(.recipient-menu .v-list) {
  padding: 4px !important;
}

:global(.recipient-menu .recipient-menu-item) {
  min-height: 58px !important;
  margin: 2px 0;
  border-radius: 6px !important;
  color: var(--color-text) !important;
}

:global(.recipient-menu .recipient-menu-item .v-list-item__prepend) {
  align-self: center;
  margin-inline-end: 12px;
}

:global(.recipient-menu .recipient-menu-item .v-list-item__overlay),
:global(.recipient-menu .recipient-menu-item .v-ripple__container) {
  display: none !important;
}

:global(.recipient-menu .recipient-menu-item:hover),
:global(.recipient-menu .recipient-menu-item.v-list-item--active),
:global(.recipient-menu .recipient-menu-item[aria-selected='true']) {
  background: var(--color-primary-soft) !important;
}

:global(.recipient-menu .recipient-menu-item .v-list-item-title) {
  color: var(--color-text);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
  white-space: normal;
}

:global(.recipient-menu .recipient-menu-item .v-list-item-subtitle) {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.4;
  opacity: 1;
}

.form-actions {
  justify-content: flex-end;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) !important;
}

.summary-card {
  padding: var(--spacing-lg);
  position: sticky;
  top: 88px;
}

.summary-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  background: var(--color-primary-soft);
  margin-bottom: var(--spacing-md);
}

.summary-card h2 {
  margin: 0 0 var(--spacing-md);
  font-size: 18px;
  font-weight: 800;
  color: var(--color-text);
}

.summary-title,
.summary-message {
  margin: 0;
  overflow-wrap: anywhere;
}

.summary-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text);
}

.summary-message {
  margin-top: 8px;
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-muted);
  line-height: 1.7;
}

.summary-row,
.result-row {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md) 0;
  border-bottom: 1px solid var(--color-border-light);
}

.summary-row span,
.result-row span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.summary-row strong,
.result-row strong {
  color: var(--color-text);
  font-size: 13px;
  text-align: left;
}

.result-box {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
}

.result-row:last-child {
  border-bottom: 0;
}

@media (max-width: 960px) {
  .send-layout {
    grid-template-columns: 1fr;
  }

  .summary-card {
    position: static;
  }
}

@media (max-width: 640px) {
  .target-grid,
  .lookup-row {
    grid-template-columns: 1fr;
  }

  .page-actions,
  .form-actions {
    width: 100%;
  }

  .page-actions .v-btn,
  .form-actions .v-btn {
    flex: 1 1 auto;
  }
}
</style>
