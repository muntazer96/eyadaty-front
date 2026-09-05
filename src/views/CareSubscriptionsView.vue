<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import api from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import { getErrorMessage } from '../utils/errors'
import EmptyState from '../components/common/Emptystate.vue'
import type { ApiResponse, DoctorItem, PageResult } from '../types/api'
import {
  careInstallationStatusLabel,
  careLicenseStatusLabel,
  careSubscriptionStatusLabel,
  type CareEvent,
  type CareInstallation,
  type CarePlan,
  type CareSubscriptionDetail,
  type CareSubscriptionListItem,
  type CreateCareSubscriptionResult,
  type UpsertCarePlanPayload,
} from '../types/care'

type Tab = 'subscriptions' | 'plans' | 'installations' | 'events'
type Modal = 'create' | 'created' | 'detail' | 'renew' | 'reasonAction' | 'replaceLicense' | 'planForm' | undefined

const { success: showSuccess, error: showError } = useNotifications()

const activeTab = ref<Tab>('subscriptions')
const loading = ref(false)
const modal = ref<Modal>()

// ─────────────────────── Lookups ───────────────────────
const plans = ref<CarePlan[]>([])
const doctors = ref<DoctorItem[]>([])

// ─────────────────────── Subscriptions ───────────────────────
const subs = ref<CareSubscriptionListItem[]>([])
const subPage = ref(1)
const subTotalPages = ref(1)
const subTotalItems = ref(0)
const subFilters = reactive({ doctorName: '', planId: '', bucket: '' })

// ─────────────────────── Create ───────────────────────
const today = new Date()
const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
const createForm = reactive({
  doctorId: '',
  planId: '',
  startDate: toInputDate(today),
  endDate: toInputDate(nextYear),
  maxInstallations: '' as string | number,
  notes: '',
})
const createdResult = ref<CreateCareSubscriptionResult>()
const copiedKey = ref(false)

// ─────────────────────── Detail & actions ───────────────────────
const detail = ref<CareSubscriptionDetail>()
const detailLoading = ref(false)
const renewForm = reactive({ newEndDate: '', reason: '' })
const pendingAction = ref<{ title: string; text: string; endpoint: string; button: string }>()
const actionReason = ref('')
const replaceForm = reactive({ licenseId: 0, reason: '', keepActiveInstallations: false, installationIdToKeep: '' })

// ─────────────────────── Installations ───────────────────────
const installations = ref<CareInstallation[]>([])
const instPage = ref(1)
const instTotalPages = ref(1)
const instTotalItems = ref(0)
const instFilters = reactive({ deviceName: '', onlyActive: '' })

// ─────────────────────── Events ───────────────────────
const events = ref<CareEvent[]>([])
const evPage = ref(1)
const evTotalPages = ref(1)
const evTotalItems = ref(0)
const evFilters = reactive({ eventType: '', onlySuspicious: '', subscriptionId: '' })

// ─────────────────────── Plans ───────────────────────
const planSaving = ref(false)
const planEditingId = ref<number>()
const planForm = reactive<UpsertCarePlanPayload>({
  name: '',
  code: '',
  description: '',
  maxInstallations: 1,
  offlineValidityDays: 7,
  gracePeriodDays: 3,
  features: 'patient_management,visits,prescriptions,reports,attachments',
  isActive: true,
})

const doctorOptions = computed(() =>
  doctors.value.map((d) => ({ value: String(d.id), label: d.name ?? `طبيب #${d.id}` })),
)

function toInputDate(d: Date) {
  return d.toLocaleDateString('en-CA')
}

onMounted(async () => {
  try { await Promise.all([loadLookups(), loadSubscriptions()]) }
  catch (e) { showError(getErrorMessage(e)) }
})

function statusMeta(status: string) {
  return careSubscriptionStatusLabel(status)
}

function formatDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'medium' }).format(new Date(value)) : '-'
}

function formatDateTime(value?: string | null) {
  return value ? new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '-'
}

function daysLeft(endDate: string) {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
}

function truncate(text: string | null | undefined, length = 70) {
  if (!text) return '-'
  return text.length > length ? `${text.slice(0, length)}…` : text
}

async function loadLookups() {
  const [planRes, docRes] = await Promise.all([
    api.get<ApiResponse<CarePlan[]>>('/CareSubscriptions/plans'),
    api.get<ApiResponse<DoctorItem[]>>('/Doctor/items'),
  ])
  plans.value = planRes.data.data ?? []
  doctors.value = docRes.data.data ?? []
}

// ─────────────────────── Plans management ───────────────────────
async function loadPlans() {
  loading.value = true
  try {
    const r = await api.get<ApiResponse<CarePlan[]>>('/CareSubscriptions/plans')
    plans.value = r.data.data ?? []
  } catch (e: any) {
    if (e.response?.status === 404) plans.value = []
    else showError(getErrorMessage(e))
  } finally { loading.value = false }
}

function resetPlanForm() {
  planEditingId.value = undefined
  Object.assign(planForm, {
    name: '',
    code: '',
    description: '',
    maxInstallations: 1,
    offlineValidityDays: 7,
    gracePeriodDays: 3,
    features: 'patient_management,visits,prescriptions,reports,attachments',
    isActive: true,
  })
}

function openPlanCreate() {
  resetPlanForm()
  modal.value = 'planForm'
}

function openPlanEdit(plan: CarePlan) {
  planEditingId.value = plan.id
  Object.assign(planForm, {
    name: plan.name,
    code: plan.code,
    description: plan.description ?? '',
    maxInstallations: plan.maxInstallations,
    offlineValidityDays: plan.offlineValidityDays,
    gracePeriodDays: plan.gracePeriodDays,
    features: plan.features,
    isActive: plan.isActive,
  })
  modal.value = 'planForm'
}

