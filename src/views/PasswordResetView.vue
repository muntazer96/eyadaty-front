<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { HeartPulse, KeyRound } from '@lucide/vue'
import api from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import { getErrorMessage } from '../utils/errors'
import type { ApiResponse } from '../types/api'
import TextInput from '../components/forms/Textinput.vue'

const route = useRoute()
const router = useRouter()
const { error: showError, success: showSuccess } = useNotifications()

const loading = ref(false)
const done = ref(false)
const form = reactive({ newPassword: '', confirmPassword: '' })

const userId = computed(() => String(route.query.userId ?? ''))
const token = computed(() => String(route.query.token ?? ''))

// Password strength calculation
const passwordScore = computed(() => {
  let score = 0
  if (form.newPassword.length >= 6) score += 1
  if (form.newPassword.length >= 10) score += 1
  if (/[A-Z]/.test(form.newPassword)) score += 1
  if (/[0-9]/.test(form.newPassword)) score += 1
  if (/[^A-Za-z0-9]/.test(form.newPassword)) score += 1
  return score
})

const strengthLabel = computed(() => {
  if (!form.newPassword) return 'أدخل كلمة مرور لا تقل عن ستة أحرف'
  if (passwordScore.value <= 2) return 'كلمة المرور ضعيفة'
  if (passwordScore.value <= 4) return 'كلمة المرور متوسطة'
  return 'كلمة المرور قوية'
})

const strengthColor = computed(() => {
  if (!form.newPassword) return 'warning'
  if (passwordScore.value <= 2) return 'error'
  if (passwordScore.value <= 4) return 'warning'
  return 'success'
})

const strengthPercentage = computed(() => {
  return Math.max(passwordScore.value, 1) * 20
})

const passwordsMatch = computed(() => {
  if (!form.confirmPassword) return null
  return form.newPassword === form.confirmPassword
})

const canSubmit = computed(() => {
  return (
    form.newPassword &&
    form.confirmPassword &&
    form.newPassword.length >= 6 &&
    passwordsMatch.value &&
    !loading.value
  )
})

// Validate inputs
const getPasswordError = (): string => {
  if (!form.newPassword) return ''
  if (form.newPassword.length < 6) return 'كلمة المرور يجب أن لا تقل عن ستة أحرف'
  return ''
}

const getConfirmError = (): string => {
  if (!form.confirmPassword) return ''
  if (form.newPassword !== form.confirmPassword) return 'تأكيد كلمة المرور غير مطابق'
  return ''
}

