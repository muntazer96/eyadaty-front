<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterView } from 'vue-router'
import NotificationCenter from './components/common/NotificationCenter.vue'
import api from './services/api'
import {
  LOGIN_APPROVAL_REQUEST_EVENT,
  startRealtimeNotifications,
  stopRealtimeNotifications,
} from './services/realtimeNotifications'
import { useAuthStore } from './stores/auth'
import { useMessagesStore } from './stores/messages'
import { useNotificationsStore } from './stores/notifications'
import type { ApiResponse, AppVersionCheck } from './types/api'
import { adminAppVersion, adminBuildNumber } from './utils/appVersion'

const updateInfo = ref<AppVersionCheck>()
const loginApprovalRequest = ref<{
  challengeId: string
  title?: string
  body?: string
  message?: string
  data: Record<string, string>
}>()
const approvalSubmitting = ref(false)
const auth = useAuthStore()
const messages = useMessagesStore()
const notifications = useNotificationsStore()

function syncMessageConnection() {
  if (auth.isAuthenticated && auth.hasAnyRole(['DoctorUser'])) messages.connect()
  else messages.disconnect()
}

onMounted(async () => {
  if (auth.isAuthenticated) startRealtimeNotifications()
  syncMessageConnection()

  try {
    const response = await api.get<ApiResponse<AppVersionCheck>>('/AppVersion/check', {
      params: {
        platform: 'admin',
        currentVersion: adminAppVersion,
        currentBuildNumber: adminBuildNumber,
      },
    })
    if (response.data.data.updateAvailable) {
      updateInfo.value = response.data.data
    }
  } catch {
    // Version checks should not block the admin panel when the API is unavailable.
  }
})

watch(
  () => auth.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) startRealtimeNotifications()
    else stopRealtimeNotifications()
    syncMessageConnection()
  },
)

const handleAuthRefreshed = () => {
  if (auth.isAuthenticated) startRealtimeNotifications()
  syncMessageConnection()
}

const handleLoginApprovalRequest = (event: Event) => {
  const detail = (event as CustomEvent<{
    title?: string
    body?: string
    message?: string
    data?: Record<string, string>
  }>).detail
  const challengeId = detail?.data?.challengeId
  if (!challengeId) return

  loginApprovalRequest.value = {
    challengeId,
    title: detail.title,
    body: detail.body,
    message: detail.message,
    data: detail.data ?? {},
  }
}

window.addEventListener('clinic-auth-refreshed', handleAuthRefreshed)
window.addEventListener(LOGIN_APPROVAL_REQUEST_EVENT, handleLoginApprovalRequest)

onUnmounted(() => {
  window.removeEventListener('clinic-auth-refreshed', handleAuthRefreshed)
  window.removeEventListener(LOGIN_APPROVAL_REQUEST_EVENT, handleLoginApprovalRequest)
  stopRealtimeNotifications()
  messages.disconnect()
})

function closeUpdateModal() {
  if (updateInfo.value?.updateRequired) return
  updateInfo.value = undefined
}

function openUpdateUrl() {
  const url = updateInfo.value?.updateUrl
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

async function decideLoginApproval(approved: boolean) {
  const request = loginApprovalRequest.value
  if (!request || approvalSubmitting.value) return

  approvalSubmitting.value = true
  try {
    await api.post(approved ? '/User/signin/approval/approve' : '/User/signin/approval/reject', {
      challengeId: request.challengeId,
    })
    notifications.success(approved ? 'تمت الموافقة على تسجيل الدخول.' : 'تم رفض تسجيل الدخول.')
    loginApprovalRequest.value = undefined
  } catch {
    notifications.error('تعذر إرسال قرار موافقة تسجيل الدخول.')
  } finally {
    approvalSubmitting.value = false
  }
}
</script>

<template>
  <RouterView />
  <NotificationCenter />

  <v-dialog
    :model-value="Boolean(updateInfo)"
    max-width="520"
    :persistent="updateInfo?.updateRequired"
    @update:model-value="(value) => !value && closeUpdateModal()"
  >
    <v-card v-if="updateInfo">
      <v-card-title class="dialog-title">
        <v-icon icon="mdi-update" color="primary" size="22" />
        {{ updateInfo.title }}
      </v-card-title>

      <v-card-text class="dialog-body">
        <p class="modal-copy">{{ updateInfo.message }}</p>
        <div class="version-mini-panel">
          <span>النسخة الحالية: {{ updateInfo.currentVersion }}+{{ updateInfo.currentBuildNumber }}</span>
          <strong>النسخة المتوفرة: {{ updateInfo.latestVersion }}+{{ updateInfo.latestBuildNumber }}</strong>
        </div>
      </v-card-text>

      <v-card-actions class="dialog-actions">
        <v-btn
          v-if="!updateInfo.updateRequired"
          variant="text"
          @click="closeUpdateModal"
        >
          لاحقا
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!updateInfo.updateUrl"
          prepend-icon="mdi-open-in-new"
          @click="openUpdateUrl"
        >
          تحديث اللوحة
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog
    :model-value="Boolean(loginApprovalRequest)"
    max-width="520"
    persistent
  >
    <v-card v-if="loginApprovalRequest" class="login-approval-card">
      <v-card-title class="dialog-title">
        <v-icon icon="mdi-shield-account" color="primary" size="24" />
        {{ loginApprovalRequest.title || 'موافقة تسجيل دخول مطلوبة' }}
      </v-card-title>

      <v-card-text class="dialog-body">
        <p class="modal-copy">
          {{ loginApprovalRequest.body || loginApprovalRequest.message || 'هناك محاولة تسجيل دخول من جهاز جديد.' }}
        </p>

        <div class="login-approval-details">
          <div>
            <span>الجهاز</span>
            <strong>{{ loginApprovalRequest.data.deviceName || 'غير معروف' }}</strong>
          </div>
          <div>
            <span>المنصة</span>
            <strong>{{ loginApprovalRequest.data.platform || 'غير معروفة' }}</strong>
          </div>
          <div>
            <span>عنوان IP</span>
            <strong dir="ltr">{{ loginApprovalRequest.data.ipAddress || 'غير معروف' }}</strong>
          </div>
        </div>
      </v-card-text>

      <v-card-actions class="dialog-actions">
        <v-btn
          color="error"
          variant="outlined"
          :disabled="approvalSubmitting"
          @click="decideLoginApproval(false)"
        >
          رفض
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="approvalSubmitting"
          @click="decideLoginApproval(true)"
        >
          موافقة
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.dialog-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) !important;
  font-size: 16px !important;
  font-weight: 700;
}

.dialog-body {
  padding: var(--spacing-lg) !important;
}

.modal-copy {
  margin: 0 0 var(--spacing-lg) 0;
  color: var(--color-text);
  line-height: 1.7;
}

.version-mini-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-text);
}

.dialog-actions {
  padding: var(--spacing-lg) !important;
  gap: var(--spacing-md);
}

.login-approval-card {
  direction: rtl;
}

.login-approval-details {
  display: grid;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
}

.login-approval-details div {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.login-approval-details span {
  color: var(--color-text-muted);
}

.login-approval-details strong {
  color: var(--color-text);
  font-weight: 700;
}
</style>