async function savePlan() {
  if (!planForm.name.trim() || !planForm.code.trim()) {
    showError('الرجاء إدخال اسم الباقة وكودها')
    return
  }
  planSaving.value = true
  try {
    const payload: UpsertCarePlanPayload = {
      name: planForm.name,
      code: planForm.code,
      description: planForm.description || undefined,
      maxInstallations: Math.max(1, Number(planForm.maxInstallations) || 1),
      offlineValidityDays: Math.max(0, Number(planForm.offlineValidityDays) || 0),
      gracePeriodDays: Math.max(0, Number(planForm.gracePeriodDays) || 0),
      features: planForm.features,
      isActive: planForm.isActive,
    }
    const r = planEditingId.value
      ? await api.put<ApiResponse<CarePlan>>(`/CareSubscriptions/plans/${planEditingId.value}`, payload)
      : await api.post<ApiResponse<CarePlan>>('/CareSubscriptions/plans', payload)
    showSuccess(r.data.message || 'تم الحفظ')
    modal.value = undefined
    await loadPlans()
  } catch (e) {
    showError(getErrorMessage(e))
  } finally { planSaving.value = false }
}

async function loadSubscriptions() {
  loading.value = true
  try {
    const r = await api.get<ApiResponse<PageResult<CareSubscriptionListItem>>>('/CareSubscriptions', {
      params: {
        doctorName: subFilters.doctorName || undefined,
        planId: subFilters.planId || undefined,
        bucket: subFilters.bucket || undefined,
        page: subPage.value,
        pageSize: 10,
      },
    })
    subs.value = r.data.data.items
    subTotalPages.value = r.data.data.totalPages
    subTotalItems.value = r.data.data.totalItems
  } catch (e: any) {
    if (e.response?.status === 404) { subs.value = []; subTotalPages.value = 1; subTotalItems.value = 0 }
    else showError(getErrorMessage(e))
  } finally { loading.value = false }
}

async function loadInstallations() {
  loading.value = true
  try {
    const r = await api.get<ApiResponse<PageResult<CareInstallation>>>('/CareInstallations', {
      params: {
        deviceName: instFilters.deviceName || undefined,
        onlyActive: instFilters.onlyActive === '' ? undefined : instFilters.onlyActive,
        page: instPage.value,
        pageSize: 10,
      },
    })
    installations.value = r.data.data.items
    instTotalPages.value = r.data.data.totalPages
    instTotalItems.value = r.data.data.totalItems
  } catch (e: any) {
    if (e.response?.status === 404) { installations.value = []; instTotalPages.value = 1; instTotalItems.value = 0 }
    else showError(getErrorMessage(e))
  } finally { loading.value = false }
}

async function loadEvents() {
  loading.value = true
  try {
    const r = await api.get<ApiResponse<PageResult<CareEvent>>>('/CareSecurityEvents', {
      params: {
        eventType: evFilters.eventType || undefined,
        onlySuspicious: evFilters.onlySuspicious === '' ? undefined : evFilters.onlySuspicious,
        subscriptionId: evFilters.subscriptionId || undefined,
        page: evPage.value,
        pageSize: 15,
      },
    })
    events.value = r.data.data.items
    evTotalPages.value = r.data.data.totalPages
    evTotalItems.value = r.data.data.totalItems
  } catch (e: any) {
    if (e.response?.status === 404) { events.value = []; evTotalPages.value = 1; evTotalItems.value = 0 }
    else showError(getErrorMessage(e))
  } finally { loading.value = false }
}

function selectTab(tab: Tab) {
  activeTab.value = tab
  if (tab === 'subscriptions') { subPage.value = 1; loadSubscriptions() }
  if (tab === 'plans') loadPlans()
  if (tab === 'installations') { instPage.value = 1; loadInstallations() }
  if (tab === 'events') { evPage.value = 1; loadEvents() }
}

function applySubFilters() { subPage.value = 1; loadSubscriptions() }
function applyInstFilters() { instPage.value = 1; loadInstallations() }
function applyEvFilters() { evPage.value = 1; loadEvents() }

// ─────────────────────── Create flow ───────────────────────
function onPlanSelected() {
  const plan = plans.value.find((p) => p.id === Number(createForm.planId))
  if (plan) createForm.maxInstallations = plan.maxInstallations
}

async function createSubscription() {
  if (!createForm.doctorId || !createForm.planId) {
    showError('الرجاء اختيار الطبيب والباقة')
    return
  }
  try {
    const r = await api.post<ApiResponse<CreateCareSubscriptionResult>>('/CareSubscriptions', {
      doctorId: Number(createForm.doctorId),
      planId: Number(createForm.planId),
      startDate: createForm.startDate,
      endDate: createForm.endDate,
      maxInstallations: createForm.maxInstallations === '' ? undefined : Number(createForm.maxInstallations),
      notes: createForm.notes || undefined,
    })
    createdResult.value = r.data.data
    copiedKey.value = false
    modal.value = 'created'
    Object.assign(createForm, { doctorId: '', planId: '', maxInstallations: '', notes: '', startDate: toInputDate(new Date()), endDate: toInputDate(nextYear) })
    await loadSubscriptions()
  } catch (e) {
    showError(getErrorMessage(e))
  }
}

async function copyKey() {
  if (!createdResult.value) return
  try {
    await navigator.clipboard.writeText(createdResult.value.fullLicenseKey)
    copiedKey.value = true
  } catch {
    showError('تعذر النسخ، الرجاء نسخ المفتاح يدوياً')
  }
}

function closeCreated() {
  modal.value = undefined
  createdResult.value = undefined
}

// ─────────────────────── Detail ───────────────────────
async function openDetail(id: number) {
  detailLoading.value = true
  modal.value = 'detail'
  try {
    const r = await api.get<ApiResponse<CareSubscriptionDetail>>(`/CareSubscriptions/${id}`)
    detail.value = r.data.data
  } catch (e) {
    showError(getErrorMessage(e)); modal.value = undefined
  } finally { detailLoading.value = false }
}

async function refreshDetail(id: number) {
  try {
    const r = await api.get<ApiResponse<CareSubscriptionDetail>>(`/CareSubscriptions/${id}`)
    detail.value = r.data.data
  } catch { /* main list refresh below covers it */ }
  await loadSubscriptions()
}

function openRenew(item: CareSubscriptionListItem | CareSubscriptionDetail) {
  const base = new Date(Math.max(Date.now(), new Date(item.endDate).getTime()))
  const suggested = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  suggested.setFullYear(suggested.getFullYear() + 1)
  renewForm.newEndDate = toInputDate(suggested)
  renewForm.reason = ''
  detail.value = item as CareSubscriptionDetail
  modal.value = 'renew'
}

