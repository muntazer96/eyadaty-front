<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr'
import api from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import type {
  ApiResponse,
  ClinicItem,
  QueueAvailabilityItem,
  WaitingRoomAppointment,
  WaitingRoomDisplay,
} from '../types/api'
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
const regenerateLinkDialog = ref(false)
const kioskDialog = ref(false)
const manualBookingDialog = ref(false)
const queueAvailability = ref<QueueAvailabilityItem>()
const queueLoading = ref(false)
const pendingMoveTarget = ref<WaitingRoomAppointment | null>(null)
let waitingRoomConnection: HubConnection | undefined
let joinedWaitingRoomToken = ''
const kioskLink = ref<{ accessToken?: string; clinicId?: number; clinicName?: string; expiresAt?: string; isActive: boolean }>()
const kioskForm = reactive({ clinicId: '', durationMinutes: '60' })

const controls = reactive({
  clinicId: '',
  currentQueueNumber: '',
  recallQueueNumber: '',
  showPatientNames: true,
})

const manualForm = reactive({
  clinicId: '',
  appointmentDate: today(),
  patientName: '',
  patientPhoneNumber: '',
  notes: '',
})

const fixedDisplayMessage = 'يرجى متابعة رقم الحجز الظاهر على الشاشة، شكرا لانتظاركم.'
const announcementRepeatCount = 2

const selectedQueueNumber = computed(() => {
  const number = Number(controls.currentQueueNumber)
  return Number.isFinite(number) && number > 0 ? number : undefined
})

const displayUrl = computed(() => {
  if (!display.value?.accessToken) return ''
  return new URL(`/waiting-room/${display.value.accessToken}`, window.location.origin).toString()
})
const kioskUrl = computed(() => kioskLink.value?.accessToken
  ? new URL(`/clinic-kiosk/${kioskLink.value.accessToken}`, window.location.origin).toString() : '')

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
const currentMoveReference = computed(() =>
  selectedQueueNumber.value ?? display.value?.currentAppointment?.queueNumber ?? display.value?.currentQueueNumber,
)
const hasPrevious = computed(() => Boolean(targetForMove('previous')?.queueNumber))
const hasNext = computed(() => Boolean(targetForMove('next')?.queueNumber))
const pendingAppointments = computed(() => orderedQueue.value.filter((item) => item.status === 0))
const canCreateManual = computed(() => {
  if (
    !manualForm.clinicId ||
    !manualForm.appointmentDate ||
    !manualForm.patientName.trim() ||
    !/^07\d{9}$/.test(manualForm.patientPhoneNumber)
  ) {
    return false
  }
  if (!queueAvailability.value) return true
  return queueAvailability.value.isAvailable && queueAvailability.value.remainingAppointments > 0
})

const manualPhoneError = computed(() => {
  if (!manualForm.patientPhoneNumber) return ''
  return /^07\d{9}$/.test(manualForm.patientPhoneNumber)
    ? ''
    : 'رقم الهاتف يجب أن يكون 11 رقماً ويبدأ بـ 07.'
})

function updateManualPhone(event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value.replace(/\D/g, '').slice(0, 11)
  manualForm.patientPhoneNumber = value
  input.value = value
}

function today() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

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
  const selected = currentMoveReference.value
  if (!activeQueue.value.length) return undefined
  if (!selected) return direction === 'next' ? activeQueue.value[0] : undefined

  const currentIndex = activeQueue.value.findIndex((item) => Number(item.queueNumber) === selected)
  if (currentIndex >= 0) {
    return direction === 'next'
      ? activeQueue.value[currentIndex + 1]
      : activeQueue.value[currentIndex - 1]
  }

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
    void syncControlRealtimeRoom()
    if (response.data.data.clinicId) controls.clinicId = String(response.data.data.clinicId)
    controls.showPatientNames = response.data.data.showPatientNames !== false
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
      showPatientNames: controls.showPatientNames,
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

