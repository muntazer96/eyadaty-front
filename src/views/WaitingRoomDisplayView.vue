<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as signalR from '@microsoft/signalr'
import api from '../services/api'
import type { ApiResponse, WaitingRoomAppointment, WaitingRoomDisplay } from '../types/api'
import { qrSvgDataUrl } from '../utils/qr'

const route = useRoute()

const loading = ref(false)
const error = ref('')
const audioWarning = ref('')
const display = ref<WaitingRoomDisplay | null>(null)
const queueDrawer = ref(false)
const selectedQueueNumber = ref<number | undefined>()
const now = ref(new Date())
let clockTimer: number | undefined
let waitingRoomConnection: signalR.HubConnection | null = null
let lastAnnouncementSerial = 0
let speaking = false
const soundEnabled = ref(localStorage.getItem('waiting_room_sound_enabled') === '1')
const alertAudioUrl = '/audio/waiting-room-alert.mp3'

const accessToken = computed(() => String(route.params.accessToken ?? '').trim())
const clinicId = computed(() => optionalNumber(route.query.clinicId))
const tickerMessages = [
  'يرجى التوجه إلى غرفة الطبيب عند ظهور رقمكم. - يرجى الحضور قبل الموعد بـ10 دقائق. - يمكن الحجز عبر QR Code. - شكراً لتعاونكم.',
  // '',
  // '',
  // '',
]

const bookingLink = computed(() => absoluteUrl(`/d/${display.value?.doctorId ?? ''}`))
const bookingQr = computed(() => qrSvgDataUrl(bookingLink.value, 5))
const hasCurrentAppointment = computed(() => Boolean(display.value?.currentAppointment))
const shouldShowPatientNames = computed(() => display.value?.showPatientNames !== false)
const currentDisplayNumber = computed(() => display.value?.currentAppointment?.queueNumber ?? display.value?.currentQueueNumber)
const currentPatientName = computed(() => patientNameFor(display.value?.currentAppointment, currentDisplayNumber.value))
const currentTransitionKey = computed(() => `${currentDisplayNumber.value ?? 'idle'}-${display.value?.announcementSerial ?? 0}`)
const flashSerial = ref(0)
const clinicUnavailable = computed(() => display.value?.isClinicAvailableToday === false)
const clinicSchedule = computed(() => display.value?.clinicSchedule ?? [])
const orderedQueue = computed(() =>
  [...(display.value?.todayQueue ?? [])]
    .filter((appointment) => Boolean(appointment.queueNumber))
    .sort((left, right) => (left.queueNumber ?? Number.MAX_SAFE_INTEGER) - (right.queueNumber ?? Number.MAX_SAFE_INTEGER)),
)
const queueSequence = computed(() => {
  const activeAppointments = orderedQueue.value.filter((appointment) => appointment.status === 1)
  const currentAppointment = orderedQueue.value.find((appointment) => isCurrentQueue(appointment))

  if (!currentAppointment?.queueNumber) return activeAppointments

  return [
    currentAppointment,
    ...activeAppointments.filter((appointment) => (appointment.queueNumber ?? 0) > currentAppointment.queueNumber!),
  ]
})

const dateLabel = computed(() =>
  new Intl.DateTimeFormat('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' }).format(now.value),
)

const timeLabel = computed(() =>
  new Intl.DateTimeFormat('ar-IQ', { hour: '2-digit', minute: '2-digit' }).format(now.value),
)

function optionalNumber(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value
  const number = Number(raw)
  return Number.isFinite(number) && number > 0 ? number : undefined
}

function absoluteUrl(path: string) {
  return new URL(path, window.location.origin).toString()
}

function queueLabel(appointment?: WaitingRoomAppointment) {
  return appointment?.queueNumber ? String(appointment.queueNumber).padStart(2, '0') : '--'
}

function numberLabel(value?: number) {
  return value ? String(value).padStart(2, '0') : '--'
}

function isCurrentQueue(appointment: WaitingRoomAppointment) {
  return Boolean(appointment.queueNumber && appointment.queueNumber === currentDisplayNumber.value)
}

function queueStatusLabel(appointment: WaitingRoomAppointment) {
  if (isCurrentQueue(appointment)) return 'تم الاستدعاء الآن'
  if (appointment.status === 3) return 'مكتمل'
  if (appointment.status === 1) return 'بانتظار النداء'
  if (appointment.status === 0) return 'بانتظار التأكيد'
  return 'ملغي'
}