async function renew() {
  const id = detail.value?.id
  if (!id) return
  try {
    const r = await api.post<ApiResponse<object>>(`/CareSubscriptions/${id}/renew`, {
      newEndDate: renewForm.newEndDate,
      reason: renewForm.reason || undefined,
    })
    showSuccess(r.data.message); modal.value = undefined
    await refreshDetail(id)
  } catch (e) { showError(getErrorMessage(e)) }
}

function askAction(title: string, text: string, endpoint: string, button: string) {
  pendingAction.value = { title, text, endpoint, button }
  actionReason.value = ''
  modal.value = 'reasonAction'
}

async function runAction() {
  if (!pendingAction.value) return
  try {
    const r = await api.post<ApiResponse<object>>(pendingAction.value.endpoint, { reason: actionReason.value })
    showSuccess(r.data.message); modal.value = undefined
    const id = detail.value?.id
    if (id && pendingAction.value.endpoint.includes(`/CareSubscriptions/${id}/`)) await refreshDetail(id)
    else if (activeTab.value === 'installations') await loadInstallations()
    else await loadSubscriptions()
  } catch (e) { showError(getErrorMessage(e)) }
}

// License actions operate within the detail dialog
function askRevokeLicense(licenseId: number) {
  askAction(
    'إلغاء ترخيص',
    'سيتم إلغاء هذا الترخيص وإيقاف جميع تثبيتاته عن العمل عند أقرب تحقق. هل أنت متأكد؟',
    `/CareLicenses/${licenseId}/revoke`,
    'إلغاء الترخيص',
  )
}

function askRevokeInstallation(installationRowId: number, fromList = false) {
  const prefix = fromList ? '/CareInstallations' : '/CareInstallations'
  askAction(
    'إلغاء تثبيت',
    'سيتم إبطال هذا الجهاز فوراً ولن يستطيع مزامنة الترخيص بعد الآن.',
    `${prefix}/${installationRowId}/revoke`,
    'إلغاء التثبيت',
  )
}

function askResetInstallation(installationRowId: number) {
  askAction(
    'تصفير تثبيت (إعادة تنشيط)',
    'يمكن للطبيب إعادة تنشيط نفس الجهاز بمفتاح جديد دون احتساب مقعد إضافي. استخدم هذه الأداة بعد إعادة تثبيت النظام.',
    `/CareInstallations/${installationRowId}/reset`,
    'تصفير التثبيت',
  )
}

function openReplaceLicense(licenseId: number) {
  replaceForm.reason = ''
  replaceForm.keepActiveInstallations = false
  replaceForm.installationIdToKeep = ''
  replaceForm.licenseId = licenseId
  modal.value = 'replaceLicense'
}

const replaceableInstallations = computed(() =>
  detail.value?.installations.filter((i) => i.status === 'Active') ?? [],
)

async function replaceLicense() {
  try {
    const r = await api.post<ApiResponse<{ fullLicenseKey: string }>>(
      `/CareLicenses/${replaceForm.licenseId}/replace`,
      {
        reason: replaceForm.reason,
        keepActiveInstallations: replaceForm.keepActiveInstallations,
        installationIdToKeep: replaceForm.installationIdToKeep || undefined,
      },
    )
    modal.value = undefined
    if (r.data.data?.fullLicenseKey) {
      createdResult.value = {
        subscription: detail.value ?? ({ id: 0 } as unknown as CareSubscriptionDetail),
        fullLicenseKey: r.data.data.fullLicenseKey,
      }
      copiedKey.value = false
      modal.value = 'created'
    } else {
      showSuccess(r.data.message)
    }
    const id = detail.value?.id
    if (id) await refreshDetail(id)
  } catch (e) { showError(getErrorMessage(e)) }
}
</script>

