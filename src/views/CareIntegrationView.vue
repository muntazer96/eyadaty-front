<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import api from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import { getErrorMessage } from '../utils/errors'
import EmptyState from '../components/common/Emptystate.vue'
import type { ApiResponse } from '../types/api'
import type {
  CareApiCredentialListItem,
  CareApiCredentialDetail,
  CreateCredentialResponse,
} from '../types/careIntegration'

type Modal = 'create' | 'created' | 'detail' | 'revoke' | undefined

const { success: showSuccess, error: showError } = useNotifications()

const loading = ref(false)
const creating = ref(false)
const modal = ref<Modal>()

const credentials = ref<CareApiCredentialListItem[]>([])
const detail = ref<CareApiCredentialDetail>()
const detailLoading = ref(false)
const createdResult = ref<CreateCredentialResponse>()
const copiedSecret = ref(false)

const createForm = reactive({
  name: '',
  scopes: ['care.appointments.read', 'care.appointments.manage', 'care.queue.read', 'care.queue.manage'],
  expiryDays: 90 as number | null,
})

const revokeConfirmAll = ref(false)
const revokeTarget = ref<CareApiCredentialListItem>()

const expiryOptions = [
  { value: 30, label: '30 يوماً' },
  { value: 60, label: '60 يوماً' },
  { value: 90, label: '90 يوماً' },
  { value: 180, label: '180 يوماً' },
  { value: 365, label: 'سنة كاملة' },
  { value: null, label: 'بدون انتهاء' },
]

const scopeOptions = [
  { value: 'care.appointments.read', label: 'قراءة الحجوزات' },
  { value: 'care.appointments.manage', label: 'إدارة الحجوزات' },
  { value: 'care.queue.read', label: 'قراءة الانتظار' },
  { value: 'care.queue.manage', label: 'إدارة الانتظار' },
]

function formatDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'medium' }).format(new Date(value)) : '-'
}

function formatDateTime(value?: string | null) {
  return value ? new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '-'
}

function statusColor(status: CareApiCredentialListItem['status']) {
  if (isActiveCredentialStatus(status)) return 'success'
  if (isRevokedCredentialStatus(status)) return 'error'
  return 'warning'
}

function statusLabel(status: CareApiCredentialListItem['status']) {
  if (isActiveCredentialStatus(status)) return 'نشط'
  if (isRevokedCredentialStatus(status)) return 'ملغى'
  return 'مستبدل'
}

function isActiveCredentialStatus(status: CareApiCredentialListItem['status']) {
  return status === 'Active' || status === 0
}

function isRevokedCredentialStatus(status: CareApiCredentialListItem['status']) {
  return status === 'Revoked' || status === 1
}

function scopeLabel(scope: string) {
  return scopeOptions.find((s) => s.value === scope)?.label ?? scope
}