function selectQueue(appointment: WaitingRoomAppointment, closeDrawer = false) {
  selectedQueueNumber.value = appointment.queueNumber
  if (closeDrawer) queueDrawer.value = false
}

function patientNameFor(appointment?: WaitingRoomAppointment, queueNumber?: number) {
  const directName = appointment?.patientName?.trim()
  if (directName) return directName
  if (!queueNumber) return ''

  return display.value?.todayQueue
    ?.find((item) => item.queueNumber === queueNumber)
    ?.patientName
    ?.trim() ?? ''
}

function formatScheduleDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'short' }).format(date)
}

function formatScheduleTime(value?: string) {
  if (!value) return '-'
  const [hours = '00', minutes = '00'] = value.split(':')
  return `${hours}:${minutes}`
}

function triggerCurrentFlash() {
  flashSerial.value += 1
}

function getWaitingRoomHubUrl() {
  const apiBase = String(api.defaults.baseURL ?? '')
  return apiBase.replace(/\/api\/?$/i, '').replace(/\/$/, '') + '/hubs/waiting-room'
}

async function speakAnnouncement(_queueNumber: number, repeatCount: number) {
  if (!soundEnabled.value || speaking) return

  speaking = true
  audioWarning.value = ''

  await playPreAlertTone()
  await new Promise((resolve) => window.setTimeout(resolve, 260))

  const count = Math.max(1, Math.min(repeatCount || 2, 5))
  for (let index = 0; index < count; index += 1) {
    await new Promise<void>((resolve) => {
      const audio = new Audio(alertAudioUrl)
      audio.preload = 'auto'
      audio.onended = () => resolve()
      audio.onerror = () => {
        audioWarning.value = 'ملف صوت التنبيه غير موجود: public/audio/waiting-room-alert.mp3'
        resolve()
      }
      audio.play().catch(() => {
        audioWarning.value = 'اضغط تفعيل الصوت حتى يسمح المتصفح بتشغيل صوت التنبيه.'
        resolve()
      })
    })

    if (index < count - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1600))
    }
  }

  speaking = false
}

async function playPreAlertTone() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const audioContext = new AudioContextClass()
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime)
    oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.16)
    gain.gain.setValueAtTime(0.001, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.24, audioContext.currentTime + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.42)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.45)
    await new Promise((resolve) => window.setTimeout(resolve, 480))
    await audioContext.close()
  } catch {
    // Browser audio policies can block generated tones before user activation.
  }
}

function handleDisplayUpdate(payload: WaitingRoomDisplay) {
  const previousSerial = lastAnnouncementSerial
  const previousQueueNumber = display.value?.currentAppointment?.queueNumber ?? display.value?.currentQueueNumber
  display.value = payload
  lastAnnouncementSerial = payload.announcementSerial ?? 0

  const queueNumber = payload.currentAppointment?.queueNumber ?? payload.currentQueueNumber
  if (queueNumber && queueNumber !== previousQueueNumber) triggerCurrentFlash()
  if (queueNumber && payload.announcementSerial && payload.announcementSerial !== previousSerial) {
    void speakAnnouncement(queueNumber, payload.announcementRepeatCount)
  }
}

function enableSound() {
  soundEnabled.value = true
  localStorage.setItem('waiting_room_sound_enabled', '1')
  const queueNumber = display.value?.currentAppointment?.queueNumber ?? display.value?.currentQueueNumber
  if (queueNumber) void speakAnnouncement(queueNumber, display.value?.announcementRepeatCount ?? 2)
}

async function loadDisplay() {
  if (!accessToken.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await api.get<ApiResponse<WaitingRoomDisplay>>(`/Appointment/waiting-room/${accessToken.value}`, {
      params: {
        clinicId: clinicId.value,
      },
    })
    display.value = response.data.data
    lastAnnouncementSerial = response.data.data.announcementSerial ?? 0
  } catch (requestError: any) {
    error.value = requestError.response?.data?.message ?? 'تعذر تحميل شاشة الانتظار.'
  } finally {
    loading.value = false
  }
}