<template>
  <div class="care-page">
    <!-- Header -->
    <div class="page-top">
      <div>
        <p class="page-kicker">عيادتي كير</p>
        <h1 class="page-title">الاشتراكات والتراخيص</h1>
      </div>
      <v-btn color="primary" prepend-icon="mdi-key-plus" @click="modal = 'create'">إنشاء اشتراك</v-btn>
    </div>

    <!-- Tabs -->
    <div class="tabs-bar">
      <button type="button" :class="['tab-btn', { 'tab-active': activeTab === 'subscriptions' }]" @click="selectTab('subscriptions')">
        <v-icon icon="mdi-certificate" size="18" /> الاشتراكات
      </button>
      <button type="button" :class="['tab-btn', { 'tab-active': activeTab === 'installations' }]" @click="selectTab('installations')">
        <v-icon icon="mdi-monitor" size="18" /> التثبيتات
      </button>
      <button type="button" :class="['tab-btn', { 'tab-active': activeTab === 'events' }]" @click="selectTab('events')">
        <v-icon icon="mdi-shield-alert" size="18" /> الأحداث الأمنية
      </button>
      <button type="button" :class="['tab-btn', { 'tab-active': activeTab === 'plans' }]" @click="selectTab('plans')">
        <v-icon icon="mdi-package-variant-closed" size="18" /> الباقات
      </button>
    </div>

    <!-- ─────────────── Subscriptions Tab ─────────────── -->
    <template v-if="activeTab === 'subscriptions'">
      <div class="filters-bar">
        <div class="filter-field">
          <label class="filter-label">اسم الطبيب</label>
          <input v-model="subFilters.doctorName" class="filter-input" placeholder="ابحث بالاسم" @keyup.enter="applySubFilters" />
        </div>
        <div class="filter-field">
          <label class="filter-label">الباقة</label>
          <select v-model="subFilters.planId" class="filter-select">
            <option value="">كل الباقات</option>
            <option v-for="plan in plans" :key="plan.id" :value="String(plan.id)">{{ plan.name }}</option>
          </select>
        </div>
        <div class="filter-field">
          <label class="filter-label">الحالة</label>
          <select v-model="subFilters.bucket" class="filter-select">
            <option value="">الكل</option>
            <option value="expiring">قاربت الانتهاء (30 يوماً)</option>
            <option value="expired">منتهية</option>
            <option value="suspended">موقوفة</option>
          </select>
        </div>
        <v-btn class="filter-btn" variant="outlined" color="primary" prepend-icon="mdi-magnify" @click="applySubFilters">بحث</v-btn>
      </div>

      <v-card elevation="0" class="table-card">
        <div class="table-toolbar">
          <strong>الاشتراكات ({{ subTotalItems }})</strong>
        </div>
        <v-progress-linear v-if="loading" indeterminate color="primary" />
        <div class="table-scroll">
          <table v-if="subs.length" class="data-table">
            <thead>
              <tr>
                <th>الطبيب</th>
                <th>الباقة</th>
                <th>الفترة</th>
                <th>التثبيتات</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in subs" :key="item.id">
                <td><strong>{{ item.doctorName }}</strong></td>
                <td>{{ item.planName }}</td>
                <td>
                  {{ formatDate(item.startDate) }} — {{ formatDate(item.endDate) }}
                  <p v-if="item.status === 'Active'" class="row-sub">{{ daysLeft(item.endDate) }} يوماً متبقياً</p>
                </td>
                <td>{{ item.activeInstallations }} / {{ item.maxInstallations }}</td>
                <td><v-chip :color="statusMeta(item.status).color" size="small" label>{{ statusMeta(item.status).label }}</v-chip></td>
                <td>
                  <div class="row-actions">
                    <v-tooltip text="التفاصيل">
                      <template #activator="{ props }"><v-btn v-bind="props" icon="mdi-eye" size="small" variant="text" @click="openDetail(item.id)" /></template>
                    </v-tooltip>
                    <v-tooltip text="تجديد">
                      <template #activator="{ props }"><v-btn v-bind="props" icon="mdi-calendar-refresh" size="small" variant="text" @click="openRenew(item)" /></template>
                    </v-tooltip>
                    <v-tooltip v-if="item.status !== 'Suspended'" text="إيقاف مؤقت">
                      <template #activator="{ props }">
                        <v-btn v-bind="props" icon="mdi-pause-circle" size="small" variant="text" color="warning"
                          @click="askAction('إيقاف مؤقت', 'سيتم تعطيل الاستخدام المحلي حتى الاستئناف.', `/CareSubscriptions/${item.id}/suspend`, 'إيقاف')" />
                      </template>
                    </v-tooltip>
                    <v-tooltip v-if="item.status === 'Suspended'" text="استئناف">
                      <template #activator="{ props }">
                        <v-btn v-bind="props" icon="mdi-play-circle" size="small" variant="text" color="success"
                          @click="askAction('استئناف', 'سيتمكن الطبيب من الاستخدام والمزامنة مجدداً.', `/CareSubscriptions/${item.id}/resume`, 'استئناف')" />
                      </template>
                    </v-tooltip>
                    <v-tooltip v-if="item.status !== 'Cancelled'" text="إلغاء نهائي">
                      <template #activator="{ props }">
                        <v-btn v-bind="props" icon="mdi-cancel" size="small" variant="text" color="error"
                          @click="askAction('إلغاء اشتراك', 'إجراء نهائي: سيتم إبطال كل التراخيص والتثبيتات ولا يمكن التراجع.', `/CareSubscriptions/${item.id}/cancel`, 'إلغاء نهائي')" />
                      </template>
                    </v-tooltip>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <EmptyState v-else-if="!loading" icon="mdi-certificate-off" title="لا توجد اشتراكات مطابقة" />
        </div>
        <div v-if="subTotalPages > 1" class="pagination-bar">
          <v-pagination v-model="subPage" :length="subTotalPages" :total-visible="5" density="compact" color="primary" @update:model-value="loadSubscriptions" />
        </div>
      </v-card>
    </template>

    <!-- ─────────────── Installations Tab ─────────────── -->
    <template v-else-if="activeTab === 'installations'">
      <div class="filters-bar">
        <div class="filter-field">
          <label class="filter-label">اسم الجهاز</label>
          <input v-model="instFilters.deviceName" class="filter-input" placeholder="ابحث باسم الجهاز" @keyup.enter="applyInstFilters" />
        </div>
        <div class="filter-field">
          <label class="filter-label">الحالة</label>
          <select v-model="instFilters.onlyActive" class="filter-select">
            <option value="">الكل</option>
            <option value="true">النشطة فقط</option>
            <option value="false">الملغاة فقط</option>
          </select>
        </div>
        <v-btn class="filter-btn" variant="outlined" color="primary" prepend-icon="mdi-magnify" @click="applyInstFilters">بحث</v-btn>
      </div>

      <v-card elevation="0" class="table-card">
        <div class="table-toolbar"><strong>التثبيتات ({{ instTotalItems }})</strong></div>
        <v-progress-linear v-if="loading" indeterminate color="primary" />
        <div class="table-scroll">
          <table v-if="installations.length" class="data-table">
            <thead>
              <tr>
                <th>الجهاز</th>
                <th>المعرّف</th>
                <th>النظام / الإصدار</th>
                <th>آخر ظهور</th>
                <th>الترخيص</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inst in installations" :key="inst.id">
                <td>
                  <strong>{{ inst.deviceName }}</strong>
                  <p class="row-sub">{{ formatDate(inst.activatedAt) }}</p>
                </td>
                <td><code class="mono">{{ inst.shortInstallationId }}</code></td>
                <td>{{ inst.platform }} · {{ inst.applicationVersion || '-' }}</td>
                <td>{{ formatDateTime(inst.lastSeenAt) }}</td>
                <td><code class="mono">{{ inst.maskedLicense || '-' }}</code></td>
                <td><v-chip :color="careInstallationStatusLabel(inst.status).color" size="small" label>{{ careInstallationStatusLabel(inst.status).label }}</v-chip></td>
                <td>
                  <div class="row-actions">
                    <v-tooltip v-if="inst.status === 'Active'" text="إلغاء التثبيت">
                      <template #activator="{ props }">
                        <v-btn v-bind="props" icon="mdi-minus-circle" size="small" variant="text" color="error" @click="askRevokeInstallation(inst.id, true)" />
                      </template>
                    </v-tooltip>
                    <v-tooltip v-else text="تصفير لإعادة التنشيط">
                      <template #activator="{ props }">
                        <v-btn v-bind="props" icon="mdi-restart" size="small" variant="text" @click="askResetInstallation(inst.id)" />
                      </template>
                    </v-tooltip>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <EmptyState v-else-if="!loading" icon="mdi-monitor-off" title="لا توجد تثبيتات مطابقة" />
        </div>
        <div v-if="instTotalPages > 1" class="pagination-bar">
          <v-pagination v-model="instPage" :length="instTotalPages" :total-visible="5" density="compact" color="primary" @update:model-value="loadInstallations" />
        </div>
      </v-card>
    </template>

    <!-- ─────────────── Events Tab ─────────────── -->
    <template v-else-if="activeTab === 'events'">
      <div class="filters-bar">
        <div class="filter-field">
          <label class="filter-label">نوع الحدث</label>
          <input v-model="evFilters.eventType" class="filter-input" placeholder="مثلاً RefreshFailed" @keyup.enter="applyEvFilters" />
        </div>
        <div class="filter-field">
          <label class="filter-label">رقم الاشتراك</label>
          <input v-model="evFilters.subscriptionId" type="number" min="1" class="filter-input" @keyup.enter="applyEvFilters" />
        </div>
        <div class="filter-field">
          <label class="filter-label">النتيجة</label>
          <select v-model="evFilters.onlySuspicious" class="filter-select">
            <option value="">الكل</option>
            <option value="true">الفشل والمشبوهة فقط</option>
          </select>
        </div>
        <v-btn class="filter-btn" variant="outlined" color="primary" prepend-icon="mdi-magnify" @click="applyEvFilters">بحث</v-btn>
      </div>

      <v-card elevation="0" class="table-card">
        <div class="table-toolbar"><strong>الأحداث الأمنية ({{ evTotalItems }})</strong></div>
        <v-progress-linear v-if="loading" indeterminate color="primary" />
        <div class="table-scroll">
          <table v-if="events.length" class="data-table">
            <thead>
              <tr>
                <th>الوقت</th>
                <th>الحدث</th>
                <th>النتيجة</th>
                <th>IP</th>
                <th>الإصدار</th>
                <th>التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ev in events" :key="ev.id">
                <td class="muted-cell">{{ formatDateTime(ev.occurredAt) }}</td>
                <td>
                  <strong>{{ ev.eventType }}</strong>
                  <p v-if="ev.subscriptionId" class="row-sub">اشتراك #{{ ev.subscriptionId }}</p>
                </td>
                <td>
                  <v-chip :color="ev.result === 'Success' ? 'success' : ev.result === 'Suspicious' ? 'error' : 'warning'" size="small" label>
                    {{ ev.result === 'Success' ? 'نجاح' : ev.result === 'Suspicious' ? 'مشبوه' : 'فشل' }}
                  </v-chip>
                </td>
                <td class="muted-cell">{{ ev.ipAddress || '-' }}</td>
                <td class="muted-cell">{{ ev.applicationVersion || '-' }}</td>
                <td><span :title="ev.metadata ?? ''" class="muted-cell">{{ truncate(ev.metadata) }}</span></td>
              </tr>
            </tbody>
          </table>
          <EmptyState v-else-if="!loading" icon="mdi-shield-check" title="لا توجد أحداث مطابقة" />
        </div>
        <div v-if="evTotalPages > 1" class="pagination-bar">
          <v-pagination v-model="evPage" :length="evTotalPages" :total-visible="5" density="compact" color="primary" @update:model-value="loadEvents" />
        </div>
      </v-card>
    </template>

    <!-- ─────────────── Plans Tab ─────────────── -->
    <template v-else-if="activeTab === 'plans'">
      <v-card elevation="0" class="table-card">
        <div class="table-toolbar">
          <strong>الباقات ({{ plans.length }})</strong>
          <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="openPlanCreate">باقة جديدة</v-btn>
        </div>
        <v-progress-linear v-if="loading" indeterminate color="primary" />
        <div class="table-scroll">
          <table v-if="plans.length" class="data-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الكود</th>
                <th>الأجهزة</th>
                <th>الصلاحية دون اتصال</th>
                <th>فترة السماح</th>
                <th>المميزات</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="plan in plans" :key="plan.id">
                <td>
                  <strong>{{ plan.name }}</strong>
                  <p v-if="plan.description" class="row-sub">{{ truncate(plan.description, 60) }}</p>
                </td>
                <td><code>{{ plan.code }}</code></td>
                <td>{{ plan.maxInstallations }}</td>
                <td>{{ plan.offlineValidityDays }} يوماً</td>
                <td>{{ plan.gracePeriodDays }} يوماً</td>
                <td><span :title="plan.features" class="muted-cell">{{ truncate(plan.features, 40) }}</span></td>
                <td>
                  <v-chip :color="plan.isActive ? 'success' : 'default'" size="small" label>
                    {{ plan.isActive ? 'مفعّلة' : 'معطّلة' }}
                  </v-chip>
                </td>
                <td>
                  <div class="row-actions">
                    <v-tooltip text="تعديل">
                      <template #activator="{ props }">
                        <v-btn v-bind="props" icon="mdi-pencil" size="small" variant="text" @click="openPlanEdit(plan)" />
                      </template>
                    </v-tooltip>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <EmptyState v-else-if="!loading" icon="mdi-package-variant-closed-remove" title="لا توجد باقات بعد" />
        </div>
      </v-card>
    </template>

    <!-- ─────────────── Create Dialog ─────────────── -->
    <v-dialog :model-value="modal === 'create'" max-width="620" @update:model-value="modal = undefined">
      <v-card>
        <v-card-title class="dialog-title"><v-icon icon="mdi-key-plus" color="primary" size="20" />إنشاء اشتراك عيادتي كير</v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <div class="form-grid">
            <div class="form-field form-field--full">
              <label class="form-label">الطبيب <span class="required">*</span></label>
              <v-autocomplete
                v-model="createForm.doctorId"
                :items="doctorOptions"
                item-title="label"
                item-value="value"
                density="compact"
                variant="outlined"
                hide-details
                placeholder="ابحث عن الطبيب"
              />
            </div>
            <div class="form-field">
              <label class="form-label">الباقة <span class="required">*</span></label>
              <select v-model="createForm.planId" class="form-input" required @change="onPlanSelected">
                <option value="" disabled>اختر الباقة</option>
                <option v-for="plan in plans.filter(p => p.isActive)" :key="plan.id" :value="String(plan.id)">
                  {{ plan.name }} — حتى {{ plan.maxInstallations }} جهاز
                </option>
              </select>
            </div>
            <div class="form-field">
              <label class="form-label">عدد الأجهزة المسموح</label>
              <input v-model="createForm.maxInstallations" type="number" min="1" max="100" class="form-input" placeholder="افتراضياً حسب الباقة" />
            </div>
            <div class="form-field">
              <label class="form-label">تاريخ البدء <span class="required">*</span></label>
              <input v-model="createForm.startDate" type="date" class="form-input" required />
            </div>
            <div class="form-field">
              <label class="form-label">تاريخ الانتهاء <span class="required">*</span></label>
              <input v-model="createForm.endDate" type="date" class="form-input" required />
            </div>
            <div class="form-field form-field--full">
              <label class="form-label">ملاحظات</label>
              <input v-model="createForm.notes" class="form-input" placeholder="اختياري" />
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="dialog-actions">
          <v-btn variant="outlined" @click="modal = undefined">إلغاء</v-btn>
          <v-btn color="primary" @click="createSubscription">إنشاء وإصدار ترخيص</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ─────────────── Plan Form Dialog ─────────────── -->
    <v-dialog :model-value="modal === 'planForm'" max-width="620" @update:model-value="modal = undefined">
      <v-card>
        <v-card-title class="dialog-title">
          <v-icon :icon="planEditingId ? 'mdi-pencil' : 'mdi-package-variant-closed-plus'" color="primary" size="20" />
          {{ planEditingId ? `تعديل الباقة #${planEditingId}` : 'باقة جديدة' }}
        </v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <div class="form-grid">
            <div class="form-field">
              <label class="form-label">اسم الباقة <span class="required">*</span></label>
              <input v-model="planForm.name" class="form-input" placeholder="مثال: الباقة الأساسية" required />
            </div>
            <div class="form-field">
              <label class="form-label">الكود <span class="required">*</span></label>
              <input v-model="planForm.code" class="form-input" placeholder="BASIC" dir="ltr" required />
            </div>
            <div class="form-field">
              <label class="form-label">عدد الأجهزة</label>
              <input v-model.number="planForm.maxInstallations" type="number" min="1" max="100" class="form-input" />
            </div>
            <div class="form-field">
              <label class="form-label">الصلاحية دون اتصال (يوم)</label>
              <input v-model.number="planForm.offlineValidityDays" type="number" min="1" max="365" class="form-input" />
            </div>
            <div class="form-field">
              <label class="form-label">فترة السماح بعد الانتهاء (يوم)</label>
              <input v-model.number="planForm.gracePeriodDays" type="number" min="0" max="90" class="form-input" />
            </div>
            <div class="form-field form-field--full">
              <label class="form-label">المميزات (مفصولة بفاصلة)</label>
              <input v-model="planForm.features" class="form-input" dir="ltr" placeholder="patient_management,visits,prescriptions,reports,attachments" />
            </div>
            <div class="form-field form-field--full">
              <label class="form-label">الوصف</label>
              <input v-model="planForm.description" class="form-input" placeholder="اختياري" />
            </div>
            <div class="form-field form-field--full">
              <label class="checkbox-label">
                <input v-model="planForm.isActive" type="checkbox" />
                باقة مفعّلة (متاحة للاشتراكات الجديدة)
              </label>
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="dialog-actions">
          <v-btn variant="outlined" @click="modal = undefined">إلغاء</v-btn>
          <v-btn color="primary" :loading="planSaving" @click="savePlan">حفظ</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ─────────────── Created Result (license key shown ONCE) ─────────────── -->
    <v-dialog :model-value="modal === 'created'" max-width="520" persistent @update:model-value="closeCreated">
      <v-card>
        <v-card-title class="dialog-title"><v-icon icon="mdi-key-variant" color="success" size="20" />تم إنشاء الاشتراك بنجاح</v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <p class="dialog-desc">
            سلّم مفتاح الترخيص التالي للطبيب. <strong>لن يظهر المفتاح الكامل مرة أخرى أبداً</strong> —
            يُخزَّن في النظام مشفراً (hash) ولا يمكن استرجاعه.
          </p>
          <div class="license-key-box">
            <code class="license-key">{{ createdResult?.fullLicenseKey }}</code>
            <v-btn :icon="copiedKey ? 'mdi-check' : 'mdi-content-copy'" size="small" variant="tonal" :color="copiedKey ? 'success' : 'primary'" @click="copyKey" />
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="dialog-actions">
          <v-btn color="primary" @click="closeCreated">نسختُه، إغلاق</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ─────────────── Detail Dialog ─────────────── -->
    <v-dialog :model-value="modal === 'detail'" max-width="860" scrollable @update:model-value="modal = undefined">
      <v-card>
        <v-card-title class="dialog-title">
          <v-icon icon="mdi-certificate" color="primary" size="20" />
          تفاصيل الاشتراك
          <v-chip v-if="detail" :color="statusMeta(detail.status).color" size="small" label class="mr-auto">{{ statusMeta(detail.status).label }}</v-chip>
        </v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <template v-if="detail">
            <div class="detail-summary">
              <div><span>الطبيب</span><strong>{{ detail.doctorName }}</strong></div>
              <div><span>الهاتف</span><strong>{{ detail.doctorPhoneNumber || '-' }}</strong></div>
              <div><span>الباقة</span><strong>{{ detail.planName }}</strong></div>
              <div><span>الفترة</span><strong>{{ formatDate(detail.startDate) }} — {{ formatDate(detail.endDate) }}</strong></div>
              <div><span>الأجهزة</span><strong>{{ detail.installations.filter(i => i.status === 'Active').length }} نشِط / {{ detail.maxInstallations }} حدّ</strong></div>
              <div><span>إصدار الصلاحيات</span><strong>v{{ detail.subscriptionVersion }}</strong></div>
            </div>

            <!-- Licenses -->
            <h3 class="section-title">التراخيص</h3>
            <div class="table-scroll inner-scroll">
              <table v-if="detail.licenses.length" class="data-table">
                <thead>
                  <tr><th>المفتاح</th><th>الحالة</th><th>أُنشئ</th><th>التثبيتات</th><th></th></tr>
                </thead>
                <tbody>
                  <tr v-for="lic in detail.licenses" :key="lic.id">
                    <td><code class="mono">{{ lic.maskedKey }}</code></td>
                    <td><v-chip :color="careLicenseStatusLabel(lic.status).color" size="small" label>{{ careLicenseStatusLabel(lic.status).label }}</v-chip></td>
                    <td class="muted-cell">{{ formatDate(lic.createdAt) }}</td>
                    <td>{{ lic.installationsCount }}</td>
                    <td>
                      <div class="row-actions">
                        <v-btn v-if="lic.status === 'Active'" size="small" variant="text" color="error" prepend-icon="mdi-cancel" @click="askRevokeLicense(lic.id)">إلغاء</v-btn>
                        <v-btn v-if="lic.status !== 'Replaced'" size="small" variant="text" color="primary" prepend-icon="mdi-swap-horizontal" @click="openReplaceLicense(lic.id)">استبدال</v-btn>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <EmptyState v-else icon="mdi-key-remove" title="لا توجد تراخيص" compact />
            </div>

            <!-- Installations -->
            <h3 class="section-title">التثبيتات</h3>
            <div class="table-scroll inner-scroll">
              <table v-if="detail.installations.length" class="data-table">
                <thead>
                  <tr><th>الجهاز</th><th>المعرّف</th><th>آخر ظهور</th><th>الحالة</th><th></th></tr>
                </thead>
                <tbody>
                  <tr v-for="inst in detail.installations" :key="inst.id">
                    <td>
                      <strong>{{ inst.deviceName }}</strong>
                      <p class="row-sub">{{ inst.platform }} · {{ inst.applicationVersion || '-' }}</p>
                    </td>
                    <td><code class="mono">{{ inst.shortInstallationId }}</code></td>
                    <td class="muted-cell">{{ formatDateTime(inst.lastSeenAt) }}</td>
                    <td><v-chip :color="careInstallationStatusLabel(inst.status).color" size="small" label>{{ careInstallationStatusLabel(inst.status).label }}</v-chip></td>
                    <td>
                      <div class="row-actions">
                        <v-btn v-if="inst.status === 'Active'" size="small" variant="text" color="error" prepend-icon="mdi-minus-circle" @click="askRevokeInstallation(inst.id)">إلغاء</v-btn>
                        <v-btn v-else size="small" variant="text" prepend-icon="mdi-restart" @click="askResetInstallation(inst.id)">تصفير</v-btn>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <EmptyState v-else icon="mdi-monitor-off" title="لم يُنشّط أي جهاز بعد" compact />
            </div>

            <!-- Renew shortcut -->
            <div class="detail-footer">
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-calendar-refresh" @click="openRenew(detail)">تجديد الاشتراك</v-btn>
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

    <!-- ─────────────── Renew Dialog ─────────────── -->
    <v-dialog :model-value="modal === 'renew'" max-width="460" @update:model-value="modal = undefined">
      <v-card>
        <v-card-title class="dialog-title"><v-icon icon="mdi-calendar-refresh" color="primary" size="20" />تجديد الاشتراك</v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <p class="dialog-desc">تمديد اشتراك <strong>{{ detail?.doctorName }}</strong> حتى تاريخ جديد.</p>
          <div class="form-fields">
            <div class="form-field">
              <label class="form-label">تاريخ الانتهاء الجديد <span class="required">*</span></label>
              <input v-model="renewForm.newEndDate" type="date" class="form-input" required />
            </div>
            <div class="form-field">
              <label class="form-label">سبب التجديد</label>
              <input v-model="renewForm.reason" class="form-input" placeholder="مثلاً دفع سنوي جديد" />
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="dialog-actions">
          <v-btn variant="outlined" @click="modal = 'detail'">رجوع</v-btn>
          <v-btn color="primary" :disabled="!renewForm.newEndDate" @click="renew">تجديد</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ─────────────── Reason Action Dialog ─────────────── -->
    <v-dialog :model-value="modal === 'reasonAction'" max-width="460" @update:model-value="modal = undefined">
      <v-card>
        <v-card-title class="dialog-title"><v-icon icon="mdi-alert" color="warning" size="20" />{{ pendingAction?.title }}</v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <p class="dialog-desc">{{ pendingAction?.text }}</p>
          <div class="form-field">
            <label class="form-label">السبب <span class="required">*</span></label>
            <textarea v-model="actionReason" class="form-input reason-input" rows="2" minlength="3" maxlength="500" placeholder="يُسجَّل في سجل التدقيق" />
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="dialog-actions">
          <v-btn variant="outlined" @click="modal = undefined">تراجع</v-btn>
          <v-btn color="error" :disabled="actionReason.trim().length < 3" @click="runAction">{{ pendingAction?.button }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ─────────────── Replace License Dialog ─────────────── -->
    <v-dialog :model-value="modal === 'replaceLicense'" max-width="500" @update:model-value="modal = undefined">
      <v-card>
        <v-card-title class="dialog-title"><v-icon icon="mdi-swap-horizontal" color="primary" size="20" />استبدال الترخيص</v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <p class="dialog-desc">
            يُصدر مفتاحاً جديداً ويُعلَّم القديم كمستبدل. استخدمه عند تسريب المفتاح أو فقدانه.
          </p>
          <div class="form-fields">
            <div class="form-field">
              <label class="form-label">السبب <span class="required">*</span></label>
              <textarea v-model="replaceForm.reason" class="form-input reason-input" rows="2" minlength="3" maxlength="500" placeholder="يُسجَّل في سجل التدقيق" />
            </div>
            <label class="check-label">
              <input v-model="replaceForm.keepActiveInstallations" type="checkbox" class="check-native" />
              <span class="check-box"><v-icon v-if="replaceForm.keepActiveInstallations" icon="mdi-check" size="12" color="white" /></span>
              <span>السماح للأجهزة النشطة بالاستمرار حتى انتهاء صلاحيتها الحالية</span>
            </label>
            <div v-if="replaceForm.keepActiveInstallations && replaceableInstallations.length" class="form-field">
              <label class="form-label">جهاز يبقى نشطاً (اختياري)</label>
              <select v-model="replaceForm.installationIdToKeep" class="form-input">
                <option value="">بدون</option>
                <option v-for="inst in replaceableInstallations" :key="inst.id" :value="inst.installationId">
                  {{ inst.deviceName }} ({{ inst.shortInstallationId }})
                </option>
              </select>
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="dialog-actions">
          <v-btn variant="outlined" @click="modal = 'detail'">تراجع</v-btn>
          <v-btn color="primary" :disabled="replaceForm.reason.trim().length < 3" @click="replaceLicense">استبدال</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.care-page { display: flex; flex-direction: column; gap: var(--spacing-lg); }

.page-top { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-lg); flex-wrap: wrap; }
.page-kicker { margin: 0 0 4px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-muted); }
.page-title { margin: 0; font-size: 28px; font-weight: 800; color: var(--color-text); }