async function loadCredentials() {
  loading.value = true
  try {
    const r = await api.get<ApiResponse<CareApiCredentialListItem[]>>('/CareIntegration')
    credentials.value = r.data.data ?? []
  } catch (e: any) {
    if (e.response?.status === 404) credentials.value = []
    else showError(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  createForm.name = ''
  createForm.scopes = ['care.appointments.read', 'care.appointments.manage', 'care.queue.read', 'care.queue.manage']
  createForm.expiryDays = 90
  modal.value = 'create'
}

async function createCredential() {
  if (!createForm.name.trim()) {
    showError('الرجاء إدخال اسم المفتاح')
    return
  }
  if (createForm.scopes.length === 0) {
    showError('الرجاء اختيار صلاحية واحدة على الأقل')
    return
  }
  creating.value = true
  try {
    const r = await api.post<ApiResponse<CreateCredentialResponse>>('/CareIntegration', {
      name: createForm.name,
      scopes: createForm.scopes,
      expiryDays: createForm.expiryDays,
    })
    createdResult.value = r.data.data
    copiedSecret.value = false
    modal.value = 'created'
    await loadCredentials()
  } catch (e) {
    showError(getErrorMessage(e))
  } finally {
    creating.value = false
  }
}

async function copySecret() {
  if (!createdResult.value) return
  try {
    await navigator.clipboard.writeText(createdResult.value.fullSecret)
    copiedSecret.value = true
  } catch {
    showError('تعذر النسخ، الرجاء نسخ المفتاح يدوياً')
  }
}

function closeCreated() {
  modal.value = undefined
  createdResult.value = undefined
}

async function openDetail(id: number) {
  detailLoading.value = true
  modal.value = 'detail'
  try {
    const r = await api.get<ApiResponse<CareApiCredentialDetail>>(`/CareIntegration/${id}`)
    detail.value = r.data.data
  } catch (e) {
    showError(getErrorMessage(e))
    modal.value = undefined
  } finally {
    detailLoading.value = false
  }
}

function openRevoke(cred: CareApiCredentialListItem) {
  revokeTarget.value = cred
  revokeConfirmAll.value = true
  modal.value = 'revoke'
}

async function confirmRevoke() {
  if (!revokeTarget.value) return
  try {
    const r = await api.post<ApiResponse<object>>(`/CareIntegration/${revokeTarget.value.id}/revoke`, {
      revokeAllIntegrations: revokeConfirmAll.value,
      reason: 'Revoked by doctor',
    })
    showSuccess(r.data.message)
    modal.value = undefined
    revokeTarget.value = undefined
    await loadCredentials()
  } catch (e) {
    showError(getErrorMessage(e))
  }
}

onMounted(() => loadCredentials())
</script>

<template>
  <div class="care-integration-page">

    <!-- Header -->
    <div class="page-top">
      <div>
        <p class="page-kicker">عيادتي كير</p>
        <h1 class="page-title">ربط عيادتي كير</h1>
        <p class="page-desc">مفتاح الربط يسمح لنسخة عيادتي كير بالوصول إلى حجوزاتك وإدارة شاشة الانتظار حسب الصلاحيات المحددة.</p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-key-plus" @click="openCreate">إنشاء مفتاح ربط</v-btn>
    </div>

    <!-- Credentials Table -->
    <v-card elevation="0" class="table-card">
      <div class="table-toolbar">
        <strong>مفاتيح الربط ({{ credentials.length }})</strong>
        <v-btn variant="outlined" color="primary" prepend-icon="mdi-refresh" :loading="loading" @click="loadCredentials">
          تحديث
        </v-btn>
      </div>
      <v-progress-linear v-if="loading" indeterminate color="primary" />
      <div class="table-scroll">
        <table v-if="credentials.length" class="data-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>المفتاح</th>
              <th>الحالة</th>
              <th>تاريخ الإنشاء</th>
              <th>تاريخ الانتهاء</th>
              <th>آخر استخدام</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cred in credentials" :key="cred.id">
              <td><strong>{{ cred.name }}</strong></td>
              <td><code class="mono">{{ cred.maskedSecret }}</code></td>
              <td>
                <v-chip :color="statusColor(cred.status)" size="small" label>
                  {{ statusLabel(cred.status) }}
                </v-chip>
              </td>
              <td class="muted-cell">{{ formatDate(cred.createdAt) }}</td>
              <td class="muted-cell">{{ cred.expiresAt ? formatDate(cred.expiresAt) : 'بلا انتهاء' }}</td>
              <td class="muted-cell">{{ formatDateTime(cred.lastUsedAt) }}</td>
              <td>
                <div class="row-actions">
                  <v-btn
                    v-if="isActiveCredentialStatus(cred.status)"
                    size="small"
                    variant="tonal"
                    color="error"
                    prepend-icon="mdi-cancel"
                    @click="openRevoke(cred)"
                  >
                    إلغاء
                  </v-btn>
                  <v-menu>
                    <template #activator="{ props }">
                      <v-btn icon="mdi-dots-vertical" size="small" variant="text" v-bind="props" />
                    </template>
                    <v-list density="compact" class="actions-list">
                      <v-list-item prepend-icon="mdi-eye" @click="openDetail(cred.id)">
                        <v-list-item-title>عرض التفاصيل</v-list-item-title>
                      </v-list-item>
                      <v-list-item
                        v-if="isActiveCredentialStatus(cred.status)"
                        prepend-icon="mdi-cancel"
                        class="action-danger"
                        @click="openRevoke(cred)"
                      >
                        <v-list-item-title>إلغاء مفتاح الربط</v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <EmptyState v-else-if="!loading" icon="mdi-key-variant" title="لا توجد مفاتيح ربط" description="أنشئ مفتاحاً جديداً للبدء بالربط مع عيادتي كير" />
      </div>
    </v-card>

    <!-- Security Warning -->
    <v-alert type="warning" variant="tonal" icon="mdi-shield-lock" density="compact" class="security-alert">
      <strong>تنبيه أمني:</strong>
      هذا المفتاح يمنح عيادتي كير صلاحية الوصول إلى حجوزاتك حسب الصلاحيات المحددة.<br />
      لا تشاركه مع أي شخص.
    </v-alert>

    <!-- ─────────────── Create Dialog ─────────────── -->
    <v-dialog :model-value="modal === 'create'" max-width="620" @update:model-value="modal = undefined">
      <v-card>
        <v-card-title class="dialog-title">
          <v-icon icon="mdi-key-plus" color="primary" size="20" />
          إنشاء مفتاح ربط جديد
        </v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <div class="form-grid">
            <div class="form-field form-field--full">
              <label class="form-label">اسم المفتاح <span class="required">*</span></label>
              <input v-model="createForm.name" class="form-input" placeholder="مثال: عيادة المنصور" maxlength="100" />
            </div>

            <div class="form-field form-field--full">
              <label class="form-label">الصلاحيات <span class="required">*</span></label>
              <div class="scopes-group">
                <label v-for="scope in scopeOptions" :key="scope.value" class="check-label">
                  <input
                    type="checkbox"
                    class="check-native"
                    :checked="createForm.scopes.includes(scope.value)"
                    @change="
                      createForm.scopes.includes(scope.value)
                        ? createForm.scopes.splice(createForm.scopes.indexOf(scope.value), 1)
                        : createForm.scopes.push(scope.value)
                    "
                  />
                  <span class="check-box">
                    <v-icon v-if="createForm.scopes.includes(scope.value)" icon="mdi-check" size="12" color="white" />
                  </span>
                  <span>{{ scope.label }}</span>
                  <code class="scope-code">{{ scope.value }}</code>
                </label>
              </div>
            </div>

            <div class="form-field form-field--full">
              <label class="form-label">مدة الصلاحية</label>
              <select v-model="createForm.expiryDays" class="form-input">
                <option v-for="opt in expiryOptions" :key="String(opt.value)" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="dialog-actions">
          <v-btn variant="outlined" :disabled="creating" @click="modal = undefined">إلغاء</v-btn>
          <v-btn color="primary" prepend-icon="mdi-key-plus" :loading="creating" @click="createCredential">
            إنشاء
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ─────────────── Created Result (secret shown ONCE) ─────────────── -->
    <v-dialog :model-value="modal === 'created'" max-width="560" persistent @update:model-value="closeCreated">
      <v-card>
        <v-card-title class="dialog-title">
          <v-icon icon="mdi-check-circle" color="success" size="20" />
          تم إنشاء المفتاح بنجاح
        </v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <v-alert type="error" variant="tonal" icon="mdi-alert" density="compact" class="mb-4">
            <strong>انسخ المفتاح الآن. لن تتمكن من مشاهدته مرة أخرى.</strong>
          </v-alert>
          <div class="secret-box">
            <code class="secret-value">{{ createdResult?.fullSecret }}</code>
            <v-btn
              :icon="copiedSecret ? 'mdi-check' : 'mdi-content-copy'"
              size="small"
              variant="tonal"
              :color="copiedSecret ? 'success' : 'primary'"
              @click="copySecret"
            />
          </div>
          <p class="secret-meta">
            <span>الاسم: <strong>{{ createdResult?.name }}</strong></span>
            <span>الصلاحية: <strong>{{ createdResult?.scopes.length }} صلاحيات</strong></span>
          </p>
        </v-card-text>
        <v-divider />
        <v-card-actions class="dialog-actions">
          <v-btn color="primary" @click="closeCreated">نسختُه، إغلاق</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ─────────────── Detail Dialog ─────────────── -->
    <v-dialog :model-value="modal === 'detail'" max-width="720" scrollable @update:model-value="modal = undefined">
      <v-card>
        <v-card-title class="dialog-title">
          <v-icon icon="mdi-key-variant" color="primary" size="20" />
          تفاصيل مفتاح الربط
          <v-chip v-if="detail" :color="statusColor(detail.status)" size="small" label class="mr-auto">
            {{ statusLabel(detail.status) }}
          </v-chip>
        </v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <template v-if="detail">
            <div class="detail-summary">
              <div>
                <span>الاسم</span>
                <strong>{{ detail.name }}</strong>
              </div>
              <div>
                <span>المفتاح</span>
                <strong><code class="mono">{{ detail.maskedSecret }}</code></strong>
              </div>
              <div>
                <span>رقم الإصدار</span>
                <strong>v{{ detail.credentialVersion }}</strong>
              </div>
              <div>
                <span>تاريخ الإنشاء</span>
                <strong>{{ formatDate(detail.createdAt) }}</strong>
              </div>
              <div>
                <span>تاريخ الانتهاء</span>
                <strong>{{ detail.expiresAt ? formatDate(detail.expiresAt) : 'بلا انتهاء' }}</strong>
              </div>
              <div>
                <span>آخر استخدام</span>
                <strong>{{ formatDateTime(detail.lastUsedAt) }}</strong>
              </div>
            </div>

            <!-- Scopes -->
            <h3 class="section-title">الصلاحيات الممنوحة</h3>
            <div class="scopes-detail-list">
              <v-chip
                v-for="scope in detail.scopes"
                :key="scope"
                size="small"
                variant="tonal"
                color="primary"
                class="scope-chip"
              >
                <v-icon icon="mdi-check-circle" size="14" start />
                {{ scopeLabel(scope) }}
              </v-chip>
            </div>

            <!-- Connected Installation -->
            <template v-if="detail.connectedInstallationId">
              <h3 class="section-title">جهاز متصل</h3>
              <div class="detail-summary">
                <div>
                  <span>اسم الجهاز</span>
                  <strong>{{ detail.deviceName || '-' }}</strong>
                </div>
                <div>
                  <span>النظام</span>
                  <strong>{{ detail.platform || '-' }}</strong>
                </div>
                <div>
                  <span>إصدار عيادتي كير</span>
                  <strong>{{ detail.connectedCareVersion || '-' }}</strong>
                </div>
                <div>
                  <span>تاريخ الاتصال</span>
                  <strong>{{ formatDateTime(detail.connectedAt) }}</strong>
                </div>
                <div>
                  <span>معرّف التثبيت</span>
                  <strong><code class="mono">{{ detail.connectedInstallationId }}</code></strong>
                </div>
              </div>
            </template>
            <template v-else>
              <v-alert type="info" variant="tonal" icon="mdi-monitor-off" density="compact">
                لا يوجد جهاز متصل حالياً بهذا المفتاح.
              </v-alert>
            </template>

            <!-- Revoke button -->
            <div v-if="isActiveCredentialStatus(detail.status)" class="detail-footer">
              <v-btn variant="tonal" color="error" prepend-icon="mdi-cancel" @click="openRevoke(detail)">
                إلغاء مفتاح الربط
              </v-btn>
            </div>
          </template>
          <v-progress-linear v-else indeterminate color="primary" />
        </v-card-text>
        <v-divider />
        <v-card-actions class="dialog-actions">
          <v-btn variant="outlined" @click="modal = undefined">إغلاق</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ─────────────── Revoke Confirmation Dialog ─────────────── -->
    <v-dialog :model-value="modal === 'revoke'" max-width="500" @update:model-value="modal = undefined">
      <v-card>
        <v-card-title class="dialog-title">
          <v-icon icon="mdi-alert" color="error" size="20" />
          إلغاء مفتاح الربط
        </v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <v-alert type="error" variant="tonal" icon="mdi-alert-circle" density="compact" class="mb-4">
            أنت على وشك إلغاء مفتاح الربط <strong>{{ revokeTarget?.name }}</strong>.<br />
            سيتوقف هذا المفتاح عن العمل فوراً، وإذا أبقيت الخيار مفعلاً سيتم قطع اتصال عيادتي كير المرتبط به.<br />
            هذا الإجراء لا يمكن التراجع عنه.
          </v-alert>
          <label class="check-label">
            <input v-model="revokeConfirmAll" type="checkbox" class="check-native" />
            <span class="check-box">
              <v-icon v-if="revokeConfirmAll" icon="mdi-check" size="12" color="white" />
            </span>
            <span>قطع اتصال عيادتي كير المرتبط بهذا المفتاح</span>
          </label>
        </v-card-text>
        <v-divider />
        <v-card-actions class="dialog-actions">
          <v-btn variant="outlined" @click="modal = 'detail'">تراجع</v-btn>
          <v-btn color="error" @click="confirmRevoke">تأكيد الإلغاء</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </div>
</template>

<style scoped>
.care-integration-page { display: flex; flex-direction: column; gap: var(--spacing-lg); }

.page-top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--spacing-lg); flex-wrap: wrap; }
.page-kicker { margin: 0 0 4px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-muted); }
.page-title { margin: 0; font-size: 28px; font-weight: 800; color: var(--color-text); }
.page-desc { margin: 6px 0 0 0; font-size: 14px; color: var(--color-text-muted); line-height: 1.6; max-width: 560px; }