async function startWaitingRoomRealtime() {
  if (!accessToken.value || waitingRoomConnection?.state === signalR.HubConnectionState.Connected) return

  waitingRoomConnection = new signalR.HubConnectionBuilder()
    .withUrl(getWaitingRoomHubUrl(), { withCredentials: false })
    .withAutomaticReconnect([0, 2000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build()

  waitingRoomConnection.on('WaitingRoomUpdated', handleDisplayUpdate)
  waitingRoomConnection.on('WaitingRoomQueueChanged', () => void loadDisplay())
  waitingRoomConnection.on('WaitingRoomAccessRevoked', () => {
    error.value = 'تم تعطيل رابط شاشة الانتظار. اطلب الرابط الجديد من الطبيب.'
    display.value = null
    void waitingRoomConnection?.stop()
  })
  waitingRoomConnection.onreconnected(() => {
    void waitingRoomConnection?.invoke('JoinDoctorWaitingRoom', accessToken.value, 'display')
    void loadDisplay()
  })

  await waitingRoomConnection.start()
  await waitingRoomConnection.invoke('JoinDoctorWaitingRoom', accessToken.value, 'display')
}

watch(() => route.fullPath, loadDisplay)

onMounted(() => {
  document.title = 'شاشة انتظار الطبيب'
  void loadDisplay()
  void startWaitingRoomRealtime()
  clockTimer = window.setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (clockTimer) window.clearInterval(clockTimer)
  void waitingRoomConnection?.stop()
  waitingRoomConnection = null
})
</script>

<template>
  <main class="waiting-display" dir="rtl">
    <section v-if="error" class="display-state">
      <v-icon icon="mdi-alert-circle" size="54" />
      <h1>{{ error }}</h1>
    </section>

    <section v-else-if="loading && !display" class="display-state">
      <v-progress-circular indeterminate color="primary" size="54" />
      <h1>جاري تحميل شاشة الانتظار</h1>
    </section>

    <section v-else-if="display" class="display-shell">
      <button v-if="!soundEnabled" class="sound-enable" @click="enableSound">
        <v-icon icon="mdi-volume-high" size="20" />
        تفعيل الصوت
      </button>
      <div v-if="audioWarning" class="audio-warning">
        <v-icon icon="mdi-alert-circle" size="18" />
        {{ audioWarning }}
      </div>

      <header class="display-header">
        <div>
          <p class="eyebrow">عيادتي - شاشة الانتظار</p>
          <h1>{{ display.doctorName }}</h1>
          <p>{{ display.specializationName }}</p>
        </div>
        <div class="display-header-actions">
          <button class="queue-drawer-trigger" type="button" aria-label="فتح قائمة الدور" @click="queueDrawer = true">
            <v-icon icon="mdi-format-list-numbered" size="22" />
          </button>
          <div class="clock-panel">
            <strong>{{ timeLabel }}</strong>
            <span>{{ dateLabel }}</span>
          </div>
        </div>
      </header>

      <div class="display-body-layout">
        <aside
          class="queue-sidebar"
          aria-label="تسلسل المراجعين"
          :style="{ '--queue-item-count': Math.max(queueSequence.length, 1) }"
        >
          <div class="queue-sidebar-header">
            <div>
              <v-icon icon="mdi-format-list-numbered" size="20" />
              <strong>تسلسل الدور</strong>
            </div>
            <span>{{ queueSequence.length }}</span>
          </div>
          <div v-if="queueSequence.length" class="queue-sidebar-list queue-sequence-list">
            <button
              v-for="appointment in queueSequence"
              :key="appointment.id"
              type="button"
              class="queue-sidebar-item"
              :class="{
                current: isCurrentQueue(appointment),
                selected: appointment.queueNumber === selectedQueueNumber,
                completed: appointment.status === 3,
              }"
              :aria-current="isCurrentQueue(appointment) ? 'true' : undefined"
              @click="selectQueue(appointment)"
            >
              <strong>#{{ appointment.queueNumber }}</strong>
              <b v-if="shouldShowPatientNames">{{ appointment.patientName || 'بدون اسم' }}</b>
              <span>{{ queueStatusLabel(appointment) }}</span>
            </button>
          </div>
          <div v-else class="queue-sidebar-empty">لا توجد حجوزات اليوم</div>
        </aside>

        <div class="display-main-area">
      <section v-if="clinicUnavailable" class="unavailable-layout">
        <div class="unavailable-message">
          <v-icon icon="mdi-calendar-remove" size="46" />
          <span>العيادة غير متوفرة اليوم</span>
          <strong>{{ display.clinicUnavailableMessage || 'الطبيب غير متوفر في هذه العيادة اليوم' }}</strong>
          <small v-if="display.clinicName">{{ display.clinicName }}</small>
        </div>

        <div class="schedule-panel">
          <div class="schedule-title">
            <v-icon icon="mdi-calendar-clock" size="24" />
            <strong>جدول العيادة</strong>
          </div>
          <div class="schedule-grid">
            <article
              v-for="day in clinicSchedule"
              :key="day.date"
              class="schedule-day"
              :class="{ available: day.isAvailable, closed: !day.isAvailable }"
            >
              <span>{{ day.dayName }}</span>
              <strong>{{ formatScheduleDate(day.date) }}</strong>
              <small v-if="day.startTime && day.endTime">
                {{ formatScheduleTime(day.startTime) }} - {{ formatScheduleTime(day.endTime) }}
              </small>
              <small v-else>لا يوجد دوام</small>
              <b>{{ day.isAvailable ? `${day.remainingAppointments} متاح` : 'غير متوفر' }}</b>
            </article>
          </div>
        </div>
      </section>

      <template v-else-if="hasCurrentAppointment">
        <div class="queue-row">
          <div class="side-card previous">
            <span>الحجز السابق</span>
            <strong>{{ queueLabel(display.previousAppointment) }}</strong>
            <small v-if="shouldShowPatientNames && patientNameFor(display.previousAppointment, display.previousAppointment?.queueNumber)">
              {{ patientNameFor(display.previousAppointment, display.previousAppointment?.queueNumber) }}
            </small>
          </div>

          <Transition name="queue-pop" mode="out-in">
            <div
              :key="currentTransitionKey"
              class="current-panel"
              :class="{ flashing: flashSerial }"
            >
              <span class="panel-kicker">الحجز الحالي</span>
              <div class="current-number-frame">
                <strong class="current-number">{{ numberLabel(currentDisplayNumber) }}</strong>
              </div>
              <div class="current-meta">
                <p v-if="shouldShowPatientNames && currentPatientName" class="patient-name">{{ currentPatientName }}</p>
                <!-- <small v-if="display.clinicName">{{ display.clinicName }}</small> -->
              </div>
            </div>
          </Transition>

          <div class="side-card next">
            <span>الحجز التالي</span>
            <strong>{{ queueLabel(display.nextAppointment) }}</strong>
            <small v-if="shouldShowPatientNames && patientNameFor(display.nextAppointment, display.nextAppointment?.queueNumber)">
              {{ patientNameFor(display.nextAppointment, display.nextAppointment?.queueNumber) }}
            </small>
          </div>
        </div>
      </template>

      <section v-else class="idle-layout">
        <div class="idle-brand">
          <img src="/app-logo.png" alt="عيادتي" class="brand-mark" />
          <span>بانتظار استدعاء المراجع التالي</span>
        </div>
        <div class="idle-info">
          <h2>{{ display.doctorName }}</h2>
          <p>{{ display.specializationName }}</p>
          <small v-if="display.clinicName">{{ display.clinicName }}</small>
        </div>
        <div class="schedule-panel idle-schedule">
          <div class="schedule-title">
            <v-icon icon="mdi-clock-outline" size="24" />
            <strong>أوقات دوام الطبيب</strong>
          </div>
          <div v-if="clinicSchedule.length" class="schedule-grid">
            <article
              v-for="day in clinicSchedule"
              :key="day.date"
              class="schedule-day"
              :class="{ available: day.isAvailable, closed: !day.isAvailable }"
            >
              <span>{{ day.dayName }}</span>
              <strong>{{ formatScheduleDate(day.date) }}</strong>
              <small v-if="day.startTime && day.endTime">
                {{ formatScheduleTime(day.startTime) }} - {{ formatScheduleTime(day.endTime) }}
              </small>
              <small v-else>لا يوجد دوام</small>
              <b>
                {{
                  day.isAvailable
                    ? 'متاح'
                    : day.startTime && day.endTime
                      ? 'مكتمل'
                      : 'لا يوجد دوام'
                }}
              </b>
            </article>
          </div>
          <div v-else class="schedule-empty">لم تُحدد أوقات دوام لهذه العيادة.</div>
        </div>
      </section>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-box">
          <span>عدد الحجوزات</span>
          <strong>{{ display.totalBookings }}</strong>
        </div>
        <div class="stat-box">
          <span>بانتظار التأكيد</span>
          <strong>{{ display.pendingBookings }}</strong>
        </div>
        <div class="stat-box">
          <span>مؤكدة</span>
          <strong>{{ display.confirmedBookings }}</strong>
        </div>
        <div class="stat-box">
          <span>مكتملة</span>
          <strong>{{ display.completedBookings }}</strong>
        </div>
      </div>

      <section class="booking-qr-panel">
        <div>
          <v-icon icon="mdi-qrcode-scan" size="24" />
          <strong>احجز من هنا</strong>
          <span>امسح الكود لفتح صفحة الطبيب مباشرة</span>
        </div>
        <img v-if="bookingQr" :src="bookingQr" alt="باركود الحجز" />
      </section>

      <footer class="display-footer">
        <div class="ticker-track">
          <div class="ticker-group">
            <template v-for="copy in 6" :key="`first-${copy}`">
              <span v-for="(message, index) in tickerMessages" :key="`first-${copy}-${index}`">{{ message }}</span>
            </template>
          </div>
          <div class="ticker-group" aria-hidden="true">
            <template v-for="copy in 6" :key="`second-${copy}`">
              <span v-for="(message, index) in tickerMessages" :key="`second-${copy}-${index}`">{{ message }}</span>
            </template>
          </div>
        </div>
      </footer>

    </section>

    <Teleport to="body">
      <Transition name="queue-drawer-slide">
        <div v-if="queueDrawer" class="queue-drawer-backdrop" @click.self="queueDrawer = false">
          <aside class="queue-drawer" aria-label="تسلسل المراجعين">
            <div class="queue-drawer-header">
              <strong>تسلسل الدور</strong>
              <button class="queue-drawer-close" type="button" aria-label="إغلاق قائمة الدور" @click="queueDrawer = false">
                <v-icon icon="mdi-close" size="22" />
              </button>
            </div>
            <div class="queue-sidebar-list queue-drawer-list">
              <div v-if="!queueSequence.length" class="queue-sidebar-empty">لا توجد حجوزات اليوم</div>
              <button
                v-for="appointment in queueSequence"
                :key="appointment.id"
                type="button"
                class="queue-sidebar-item"
                :class="{
                  current: isCurrentQueue(appointment),
                  selected: appointment.queueNumber === selectedQueueNumber,
                  completed: appointment.status === 3,
                }"
                :aria-current="isCurrentQueue(appointment) ? 'true' : undefined"
                @click="selectQueue(appointment, true)"
              >
                <strong>#{{ appointment.queueNumber }}</strong>
                <b v-if="shouldShowPatientNames">{{ appointment.patientName || 'بدون اسم' }}</b>
                <span>{{ queueStatusLabel(appointment) }}</span>
              </button>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>