.tabs-bar { display: flex; gap: 6px; padding: 6px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); flex-wrap: wrap; }
.tab-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px; border: none; border-radius: var(--radius-md); background: transparent; color: var(--color-text-muted); font-family: var(--font-family-primary); font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.15s ease; }
.tab-btn:hover { background: var(--color-primary-soft); color: var(--color-primary); }
.tab-active { background: var(--color-primary-soft) !important; color: var(--color-primary) !important; font-weight: 700; }

.filters-bar { display: flex; align-items: flex-end; gap: var(--spacing-md); flex-wrap: wrap; padding: var(--spacing-lg); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.filter-field { display: flex; flex-direction: column; gap: 6px; }
.filter-label { font-size: 12px; font-weight: 700; color: var(--color-text-muted); }
.filter-select { height: 40px; padding: 0 12px; border: 1.5px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text); font-family: var(--font-family-primary); font-size: 14px; outline: none; min-width: 150px; transition: border-color 0.2s; }
.filter-input { height: 40px; padding: 0 12px; border: 1.5px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text); font-family: var(--font-family-primary); font-size: 14px; outline: none; min-width: 150px; transition: border-color 0.2s; }
.filter-select:focus, .filter-input:focus { border-color: var(--color-primary); }
.filter-btn { align-self: flex-end; }