.security-alert { border-radius: var(--radius-lg) !important; }

.table-card { border: 1px solid var(--color-border) !important; border-radius: var(--radius-lg) !important; overflow: hidden; }
.table-toolbar { display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-lg); border-bottom: 1px solid var(--color-border); }
.table-toolbar strong { flex: 1; font-size: 15px; color: var(--color-text); }
.table-scroll { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th { padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 700; color: var(--color-text-muted); background: var(--color-background); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
.data-table td { padding: 12px 16px; border-bottom: 1px solid var(--color-border-light); vertical-align: middle; color: var(--color-text); }
.data-table tbody tr:hover { background: var(--color-background); }
.data-table tbody tr:last-child td { border-bottom: none; }
.muted-cell { color: var(--color-text-muted); font-size: 12px; }
.row-actions { display: flex; gap: 4px; justify-content: flex-end; }
.mono { direction: ltr; unicode-bidi: embed; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; background: var(--color-background); padding: 2px 6px; border-radius: 4px; }

.actions-list { min-width: 180px; }
.action-danger { color: var(--color-error) !important; }

.dialog-title { display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-lg) !important; font-size: 16px !important; font-weight: 700; color: var(--color-text); }
.dialog-body { padding: var(--spacing-lg) !important; }
.dialog-actions { padding: var(--spacing-lg) !important; gap: var(--spacing-md); justify-content: flex-end; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-lg); }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field--full { grid-column: 1 / -1; }
.form-label { font-size: 13px; font-weight: 600; color: var(--color-text); }
.required { color: var(--color-error); }
.form-input { padding: 10px 12px; border: 1.5px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text); font-family: var(--font-family-primary); font-size: 14px; outline: none; width: 100%; transition: border-color 0.2s; }
.form-input:focus { border-color: var(--color-primary); }

