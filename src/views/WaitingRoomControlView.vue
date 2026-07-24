<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import api from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import type { ApiResponse, ClinicItem, WaitingRoomAppointment, WaitingRoomDisplay } from '../types/api'
import { getErrorMessage } from '../utils/errors'
import PageHeader from '../components/common/Pageheader.vue'
import EmptyState from '../components/common/Emptystate.vue'

const { success: showSuccess, error: showError } = useNotifications()

const clinics = ref<ClinicItem[]>([])
const display = ref<WaitingRoomDisplay | null>(null)
const loading = ref(false)
const clinicsLoading = ref(false)
const saving = ref(false)
const copied = ref(false)
const completionDialog = ref(false)
const pendingMoveTarget = ref<WaitingRoomAppointment | null>(null)

const controls = reactive({
  clinicId: '',
  currentQueueNumber: '',
  recallQueueNumber: '',
})

const fixedDisplayMessage = 'يرجى متابعة رقم الحجز الظاهر على الشاشة، شكرا لانتظاركم.'
const announcementRepeatCount = 2

const selectedQueueNumber = computed(() => {
  const number = Number(controls.currentQueueNumber)
  return Number.isFinite(number) && number > 0 ? number : undefined
})

const displayUrl = computed(() => {
  if (!display.value?.doctorId) return ''
  return new URL(`/waiting-room/${display.value.doctorId}`, window.location.origin).toString()
})

const orderedQueue = computed(() =>
  [...(display.value?.todayQueue ?? [])]
    .sort((a, b) => {
      const left = a.queueNumber ?? Number.MAX_SAFE_INTEGER
      const right = b.queueNumber ?? Number.MAX_SAFE_INTEGER
      return left - right
    }),
)

const numberedQueue = computed(() => orderedQueue.value.filter((item) => item.queueNumber))
const activeQueue = computed(() => numberedQueue.value.filter((item) => item.status === 1))

const callableQueueItems = computed(() =>
  numberedQueue.value
    .filter((item) => item.status === 1 || item.status === 3)
    .map((item) => ({
      value: String(item.queueNumber),
      title: `#${item.queueNumber} - ${item.patientName || 'بدون اسم'} - ${statusLabel(item.status)}`,
    })),
)

const currentAppointment = computed(() => display.value?.currentAppointment)
const previousAppointment = computed(() => display.value?.previousAppointment)
const nextAppointment = computed(() => display.value?.nextAppointment)
const hasPrevious = computed(() => Boolean(previousAppointment.value?.queueNumber))
const hasNext = computed(() => Boolean(nextAppointment.value?.queueNumber))
const pendingAppointments = computed(() => orderedQueue.value.filter((item) => item.status === 0))

function statusLabel(status?: number) {
  return ['قيد الانتظار', 'مؤكد', 'ملغي', 'مكتمل'][status ?? -1] ?? 'غير معروف'
}

function statusClass(status?: number) {
  return ['pending', 'confirmed', 'cancelled', 'completed'][status ?? -1] ?? 'unknown'
}

function queueLabel(appointment?: WaitingRoomAppointment) {
  return appointment?.queueNumber ? `#${appointment.queueNumber}` : '-'
}

function currentQueueLabel() {
  const number = display.value?.currentAppointment?.queueNumber ?? display.value?.currentQueueNumber
  return number ? `#${number}` : '-'
}

function findQueueByNumber(queueNumber?: number) {
  if (!queueNumber) return undefined
  return numberedQueue.value.find((item) => Number(item.queueNumber) === queueNumber)
}

function targetForMove(direction: 'previous' | 'next') {
  const selected = selectedQueueNumber.value ?? display.value?.currentQueueNumber
  if (!activeQueue.value.length) return undefined
  if (!selected) return direction === 'next' ? activeQueue.value[0] : undefined

  return direction === 'next'
    ? activeQueue.value.find((item) => Number(item.queueNumber) > selected)
    : [...activeQueue.value].reverse().find((item) => Number(item.queueNumber) < selected)
}

async function loadClinics() {
  clinicsLoading.value = true
  try {
    const response = await api.get<ApiResponse<ClinicItem[]>>('/Clinic/my')
    clinics.value = response.data.data
    if (!controls.clinicId && clinics.value[0]?.id) controls.clinicId = String(clinics.value[0].id)
  } catch (error: any) {
    if (error.response?.status !== 404) showError(getErrorMessage(error))
  } finally {
    clinicsLoading.value = false
  }
}

