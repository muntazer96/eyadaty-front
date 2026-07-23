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
const now = ref(new Date())
let clockTimer: number | undefined
let waitingRoomConnection: signalR.HubConnection | null = null
let lastAnnouncementSerial = 0
let speaking = false
const soundEnabled = ref(localStorage.getItem('waiting_room_sound_enabled') === '1')
const alertAudioUrl = '/audio/waiting-room-alert.mp3'

const doctorId = computed(() => Number(route.params.doctorId))
const clinicId = computed(() => optionalNumber(route.query.clinicId))
const currentQueueNumber = computed(() => optionalNumber(route.query.currentQueueNumber))
const fixedDisplayMessage = 'يرجى متابعة رقم الحجز الظاهر على الشاشة، شكرا لانتظاركم.'

const bookingLink = computed(() => absoluteUrl(`/d/${display.value?.doctorId ?? doctorId.value}`))
const websiteDownloadLink = computed(() => {
  const url = new URL('/download', window.location.origin)
  url.searchParams.set('doctorId', String(display.value?.doctorId ?? doctorId.value))
  return url.toString()
})
const bookingQr = computed(() => qrSvgDataUrl(bookingLink.value, 5))
const downloadQr = computed(() => qrSvgDataUrl(websiteDownloadLink.value, 5))

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

function getWaitingRoomHubUrl() {
  const apiBase = String(api.defaults.baseURL ?? '')
  return apiBase.replace(/\/api\/?$/i, '').replace(/\/$/, '') + '/hubs/waiting-room'
}

