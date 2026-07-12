<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import { getErrorMessage } from '../utils/errors'
import type { ApiResponse, PageResult, UserItem } from '../types/api'
import EmptyState from '../components/common/Emptystate.vue'

const { error: showError } = useNotifications()

const users = ref<UserItem[]>([])
const loading = ref(false)
const search = ref('')
const page = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)

function formatDate(date?: string) {
  return date
    ? new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
    : '-'
}

function remainingDays(date?: string) {
  if (!date) return '-'
  const diff = new Date(date).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000)).toString()
}

async function loadUsers() {
  loading.value = true
  try {
    const response = await api.get<ApiResponse<PageResult<UserItem>>>('/User/pending-deletions', {
      params: {
        search: search.value.trim() || undefined,
        page: page.value,
        pageSize: 10,
      },
    })
    users.value = response.data.data.items
    totalPages.value = response.data.data.totalPages
    totalItems.value = response.data.data.totalItems
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function runSearch() {
  page.value = 1
  loadUsers()
}

function changePage(value: number) {
  page.value = value
  loadUsers()
}

onMounted(loadUsers)
</script>

<template>
  <div class="pending-page">
    <div class="page-top">
      <div>
        <p class="page-kicker">إدارة الحسابات</p>
        <h1 class="page-title">طلبات حذف الحساب</h1>
      </div>
      <div class="page-actions">
        <v-btn variant="outlined" color="primary" prepend-icon="mdi-refresh" :loading="loading" @click="loadUsers">تحديث</v-btn>
      </div>
    </div>

    <v-card elevation="0" class="table-card">
      <div class="table-toolbar">
        <div class="search-wrap">
          <v-icon icon="mdi-magnify" size="18" class="search-icon" />
          <input
            v-model="search"
            class="search-input"
            placeholder="ابحث بالاسم أو الهاتف"
            @keyup.enter="runSearch"
          />
        </div>
        <v-btn color="primary" size="small" prepend-icon="mdi-magnify" @click="runSearch">بحث</v-btn>
        <v-chip size="small" color="error" variant="tonal">
          <v-icon icon="mdi-account-clock" size="14" start />
          {{ totalItems }} طلب
        </v-chip>
      </div>

      <div v-if="loading" class="table-loading">
        <v-skeleton-loader v-for="i in 5" :key="i" type="table-row" />
      </div>

      <EmptyState
        v-else-if="!users.length"
        icon="mdi-account-check"
        title="لا توجد طلبات حذف"
        description="لا توجد حسابات مجدولة للحذف حالياً"
      />

      <div v-else class="table-scroll">
        <table class="data-table mobile-card-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>رقم الهاتف</th>
              <th>تاريخ الطلب</th>
              <th>موعد الحذف</th>
              <th>المتبقي</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td data-label="المستخدم">
                <div class="user-cell">
                  <div class="user-avatar">
                    <v-icon icon="mdi-account" size="18" color="error" />
                  </div>
                  <div>
                    <strong>{{ user.name || user.userName || 'مستخدم' }}</strong>
                    <p class="row-sub ltr">{{ user.id }}</p>
                  </div>
                </div>
              </td>
              <td data-label="رقم الهاتف"><strong class="ltr">{{ user.phoneNumber || '-' }}</strong></td>
              <td data-label="تاريخ الطلب">{{ formatDate(user.deletionRequestedAt) }}</td>
              <td data-label="موعد الحذف">{{ formatDate(user.scheduledDeletionAt) }}</td>
              <td data-label="المتبقي">
                <v-chip size="small" color="warning" variant="tonal">{{ remainingDays(user.scheduledDeletionAt) }} يوم</v-chip>
              </td>
              <td data-label="الحالة">
                <v-chip size="small" color="error" variant="tonal">مجدول للحذف</v-chip>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="totalPages > 1" class="pagination-bar">
        <v-pagination v-model="page" :length="totalPages" :total-visible="5" density="compact" color="primary" @update:model-value="changePage" />
      </div>
    </v-card>
  </div>
</template>

<style scoped>
.pending-page { display: flex; flex-direction: column; gap: var(--spacing-lg); }
.page-top { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-lg); flex-wrap: wrap; }
.page-kicker { margin: 0 0 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); }
.page-title { margin: 0; font-size: 28px; font-weight: 800; color: var(--color-text); }
.page-actions { display: flex; gap: var(--spacing-md); }
.table-card { border: 1px solid var(--color-border) !important; border-radius: var(--radius-lg) !important; overflow: hidden; }
.table-toolbar { display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-lg); border-bottom: 1px solid var(--color-border); flex-wrap: wrap; }
.search-wrap { position: relative; flex: 1; min-width: 200px; }
.search-icon { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none; }
[dir='rtl'] .search-icon { right: auto; left: 10px; }
.search-input { width: 100%; height: 38px; padding: 0 36px 0 12px; border: 1.5px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text); font-family: var(--font-family-primary); font-size: 14px; outline: none; }
[dir='rtl'] .search-input { padding: 0 12px 0 36px; }
.search-input:focus { border-color: var(--color-primary); }
.table-loading { padding: var(--spacing-lg); }
.table-scroll { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th { padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 700; color: var(--color-text-muted); background: var(--color-background); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
.data-table td { padding: 12px 16px; border-bottom: 1px solid var(--color-border-light); vertical-align: middle; color: var(--color-text); }
.user-cell { display: flex; align-items: center; gap: var(--spacing-md); }
.user-avatar { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--radius-md); background: rgba(220, 38, 38, .1); flex-shrink: 0; }
.row-sub { margin: 2px 0 0; font-size: 11px; color: var(--color-text-muted); }
.ltr { direction: ltr; text-align: right; }
.pagination-bar { display: flex; justify-content: center; padding: var(--spacing-lg); border-top: 1px solid var(--color-border); }
</style>
