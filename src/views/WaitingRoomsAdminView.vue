<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import * as signalR from '@microsoft/signalr'
import api, { ACCESS_TOKEN_KEY } from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import type { AdminWaitingRoomStatus, ApiResponse } from '../types/api'
import { getErrorMessage } from '../utils/errors'
import PageHeader from '../components/common/Pageheader.vue'
import EmptyState from '../components/common/Emptystate.vue'

const { error: showError } = useNotifications()

const rooms = ref<AdminWaitingRoomStatus[]>([])
const loading = ref(false)
const filter = ref<'all' | 'active' | 'offline' | 'unconfigured'>('all')
const realtimeConnected = ref(false)
let waitingRoomConnection: signalR.HubConnection | undefined

interface WaitingRoomConnectionSnapshot {
  doctorId: number
  activeConnections: number
  activeDisplayConnections: number
  activeControlConnections: number
  firstConnectedAt?: string
  lastConnectedAt?: string
}

const latestSnapshots = ref<WaitingRoomConnectionSnapshot[]>([])

const activeCount = computed(() => rooms.value.filter((room) => room.isActive).length)
const offlineCount = computed(() => rooms.value.filter((room) => room.hasWaitingRoomLink && !room.isActive).length)
const unconfiguredCount = computed(() => rooms.value.filter((room) => !room.hasWaitingRoomLink).length)

const filteredRooms = computed(() => {
  if (filter.value === 'active') return rooms.value.filter((room) => room.isActive)
  if (filter.value === 'offline') return rooms.value.filter((room) => room.hasWaitingRoomLink && !room.isActive)
  if (filter.value === 'unconfigured') return rooms.value.filter((room) => !room.hasWaitingRoomLink)
  return rooms.value
})

function formatNumber(value = 0) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatDateTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ar-IQ', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function openWaitingRoom(room: AdminWaitingRoomStatus) {
  if (!room.isActive || !room.accessToken) return
  const path = room.clinicId
    ? `/w/${room.accessToken}?clinicId=${encodeURIComponent(String(room.clinicId))}`
    : `/w/${room.accessToken}`
  window.open(path, '_blank', 'noopener,noreferrer')
}

function getWaitingRoomHubUrl() {
  const apiBase = String(api.defaults.baseURL ?? '')
  return apiBase.replace(/\/api\/?$/i, '').replace(/\/$/, '') + '/hubs/waiting-room'
}

function applyConnectionSnapshots(snapshots: WaitingRoomConnectionSnapshot[]) {
  latestSnapshots.value = snapshots
  const snapshotByDoctorId = new Map(snapshots.map((snapshot) => [snapshot.doctorId, snapshot]))

  rooms.value = rooms.value
    .map((room) => {
      const snapshot = snapshotByDoctorId.get(room.doctorId)
      const activeDisplayConnections = snapshot?.activeDisplayConnections ?? 0
      return {
        ...room,
        isActive: activeDisplayConnections > 0,
        activeConnections: snapshot?.activeConnections ?? 0,
        activeDisplayConnections,
        activeControlConnections: snapshot?.activeControlConnections ?? 0,
        firstConnectedAt: snapshot?.firstConnectedAt,
        lastConnectedAt: snapshot?.lastConnectedAt,
      }
    })
    .sort((left, right) => {
      if (left.isActive !== right.isActive) return left.isActive ? -1 : 1
      if (left.hasWaitingRoomLink !== right.hasWaitingRoomLink) return left.hasWaitingRoomLink ? -1 : 1
      return left.doctorName.localeCompare(right.doctorName, 'ar')
    })
}

