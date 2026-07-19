<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api, { REFRESH_TOKEN_KEY } from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import { getErrorMessage } from '../utils/errors'
import { useAuthStore } from '../stores/auth'
import type { ApiResponse } from '../types/api'

interface UserSession {
  sessionId: number
  refreshTokenId: number
  deviceId?: string
  deviceName?: string
  platform?: string
  ipAddress?: string
  userAgent?: string
  createdAt: string
  lastSeenAt: string
  revokedAt?: string
  isCurrent: boolean
}

const { success: showSuccess, error: showError } = useNotifications()
const auth = useAuthStore()
const router = useRouter()
const loading = ref(false)
const revokingId = ref<number | null>(null)
const revokingOthers = ref(false)
const revokingAll = ref(false)
const sessions = ref<UserSession[]>([])

const activeSessions = computed(() => sessions.value.filter((session) => !session.revokedAt))

function formatDate(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ar-IQ')
}

function sessionTitle(session: UserSession) {
  return session.deviceName || session.platform || 'جهاز غير معروف'
}

async function loadSessions() {
  loading.value = true
  try {
    const response = await api.get<ApiResponse<UserSession[]>>('/User/sessions')
    sessions.value = response.data.data
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function revokeSession(session: UserSession) {
  revokingId.value = session.sessionId
  try {
    await api.delete(`/User/sessions/${session.sessionId}`)
    showSuccess('تم تسجيل خروج الجلسة.')
    await loadSessions()
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    revokingId.value = null
  }
}

async function revokeOtherSessions() {
  revokingOthers.value = true
  try {
    const response = await api.delete('/User/sessions/others', {
      data: {
        refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
        trustedDeviceToken: localStorage.getItem('clinic_admin_trusted_2fa_device_token'),
      },
    })
    const data = response.data?.data
    if (data?.token) {
      auth.applyTokens(data.token, data.refreshToken, data.trustedDeviceToken, data.trustedDeviceTokenExpiresAt)
    }
    showSuccess('تم تسجيل خروج باقي الأجهزة.')
    await loadSessions()
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    revokingOthers.value = false
  }
}

async function revokeAllSessions() {
  revokingAll.value = true
  try {
    await api.delete('/User/sessions')
    showSuccess('تم تسجيل خروج كل الأجهزة.')
    auth.logout()
    await router.push('/login')
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    revokingAll.value = false
  }
}

onMounted(loadSessions)
</script>

<template>
  <div class="sessions-page">
    <div class="page-top">
      <div>
        <p class="page-kicker">أمان الحساب</p>
        <h1 class="page-title">الأجهزة والجلسات</h1>
      </div>
      <div class="page-actions">
        <v-btn variant="outlined" color="primary" prepend-icon="mdi-refresh" :loading="loading" @click="loadSessions">
          تحديث
        </v-btn>
        <v-btn color="error" variant="outlined" prepend-icon="mdi-logout-variant" :loading="revokingOthers" :disabled="activeSessions.length <= 1" @click="revokeOtherSessions">
          تسجيل خروج باقي الأجهزة
        </v-btn>
        <v-btn color="error" prepend-icon="mdi-logout" :loading="revokingAll" :disabled="!activeSessions.length" @click="revokeAllSessions">
          تسجيل خروج كل الأجهزة
        </v-btn>
      </div>
    </div>

    <v-alert type="info" variant="tonal" icon="mdi-devices" density="comfortable">
      تظهر هنا آخر جلسة فعالة لكل جهاز. عند حذف جلسة يتم إلغاء refresh token المرتبط بها مباشرة.
    </v-alert>

    <v-skeleton-loader v-if="loading && !sessions.length" type="list-item-two-line, list-item-two-line, list-item-two-line" />

    <div v-else class="session-list">
      <div v-for="session in sessions" :key="session.sessionId" class="session-item">
        <div class="session-icon">
          <v-icon :icon="session.platform?.toLowerCase().includes('win') ? 'mdi-monitor' : 'mdi-cellphone-link'" size="26" />
        </div>

        <div class="session-main">
          <div class="session-title-row">
            <h3>{{ sessionTitle(session) }}</h3>
          </div>
          <div class="session-meta">
            <span><v-icon icon="mdi-laptop" size="14" /> {{ session.platform || 'Web' }}</span>
            <span><v-icon icon="mdi-map-marker" size="14" /> {{ session.ipAddress || '-' }}</span>
            <span><v-icon icon="mdi-clock-outline" size="14" /> آخر نشاط: {{ formatDate(session.lastSeenAt) }}</span>
            <span><v-icon icon="mdi-calendar-plus" size="14" /> الإنشاء: {{ formatDate(session.createdAt) }}</span>
          </div>
          <p v-if="session.userAgent" class="user-agent" dir="ltr">{{ session.userAgent }}</p>
        </div>

        <v-btn
          icon
          variant="text"
          color="error"
          :loading="revokingId === session.sessionId"
          aria-label="تسجيل خروج الجلسة"
          @click="revokeSession(session)"
        >
          <v-icon icon="mdi-logout" />
        </v-btn>
      </div>

      <div v-if="!sessions.length" class="empty-state">
        <v-icon icon="mdi-devices-off" size="44" color="primary" />
        <h3>لا توجد جلسات فعالة</h3>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sessions-page { display: flex; flex-direction: column; gap: var(--spacing-lg); }
.page-top { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-lg); flex-wrap: wrap; }
.page-kicker { margin: 0 0 4px; font-size: 12px; font-weight: 700; color: var(--color-text-muted); }
.page-title { margin: 0; font-size: 28px; font-weight: 800; color: var(--color-text); }
.page-actions { display: flex; gap: var(--spacing-md); flex-wrap: wrap; }
.session-list { display: flex; flex-direction: column; gap: var(--spacing-md); }
.session-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--spacing-md);
  align-items: center;
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.session-icon { display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--color-primary-soft); color: var(--color-primary); }
.session-main { min-width: 0; }
.session-title-row { display: flex; align-items: center; gap: var(--spacing-sm); flex-wrap: wrap; }
.session-title-row h3 { margin: 0; font-size: 17px; color: var(--color-text); }
.session-meta { display: flex; gap: var(--spacing-md); flex-wrap: wrap; margin-top: 8px; color: var(--color-text-muted); font-size: 13px; }
.session-meta span { display: inline-flex; align-items: center; gap: 4px; }
.user-agent { margin: 8px 0 0; color: var(--color-text-muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-2xl); color: var(--color-text-muted); }
@media (max-width: 700px) {
  .session-item { grid-template-columns: 1fr; align-items: start; }
  .session-icon { display: none; }
}
</style>