async function clearCurrentCall() {
  if (!currentMoveReference.value) {
    showError('لا يوجد حجز حالي لإلغاء استدعائه.')
    return
  }

  controls.currentQueueNumber = ''
  await saveDisplayState(true, false)
  showSuccess('تم إلغاء الاستدعاء الحالي من شاشة العرض.')
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
  const completed = await completeAppointment(currentAppointment.value, false)
  if (!completed) return
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
  if (appointment.status !== 1) return false
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
    return true
  } catch (error) {
    showError(getErrorMessage(error))
    return false
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

function openManualBooking() {
  Object.assign(manualForm, {
    clinicId: controls.clinicId || (clinics.value[0]?.id ? String(clinics.value[0].id) : ''),
    appointmentDate: today(),
    patientName: '',
    patientPhoneNumber: '',
    notes: '',
  })
  manualBookingDialog.value = true
  void loadManualQueueAvailability()
}

async function loadManualQueueAvailability() {
  queueAvailability.value = undefined
  if (!manualForm.clinicId || !manualForm.appointmentDate) return

  queueLoading.value = true
  try {
    const response = await api.get<ApiResponse<QueueAvailabilityItem[]>>(
      `/Appointment/queue-availability/${manualForm.clinicId}`,
      { params: { fromDate: manualForm.appointmentDate, days: 1 } },
    )
    queueAvailability.value = response.data.data[0]
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    queueLoading.value = false
  }
}

async function createManualBooking() {
  if (!canCreateManual.value) return

  saving.value = true
  try {
    const response = await api.post<ApiResponse<object>>('/Appointment/manual', {
      clinicId: Number(manualForm.clinicId),
      appointmentDate: manualForm.appointmentDate,
      patientName: manualForm.patientName.trim(),
      patientPhoneNumber: manualForm.patientPhoneNumber.trim(),
      notes: manualForm.notes.trim() || null,
    })
    manualBookingDialog.value = false
    showSuccess(response.data.message)
    await loadDisplay()
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function confirmRegenerateDisplayLink() {
  saving.value = true
  try {
    const response = await api.post<ApiResponse<object>>(
      '/Appointment/doctor/waiting-room/regenerate-link',
    )
    await loadDisplay()
    regenerateLinkDialog.value = false
    showSuccess(response.data.message)
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function loadKioskLink() {
  try {
    const response = await api.get<ApiResponse<typeof kioskLink.value>>('/Appointment/doctor/kiosk-link')
    kioskLink.value = response.data.data
  } catch (error) { showError(getErrorMessage(error)) }
}
async function generateKioskLink() {
  if (!kioskForm.clinicId) return
  saving.value = true
  try {
    const response = await api.post<ApiResponse<typeof kioskLink.value>>('/Appointment/doctor/kiosk-link', {
      clinicId: Number(kioskForm.clinicId), durationMinutes: Number(kioskForm.durationMinutes),
    })
    kioskLink.value = response.data.data
    kioskDialog.value = false
    showSuccess('تم توليد رابط الحجز الذاتي وإبطال أي رابط سابق.')
  } catch (error) { showError(getErrorMessage(error)) }
  finally { saving.value = false }
}
async function disableKioskLink() {
  saving.value = true
  try {
    await api.delete('/Appointment/doctor/kiosk-link')
    kioskLink.value = { isActive: false }
    showSuccess('تم إيقاف رابط الحجز الذاتي.')
  } catch (error) { showError(getErrorMessage(error)) }
  finally { saving.value = false }
}
async function copyKioskLink() {
  if (!kioskUrl.value) return
  await navigator.clipboard.writeText(kioskUrl.value)
  showSuccess('تم نسخ رابط الحجز الذاتي.')
}
function openKioskLink() {
  if (kioskUrl.value) window.open(kioskUrl.value, '_blank', 'noopener,noreferrer')
}

function waitingRoomHubUrl() {
  const apiBase = String(api.defaults.baseURL || '')
  return apiBase.replace(/\/api\/?$/i, '').replace(/\/$/, '') + '/hubs/waiting-room'
}

async function syncControlRealtimeRoom() {
  const token = display.value?.accessToken || ''
  if (!waitingRoomConnection || waitingRoomConnection.state !== 'Connected' || !token ||
      token === joinedWaitingRoomToken) return
  if (joinedWaitingRoomToken) {
    await waitingRoomConnection.invoke('LeaveDoctorWaitingRoom', joinedWaitingRoomToken).catch(() => undefined)
  }
  await waitingRoomConnection.invoke('JoinDoctorWaitingRoom', token, 'control')
  joinedWaitingRoomToken = token
}

async function connectControlRealtime() {
  if (!display.value?.accessToken || waitingRoomConnection) return
  waitingRoomConnection = new HubConnectionBuilder()
    .withUrl(waitingRoomHubUrl(), { withCredentials: false })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build()
  waitingRoomConnection.on('WaitingRoomQueueChanged', () => void loadDisplay())
  waitingRoomConnection.onreconnected(() => {
    joinedWaitingRoomToken = ''
    void syncControlRealtimeRoom()
  })
  try {
    await waitingRoomConnection.start()
    await syncControlRealtimeRoom()
  } catch {
    waitingRoomConnection = undefined
  }
}
function openKioskDialog() {
  kioskForm.clinicId = kioskLink.value?.clinicId
    ? String(kioskLink.value.clinicId)
    : controls.clinicId || (clinics.value[0]?.id ? String(clinics.value[0].id) : '')
  kioskDialog.value = true
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

async function changePatientNameVisibility() {
  await saveDisplayState(true, false)
}

onMounted(async () => {
  await loadClinics()
  controls.clinicId = ''
  controls.recallQueueNumber = ''
  await loadDisplay()
  await connectControlRealtime()
  await loadKioskLink()
})

onBeforeUnmount(() => {
  void waitingRoomConnection?.stop()
  waitingRoomConnection = undefined
  joinedWaitingRoomToken = ''
})
</script>

<template>
  <div class="waiting-control">
    <PageHeader
      title="لوحة تحكم شاشة الانتظار"
      subtitle="إدارة الدور الحالي والنداء الصوتي وحالات حجوزات اليوم"
    >
      <template #actions>
        <v-btn
          color="success"
          prepend-icon="mdi-calendar-plus"
          :disabled="!clinics.length"
          @click="openManualBooking"
        >
          إضافة حجز يدوي
        </v-btn>
        <v-btn variant="outlined" color="primary" prepend-icon="mdi-refresh" :loading="loading" @click="loadDisplay">
          تحديث
        </v-btn>
        <v-btn color="primary" prepend-icon="mdi-open-in-new" :disabled="!displayUrl" @click="openDisplay">
          فتح الشاشة
        </v-btn>
        <v-btn
          variant="tonal"
          color="warning"
          prepend-icon="mdi-link-variant-plus"
          :loading="saving"
          :disabled="!displayUrl"
          @click="regenerateLinkDialog = true"
        >
          توليد رابط جديد لشاشة العرض
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
          <v-btn
            v-else-if="currentMoveReference"
            variant="tonal"
            color="error"
            prepend-icon="mdi-close-circle-outline"
            :loading="saving"
            @click="clearCurrentCall"
          >
            إلغاء الاستدعاء الحالي
          </v-btn>
        </div>

        <div class="visibility-box">
          <div>
            <strong>عرض اسم المراجع على شاشة العرض</strong>
            <span>عند الإيقاف تظهر أرقام الحجوزات فقط للمرضى.</span>
          </div>
          <v-switch
            v-model="controls.showPatientNames"
            color="primary"
            hide-details
            inset
            :disabled="saving"
            @update:model-value="changePatientNameVisibility"
          />
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

    <section class="panel kiosk-control-panel" :class="{ active: kioskLink?.isActive }">
      <div class="kiosk-summary">
        <div class="kiosk-summary-icon">
          <v-icon icon="mdi-tablet" color="primary" size="30" />
          <span v-if="kioskLink?.isActive" class="kiosk-icon-status">
            <v-icon icon="mdi-check" color="white" size="11" />
          </span>
        </div>
        <div class="kiosk-summary-copy">
          <div class="kiosk-title-row">
            <h2>محطة الحجز الذاتي</h2>
            <span class="kiosk-status" :class="{ active: kioskLink?.isActive }">
              {{ kioskLink?.isActive ? 'فعّالة' : 'متوقفة' }}
            </span>
          </div>
          <p v-if="kioskLink?.isActive">
            رابط التابلت فعال لغاية
            <strong>{{ kioskLink.expiresAt ? new Date(kioskLink.expiresAt).toLocaleString('ar-IQ') : '' }}</strong>
          </p>
          <p v-else>فعّل رابطاً مؤقتاً لاستقبال الحجوزات من شاشة اللمس داخل العيادة.</p>
        </div>
        <div class="kiosk-summary-actions">
          <template v-if="kioskLink?.isActive">
            <v-btn icon="mdi-content-copy" variant="tonal" color="primary" title="نسخ الرابط" @click="copyKioskLink" />
            <v-btn icon="mdi-open-in-new" variant="tonal" color="primary" title="فتح المحطة" @click="openKioskLink" />
            <v-btn variant="outlined" color="primary" prepend-icon="mdi-refresh" @click="openKioskDialog">تغيير الرابط</v-btn>
            <v-btn icon="mdi-power" variant="tonal" color="error" title="إيقاف الرابط" :loading="saving" @click="disableKioskLink" />
          </template>
          <v-btn v-else color="primary" prepend-icon="mdi-link-plus" @click="openKioskDialog">إنشاء رابط</v-btn>
        </div>
      </div>
    </section>

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

    <v-dialog v-model="manualBookingDialog" max-width="520" persistent>
      <v-card>
        <v-card-title class="dialog-title">
          <v-icon icon="mdi-calendar-plus" color="success" size="22" />
          إضافة حجز يدوي
        </v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <p class="dialog-desc">
            أدخل بيانات المراجع القادم عبر الهاتف أو الاستقبال. يضاف الحجز مؤكداً مباشرة بدون رمز OTP.
          </p>

          <div class="manual-form-fields">
            <div class="manual-form-field">
              <label>العيادة</label>
              <v-autocomplete
                v-model="manualForm.clinicId"
                :items="clinics.map(c => ({ value: String(c.id), label: c.name }))"
                item-title="label"
                item-value="value"
                class="form-select"
                density="compact"
                variant="outlined"
                hide-details
                :disabled="saving"
                @update:model-value="loadManualQueueAvailability"
              />
            </div>

            <div class="manual-form-field">
              <label>تاريخ الحجز</label>
              <input
                v-model="manualForm.appointmentDate"
                type="date"
                class="manual-input"
                :min="today()"
                :disabled="saving"
                @change="loadManualQueueAvailability"
              />
            </div>

            <div v-if="queueLoading" class="manual-queue-box">
              <v-progress-circular size="16" width="2" indeterminate color="primary" />
              جارِ فحص توفر الأدوار...
            </div>
            <div
              v-else-if="queueAvailability"
              class="manual-queue-box"
              :class="{ unavailable: !queueAvailability.isAvailable }"
            >
              <v-icon
                :icon="queueAvailability.isAvailable ? 'mdi-check-circle' : 'mdi-alert-circle'"
                :color="queueAvailability.isAvailable ? 'success' : 'error'"
                size="18"
              />
              <div>
                <strong>
                  {{ queueAvailability.isAvailable ? 'الأدوار المتاحة' : 'اليوم غير متاح' }}
                </strong>
                <p v-if="queueAvailability.isAvailable">
                  {{ queueAvailability.remainingAppointments }} متبقي من
                  {{ queueAvailability.maxAppointments }}
                </p>
                <p v-else>
                  {{ queueAvailability.closureReason || 'لا يوجد دوام لهذا اليوم.' }}
                </p>
              </div>
            </div>

            <div class="manual-form-field">
              <label>اسم المراجع</label>
              <input
                v-model="manualForm.patientName"
                class="manual-input"
                maxlength="200"
                :disabled="saving"
              />
            </div>

            <div class="manual-form-field">
              <label>رقم الهاتف</label>
              <input
                :value="manualForm.patientPhoneNumber"
                v-iraqi-phone
                class="manual-input"
                :class="{ invalid: manualPhoneError }"
                inputmode="numeric"
                maxlength="11"
                placeholder="07XXXXXXXXX"
                :disabled="saving"
                @input="updateManualPhone"
              />
              <small v-if="manualPhoneError" class="manual-field-error">{{ manualPhoneError }}</small>
            </div>

            <div class="manual-form-field">
              <label>ملاحظات</label>
              <textarea
                v-model="manualForm.notes"
                class="manual-input manual-textarea"
                rows="3"
                maxlength="1000"
                :disabled="saving"
              />
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="dialog-actions">
          <v-btn
            variant="outlined"
            :disabled="saving"
            @click="manualBookingDialog = false"
          >
            تراجع
          </v-btn>
          <v-btn
            color="success"
            prepend-icon="mdi-check"
            :loading="saving"
            :disabled="saving || queueLoading || !canCreateManual"
            @click="createManualBooking"
          >
            تثبيت الحجز
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="kioskDialog" max-width="520" persistent>
      <v-card class="confirm-card">
        <v-card-title class="dialog-title">
          <v-icon icon="mdi-tablet-cellphone" color="primary" />
          <div>
            <strong>{{ kioskLink?.isActive ? 'تغيير رابط المحطة' : 'إنشاء محطة حجز ذاتي' }}</strong>
            <small>حدد العيادة ومدة عمل الرابط</small>
          </div>
        </v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <v-alert v-if="kioskLink?.isActive" type="warning" variant="tonal" density="compact" class="mb-4">
            عند التأكيد سيتوقف الرابط الحالي مباشرة ويُنشأ رابط جديد.
          </v-alert>
          <div class="manual-form-fields">
            <div class="manual-form-field">
              <label>العيادة</label>
              <select v-model="kioskForm.clinicId" class="manual-input">
                <option value="" disabled>اختر العيادة</option>
                <option v-for="clinic in clinics" :key="clinic.id" :value="String(clinic.id)">{{ clinic.name }}</option>
              </select>
            </div>
            <div class="manual-form-field">
              <label>مدة صلاحية الرابط</label>
              <select v-model="kioskForm.durationMinutes" class="manual-input">
                <option value="15">15 دقيقة</option>
                <option value="30">30 دقيقة</option>
                <option value="60">ساعة واحدة</option>
                <option value="240">4 ساعات</option>
                <option value="720">12 ساعة</option>
              </select>
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="dialog-actions">
          <v-btn variant="text" :disabled="saving" @click="kioskDialog = false">تراجع</v-btn>
          <v-btn color="primary" prepend-icon="mdi-shield-check" :loading="saving"
            :disabled="!kioskForm.clinicId" @click="generateKioskLink">
            {{ kioskLink?.isActive ? 'توليد وتبديل الرابط' : 'إنشاء الرابط الآمن' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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

    <v-dialog v-model="regenerateLinkDialog" max-width="480" persistent>
      <v-card>
        <v-card-title class="dialog-title">
          <v-icon icon="mdi-link-variant-plus" color="warning" size="22" />
          توليد رابط جديد؟
        </v-card-title>
        <v-divider />
        <v-card-text class="dialog-body">
          <p>سيتم تعطيل الرابط السابق فوراً وتوليد رابط سري جديد لشاشة الانتظار.</p>
          <small>أي شاشة مفتوحة على الرابط السابق ستتوقف عن استقبال التحديثات.</small>
        </v-card-text>
        <v-card-actions class="dialog-actions">
          <v-btn
            variant="tonal"
            :disabled="saving"
            @click="regenerateLinkDialog = false"
          >
            إلغاء
          </v-btn>
          <v-btn
            color="warning"
            prepend-icon="mdi-link-variant-plus"
            :loading="saving"
            @click="confirmRegenerateDisplayLink"
          >
            توليد الرابط
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
.visibility-box,
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

.visibility-box {
  margin-top: var(--spacing-md);
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
}

.visibility-box strong,
.visibility-box span {
  display: block;
}

.visibility-box strong {
  color: var(--color-text);
  font-size: 14px;
  font-weight: 900;
}

.visibility-box span {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
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

.manual-form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-top: var(--spacing-sm);
}

.manual-form-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.manual-form-field label {
  color: var(--color-text);
  font-size: 13px;
  font-weight: 800;
}

.manual-input {
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

.manual-input:focus {
  border-color: var(--color-primary);
}

.manual-input.invalid {
  border-color: var(--color-error);
}

.manual-field-error {
  color: var(--color-error);
  font-size: 0.78rem;
  line-height: 1.5;
}

.kiosk-control-panel {
  margin-top: var(--spacing-lg);
  padding: 18px 20px;
  overflow: hidden;
  position: relative;
}

.kiosk-control-panel.active {
  border-color: rgba(19, 121, 107, 0.24);
  background: linear-gradient(110deg, #fff 0%, #f4fbf9 100%);
}

.kiosk-control-panel.active::before {
  content: '';
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: 4px;
  background: var(--color-primary);
}

.kiosk-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
}

.kiosk-summary-icon {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  color: var(--color-primary);
  background: rgba(19, 121, 107, 0.1);
  position: relative;
}

.kiosk-icon-status {
  position: absolute;
  inset-inline-end: -3px;
  inset-block-end: -3px;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--color-success, #16856f);
}

.kiosk-summary-copy { min-width: 0; }
.kiosk-title-row { display: flex; align-items: center; gap: 10px; }
.kiosk-title-row h2 { margin: 0; font-size: 17px; color: var(--color-text); }
.kiosk-summary-copy p { margin: 5px 0 0; color: var(--color-text-muted); font-size: 13px; }
.kiosk-summary-copy p strong { color: var(--color-text); }

.kiosk-status {
  padding: 3px 9px;
  border-radius: 999px;
  background: #edf1f0;
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: 800;
}

.kiosk-status.active { color: #08765f; background: #dff6ee; }
.kiosk-summary-actions { display: flex; align-items: center; gap: 8px; }

@media (max-width: 850px) {
  .kiosk-summary { grid-template-columns: auto 1fr; }
  .kiosk-summary-actions { grid-column: 1 / -1; justify-content: flex-end; }
}

@media (max-width: 560px) {
  .kiosk-control-panel { padding: 16px; }
  .kiosk-summary-icon { width: 44px; height: 44px; border-radius: 13px; }
  .kiosk-summary-actions { justify-content: stretch; flex-wrap: wrap; }
  .kiosk-summary-actions .v-btn:not(.v-btn--icon) { flex: 1; }
}

.manual-input:disabled {
  opacity: 0.65;
}

.manual-textarea {
  min-height: 80px;
  resize: vertical;
}

.manual-queue-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(34, 197, 94, 0.28);
  border-radius: var(--radius-md);
  background: rgba(34, 197, 94, 0.08);
  color: var(--color-text);
  font-size: 13px;
}

.manual-queue-box.unavailable {
  border-color: rgba(239, 68, 68, 0.25);
  background: rgba(239, 68, 68, 0.07);
}

.manual-queue-box strong {
  display: block;
  font-weight: 800;
}

.manual-queue-box p {
  margin: 2px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
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
