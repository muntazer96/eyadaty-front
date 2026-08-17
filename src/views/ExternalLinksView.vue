<script setup lang="ts">
import { useRouter } from 'vue-router'
import DoctorExternalLinks from '../components/externalLinks/DoctorExternalLinks.vue'

const router = useRouter()
</script>

<template>
  <div class="external-links-page">

    <!-- Header -->
    <div class="page-top">
      <div>
        <p class="page-kicker">إدارة الروابط</p>
        <h1 class="page-title">الروابط الخارجية</h1>
      </div>
      <v-btn variant="outlined" color="primary" prepend-icon="mdi-arrow-right" @click="router.push('/')">
        العودة
      </v-btn>
    </div>

    <!-- External Links Component -->
    <DoctorExternalLinks :is-doctor="true" />

  </div>
</template>

<style scoped>
.external-links-page {
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
</style>