.scopes-group { display: flex; flex-direction: column; gap: var(--spacing-md); padding: var(--spacing-md); background: var(--color-background); border-radius: var(--radius-md); border: 1px solid var(--color-border-light); }
.check-label { display: flex; align-items: center; gap: var(--spacing-md); cursor: pointer; font-size: 13px; font-weight: 500; color: var(--color-text); user-select: none; line-height: 1.5; }
.check-native { position: absolute; opacity: 0; width: 0; height: 0; }
.check-box { width: 18px; height: 18px; border: 2px solid var(--color-border); border-radius: 4px; background: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s ease; }
.check-native:checked ~ .check-box { background: var(--color-primary); border-color: var(--color-primary); }
.scope-code { margin-inline-start: auto; direction: ltr; font-size: 11px; color: var(--color-text-muted); background: var(--color-surface); padding: 2px 8px; border-radius: 4px; }

.secret-box { display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-lg); background: var(--color-background); border: 2px dashed var(--color-primary); border-radius: var(--radius-md); }
.secret-value { flex: 1; direction: ltr; unicode-bidi: embed; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 15px; font-weight: 700; letter-spacing: 1px; color: var(--color-text); overflow-wrap: anywhere; word-break: break-all; }
.secret-meta { margin: var(--spacing-md) 0 0 0; display: flex; gap: var(--spacing-lg); font-size: 13px; color: var(--color-text-muted); }