// Reset password
async function resetPassword() {
  if (!userId.value || !token.value) {
    showError('رابط إعادة تعيين كلمة المرور غير مكتمل')
    return
  }

  if (!canSubmit.value) {
    showError('تأكد من صحة البيانات المدخلة')
    return
  }

  loading.value = true
  try {
    const response = await axios.post<ApiResponse<string>>(
      `${api.defaults.baseURL}/User/password/reset`,
      {
        userId: userId.value,
        token: token.value,
        newPassword: form.newPassword,
      },
      { timeout: 15000 }
    )
    done.value = true
    showSuccess(response.data.message || 'تم تغيير كلمة المرور بنجاح')
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

// Navigate to login
const goToLogin = (): void => {
  router.push('/login')
}

const handleKeyPress = (event: KeyboardEvent): void => {
  if (event.key === 'Enter' && canSubmit.value) {
    resetPassword()
  }
}
</script>

<template>
  <div class="reset-container">
    <!-- Left Side - Branding (Desktop Only) -->
    <div class="reset-intro">
      <div class="intro-content">
        <div class="brand-intro">
          <HeartPulse :size="40" class="brand-icon" />
          <h1 class="brand-title">عيادتي</h1>
          <p class="brand-subtitle">لوحة التحكم الطبية</p>
        </div>

        <div class="intro-description">
          <h2>استرجاع حسابك</h2>
          <p>اتبع الخطوات البسيطة لإنشاء كلمة مرور جديدة وآمنة لحسابك.</p>
        </div>

        <div class="intro-features">
          <div class="feature">
            <v-icon icon="mdi-shield-check" class="feature-icon" />
            <span>آمن وموثوق</span>
          </div>
          <div class="feature">
            <v-icon icon="mdi-lock-check" class="feature-icon" />
            <span>تشفير قوي</span>
          </div>
          <div class="feature">
            <v-icon icon="mdi-clock-fast" class="feature-icon" />
            <span>فوري وسريع</span>
          </div>
        </div>

        <p class="intro-footer">© 2024 عيادتي - جميع الحقوق محفوظة</p>
      </div>
    </div>

    <!-- Right Side - Reset Form -->
    <div class="reset-panel">
      <v-card class="reset-card" elevation="0">
        <!-- Mobile Brand -->
        <div class="mobile-brand">
          <HeartPulse :size="28" class="brand-icon-mobile" />
          <h2>عيادتي</h2>
        </div>

        <!-- Header -->
        <div class="reset-header">
          <div class="reset-icon">
            <KeyRound :size="32" class="icon-content" />
          </div>
          <h2 class="reset-title">{{ done ? 'تم تغيير كلمة المرور' : 'إعادة تعيين كلمة المرور' }}</h2>
          <p class="reset-subtitle">
            {{ done ? 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة' : 'أدخل كلمة مرور جديدة آمنة لحسابك' }}
          </p>
        </div>

        <!-- Success State -->
        <div v-if="done" class="reset-success">
          <v-alert type="success" variant="tonal" class="success-alert">
            <v-icon icon="mdi-check-circle" start />
            تم تغيير كلمة المرور بنجاح!
          </v-alert>

          <v-btn
            color="primary"
            size="large"
            block
            class="reset-button"
            @click="goToLogin"
          >
            الانتقال إلى تسجيل الدخول
          </v-btn>
        </div>

        <!-- Reset Form -->
        <form v-else class="reset-form" @submit.prevent="resetPassword" @keypress="handleKeyPress">
          <!-- New Password -->
          <TextInput
            v-model="form.newPassword"
            label="كلمة المرور الجديدة"
            type="password"
            icon="mdi-lock"
            placeholder="أدخل كلمة المرور الجديدة"
            :error="getPasswordError()"
            :disabled="loading"
            clearable
          />

          <!-- Password Strength Indicator -->
          <div class="password-strength">
            <div class="strength-bar">
              <div
                class="strength-fill"
                :class="`strength-${strengthColor}`"
                :style="{ width: `${strengthPercentage}%` }"
              />
            </div>
            <p class="strength-label" :class="`text-${strengthColor}`">
              {{ strengthLabel }}
            </p>
          </div>

          <!-- Confirm Password -->
          <TextInput
            v-model="form.confirmPassword"
            label="تأكيد كلمة المرور"
            type="password"
            icon="mdi-lock-check"
            placeholder="أدخل كلمة المرور مرة أخرى"
            :error="getConfirmError()"
            :disabled="loading"
            clearable
          />

          <!-- Match Indicator -->
          <div v-if="form.confirmPassword" class="match-indicator">
            <v-icon
              :icon="passwordsMatch ? 'mdi-check-circle' : 'mdi-alert-circle'"
              :color="passwordsMatch ? 'success' : 'error'"
              size="small"
            />
            <span :class="passwordsMatch ? 'text-success' : 'text-error'">
              {{ passwordsMatch ? 'كلمات المرور متطابقة' : 'كلمات المرور غير متطابقة' }}
            </span>
          </div>

          <!-- Submit Button -->
          <v-btn
            type="submit"
            color="primary"
            size="large"
            block
            class="reset-button"
            :loading="loading"
            :disabled="!canSubmit"
          >
            {{ loading ? 'جاري حفظ كلمة المرور...' : 'حفظ كلمة المرور الجديدة' }}
          </v-btn>

          <!-- Helper Text -->
          <p class="helper-text">
            <v-icon icon="mdi-information" size="14" />
            استخدم كلمة مرور قوية تتضمن أحرف وأرقام ورموز خاصة
          </p>
        </form>
      </v-card>
    </div>
  </div>
</template>

<style scoped>
.reset-container {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  min-height: 100vh;
  background: var(--color-background);
}

/* Left Side - Branding */
.reset-intro {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-3xl);
  background: linear-gradient(140deg, #0a5149, #13796b 58%, #42a799);
  color: white;
  position: relative;
  overflow: hidden;
}

.reset-intro::before {
  content: '';
  position: absolute;
  width: 460px;
  height: 460px;
  border: 70px solid rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  top: -200px;
  left: -180px;
}

.intro-content {
  position: relative;
  z-index: 1;
  max-width: 520px;
}

.brand-intro {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-3xl);
}

.brand-icon {
  color: #d7fffa;
}

.brand-title {
  margin: 0;
  padding: 0;
  font-size: clamp(32px, 5vw, 48px);
  font-weight: 800;
  line-height: 1.2;
  color: white;
}

.brand-subtitle {
  margin: var(--spacing-sm) 0 0 0;
  padding: 0;
  font-size: 14px;
  color: #9ac6bf;
  font-weight: 500;
}

.intro-description {
  margin: var(--spacing-2xl) 0;
}

.intro-description h2 {
  margin: 0 0 var(--spacing-md) 0;
  padding: 0;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.3;
  color: white;
}

.intro-description p {
  margin: 0;
  padding: 0;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.8;
}

.intro-features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-lg);
  margin: var(--spacing-2xl) 0;
  padding: var(--spacing-lg);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
}

.feature {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.feature-icon {
  font-size: 24px;
  color: #d7fffa;
}

.feature span {
  font-size: 12px;
  font-weight: 600;
  color: white;
}

.intro-footer {
  margin: 0;
  padding: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
}

/* Right Side - Reset Panel */
.reset-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  background-color: var(--color-surface);
}

.reset-card {
  width: 100%;
  max-width: 420px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.mobile-brand {
  display: none;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl);
  color: var(--color-primary);
  border-bottom: 1px solid var(--color-border);
}

.mobile-brand h2 {
  margin: 0;
  padding: 0;
  font-size: 20px;
  font-weight: 700;
}

.brand-icon-mobile {
  color: var(--color-primary);
}

.reset-header {
  padding: var(--spacing-xl);
  text-align: center;
  border-bottom: 1px solid var(--color-border);
}

.reset-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 auto var(--spacing-lg);
  background: var(--color-primary-soft);
  border-radius: var(--radius-lg);
}

