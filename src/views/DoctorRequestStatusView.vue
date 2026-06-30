<script setup lang="ts">
import { ref } from 'vue'
import { Search, ArrowRight, HeartPulse } from '@lucide/vue'
import { getRequestStatus } from '../services/doctorRequestService'
import { getErrorMessage } from '../utils/errors'
import type { DoctorRequestDetails } from '../types/api'

const phone = ref('')
const code = ref('')
const result = ref<DoctorRequestDetails | null>(null)
const loading = ref(false)
const errorMsg = ref('')

const statusConfig: Record<string, { label: string; icon: string; color: string }> = {
  Waiting: { label: 'قيد الانتظار', icon: 'mdi-clock-outline', color: 'warning' },
  Accepted: { label: 'تم القبول', icon: 'mdi-check-circle', color: 'success' },
  Rejected: { label: 'مرفوض', icon: 'mdi-close-circle', color: 'error' },
}

function statusLabel(s: string) {
  return statusConfig[s]?.label ?? s
}

function statusIcon(s: string) {
  return statusConfig[s]?.icon ?? 'mdi-help'
}

function statusColor(s: string) {
  return statusConfig[s]?.color ?? 'default'
}

function validatePhone(val: string) {
  return /^07\d{9}$/.test(val.replace(/\s/g, ''))
}

async function handleSearch() {
  errorMsg.value = ''
  result.value = null
  const p = phone.value.trim()
  if (!p) {
    errorMsg.value = 'يرجى إدخال رقم الهاتف.'
    return
  }
  if (!validatePhone(p)) {
    errorMsg.value = 'رقم الهاتف غير صحيح. يجب أن يبدأ بـ 07 ويتكون من 11 رقمًا.'
    return
  }
  if (!/^DR-[A-Z0-9]{6}$/i.test(code.value.trim())) {
    errorMsg.value = 'صيغة الكود غير صحيحة. مثال: DR-XXXXXX'
    return
  }
  loading.value = true
  try {
    const res = await getRequestStatus(code.value.trim().toUpperCase(), p)
    result.value = res.data!
  } catch (e) {
    errorMsg.value = getErrorMessage(e, 'لم يتم العثور على طلب بهذا الكود ورقم الهاتف.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="sr-page">
    <div class="sr-container">
      <div class="sr-card">
        <div class="sr-brand">
          <div class="sr-logo">
            <HeartPulse :size="32" />
          </div>
          <h1 class="sr-title">متابعة حالة الطلب</h1>
          <p class="sr-subtitle">أدخل رقم الهاتف وكود المتابعة</p>
        </div>

        <!-- Search Fields -->
        <div class="sr-search">
          <div class="sr-input-group">
            <input
              v-model="phone"
              type="tel"
              class="sr-input"
              placeholder="رقم الهاتف"
              maxlength="11"
              dir="ltr"
              @keyup.enter="handleSearch"
            />
          </div>
          <div class="sr-input-group" style="margin-top: 8px;">
            <input
              v-model="code"
              type="text"
              class="sr-input"
              placeholder="DR-XXXXXX"
              maxlength="10"
              dir="ltr"
              @keyup.enter="handleSearch"
            />
            <button
              class="sr-btn"
              :disabled="!code.trim() || !phone.trim() || loading"
              @click="handleSearch"
            >
              <Search :size="18" />
            </button>
          </div>
        </div>

        <div v-if="errorMsg" class="sr-error">{{ errorMsg }}</div>

        <!-- Loading -->
        <div v-if="loading" class="sr-loading">
          جاري البحث...
        </div>

        <!-- Result -->
        <div v-if="result" class="sr-result">
          <div class="sr-status-badge" :class="`sr-status--${statusColor(result.status)}`">
            <v-icon :icon="statusIcon(result.status)" size="28" />
            <span>{{ statusLabel(result.status) }}</span>
          </div>

          <div class="sr-details">
            <div class="sr-row">
              <span class="sr-label">الاسم الكامل</span>
              <span class="sr-value">{{ result.fullName }}</span>
            </div>
            <div class="sr-row">
              <span class="sr-label">رقم الهاتف</span>
              <span class="sr-value" dir="ltr">{{ result.phoneNumber }}</span>
            </div>
            <div class="sr-row">
              <span class="sr-label">التخصص</span>
              <span class="sr-value">{{ result.specializationName }}</span>
            </div>
            <div class="sr-row">
              <span class="sr-label">المحافظة</span>
              <span class="sr-value">{{ result.province }}</span>
            </div>
            <div class="sr-row">
              <span class="sr-label">تاريخ الإرسال</span>
              <span class="sr-value">{{ new Date(result.createdAt).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' }) }}</span>
            </div>
            <div v-if="result.rejectedReason" class="sr-row">
              <span class="sr-label">سبب الرفض</span>
              <span class="sr-value sr-value--error">{{ result.rejectedReason }}</span>
            </div>
          </div>

        </div>

        <RouterLink to="/doctor-request" class="sr-back-link">
          <ArrowRight :size="16" /> تقديم طلب جديد
        </RouterLink>
      </div>
    </div>
  </main>
</template>

<style scoped>
.sr-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f6f9f8 0%, #eef8f5 50%, #e4f4f0 100%);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 16px;
}

.sr-container {
  width: 100%;
  max-width: 480px;
  margin-top: 80px;
}

.sr-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--color-border);
  border-radius: 24px;
  box-shadow: var(--shadow-md);
  padding: 32px;
  animation: fadeInUp 0.5s ease both;
}

.sr-brand {
  text-align: center;
  margin-bottom: 24px;
}

.sr-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  margin-bottom: 16px;
}

.sr-title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
}

.sr-subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-muted);
}

.sr-search {
  margin-bottom: 20px;
}

.sr-input-group {
  display: flex;
  gap: 8px;
}

.sr-input {
  flex: 1;
  padding: 12px 16px;
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-family-primary);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 2px;
  outline: none;
  transition: border-color 0.2s;
  direction: ltr;
  text-align: center;
}

.sr-input:focus {
  border-color: var(--color-primary);
}

.sr-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.sr-btn:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.sr-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sr-error {
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  border-radius: 12px;
  font-size: 13px;
  text-align: center;
  margin-bottom: 12px;
}

.sr-loading {
  text-align: center;
  font-size: 14px;
  color: var(--color-text-muted);
  padding: 20px;
}

.sr-result {
  animation: fadeInUp 0.35s ease both;
}

.sr-status-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  border-radius: 16px;
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 20px;
}

.sr-status--success {
  background: #f0fdf4;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}

.sr-status--warning {
  background: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
}

.sr-status--error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.sr-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.sr-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border-light);
}

.sr-row:last-child {
  border-bottom: none;
}

.sr-label {
  font-size: 13px;
  color: var(--color-text-muted);
}

.sr-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.sr-value--error {
  color: #dc2626;
}

.sr-back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 600;
}

.sr-back-link:hover {
  text-decoration: underline;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 480px) {
  .sr-card { padding: 20px; }
}
</style>