.mb-4 { margin-bottom: var(--spacing-lg); }

.detail-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-md); margin-bottom: var(--spacing-xl, 24px); }
.detail-summary > div { display: flex; flex-direction: column; gap: 3px; padding: var(--spacing-md); background: var(--color-background); border-radius: var(--radius-md); }
.detail-summary span { font-size: 11px; font-weight: 700; color: var(--color-text-muted); }
.detail-summary strong { font-size: 14px; color: var(--color-text); overflow-wrap: anywhere; }
.section-title { margin: 0 0 var(--spacing-md) 0; font-size: 14px; font-weight: 800; color: var(--color-text); }
.detail-footer { display: flex; justify-content: flex-start; margin-top: var(--spacing-lg); padding-top: var(--spacing-lg); border-top: 1px solid var(--color-border-light); }

.scopes-detail-list { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); margin-bottom: var(--spacing-lg); }
.scope-chip { font-size: 12px !important; }

.mr-auto { margin-inline-start: auto; }

@media (max-width: 768px) {
  .page-top { flex-direction: column; align-items: stretch; }
  .form-grid { grid-template-columns: 1fr; }
  .detail-summary { grid-template-columns: 1fr 1fr; }
  .secret-box { flex-direction: column; align-items: stretch; }
}

@media (max-width: 500px) {
  .detail-summary { grid-template-columns: 1fr; }
}
</style>