<style scoped>
:global(html:has(.waiting-display)),
:global(body:has(.waiting-display)),
:global(#app:has(.waiting-display)) {
  height: 100%;
  overflow: hidden;
}

.waiting-display {
  box-sizing: border-box;
  height: 100vh;
  overflow: hidden;
  padding: 16px;
  background:
    radial-gradient(circle at top right, rgba(19, 121, 107, 0.16), transparent 32%),
    linear-gradient(135deg, #f7fbfa 0%, #eef5f3 45%, #f8fafc 100%);
  color: #102421;
}

.waiting-display *,
.waiting-display *::before,
.waiting-display *::after {
  box-sizing: border-box;
}

.display-state {
  min-height: calc(100vh - 56px);
  display: grid;
  place-items: center;
  align-content: center;
  gap: 18px;
  text-align: center;
  color: #13796b;
}

.display-state h1 {
  margin: 0;
  font-size: 32px;
}

.display-shell {
  position: relative;
  height: calc(100vh - 32px);
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sound-enable {
  position: fixed;
  z-index: 20;
  top: 24px;
  left: 24px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid rgba(19, 121, 107, 0.3);
  border-radius: 8px;
  background: #ffffff;
  color: #13796b;
  font-family: inherit;
  font-weight: 900;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
  cursor: pointer;
}

.audio-warning {
  position: fixed;
  z-index: 20;
  top: 78px;
  left: 24px;
  max-width: 420px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  background: #fffbeb;
  color: #92400e;
  font-size: 14px;
  font-weight: 800;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
}

.display-header {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
}

.display-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.queue-drawer-trigger,
.queue-drawer {
  display: none;
}

.eyebrow,
.display-header p,
.panel-kicker,
.side-card span,
.stat-box span,
.display-footer span {
  margin: 0;
  color: #55706b;
  font-weight: 800;
}

.display-header h1 {
  margin: 2px 0;
  font-size: clamp(22px, 2.8vw, 34px);
  line-height: 1.15;
}

.clock-panel {
  min-width: 190px;
  padding: 10px 16px;
  border: 1px solid #d8e7e4;
  border-radius: 8px;
  background: #ffffff;
  text-align: center;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

.clock-panel strong {
  display: block;
  font-size: clamp(26px, 2.7vw, 36px);
  color: #13796b;
}

.clock-panel span {
  color: #55706b;
  font-weight: 700;
}

.display-body-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 10px;
  overflow: hidden;
  direction: ltr;
}

.display-main-area {
  grid-column: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  direction: rtl;
}

.queue-sidebar {
  grid-column: 2;
  grid-row: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #d8e7e4;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
  direction: rtl;
}

.queue-sidebar-header,
.queue-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 11px 12px;
  border-bottom: 1px solid #d8e7e4;
  color: #13796b;
}

.queue-sidebar-header > div {
  display: flex;
  align-items: center;
  gap: 6px;
}

.queue-sidebar-header strong,
.queue-drawer-header strong {
  font-size: 15px;
  font-weight: 900;
}

.queue-sidebar-header > span {
  min-width: 26px;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(19, 121, 107, 0.1);
  font-size: 12px;
  font-weight: 900;
  text-align: center;
}

.queue-sidebar-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 7px;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}

