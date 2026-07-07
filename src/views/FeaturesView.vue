<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import api from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import { getErrorMessage } from '../utils/errors'
import EmptyState from '../components/common/Emptystate.vue'
import type { ApiResponse, CurrentDoctorSubscription, DoctorFeature, PageResult } from '../types/api'

const { success: showSuccess, error: showError } = useNotifications()

const loading = ref(false)
const savingId = ref<number | null>(null)
const features = ref<DoctorFeature[]>([])
const subscription = ref<CurrentDoctorSubscription | null>(null)

const enabledCount = computed(() => features.value.filter((item) => item.isEnabled).length)
const disabledCount = computed(() => Math.max(0, features.value.length - enabledCount.value))
const packageName = computed(() =>
  subscription.value?.packageArabicName ||
  subscription.value?.packageName ||
  'لا يوجد اشتراك فعال',
)

async function loadData() {
  loading.value = true
  try {
    const [subscriptionResult, featuresResult] = await Promise.allSettled([
      api.get<ApiResponse<CurrentDoctorSubscription>>('/DoctorSubscription/my/current'),
      api.get<ApiResponse<PageResult<DoctorFeature>>>('/DoctorFeature', {
        params: { page: 1, pageSize: 50 },
      }),
    ])

    if (subscriptionResult.status === 'fulfilled') {
      subscription.value = subscriptionResult.value.data.data
    } else {
      const status = (subscriptionResult.reason as any)?.response?.status
      if (status !== 404) showError(getErrorMessage(subscriptionResult.reason))
      subscription.value = null
    }

    if (featuresResult.status === 'fulfilled') {
      features.value = featuresResult.value.data.data.items
    } else {
      const status = (featuresResult.reason as any)?.response?.status
      if (status === 404) features.value = []
      else showError(getErrorMessage(featuresResult.reason))
    }
  } finally {
    loading.value = false
  }
}

async function toggleFeature(item: DoctorFeature) {
  savingId.value = item.id
  try {
    const response = await api.post<ApiResponse<object>>(`/DoctorFeature/${item.id}/toggle`)
    showSuccess(response.data.message)
    await loadData()
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    savingId.value = null
  }
}

function featureIcon(item: DoctorFeature) {
  const name = item.feature.normalizedName
  if (name === 'EBooking') return 'mdi-calendar-check'
  if (name === 'AutoApproveAppointments') return 'mdi-check-decagram'
  if (name === 'ShowReviews') return 'mdi-star'
  if (name === 'ShowMessages') return 'mdi-message-text'
  if (name === 'EPayments') return 'mdi-credit-card-check'
  if (name === 'MakeOffers') return 'mdi-tag-multiple'
  return 'mdi-tune'
}

onMounted(loadData)
</script>

<template>
  <div class="features-page">
    <div class="page-top">
      <div>
        <p class="page-kicker">اشتراكي</p>
        <h1 class="page-title">مميزات الاشتراك</h1>
      </div>
      <v-btn color="primary" prepend-icon="mdi-refresh" :loading="loading" @click="loadData">
        تحديث
      </v-btn>
    </div>

    <div class="summary-band">
      <div class="summary-main">
        <div class="summary-icon">
          <v-icon icon="mdi-crown" size="28" />
        </div>
        <div>
          <p class="summary-label">الباقة الحالية</p>
          <h2>{{ packageName }}</h2>
          <p v-if="subscription" class="summary-note">
            متبقي {{ subscription.daysRemaining }} يوم من الاشتراك
          </p>
          <p v-else class="summary-note">لا توجد باقة فعالة حالياً</p>
        </div>
      </div>
      <div class="summary-stats">
        <div>
          <strong>{{ enabledCount }}</strong>
          <span>مفعلة</span>
        </div>
        <div>
          <strong>{{ disabledCount }}</strong>
          <span>غير مفعلة</span>
        </div>
        <div>
          <strong>{{ features.length }}</strong>
          <span>إجمالي</span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="features-grid">
      <v-skeleton-loader v-for="i in 6" :key="i" type="article" />
    </div>

    <EmptyState
      v-else-if="!features.length"
      icon="mdi-star-off"
      title="لا توجد مميزات متاحة"
      description="عند تفعيل اشتراكك ستظهر هنا المميزات التي تستطيع التحكم بها."
    />

    <div v-else class="features-grid">
      <div
        v-for="item in features"
        :key="item.id"
        class="feature-card"
        :class="{ 'feature-card--on': item.isEnabled }"
      >
        <div class="feature-head">
          <div class="feature-icon">
            <v-icon :icon="featureIcon(item)" size="24" />
          </div>
          <v-chip size="small" :color="item.isEnabled ? 'success' : 'default'" variant="tonal">
            {{ item.isEnabled ? 'مفعلة' : 'غير مفعلة' }}
          </v-chip>
        </div>

        <h3>{{ item.feature.name }}</h3>
        <p>{{ item.feature.description || item.feature.normalizedName }}</p>

        <div class="feature-actions">
          <span class="feature-code">{{ item.feature.normalizedName }}</span>
          <v-switch
            :model-value="item.isEnabled"
            color="primary"
            density="compact"
            hide-details
            :loading="savingId === item.id"
            @update:model-value="toggleFeature(item)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.features-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.page-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
}

.page-kicker {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 800;
  color: var(--color-text-muted);
}

.page-title {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  color: var(--color-text);
}

.summary-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.summary-main {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.summary-icon {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: var(--radius-md);
  color: var(--color-primary);
  background: var(--color-primary-soft);
  flex-shrink: 0;
}

.summary-label,
.summary-note {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 700;
}

.summary-main h2 {
  margin: 2px 0;
  font-size: 21px;
  font-weight: 800;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(80px, 1fr));
  gap: var(--spacing-sm);
}

.summary-stats div {
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--color-background);
  text-align: center;
}

.summary-stats strong {
  display: block;
  font-size: 22px;
  color: var(--color-text);
}

.summary-stats span {
  font-size: 12px;
  color: var(--color-text-muted);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--spacing-md);
}

.feature-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-height: 190px;
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.feature-card--on {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
}

.feature-head,
.feature-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.feature-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  color: var(--color-primary);
  background: var(--color-primary-soft);
}

.feature-card h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--color-text);
}

.feature-card p {
  flex: 1;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.7;
}

.feature-code {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 720px) {
  .summary-band {
    align-items: stretch;
    flex-direction: column;
  }

  .summary-stats {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