.table-card { border: 1px solid var(--color-border) !important; border-radius: var(--radius-lg) !important; overflow: hidden; }
.table-toolbar { display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-lg); border-bottom: 1px solid var(--color-border); }
.table-toolbar strong { flex: 1; font-size: 15px; color: var(--color-text); }
.table-scroll { overflow-x: auto; }
.inner-scroll { border: 1px solid var(--color-border-light); border-radius: var(--radius-md); margin-bottom: var(--spacing-lg); }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th { padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 700; color: var(--color-text-muted); background: var(--color-background); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
.data-table td { padding: 12px 16px; border-bottom: 1px solid var(--color-border-light); vertical-align: middle; color: var(--color-text); }
.data-table tbody tr:hover { background: var(--color-background); }
.data-table tbody tr:last-child td { border-bottom: none; }
.row-sub { margin: 2px 0 0 0; font-size: 11px; color: var(--color-text-muted); }
.muted-cell { color: var(--color-text-muted); font-size: 12px; }
.row-actions { display: flex; gap: 4px; justify-content: flex-end; }
.mono { direction: ltr; unicode-bidi: embed; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; background: var(--color-background); padding: 2px 6px; border-radius: 4px; }
.pagination-bar { display: flex; justify-content: center; padding: var(--spacing-lg); border-top: 1px solid var(--color-border); }

.dialog-title { display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-lg) !important; font-size: 16px !important; font-weight: 700; color: var(--color-text); }
.dialog-body { padding: var(--spacing-lg) !important; }
.dialog-desc { margin: 0 0 var(--spacing-lg) 0; font-size: 14px; color: var(--color-text-muted); line-height: 1.7; }
.dialog-actions { padding: var(--spacing-lg) !important; gap: var(--spacing-md); justify-content: flex-end; }

