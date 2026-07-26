<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import api from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import { getErrorMessage } from '../utils/errors'
import EmptyState from '../components/common/Emptystate.vue'
import type { ApiResponse, CurrentDoctorSubscription, SubscriptionPackage } from '../types/api'

const { error: showError } = useNotifications()
const loading = ref(false)
const packages = ref<SubscriptionPackage[]>([])
const currentSubscription = ref<CurrentDoctorSubscription | null>(null)

const currentPackageId = computed(() => currentSubscription.value?.packageId)

function money(value: number) {
  return new Intl.NumberFormat('ar-IQ').format(value)
}

async function loadData() {
  loading.value = true
  const [packagesResult, currentResult] = await Promise.allSettled([
    api.get<ApiResponse<SubscriptionPackage[]>>('/SubscriptionPackages/items'),
    api.get<ApiResponse<CurrentDoctorSubscription>>('/DoctorSubscription/my/current'),
  ])

  if (packagesResult.status === 'fulfilled') {
    packages.value = packagesResult.value.data.data
  } else {
    showError(getErrorMessage(packagesResult.reason))
  }

  if (currentResult.status === 'fulfilled') {
    currentSubscription.value = currentResult.value.data.data
  } else {
    const status = (currentResult.reason as any)?.response?.status
    if (status !== 404) showError(getErrorMessage(currentResult.reason))
    currentSubscription.value = null
  }
  loading.value = false
}

onMounted(loadData)
</script>

<template>
  <div class="subscriptions-page">
    <div class="page-top">
      <div>
        <p class="page-kicker">الباقات المتاحة</p>
        <h1 class="page-title">أنواع الاشتراكات</h1>
        <p class="page-description">تعرّف على أسعار الباقات وحدودها والمميزات التي تقدمها كل باقة.</p>
      </div>
      <v-btn variant="outlined" color="primary" prepend-icon="mdi-refresh" :loading="loading" @click="loadData">تحديث</v-btn>
    </div>

    <div v-if="currentSubscription" class="current-banner">
      <div class="current-icon"><v-icon icon="mdi-crown" size="25" /></div>
      <div>
        <span>اشتراكك الحالي</span>
        <strong>{{ currentSubscription.packageArabicName || currentSubscription.packageName }}</strong>
      </div>
      <v-chip color="success" variant="tonal" prepend-icon="mdi-check-decagram">
        متبقي {{ currentSubscription.daysRemaining }} يوم
      </v-chip>
    </div>

    <div v-if="loading && !packages.length" class="packages-grid">
      <v-skeleton-loader v-for="i in 3" :key="i" type="article" height="340" />
    </div>

    <EmptyState v-else-if="!packages.length" icon="mdi-package-variant" title="لا توجد باقات متاحة" description="ستظهر أنواع الاشتراكات هنا عند إضافتها إلى النظام." />

    <div v-else class="packages-grid">
      <article v-for="item in packages" :key="item.id" class="package-card" :class="{ 'package-card--current': currentPackageId === item.id }">
        <div v-if="currentPackageId === item.id" class="current-ribbon"><v-icon icon="mdi-check-circle" size="15" /> باقتك الحالية</div>

        <div class="package-header">
          <div class="package-icon"><v-icon icon="mdi-crown" color="primary" size="22" /></div>
          <div class="package-title">
            <h3>{{ item.name }}</h3>
            <p>{{ item.normalizedName }}</p>
          </div>
        </div>

        <div class="package-price">
          <strong>{{ money(item.price) }}</strong>
          <span>د.ع / شهر</span>
        </div>
        <p class="package-yearly"><v-icon icon="mdi-calendar-range" size="16" /> {{ money(item.yearlyPrice) }} د.ع سنوياً</p>

        <div class="package-limits">
          <span><v-icon icon="mdi-hospital-building" size="15" /> {{ item.maxClinics }} عيادات</span>
          <span><v-icon icon="mdi-calendar-week" size="15" /> {{ item.maxWeeklyDays }} أيام</span>
          <span><v-icon icon="mdi-account-group" size="15" /> {{ item.maxDailyAppointments }} دور/يوم</span>
          <span v-if="item.makeOffers"><v-icon icon="mdi-tag-multiple" size="15" /> {{ item.maxActiveOffers }} عروض فعالة</span>
        </div>

        <v-divider class="my-3" />
        <p class="features-title">مميزات الباقة</p>
        <div class="package-features">
          <span class="feature-chip" :class="{ 'feature-chip--on': item.eBooking }"><v-icon :icon="item.eBooking ? 'mdi-check' : 'mdi-close'" size="13" /> الحجز الإلكتروني</span>
          <span class="feature-chip" :class="{ 'feature-chip--on': item.autoApproveAppointments }"><v-icon :icon="item.autoApproveAppointments ? 'mdi-check' : 'mdi-close'" size="13" /> الموافقة التلقائية</span>
          <span class="feature-chip" :class="{ 'feature-chip--on': item.showReviews }"><v-icon :icon="item.showReviews ? 'mdi-check' : 'mdi-close'" size="13" /> التقييمات</span>
          <span class="feature-chip" :class="{ 'feature-chip--on': item.showMessages }"><v-icon :icon="item.showMessages ? 'mdi-check' : 'mdi-close'" size="13" /> الرسائل</span>
          <span class="feature-chip" :class="{ 'feature-chip--on': item.ePayments }"><v-icon :icon="item.ePayments ? 'mdi-check' : 'mdi-close'" size="13" /> الدفع الإلكتروني</span>
          <span class="feature-chip" :class="{ 'feature-chip--on': item.makeOffers }"><v-icon :icon="item.makeOffers ? 'mdi-check' : 'mdi-close'" size="13" /> العروض</span>
        </div>
      </article>
    </div>

    <div class="read-only-note"><v-icon icon="mdi-information-outline" size="20" /><span>هذه الصفحة للعرض فقط. لتغيير باقتك أو الاستفسار عن الاشتراك تواصل مع إدارة النظام.</span></div>
  </div>
