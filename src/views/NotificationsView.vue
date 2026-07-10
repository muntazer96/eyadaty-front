<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import api from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import { REALTIME_NOTIFICATION_EVENT } from '../services/realtimeNotifications'
import type { ApiResponse, DoctorNotificationItem, PageResult } from '../types/api'
import { getErrorMessage } from '../utils/errors'
import EmptyState from '../components/common/Emptystate.vue'
import { useAuthStore } from '../stores/auth'

const { success: showSuccess, error: showError } = useNotifications()
const auth = useAuthStore()

const items   = ref<DoctorNotificationItem[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = 10
const totalPages = ref(1)
const totalItems = ref(0)
const unreadCount = ref(0)

interface UnreadCountResponse {
  unreadCount?: number
  UnreadCount?: number
}

const canUseNotifications = computed(() => auth.hasAnyRole(['SuperAdmin', 'DoctorUser']))
const notificationBaseUrl = computed(() =>
  auth.hasAnyRole(['SuperAdmin']) ? '/Notification/admin/my' : '/Notification/doctor/my'
)
const pageTitle = computed(() =>
  auth.hasAnyRole(['SuperAdmin']) ? 'إشعارات الإدارة' : 'إشعارات الطبيب'
)

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

async function loadUnreadCount() {
  if (!canUseNotifications.value) {
    unreadCount.value = 0
    return
  }
  try {
    const unreadResponse = await api.get<ApiResponse<UnreadCountResponse>>(`${notificationBaseUrl.value}/unread-count`)
    unreadCount.value = unreadResponse.data.data.unreadCount ?? unreadResponse.data.data.UnreadCount ?? 0
  } catch {
    unreadCount.value = items.value.filter((item) => !item.readAt).length
  }
}

async function loadNotifications() {
  if (!canUseNotifications.value) {
    items.value = []
    totalItems.value = 0
    totalPages.value = 1
    unreadCount.value = 0
    return
  }
  loading.value = true
  try {
    const notificationsResponse = await api.get<ApiResponse<PageResult<DoctorNotificationItem> | DoctorNotificationItem[]>>(`${notificationBaseUrl.value}/paged`, {
      params: { page: page.value, pageSize },
    })
    if (Array.isArray(notificationsResponse.data.data)) {
      items.value = notificationsResponse.data.data
      totalItems.value = (page.value - 1) * pageSize + items.value.length
      totalPages.value = items.value.length === pageSize ? page.value + 1 : Math.max(1, page.value)
    } else {
      items.value = notificationsResponse.data.data.items
      totalPages.value = notificationsResponse.data.data.totalPages || 1
      totalItems.value = notificationsResponse.data.data.totalItems
    }
    await loadUnreadCount()
    if (!items.value.length && page.value > 1) {
      page.value = Math.max(1, totalPages.value)
      await loadNotifications()
    }
  } catch (e: any) {
    if (e.response?.status === 404) {
      try {
        const fallback = await api.get<ApiResponse<DoctorNotificationItem[]>>(notificationBaseUrl.value, {
          params: { page: page.value, pageSize },
        })
        items.value = fallback.data.data
        totalItems.value = (page.value - 1) * pageSize + items.value.length
        totalPages.value = items.value.length === pageSize ? page.value + 1 : Math.max(1, page.value)
        await loadUnreadCount()
      } catch (fallbackError: any) {
        if (fallbackError.response?.status === 404) { items.value = []; totalPages.value = 1; totalItems.value = 0; unreadCount.value = 0 }
        else showError(getErrorMessage(fallbackError))
      }
    }
    else showError(getErrorMessage(e))
  } finally { loading.value = false }
}

function changePage() {
  loadNotifications()
}

async function markAsRead(item: DoctorNotificationItem) {
  if (item.readAt) return
  try {
    const r = await api.post<ApiResponse<object>>(`${notificationBaseUrl.value}/${item.id}/read`)
    showSuccess(r.data.message)
    await loadNotifications()
  } catch (e) { showError(getErrorMessage(e)) }
}

onMounted(loadNotifications)

window.addEventListener(REALTIME_NOTIFICATION_EVENT, loadNotifications)

onUnmounted(() => {
  window.removeEventListener(REALTIME_NOTIFICATION_EVENT, loadNotifications)
})
</script>

<template>
  <div class="notifications-page">

    <!-- Header -->
    <div class="page-top">
      <div>
        <p class="page-kicker">مركز التنبيهات</p>
        <h1 class="page-title">{{ pageTitle }}</h1>
      </div>
      <div class="page-actions">
        <v-chip v-if="unreadCount > 0" color="error" variant="tonal" size="small">
          {{ unreadCount }} غير مقروء
        </v-chip>
        <v-chip v-if="totalItems > 0" color="primary" variant="tonal" size="small">
          {{ totalItems }}
        </v-chip>
        <v-btn variant="outlined" color="primary" prepend-icon="mdi-refresh" :loading="loading" @click="loadNotifications">
          تحديث
        </v-btn>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="notif-list">
      <v-skeleton-loader v-for="i in 4" :key="i" type="list-item-two-line" />
    </div>

    <!-- Empty -->
    <EmptyState
      v-else-if="!items.length"
      icon="mdi-bell-off"
      title="لا توجد إشعارات"
      description="ستظهر هنا التنبيهات المهمة فور وصولها"
    />

    <!-- Notifications List -->
    <div v-else class="notif-list">
      <div
        v-for="item in items"
        :key="item.id"
        class="notif-card"
        :class="{ 'notif-card--unread': !item.readAt }"
      >
        <!-- Icon -->
        <div class="notif-icon" :class="{ 'notif-icon--unread': !item.readAt }">
          <v-icon
            icon="mdi-bell"
            :color="item.readAt ? 'var(--color-text-muted)' : 'primary'"
            size="20"
          />
        </div>

        <!-- Content -->
        <div class="notif-content">
          <p class="notif-message">{{ item.message }}</p>
          <span class="notif-time">
            <v-icon icon="mdi-clock-outline" size="12" />
            {{ formatDate(item.createdAt) }}
          </span>
        </div>

        <!-- Unread Dot -->
        <div v-if="!item.readAt" class="notif-dot" />

        <!-- Mark Read Button -->
        <v-btn
          v-if="!item.readAt"
          size="small"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-check-all"
          class="notif-btn"
          @click="markAsRead(item)"
        >
          مقروء
        </v-btn>

        <!-- Read Badge -->
        <v-chip v-else size="x-small" variant="tonal" color="default" class="notif-read-chip">
          <v-icon icon="mdi-check" size="12" start />
          مقروء
        </v-chip>
      </div>
    </div>

    <div v-if="totalPages > 1" class="pagination-bar">
      <v-pagination
        v-model="page"
        :length="totalPages"
        :total-visible="5"
        density="compact"
        color="primary"
        @update:model-value="changePage"
      />
    </div>

  </div>
</template>

<style scoped>
.notifications-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

/* Page Top */
.page-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
}
.page-kicker {
  margin: 0 0 4px 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
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
}

/* Notifications List */
.notif-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* Notification Card */
.notif-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.2s ease;
}

.notif-card:hover {
  box-shadow: var(--shadow-md);
}

.notif-card--unread {
  border-color: var(--color-primary-light);
  background: var(--color-primary-soft);
}

/* Icon */
.notif-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--color-background);
  flex-shrink: 0;
}

.notif-icon--unread {
  background: white;
}

/* Content */
.notif-content {
  flex: 1;
  min-width: 0;
}

.notif-message {
  margin: 0 0 6px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.6;
}

.notif-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 500;
}

/* Unread Dot */
.notif-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
  flex-shrink: 0;
}

/* Mark Read Button */
.notif-btn {
  flex-shrink: 0;
}

.notif-read-chip {
  flex-shrink: 0;
}

.pagination-bar {
  display: flex;
  justify-content: center;
  padding-top: var(--spacing-sm);
}

/* Responsive */
@media (max-width: 600px) {
  .notif-card {
    flex-wrap: wrap;
  }
  .notif-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