.queue-sequence-list {
  display: grid;
  grid-template-rows: repeat(var(--queue-item-count), minmax(0, 1fr));
  overflow: hidden;
}

.queue-sidebar-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1px 8px;
  width: 100%;
  min-height: 0;
  padding: 4px 8px;
  border: 1px solid #d8e7e4;
  border-radius: 7px;
  background: #ffffff;
  color: #102421;
  cursor: pointer;
  font-family: inherit;
  text-align: right;
  transition: border-color .15s ease, background .15s ease;
}

.queue-sidebar-item:hover,
.queue-sidebar-item.selected {
  border-color: #13796b;
  background: rgba(19, 121, 107, 0.07);
}

.queue-sidebar-item.current {
  border-color: #13796b;
  background: #13796b;
  color: #ffffff;
  box-shadow: 0 5px 16px rgba(19, 121, 107, 0.24);
}

.queue-sidebar-item.completed {
  opacity: .55;
}

.queue-sidebar-item strong {
  grid-row: span 2;
  align-self: center;
  color: #13796b;
  direction: ltr;
  font-size: clamp(16px, 1.55vw, 23px);
  font-weight: 900;
  line-height: 1;
}

.queue-sidebar-item.current strong,
.queue-sidebar-item.current span {
  color: #ffffff;
}