.icon-content {
  color: var(--color-primary);
}

.reset-title {
  margin: 0 0 var(--spacing-sm) 0;
  padding: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.2;
}

.reset-subtitle {
  margin: 0;
  padding: 0;
  font-size: 14px;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.reset-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding: var(--spacing-xl);
}

.reset-success {
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.success-alert {
  margin: 0;
}

.password-strength {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.strength-bar {
  width: 100%;
  height: 6px;
  background: var(--color-border);
  border-radius: 999px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  border-radius: inherit;
  transition: width 0.3s ease;
}

.strength-fill.strength-error {
  background-color: var(--color-error);
}

.strength-fill.strength-warning {
  background-color: var(--color-warning);
}

.strength-fill.strength-success {
  background-color: var(--color-success);
}

.strength-label {
  margin: 0;
  padding: 0;
  font-size: 12px;
  font-weight: 600;
}

.text-error {
  color: var(--color-error);
}

.text-warning {
  color: var(--color-warning);
}

.text-success {
  color: var(--color-success);
}

.match-indicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-background);
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 600;
}

.reset-button {
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  margin-top: var(--spacing-md);
}

.helper-text {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin: 0;
  padding: var(--spacing-md);
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--color-background);
  border-radius: var(--radius-md);
  line-height: 1.5;
}

/* Responsive */
@media (max-width: 1000px) {
  .reset-intro {
    display: none;
  }

  .reset-container {
    grid-template-columns: 1fr;
  }

  .reset-panel {
    min-height: 100vh;
    padding: var(--spacing-lg);
  }

  .mobile-brand {
    display: flex;
  }

  .reset-card {
    max-width: 100%;
  }
}

@media (max-width: 600px) {
  .reset-panel {
    padding: var(--spacing-md);
  }

  .reset-card {
    border: none;
    box-shadow: none;
  }

  .reset-header {
    padding: var(--spacing-lg);
  }

  .reset-form {
    padding: var(--spacing-lg);
  }

  .reset-title {
    font-size: 20px;
  }

  .reset-subtitle {
    font-size: 13px;
  }

  .reset-icon {
    width: 56px;
    height: 56px;
  }

  .mobile-brand {
    padding: var(--spacing-lg);
  }

  .mobile-brand h2 {
    font-size: 18px;
  }
}
</style>