async function speakAnnouncement(_queueNumber: number, repeatCount: number) {
  if (!soundEnabled.value || speaking) return

  speaking = true
  audioWarning.value = ''

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

function handleDisplayUpdate(payload: WaitingRoomDisplay) {
  const previousSerial = lastAnnouncementSerial
  display.value = payload
  lastAnnouncementSerial = payload.announcementSerial ?? 0

  const queueNumber = payload.currentAppointment?.queueNumber ?? payload.currentQueueNumber
  if (queueNumber && payload.announcementSerial && payload.announcementSerial !== previousSerial) {
    void speakAnnouncement(queueNumber, 2)
  }
}

function enableSound() {
  soundEnabled.value = true
  localStorage.setItem('waiting_room_sound_enabled', '1')
  const queueNumber = display.value?.currentAppointment?.queueNumber ?? display.value?.currentQueueNumber
  if (queueNumber) void speakAnnouncement(queueNumber, 2)
}

async function loadDisplay() {
  if (!doctorId.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await api.get<ApiResponse<WaitingRoomDisplay>>(`/Appointment/waiting-room/${doctorId.value}`, {
      params: {
        clinicId: clinicId.value,
        currentQueueNumber: currentQueueNumber.value,
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
  if (!doctorId.value || waitingRoomConnection?.state === signalR.HubConnectionState.Connected) return

  waitingRoomConnection = new signalR.HubConnectionBuilder()
    .withUrl(getWaitingRoomHubUrl(), { withCredentials: false })
    .withAutomaticReconnect([0, 2000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build()

  waitingRoomConnection.on('WaitingRoomUpdated', handleDisplayUpdate)
  waitingRoomConnection.onreconnected(() => {
    void waitingRoomConnection?.invoke('JoinDoctorWaitingRoom', doctorId.value)
  })

  await waitingRoomConnection.start()
  await waitingRoomConnection.invoke('JoinDoctorWaitingRoom', doctorId.value)
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
        <div class="clock-panel">
          <strong>{{ timeLabel }}</strong>
          <span>{{ dateLabel }}</span>
        </div>
      </header>

      <div class="top-grid">
        <div class="current-panel">
          <span class="panel-kicker">الحجز الحالي</span>
          <strong class="current-number">{{ numberLabel(display.currentAppointment?.queueNumber ?? display.currentQueueNumber) }}</strong>
          <p v-if="display.currentAppointment?.patientName" class="patient-name">{{ display.currentAppointment.patientName }}</p>
          <p v-else class="no-current-label">لا يوجد حجز حالي</p>
          <small v-if="display.clinicName">{{ display.clinicName }}</small>
        </div>

        <div class="side-card previous">
          <span>الحجز السابق</span>
          <strong>{{ queueLabel(display.previousAppointment) }}</strong>
          <small v-if="display.previousAppointment?.patientName">{{ display.previousAppointment.patientName }}</small>
        </div>

        <div class="side-card next">
          <span>الحجز التالي</span>
          <strong>{{ queueLabel(display.nextAppointment) }}</strong>
          <small v-if="display.nextAppointment?.patientName">{{ display.nextAppointment.patientName }}</small>
        </div>

        <section class="links-panel">
          <!-- <div class="section-title">
            <v-icon icon="mdi-qrcode-scan" size="22" />
            <h2>الروابط</h2>
          </div> -->
          <div class="qr-grid">
            <div class="qr-card">
              <img v-if="bookingQr" :src="bookingQr" alt="باركود الحجز" />
              <strong>احجز من هنا</strong>
            </div>
            <div class="qr-card">
              <img v-if="downloadQr" :src="downloadQr" alt="باركود تحميل التطبيق" />
              <strong>تحميل التطبيق</strong>
            </div>
          </div>
        </section>
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

      <footer class="display-footer">
        <p>{{ fixedDisplayMessage }}</p>
        <span>آخر تحديث: {{ new Intl.DateTimeFormat('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(display.generatedAt)) }}</span>
      </footer>
    </section>
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
  gap: 12px;
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
  gap: 24px;
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
  margin: 4px 0;
  font-size: clamp(24px, 3.2vw, 38px);
  line-height: 1.15;
}

.clock-panel {
  min-width: 210px;
  padding: 12px 18px;
  border: 1px solid #d8e7e4;
  border-radius: 8px;
  background: #ffffff;
  text-align: center;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

.clock-panel strong {
  display: block;
  font-size: clamp(28px, 3vw, 40px);
  color: #13796b;
}

.clock-panel span {
  color: #55706b;
  font-weight: 700;
}

.top-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(190px, 0.32fr) minmax(260px, 0.4fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.current-panel,
.side-card,
.stat-box,
.links-panel {
  border: 1px solid #d8e7e4;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

.current-panel {
  grid-row: 1 / span 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 18px;
  border-color: rgba(19, 121, 107, 0.36);
  min-height: 0;
}

.current-number {
  font-size: clamp(120px, 17vw, 230px);
  line-height: 0.95;
  color: #13796b;
  font-weight: 900;
}

.current-panel p {
  margin: 4px 0;
  font-size: clamp(20px, 2.5vw, 32px);
  font-weight: 900;
}

.patient-name {
  max-width: 100%;
  overflow: hidden;
  color: #102421;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-current-label {
  color: #55706b;
}

.current-panel small {
  font-size: clamp(16px, 1.7vw, 22px);
  color: #55706b;
  font-weight: 800;
}

.side-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  min-height: 0;
}

.side-card strong {
  font-size: clamp(54px, 6vw, 82px);
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
  gap: 10px;
}

.stat-box {
  padding: 10px 14px;
}

.stat-box strong {
  display: block;
  margin-top: 2px;
  font-size: clamp(26px, 3.2vw, 40px);
  color: #13796b;
}

.links-panel {
  grid-column: 3;
  grid-row: 1 / span 2;
  min-height: 0;
  padding: 14px;
  overflow: hidden;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #13796b;
}

.section-title h2 {
  margin: 0;
  font-size: 20px;
}

.links-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.qr-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  min-height: 0;
  flex: 1;
}

.qr-card {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  justify-content: center;
  padding: 10px;
  border: 1px solid #d8e7e4;
  border-radius: 8px;
  background: #ffffff;
}

.qr-card img {
  width: min(100%, 150px, 18vh);
  aspect-ratio: 1;
  border: 8px solid #ffffff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

.qr-card strong {
  color: #13796b;
  font-size: clamp(14px, 1.5vw, 18px);
  font-weight: 900;
}

.qr-card span {
  display: none;
  direction: ltr;
  overflow-wrap: anywhere;
  text-align: center;
  color: #55706b;
  font-size: 12px;
  font-weight: 800;
}

.display-footer {
  flex-shrink: 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #102421;
  color: #ffffff;
}

.display-footer p {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: clamp(16px, 1.8vw, 22px);
  font-weight: 900;
}

.display-footer span {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.72);
  white-space: nowrap;
}

@media (max-width: 900px) {
  .waiting-display {
    padding: 16px;
  }

  .display-header,
  .display-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .top-grid,
  .stats-row {
    grid-template-columns: 1fr;
  }

  .current-panel {
    grid-row: auto;
  }

  .links-panel {
    grid-column: auto;
    grid-row: auto;
  }

  .qr-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