</template>

<style scoped>
.subscriptions-page{display:flex;flex-direction:column;gap:var(--spacing-lg)}.page-top{display:flex;align-items:center;justify-content:space-between;gap:var(--spacing-lg);flex-wrap:wrap}.page-kicker{margin:0 0 4px;font-size:12px;font-weight:800;color:var(--color-primary)}.page-title{margin:0;font-size:28px;font-weight:800;color:var(--color-text)}.page-description{margin:6px 0 0;color:var(--color-text-muted);font-size:14px}.current-banner{display:flex;align-items:center;gap:13px;padding:16px 18px;border:1px solid #9bd1c7;border-radius:var(--radius-lg);background:linear-gradient(90deg,var(--color-primary-soft),#fbfefd)}.current-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:13px;background:#fff;color:var(--color-primary);box-shadow:var(--shadow-sm)}.current-banner>div:nth-child(2){display:flex;flex:1;flex-direction:column}.current-banner span{font-size:12px;color:var(--color-text-muted);font-weight:700}.current-banner strong{font-size:17px;color:var(--color-text)}.packages-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--spacing-lg);align-items:stretch}.package-card{position:relative;overflow:hidden;display:flex;flex-direction:column;gap:var(--spacing-md);min-height:350px;padding:var(--spacing-lg);border:1px solid var(--color-border);border-radius:var(--radius-lg);background:var(--color-surface);box-shadow:var(--shadow-sm);transition:box-shadow .2s,transform .2s}.package-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}.package-card--current{border:2px solid var(--color-primary);padding:15px}.current-ribbon{position:absolute;top:0;left:0;display:flex;align-items:center;gap:4px;padding:6px 11px;border-radius:0 0 12px 0;background:var(--color-primary);color:#fff;font-size:11px;font-weight:800}.package-header{display:flex;align-items:center;gap:var(--spacing-md);min-height:44px}.package-icon{display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:var(--radius-md);background:var(--color-primary-soft);flex-shrink:0}.package-title{flex:1;min-width:0}.package-title h3{margin:0;font-size:17px;font-weight:800;color:var(--color-text)}.package-title p{margin:2px 0 0;font-size:11px;color:var(--color-text-muted)}.package-price{display:flex;align-items:baseline;gap:6px}.package-price strong{font-size:28px;font-weight:800;color:var(--color-primary)}.package-price span{font-size:13px;color:var(--color-text-muted)}.package-yearly{display:flex;align-items:center;gap:5px;margin:-7px 0 0;color:var(--color-text-muted);font-size:12px}.package-limits{display:flex;gap:var(--spacing-sm);flex-wrap:wrap}.package-limits span{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border:1px solid var(--color-border);border-radius:999px;background:var(--color-background);color:var(--color-text);font-size:11px;font-weight:600}.features-title{margin:0;font-size:12px;font-weight:800;color:var(--color-text)}.package-features{display:flex;flex-wrap:wrap;gap:7px}.feature-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border:1px solid var(--color-border);border-radius:999px;background:var(--color-background);color:var(--color-text-muted);font-size:11px;font-weight:600}.feature-chip--on{border-color:#a8d8cf;background:var(--color-success-light);color:var(--color-success)}.read-only-note{display:flex;align-items:center;gap:9px;padding:13px 16px;border-radius:var(--radius-md);background:var(--color-info-light);color:var(--color-info);font-size:13px;font-weight:600}
@media(max-width:1100px){.packages-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){.packages-grid{grid-template-columns:1fr}.current-banner{align-items:flex-start;flex-wrap:wrap}.current-banner .v-chip{margin-right:59px}.page-top .v-btn{width:100%}.page-title{font-size:24px}}
</style>
