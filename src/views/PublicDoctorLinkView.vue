<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const doctorId = computed(() => String(route.params.doctorId ?? '').trim())
const downloadLocation = computed(() => {
  const url = new URL('/download', window.location.origin)
  if (doctorId.value) url.searchParams.set('doctorId', doctorId.value)
  return url.toString()
})

function isAndroid() {
  return /android/i.test(navigator.userAgent)
}

function openAndroidApp() {
  const currentPath = `/d/${encodeURIComponent(doctorId.value)}`
  const fallbackUrl = encodeURIComponent(downloadLocation.value)
  window.location.href =
    `intent://${window.location.host}${currentPath}` +
    `#Intent;scheme=${window.location.protocol.replace(':', '')};` +
    'package=com.clinicbooking.clinic_app;' +
    `S.browser_fallback_url=${fallbackUrl};end`
}

onMounted(() => {
  if (!doctorId.value) {
    router.replace('/download')
    return
  }

  if (isAndroid()) {
    openAndroidApp()
    window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.location.replace(downloadLocation.value)
      }
    }, 1400)
    return
  }

  window.location.replace(downloadLocation.value)
})
</script>

<template>
  <main class="deep-link-page" dir="rtl">
    <section class="deep-link-panel">
      <v-icon icon="mdi-cellphone-arrow-down" size="44" />
      <h1>جاري فتح تطبيق عيادتي</h1>
      <p>إذا ما انفتح التطبيق خلال لحظات، راح نحولك تلقائياً إلى صفحة التحميل.</p>
      <RouterLink :to="{ path: '/download', query: { doctorId } }" class="download-link">
        تحميل التطبيق
      </RouterLink>
    </section>
  </main>
</template>

<style scoped>
.deep-link-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--color-background);
}

.deep-link-panel {
  width: min(100%, 420px);
  text-align: center;
  color: var(--color-text);
}

.deep-link-panel h1 {
  margin: 16px 0 8px;
  font-size: 24px;
  font-weight: 800;
}

.deep-link-panel p {
  margin: 0 0 20px;
  color: var(--color-text-muted);
  line-height: 1.7;
}

.download-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 12px;
  background: var(--color-primary);
  color: #fff;
  font-weight: 800;
  text-decoration: none;
}
</style>