async function loadRooms(showLoader = true) {
  if (showLoader) loading.value = true
  try {
    const response = await api.get<ApiResponse<AdminWaitingRoomStatus[]>>('/Appointment/admin/waiting-rooms')
    rooms.value = response.data.data
    applyConnectionSnapshots(latestSnapshots.value)
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function connectRealtimeMonitor() {
  if (waitingRoomConnection) return

  waitingRoomConnection = new signalR.HubConnectionBuilder()
    .withUrl(getWaitingRoomHubUrl(), {
      accessTokenFactory: () => localStorage.getItem(ACCESS_TOKEN_KEY) ?? '',
      withCredentials: false,
    })
    .withAutomaticReconnect([0, 2000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build()

  waitingRoomConnection.on(
    'WaitingRoomConnectionSnapshotsUpdated',
    (snapshots: WaitingRoomConnectionSnapshot[]) => applyConnectionSnapshots(snapshots ?? []),
  )

  waitingRoomConnection.onreconnected(() => {
    realtimeConnected.value = true
    void waitingRoomConnection?.invoke('JoinAdminWaitingRoomMonitor')
  })

  waitingRoomConnection.onclose(() => {
    realtimeConnected.value = false
  })

  try {
    await waitingRoomConnection.start()
    realtimeConnected.value = true
    await waitingRoomConnection.invoke('JoinAdminWaitingRoomMonitor')
  } catch (error) {
    realtimeConnected.value = false
    showError(getErrorMessage(error))
  }
}

onMounted(async () => {
  await loadRooms()
  await connectRealtimeMonitor()
})

onUnmounted(() => {
  void waitingRoomConnection?.invoke('LeaveAdminWaitingRoomMonitor').catch(() => undefined)
  void waitingRoomConnection?.stop()
  waitingRoomConnection = undefined
})
</script>

<template>
  <div class="waiting-rooms-admin">
    <PageHeader
      title="مراقبة شاشات الانتظار"
      subtitle="اتصالات SignalR الفعالة لشاشات الأطباء"
    >
      <template #actions>
        <v-btn
          variant="outlined"
          color="primary"
          prepend-icon="mdi-refresh"
          :loading="loading"
          @click="loadRooms"
        >
          تحديث
        </v-btn>
      </template>
    </PageHeader>

    <div class="summary-grid">
      <button class="summary-card" :class="{ selected: filter === 'all' }" @click="filter = 'all'">
        <v-icon icon="mdi-monitor-dashboard" size="24" />
        <span>كل الأطباء</span>
        <strong>{{ formatNumber(rooms.length) }}</strong>
      </button>
      <button class="summary-card active" :class="{ selected: filter === 'active' }" @click="filter = 'active'">
        <v-icon icon="mdi-access-point-check" size="24" />
        <span>شاشات فعالة</span>
        <strong>{{ formatNumber(activeCount) }}</strong>
      </button>
      <button class="summary-card offline" :class="{ selected: filter === 'offline' }" @click="filter = 'offline'">
        <v-icon icon="mdi-access-point-off" size="24" />
        <span>غير فعالة</span>
        <strong>{{ formatNumber(offlineCount) }}</strong>
      </button>
      <button class="summary-card muted" :class="{ selected: filter === 'unconfigured' }" @click="filter = 'unconfigured'">
        <v-icon icon="mdi-link-off" size="24" />
        <span>بدون رابط شاشة</span>
        <strong>{{ formatNumber(unconfiguredCount) }}</strong>
      </button>
    </div>

    <div class="rooms-panel">
      <div class="panel-title">
        <v-icon icon="mdi-television-play" color="primary" size="20" />
        <h2>شاشات الأطباء</h2>
        <small>{{ realtimeConnected ? 'تحديث مباشر عبر SignalR' : 'بانتظار اتصال SignalR' }}</small>
      </div>

      <div v-if="loading && !rooms.length" class="rooms-list">
        <v-skeleton-loader v-for="i in 6" :key="i" type="list-item-avatar-three-line" />
      </div>

      <div v-else-if="filteredRooms.length" class="rooms-list">
        <button
          v-for="room in filteredRooms"
          :key="room.doctorId"
          class="room-row"
          :class="{ active: room.isActive, disabled: !room.isActive }"
          type="button"
          :disabled="!room.isActive"
          @click="openWaitingRoom(room)"
        >
          <span class="status-dot" :class="{ active: room.isActive, offline: !room.isActive }" />
          <span class="room-main">
            <strong>{{ room.doctorName }}</strong>
            <small>{{ room.specializationName }} · {{ room.clinicName || 'كل العيادات' }}</small>
          </span>
          <span class="room-status">
            <v-chip :color="room.isActive ? 'success' : room.hasWaitingRoomLink ? 'error' : 'default'" variant="tonal" size="small">
              {{ room.isActive ? 'Active' : room.hasWaitingRoomLink ? 'Offline' : 'No Link' }}
            </v-chip>
            <small v-if="room.isActive">آخر اتصال {{ formatDateTime(room.lastConnectedAt) }}</small>
            <small v-else-if="room.hasWaitingRoomLink">لا يوجد اتصال شاشة مفتوح</small>
            <small v-else>لم يتم إنشاء رابط انتظار</small>
          </span>
          <span class="room-metrics">
            <b>{{ formatNumber(room.activeDisplayConnections) }}</b>
            <small>شاشة</small>
          </span>
          <span class="room-metrics">
            <b>{{ formatNumber(room.activeControlConnections) }}</b>
            <small>تحكم</small>
          </span>
          <span class="room-metrics">
            <b>{{ formatNumber(room.totalBookings) }}</b>
            <small>حجوزات اليوم</small>
          </span>
          <v-icon v-if="room.isActive" icon="mdi-arrow-left" size="20" color="primary" />
          <v-icon v-else icon="mdi-lock-outline" size="20" color="disabled" />
        </button>
      </div>

      <EmptyState
        v-else
        icon="mdi-monitor-off"
        title="لا توجد نتائج"
        compact
      />
    </div>
  </div>
</template>

<style scoped>
.waiting-rooms-admin {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-lg);
}

.summary-card {
  min-width: 0;
  display: grid;
  gap: 6px;
  justify-items: start;
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-primary);
  text-align: start;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
}

.summary-card span {
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 800;
}

.summary-card strong {
  color: var(--color-text);
  font-size: 28px;
  font-weight: 900;
}

.summary-card.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.summary-card.active { color: var(--color-success); }
.summary-card.offline { color: var(--color-error); }
.summary-card.muted { color: var(--color-text-muted); }

.rooms-panel {
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.panel-title h2 {
  margin: 0;
  color: var(--color-text);
  font-size: 16px;
}

.panel-title small {
  margin-inline-start: auto;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.rooms-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.room-row {
  width: 100%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(150px, auto) repeat(3, minmax(76px, auto)) auto;
  align-items: center;
  gap: var(--spacing-md);
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-text);
  text-align: start;
  cursor: pointer;
}

.room-row.active {
  border-color: rgba(22, 133, 111, 0.4);
  background: rgba(22, 133, 111, 0.07);
}

.room-row.disabled {
  cursor: default;
  opacity: 0.72;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-error);
}

.status-dot.active {
  background: var(--color-success);
  box-shadow: 0 0 0 5px var(--color-success-light);
}

.room-main,
.room-status,
.room-metrics {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-main strong {
  overflow: hidden;
  font-size: 14px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-main small,
.room-status small,
.room-metrics small {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.room-status {
  align-items: flex-start;
}

.room-metrics {
  align-items: center;
}

.room-metrics b {
  color: var(--color-primary);
  font-size: 17px;
  font-weight: 900;
}

@media (max-width: 1200px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .room-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .room-status,
  .room-metrics {
    grid-column: 2 / -1;
    align-items: flex-start;
  }

  .room-metrics {
    display: inline-flex;
  }
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .panel-title {
    flex-wrap: wrap;
  }

  .panel-title small {
    width: 100%;
    margin-inline-start: 0;
  }
}
</style>