.form-fields { display: flex; flex-direction: column; gap: var(--spacing-lg); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-lg); }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field--full { grid-column: 1 / -1; }
.form-label { font-size: 13px; font-weight: 600; color: var(--color-text); }
.required { color: var(--color-error); }
.checkbox-label { display: flex; align-items: center; gap: var(--spacing-sm); font-size: 14px; color: var(--color-text); cursor: pointer; }
.checkbox-label input[type='checkbox'] { width: 18px; height: 18px; accent-color: var(--color-primary); cursor: pointer; }
.form-input, .form-select { padding: 10px 12px; border: 1.5px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text); font-family: var(--font-family-primary); font-size: 14px; outline: none; width: 100%; transition: border-color 0.2s; }
.form-input:focus { border-color: var(--color-primary); }
.reason-input { resize: vertical; }

.license-key-box { display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-lg); background: var(--color-background); border: 2px dashed var(--color-primary); border-radius: var(--radius-md); }
.license-key { flex: 1; direction: ltr; unicode-bidi: embed; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 16px; font-weight: 700; letter-spacing: 1px; color: var(--color-text); overflow-wrap: anywhere; }

.detail-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-md); margin-bottom: var(--spacing-xl, 24px); }
.detail-summary > div { display: flex; flex-direction: column; gap: 3px; padding: var(--spacing-md); background: var(--color-background); border-radius: var(--radius-md); }
.detail-summary span { font-size: 11px; font-weight: 700; color: var(--color-text-muted); }
.detail-summary strong { font-size: 14px; color: var(--color-text); overflow-wrap: anywhere; }
.section-title { margin: 0 0 var(--spacing-md) 0; font-size: 14px; font-weight: 800; color: var(--color-text); }
.detail-footer { display: flex; justify-content: flex-start; margin-top: var(--spacing-sm); }

.check-label { display: flex; align-items: center; gap: var(--spacing-md); cursor: pointer; font-size: 13px; font-weight: 500; color: var(--color-text); user-select: none; line-height: 1.5; }
.check-native { position: absolute; opacity: 0; width: 0; height: 0; }
.check-box { width: 18px; height: 18px; border: 2px solid var(--color-border); border-radius: 4px; background: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s ease; }
.check-native:checked ~ .check-box { background: var(--color-primary); border-color: var(--color-primary); }

@media (max-width: 600px) {
  .filters-bar { flex-direction: column; align-items: stretch; }
  .filter-field, .filter-select, .filter-input { width: 100%; }
  .filter-btn { align-self: stretch; }
  .form-grid { grid-template-columns: 1fr; }
  .detail-summary { grid-template-columns: 1fr 1fr; }
  .license-key-box { flex-direction: column; }
}
</style>