.queue-sidebar-item b {
  overflow: hidden;
  font-size: clamp(10px, 0.9vw, 13px);
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-sidebar-item span {
  color: #55706b;
  font-size: clamp(9px, 0.78vw, 11px);
  font-weight: 800;
}

.queue-sidebar-empty {
  display: grid;
  flex: 1;
  min-height: 100px;
  place-items: center;
  padding: 20px;
  color: #55706b;
  font-weight: 800;
  text-align: center;
}

.queue-drawer-list {
  height: calc(100% - 58px);
}

.queue-drawer-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: flex;
  justify-content: flex-start;
  background: rgba(15, 23, 42, 0.36);
  direction: rtl;
}

.queue-drawer {
  width: min(310px, 86vw);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  box-shadow: -16px 0 40px rgba(15, 23, 42, 0.2);
}

.queue-drawer-close {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #13796b;
  cursor: pointer;
}

.queue-drawer-slide-enter-active,
.queue-drawer-slide-leave-active {
  transition: opacity .2s ease;
}

.queue-drawer-slide-enter-active .queue-drawer,
.queue-drawer-slide-leave-active .queue-drawer {
  transition: transform .2s ease;
}

.queue-drawer-slide-enter-from,
.queue-drawer-slide-leave-to {
  opacity: 0;
}

.queue-drawer-slide-enter-from .queue-drawer,
.queue-drawer-slide-leave-to .queue-drawer {
  transform: translateX(100%);
}