async function loadDisplay() {
  loading.value = true
  try {
    const response = await api.get<ApiResponse<WaitingRoomDisplay>>('/Appointment/doctor/waiting-room', {
      params: {
        clinicId: controls.clinicId || undefined,
        currentQueueNumber: selectedQueueNumber.value,
      },
    })
    display.value = response.data.data
    if (response.data.data.clinicId) controls.clinicId = String(response.data.data.clinicId)
    if (response.data.data.currentQueueNumber) {
      controls.currentQueueNumber = String(response.data.data.currentQueueNumber)
    } else if (response.data.data.currentAppointment?.queueNumber) {
      controls.currentQueueNumber = String(response.data.data.currentAppointment.queueNumber)
    } else {
      controls.currentQueueNumber = ''
    }
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function saveDisplayState(reloadAfter = true, forceAnnounce = false) {
  saving.value = true
  try {
    await api.post<ApiResponse<object>>('/Appointment/doctor/waiting-room', {
      clinicId: controls.clinicId ? Number(controls.clinicId) : null,
      currentQueueNumber: selectedQueueNumber.value ?? null,
      displayMessage: fixedDisplayMessage,
      showDoctorInfo: false,
      showLinks: true,
      announcementRepeatCount,
      forceAnnounce,
    })
    if (reloadAfter) await loadDisplay()
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function showQueue(queueNumber: number, forceAnnounce = true, allowCompleted = false) {
  const appointment = findQueueByNumber(queueNumber)
  if (!appointment) {
    showError('هذا الرقم غير موجود ضمن حجوزات اليوم.')
    return
  }
  if (appointment.status === 0) {
    showError('لا يمكن استدعاء الحجز قبل تأكيده.')
    return
  }
  if (appointment.status === 2) {
    showError('لا يمكن استدعاء حجز ملغي.')
    return
  }
  if (appointment.status === 3 && !allowCompleted) {
    showError('الحجز المكتمل يستدعى فقط من قائمة استدعاء حجز موجود.')
    return
  }
  controls.currentQueueNumber = String(queueNumber)
  await saveDisplayState(true, forceAnnounce)
}

async function recallSelectedQueue() {
  const queueNumber = Number(controls.recallQueueNumber)
  if (!Number.isFinite(queueNumber) || queueNumber <= 0) {
    showError('اختر رقم حجز من القائمة.')
    return
  }
  await showQueue(queueNumber, true, true)
}

async function repeatAnnouncement() {
  const queueNumber = selectedQueueNumber.value ?? display.value?.currentQueueNumber
  if (!queueNumber) {
    showError('لا يوجد حجز حالي لإعادة النداء.')
    return
  }
  await showQueue(queueNumber, true, true)
}

async function requestMove(direction: 'previous' | 'next') {
  const target = targetForMove(direction)
  if (!target?.queueNumber) {
    showError(direction === 'next' ? 'وصلت إلى آخر حجز اليوم.' : 'هذا أول حجز اليوم.')
    return
  }

  if (direction === 'next' && currentAppointment.value?.status === 1) {
    pendingMoveTarget.value = target
    completionDialog.value = true
    return
  }

  await showQueue(target.queueNumber, true)
}

async function confirmCompleteAndMove() {
  if (!currentAppointment.value?.id || !pendingMoveTarget.value?.queueNumber) return
  await completeAppointment(currentAppointment.value, false)
  await showQueue(pendingMoveTarget.value.queueNumber, true)
  closeCompletionDialog()
}

async function moveWithoutCompleting() {
  if (pendingMoveTarget.value?.queueNumber) {
    await showQueue(pendingMoveTarget.value.queueNumber, true)
  }
  closeCompletionDialog()
}

function closeCompletionDialog() {
  completionDialog.value = false
  pendingMoveTarget.value = null
}

async function confirmAppointment(appointment: WaitingRoomAppointment) {
  if (appointment.status !== 0) return
  saving.value = true
  try {
    const response = await api.post<ApiResponse<object>>('/Appointment/toggle-status', null, {
      params: { appointmentId: appointment.id },
    })
    showSuccess(response.data.message)
    await saveDisplayState(true, false)
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function completeAppointment(appointment: WaitingRoomAppointment, reloadAfter = true) {
  if (appointment.status !== 1) return
  saving.value = true
  try {
    const response = await api.post<ApiResponse<object>>('/Appointment/complete', null, {
      params: { appointmentId: appointment.id },
    })
    showSuccess(response.data.message)
    if (reloadAfter) {
      controls.currentQueueNumber = ''
      await saveDisplayState(true, false)
    }
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function copyDisplayUrl() {
  if (!displayUrl.value) return
  await navigator.clipboard.writeText(displayUrl.value)
  copied.value = true
  showSuccess('تم نسخ رابط شاشة الانتظار.')
  window.setTimeout(() => {
    copied.value = false
  }, 1800)
}

function openDisplay() {
  if (!displayUrl.value) return
  window.open(displayUrl.value, '_blank', 'noopener,noreferrer')
}

async function changeClinic() {
  controls.currentQueueNumber = ''
  controls.recallQueueNumber = ''
  await saveDisplayState(true, false)
}

onMounted(async () => {
  await loadClinics()
  controls.currentQueueNumber = ''
  controls.recallQueueNumber = ''
  await saveDisplayState(true, false)
})
</script>

<template>
  <div class="waiting-control">
    <PageHeader
      title="لوحة تحكم شاشة الانتظار"
      subtitle="إدارة الدور الحالي والنداء الصوتي وحالات حجوزات اليوم"
    >
      <template #actions>
        <v-btn variant="outlined" color="primary" prepend-icon="mdi-refresh" :loading="loading" @click="loadDisplay">
          تحديث
        </v-btn>
        <v-btn color="primary" prepend-icon="mdi-open-in-new" :disabled="!displayUrl" @click="openDisplay">
          فتح الشاشة
        </v-btn>
      </template>
    </PageHeader>

    <div class="control-grid">
      <section class="panel command-panel">
        <div class="panel-title">
          <v-icon icon="mdi-remote" color="primary" size="22" />
          <h2>التحكم بالدور</h2>
        </div>

        <div class="clinic-row">
          <label>العيادة</label>
          <v-autocomplete
            v-model="controls.clinicId"
            :items="clinics.map(c => ({ value: String(c.id), label: c.name }))"
            item-title="label"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
            :loading="clinicsLoading"
            :disabled="clinicsLoading || saving"
            @update:model-value="changeClinic"
          />
        </div>

        <div class="current-stage">
          <span>الحجز الحالي</span>
          <strong>{{ currentQueueLabel() }}</strong>
          <b v-if="currentAppointment?.patientName">{{ currentAppointment.patientName }}</b>
          <p>{{ currentAppointment ? statusLabel(currentAppointment.status) : 'لم يتم اختيار حجز' }}</p>
        </div>

        <div class="main-actions">
          <v-btn
            variant="tonal"
            color="warning"
            prepend-icon="mdi-volume-high"
            :disabled="!selectedQueueNumber || saving"
            @click="repeatAnnouncement"
          >
            إعادة النداء الصوتي
          </v-btn>
          <v-btn
            v-if="currentAppointment?.status === 1"
            variant="tonal"
            color="success"
            prepend-icon="mdi-check-all"
            :loading="saving"
            @click="completeAppointment(currentAppointment)"
          >
            إكمال الحجز الحالي
          </v-btn>
        </div>
        <div class="secondary-actions">
          <v-btn
            size="large"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-chevron-right"
            :disabled="!hasPrevious || saving"
            @click="requestMove('previous')"
          >
            السابق
          </v-btn>
          <v-btn
            size="large"
            color="primary"
            append-icon="mdi-chevron-left"
            :disabled="!hasNext || saving"
            @click="requestMove('next')"
          >
            التالي
          </v-btn>
        </div>

        <div class="recall-box">
          <label>استدعاء حجز موجود</label>
          <div class="recall-row">
            <v-autocomplete
              v-model="controls.recallQueueNumber"
              :items="callableQueueItems"
              item-title="title"
              item-value="value"
              density="compact"
              variant="outlined"
              hide-details
              clearable
              no-data-text="لا توجد حجوزات متاحة"
              :disabled="saving"
            />
            <v-btn color="primary" prepend-icon="mdi-bullhorn" :loading="saving" @click="recallSelectedQueue">
              استدعاء
            </v-btn>
          </div>
        </div>

        
      </section>

      <section class="panel preview-panel">
        <div class="panel-title">
          <v-icon icon="mdi-monitor-dashboard" color="primary" size="22" />
          <h2>ملخص الشاشة</h2>
        </div>

        <div v-if="loading && !display" class="loading-box">
          <v-progress-circular indeterminate color="primary" size="30" />
          جاري تحميل البيانات...
        </div>

        <template v-else-if="display">
          <div class="queue-cards">
            <div>
              <span>السابق</span>
              <strong>{{ queueLabel(previousAppointment) }}</strong>
              <small v-if="previousAppointment?.patientName">{{ previousAppointment.patientName }}</small>
            </div>
            <div class="active">
              <span>الحالي</span>
              <strong>{{ currentQueueLabel() }}</strong>
              <small v-if="currentAppointment?.patientName">{{ currentAppointment.patientName }}</small>
            </div>
            <div>
              <span>التالي</span>
              <strong>{{ queueLabel(nextAppointment) }}</strong>
              <small v-if="nextAppointment?.patientName">{{ nextAppointment.patientName }}</small>
            </div>
          </div>

          <div class="mini-stats">
            <span>{{ display.totalBookings }} حجز اليوم</span>
            <span>{{ display.pendingBookings }} قيد الانتظار</span>
            <span>{{ display.confirmedBookings }} مؤكد</span>
            <span>{{ display.completedBookings }} مكتمل</span>
          </div>

          <div class="fixed-settings">
            <span>تكرار النداء الصوتي: مرتين</span>
            <span>رسالة أسفل الشاشة ثابتة</span>
          </div>

          <div class="display-link-box">
            <label>رابط الشاشة</label>
            <div>
              <input :value="displayUrl" readonly />
              <v-btn icon variant="tonal" color="primary" :aria-label="copied ? 'تم النسخ' : 'نسخ الرابط'" @click="copyDisplayUrl">
                <v-icon :icon="copied ? 'mdi-check' : 'mdi-content-copy'" size="18" />
              </v-btn>
            </div>
            <small class="save-state">{{ saving ? 'جاري حفظ التغييرات...' : 'التغييرات تصل إلى الشاشة المفتوحة تلقائيا.' }}</small>
          </div>
        </template>
      </section>
    </div>

    <section class="panel queue-panel">
      <div class="panel-title queue-title">
        <div>
          <v-icon icon="mdi-format-list-numbered" color="primary" size="22" />
          <h2>حجوزات اليوم</h2>
        </div>
        <span v-if="pendingAppointments.length">{{ pendingAppointments.length }} بانتظار التأكيد</span>
      </div>

      <EmptyState
        v-if="!loading && !orderedQueue.length"
        icon="mdi-calendar-blank"
        title="لا توجد حجوزات اليوم"
        compact
      />

      <div v-else class="queue-list">
        <article
          v-for="appointment in orderedQueue"
          :key="appointment.id"
          class="queue-item"
          :class="[{ selected: appointment.queueNumber === selectedQueueNumber }, statusClass(appointment.status)]"
        >
          <button
            class="queue-main"
            type="button"
            :disabled="!appointment.queueNumber || appointment.status !== 1"
            @click="appointment.queueNumber && showQueue(appointment.queueNumber)"
          >
            <strong>#{{ appointment.queueNumber ?? '-' }}</strong>
            <b>{{ appointment.patientName || 'بدون اسم' }}</b>
            <span>{{ statusLabel(appointment.status) }}</span>
            <small>{{ appointment.clinicName }}</small>
          </button>

          <div class="queue-actions">
            <v-btn
              v-if="appointment.status === 0"
              size="small"
              color="success"
              variant="tonal"
              prepend-icon="mdi-check"
              :loading="saving"
              @click="confirmAppointment(appointment)"
            >
              أكدها
            </v-btn>
            <v-btn
              v-if="appointment.status === 1"
              size="small"
              color="primary"
              variant="tonal"
              prepend-icon="mdi-bullhorn"
              :loading="saving"
              @click="appointment.queueNumber && showQueue(appointment.queueNumber)"
            >
              نداء
            </v-btn>
          </div>
        </article>
      </div>
    </section>

    <v-dialog v-model="completionDialog" max-width="460" persistent>
      <v-card>
        <v-card-title class="dialog-title">
          <v-icon icon="mdi-check-all" color="primary" size="22" />
          إكمال الحجز الحالي؟
        </v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <p>
            الحجز الحالي {{ currentQueueLabel() }} مؤكد. هل تريد إكماله قبل الانتقال إلى
            {{ queueLabel(pendingMoveTarget ?? undefined) }}؟
          </p>
          <small>عند الإكمال ستصل للمراجع رسالة التقييم تلقائيا.</small>
        </v-card-text>
        <v-card-actions class="dialog-actions">
          <v-btn variant="tonal" color="primary" :disabled="saving" @click="moveWithoutCompleting">
            كلا، انتقل فقط
          </v-btn>
          <v-btn color="primary" :loading="saving" @click="confirmCompleteAndMove">
            نعم، أكمل وانتقل
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.waiting-control {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.control-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  gap: var(--spacing-lg);
}

.panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
}

.panel-title,
.queue-title,
.queue-title div {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.panel-title {
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.queue-title {
  justify-content: space-between;
}

.panel-title h2,
.queue-title h2 {
  margin: 0;
  font-size: 16px;
  color: var(--color-text);
}

.queue-title > span {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--color-warning-soft, #fff7ed);
  color: var(--color-warning, #b7791f);
  font-size: 12px;
  font-weight: 800;
}

.clinic-row,
.recall-box,
.display-link-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.clinic-row label,
.recall-box label,
.display-link-box label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.current-stage {
  display: grid;
  place-items: center;
  gap: 4px;
  margin: var(--spacing-lg) 0;
  padding: 26px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-lg);
  background: var(--color-primary-soft);
  text-align: center;
}

.current-stage span,
.current-stage p {
  margin: 0;
  color: var(--color-text-muted);
  font-weight: 800;
}

.current-stage b {
  max-width: 100%;
  overflow: hidden;
  color: var(--color-text);
  font-size: 22px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.current-stage strong {
  color: var(--color-primary);
  font-size: clamp(54px, 8vw, 96px);
  line-height: 1;
}

.main-actions,
.secondary-actions,
.recall-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.secondary-actions {
  margin-top: var(--spacing-md);
}

.recall-box {
  margin-top: var(--spacing-lg);
}

.loading-box {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  color: var(--color-text-muted);
  font-weight: 700;
}

.queue-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
}

.queue-cards div {
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--color-background);
  border: 1px solid var(--color-border);
}

.queue-cards .active {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.queue-cards span,
.mini-stats span,
.fixed-settings span {
  display: block;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 800;
}

.queue-cards strong {
  display: block;
  margin-top: 4px;
  color: var(--color-primary);
  font-size: 26px;
}

.queue-cards small {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-stats,
.fixed-settings {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  margin: var(--spacing-lg) 0;
}

.mini-stats span,
.fixed-settings span {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--color-background);
}

.display-link-box div {
  display: flex;
  gap: var(--spacing-sm);
}

.display-link-box input {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  direction: ltr;
  text-align: left;
  font-family: var(--font-family-primary);
  font-size: 14px;
  outline: none;
}

.save-state {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.queue-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: var(--spacing-md);
}

.queue-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.queue-item.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.queue-main {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  border: 0;
  background: transparent;
  color: var(--color-text);
  text-align: start;
  cursor: pointer;
}

.queue-main:disabled {
  cursor: default;
}

.queue-main strong {
  font-size: 24px;
  color: var(--color-primary);
}

.queue-main span {
  font-weight: 900;
}

.queue-main b {
  max-width: 100%;
  overflow: hidden;
  font-size: 15px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-main small {
  color: var(--color-text-muted);
}

.queue-actions {
  display: flex;
  gap: 8px;
}

.queue-item.pending {
  border-color: rgba(183, 121, 31, 0.35);
}

.queue-item.completed {
  opacity: 0.68;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  font-weight: 900;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dialog-body p {
  margin: 0;
  color: var(--color-text);
  font-weight: 800;
}

.dialog-body small {
  color: var(--color-text-muted);
  font-weight: 700;
}

.dialog-actions {
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

@media (max-width: 1100px) {
  .control-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .main-actions,
  .secondary-actions,
  .recall-row,
  .queue-cards {
    grid-template-columns: 1fr;
  }

  .display-link-box div {
    flex-direction: column;
  }
}
</style>