.queue-row {
  display: grid;
  grid-template-columns: minmax(180px, 0.7fr) minmax(0, 1.9fr) minmax(180px, 0.7fr);
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.queue-row > * {
  min-width: 0;
  min-height: 0;
}

.current-panel,
.side-card,
.stat-box,
.booking-qr-panel,
.idle-layout,
.unavailable-layout {
  border: 1px solid #d8e7e4;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

.unavailable-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(280px, 0.55fr) minmax(0, 1fr);
  gap: 12px;
  padding: 16px;
  overflow: hidden;
}

.unavailable-message {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px solid rgba(183, 121, 31, 0.28);
  border-radius: 8px;
  background: #fffbeb;
  text-align: center;
}

.unavailable-message span {
  color: #b7791f;
  font-size: clamp(20px, 2.4vw, 34px);
  font-weight: 900;
}

.unavailable-message strong {
  max-width: 100%;
  overflow: hidden;
  padding: 0 18px;
  color: #102421;
  font-size: clamp(24px, 3.4vw, 48px);
  line-height: 1.2;
  text-overflow: ellipsis;
}

.unavailable-message small {
  color: #55706b;
  font-size: clamp(16px, 1.6vw, 22px);
  font-weight: 800;
}

.schedule-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.schedule-title {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #13796b;
  font-size: clamp(18px, 2vw, 26px);
  font-weight: 900;
}

.schedule-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.schedule-day {
  min-width: 0;
  min-height: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 6px;
  padding: 10px 8px;
  border: 1px solid #d8e7e4;
  border-radius: 8px;
  background: #ffffff;
  text-align: center;
}

.schedule-day.available {
  border-color: rgba(19, 121, 107, 0.34);
  background: rgba(19, 121, 107, 0.07);
}

.schedule-day.closed {
  border-color: rgba(100, 116, 139, 0.22);
  background: #f8fafc;
}

.schedule-day span,
.schedule-day small {
  color: #55706b;
  font-weight: 800;
}

.schedule-day strong {
  color: #102421;
  font-size: clamp(15px, 1.4vw, 20px);
  font-weight: 900;
}

.schedule-day b {
  color: #13796b;
  font-size: clamp(13px, 1.2vw, 16px);
  font-weight: 900;
}

.schedule-day.closed b {
  color: #b7791f;
}

.current-panel {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  align-items: center;
  justify-items: center;
  gap: 8px;
  padding: 14px 16px 16px;
  border-color: rgba(19, 121, 107, 0.36);
  min-height: 0;
  overflow: hidden;
}

.current-number-frame {
  min-width: 0;
  min-height: 0;
  display: grid;
  place-items: center;
  align-self: stretch;
  justify-self: stretch;
  overflow: hidden;
}

.current-number {
  min-height: 0;
  font-size: clamp(96px, min(15vw, 24vh), 220px);
  line-height: 1;
  color: #13796b;
  font-weight: 900;
}

.current-meta {
  min-width: 0;
  display: grid;
  justify-items: center;
  gap: 6px;
}

.current-panel p {
  margin: 0;
  font-size: clamp(17px, 1.9vw, 28px);
  font-weight: 900;
}

.patient-name {
  max-width: min(100%, 520px);
  overflow: hidden;
  padding: 7px 18px;
  border-radius: 8px;
  background: rgba(19, 121, 107, 0.1);
  color: #102421;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-current-label {
  color: #55706b;
}

.current-panel small {
  max-width: 100%;
  overflow: hidden;
  font-size: clamp(14px, 1.4vw, 20px);
  color: #55706b;
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  min-height: 0;
  text-align: center;
}

.side-card strong {
  font-size: clamp(70px, 8vw, 120px);
  line-height: 1;
}

.side-card small {
  max-width: 100%;
  overflow: hidden;
  font-size: 18px;
  color: #55706b;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.previous strong {
  color: #64748b;
}

.next strong {
  color: #b7791f;
}

.stats-row {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.stat-box {
  padding: 8px 12px;
}

.stat-box strong {
  display: block;
  margin-top: 2px;
  font-size: clamp(24px, 2.8vw, 34px);
  color: #13796b;
}

.booking-qr-panel {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 8px 14px;
}

.booking-qr-panel div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.booking-qr-panel strong {
  color: #13796b;
  font-size: clamp(17px, 1.8vw, 22px);
  font-weight: 900;
}

.booking-qr-panel span {
  color: #55706b;
  font-size: 14px;
  font-weight: 800;
}

.booking-qr-panel img {
  width: min(132px, 15vh);
  aspect-ratio: 1;
  border: 8px solid #ffffff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

.idle-layout {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(170px, 0.42fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, auto) minmax(0, 1fr);
  gap: 12px;
  padding: 14px 18px;
  overflow: hidden;
}

.idle-brand {
  grid-row: 1 / span 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
}

.brand-mark {
  width: min(210px, 17vw, 25vh);
  aspect-ratio: 1;
  border-radius: 22%;
  object-fit: contain;
  background: #ffffff;
  box-shadow: 0 20px 52px rgba(19, 121, 107, 0.18);
}

.idle-brand span,
.idle-info p,
.idle-info small {
  color: #55706b;
  font-weight: 800;
}

.idle-info h2 {
  margin: 0;
  color: #102421;
  font-size: clamp(30px, 4vw, 52px);
  line-height: 1.1;
}

.idle-info p {
  margin: 4px 0;
  font-size: clamp(17px, 1.8vw, 24px);
}

.idle-schedule {
  padding: 12px;
  border: 1px solid #d8e7e4;
  border-radius: 10px;
  background: #ffffff;
}

.schedule-empty {
  display: grid;
  min-height: 100px;
  place-items: center;
  color: #55706b;
  font-size: clamp(15px, 1.4vw, 19px);
  font-weight: 800;
}

.queue-pop-enter-active,
.queue-pop-leave-active {
  transition: transform 0.35s ease, opacity 0.35s ease;
}

.queue-pop-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.96);
}

.queue-pop-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.96);
}

.current-panel.flashing {
  animation: current-flash 2s ease;
}

@keyframes current-flash {
  0%, 100% {
    border-color: rgba(19, 121, 107, 0.36);
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
  }
  15%, 45%, 75% {
    border-color: #f59e0b;
    box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.18), 0 24px 56px rgba(15, 23, 42, 0.16);
  }
  30%, 60% {
    border-color: #13796b;
    box-shadow: 0 0 0 8px rgba(19, 121, 107, 0.16), 0 24px 56px rgba(15, 23, 42, 0.16);
  }
}

.display-footer {
  flex-shrink: 0;
  min-width: 0;
  overflow: hidden;
  min-height: 58px;
  display: flex;
  align-items: center;
  border-radius: 8px;
  background: #102421;
  color: #ffffff;
  direction: ltr;
}

.ticker-track {
  display: flex;
  width: max-content;
  white-space: nowrap;
  will-change: transform;
  animation: ticker-move 120s linear infinite;
}

.ticker-group {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 72px;
  min-width: max-content;
  padding-inline: 36px;
}

.ticker-track span {
  color: #ffffff;
  direction: rtl;
  font-size: clamp(16px, 1.8vw, 22px);
  font-weight: 900;
}

@keyframes ticker-move {
  from {
    transform: translateX(-50%);
  }
  to {
    transform: translateX(0);
  }
}

@media (max-width: 1200px) {
  .display-body-layout {
    display: block;
    overflow: visible;
  }

  .display-main-area {
    height: 100%;
  }

  .queue-sidebar {
    display: none;
  }

  .queue-drawer-trigger {
    display: grid;
    width: 46px;
    height: 46px;
    place-items: center;
    border: 1px solid #d8e7e4;
    border-radius: 8px;
    background: #ffffff;
    color: #13796b;
    cursor: pointer;
  }
}

@media (max-width: 900px) {
  .waiting-display {
    height: 100%;
    min-height: 100vh;
    overflow-y: auto;
    padding: 12px;
  }

  .display-shell {
    height: auto;
    min-height: calc(100vh - 24px);
  }

  .display-header {
    flex-direction: column;
    align-items: stretch;
  }

  .display-header-actions {
    justify-content: space-between;
  }

  .display-body-layout {
    display: block;
    overflow: visible;
  }

  .display-main-area {
    height: auto;
  }

  .queue-row,
  .idle-layout {
    grid-template-columns: 1fr;
  }

  .unavailable-layout {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .schedule-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .queue-row {
    gap: 10px;
  }

  .current-panel {
    min-height: 380px;
  }

  .side-card {
    min-height: 170px;
  }

  .stats-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .idle-brand {
    grid-row: auto;
  }

  .current-number {
    font-size: clamp(120px, 32vw, 210px);
  }

  .booking-qr-panel {
    flex-direction: column;
    text-align: center;
  }
}

@media (max-width: 560px) {
  .waiting-display {
    padding: 8px;
  }

  .display-shell {
    min-height: calc(100vh - 16px);
    gap: 8px;
  }

  .display-header h1 {
    font-size: 25px;
  }

  .clock-panel {
    min-width: 0;
    flex: 1;
    padding: 8px 10px;
  }

  .clock-panel strong {
    font-size: 25px;
  }

  .current-panel {
    min-height: 300px;
    padding: 12px;
  }

  .current-number {
    font-size: min(42vw, 170px);
  }

  .side-card {
    min-height: 125px;
  }

  .side-card strong {
    font-size: 64px;
  }

  .stats-row {
    gap: 6px;
  }

  .stat-box {
    padding: 8px;
  }

  .booking-qr-panel img {
    width: 104px;
  }

  .schedule-grid {
    grid-template-columns: 1fr;
  }

  .display-footer {
    min-height: 46px;
  }
}
</style>
