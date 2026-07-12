<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import api from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import { getErrorMessage } from '../utils/errors'
import type { ApiResponse } from '../types/api'
import TextInput from '../components/forms/Textinput.vue'

type Step = 'phone' | 'otp' | 'done'

interface AccountDeletionScheduled {
  userId: string
  phoneNumber?: string
  requestedAt: string
  scheduledDeletionAt: string
}

const { error: showError, success: showSuccess } = useNotifications()

const loading = ref(false)
const step = ref<Step>('phone')
const result = ref<AccountDeletionScheduled>()

const form = reactive({
  phoneNumber: '',
  otpCode: '',
})

const normalizedPhone = computed(() => normalizeDigits(form.phoneNumber).trim())
const normalizedOtp = computed(() => normalizeDigits(form.otpCode).trim())
const isPhoneValid = computed(() => /^07\d{9}$/.test(normalizedPhone.value))
const isOtpValid = computed(() => /^\d{6}$/.test(normalizedOtp.value))

const deletionDate = computed(() => {
  if (!result.value?.scheduledDeletionAt) return ''
  return new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'full', timeStyle: 'short' }).format(
    new Date(result.value.scheduledDeletionAt),
  )
})

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
}

function phoneError() {
  if (!form.phoneNumber) return ''
  if (!isPhoneValid.value) return 'رقم الهاتف يجب أن يكون 11 رقماً ويبدأ بـ 07'
  return ''
}

function otpError() {
  if (!form.otpCode) return ''
  if (!isOtpValid.value) return 'رمز OTP يجب أن يتكون من 6 أرقام'
  return ''
}

async function sendOtp() {
  if (!isPhoneValid.value || loading.value) {
    showError('أدخل رقم هاتف عراقي صحيح يبدأ بـ 07.')
    return
  }

  loading.value = true
  try {
    const response = await api.post<ApiResponse<AccountDeletionScheduled | string>>('/User/account-deletion/send-otp', {
      phoneNumber: normalizedPhone.value,
    })

    if (typeof response.data.data === 'object' && response.data.data?.scheduledDeletionAt) {
      result.value = response.data.data
      step.value = 'done'
    } else {
      step.value = 'otp'
    }

    showSuccess(response.data.message || 'تم إرسال رمز التحقق إلى رقم الهاتف.')
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function confirmDeletion() {
  if (!isOtpValid.value || loading.value) {
    showError('أدخل رمز OTP المكون من 6 أرقام.')
    return
  }

  loading.value = true
  try {
    const response = await api.post<ApiResponse<AccountDeletionScheduled>>('/User/account-deletion/confirm', {
      phoneNumber: normalizedPhone.value,
      otpCode: normalizedOtp.value,
    })

    result.value = response.data.data
    step.value = 'done'
    showSuccess(response.data.message || 'تم استلام طلب حذف الحساب.')
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function backToPhone() {
  if (loading.value) return
  step.value = 'phone'
  form.otpCode = ''
}
</script>

<template>
  <div class="delete-container">
    <section class="delete-intro">
      <div class="intro-content">
        <div class="brand-intro">
          <v-icon icon="mdi-heart-pulse" size="40" class="brand-icon" />
          <div>
            <h1 class="brand-title">عيادتي</h1>
            <p class="brand-subtitle">إدارة طلب حذف الحساب</p>
          </div>
        </div>
        <div class="intro-description">
          <h2>حذف الحساب</h2>
          <p>أدخل رقم هاتفك، تحقق من رمز OTP، وبعد التأكيد سيتم جدولة حذف الحساب نهائياً خلال 30 يوم.</p>
        </div>
      </div>
    </section>

    <section class="delete-panel">
      <v-card class="delete-card" elevation="0">
        <div class="delete-header">
          <div class="delete-icon">
            <v-icon :icon="step === 'done' ? 'mdi-check-circle' : 'mdi-account-remove'" size="32" />
          </div>
          <h2>{{ step === 'done' ? 'تم استلام الطلب' : 'طلب حذف الحساب' }}</h2>
          <p>
            {{ step === 'done' ? 'تمت جدولة حذف الحساب، ولن يمكن تسجيل الدخول إليه.' : 'سنرسل رمز OTP إلى رقم الهاتف المرتبط بالحساب.' }}
          </p>
        </div>

        <div v-if="step === 'done'" class="done-state">
          <v-alert type="success" variant="tonal" icon="mdi-calendar-check">
            سيتم حذف الحساب نهائياً بتاريخ {{ deletionDate }}.
          </v-alert>
          <p class="done-copy">
            إذا احتجت مساعدة بخصوص هذا الطلب تواصل مع دعم عيادتي واذكر رقم الهاتف المستخدم.
          </p>
        </div>

        <form v-else class="delete-form" @submit.prevent="step === 'phone' ? sendOtp() : confirmDeletion()">
          <TextInput
            v-model="form.phoneNumber"
            label="رقم الهاتف"
            type="tel"
            icon="mdi-phone"
            placeholder="07XXXXXXXXX"
            :error="phoneError()"
            :disabled="loading || step === 'otp'"
            required
            clearable
          />

          <template v-if="step === 'otp'">
            <TextInput
              v-model="form.otpCode"
              label="رمز OTP"
              type="tel"
              icon="mdi-message-processing"
              placeholder="أدخل الرمز المكون من 6 أرقام"
              :error="otpError()"
              :disabled="loading"
              required
              clearable
            />
            <p class="helper-text">
              <v-icon icon="mdi-information" size="14" />
              تم إرسال الرمز إلى {{ normalizedPhone }}
            </p>
          </template>

          <v-alert v-if="step === 'otp'" type="warning" variant="tonal" density="comfortable">
            بعد التأكيد سيتم جدولة حذف الحساب خلال 30 يوم وسيتم منع تسجيل الدخول إليه.
          </v-alert>

          <v-btn
            type="submit"
            color="error"
            size="large"
            block
            class="delete-button"
            :loading="loading"
            :disabled="step === 'phone' ? !isPhoneValid : !isOtpValid"
          >
            {{ step === 'phone' ? 'إرسال رمز التحقق' : 'تأكيد حذف الحساب' }}
          </v-btn>

          <div v-if="step === 'otp'" class="form-actions">
            <v-btn variant="text" color="primary" :disabled="loading" @click="sendOtp">إعادة إرسال الرمز</v-btn>
            <v-btn variant="text" color="secondary" :disabled="loading" @click="backToPhone">تغيير رقم الهاتف</v-btn>
          </div>
        </form>
      </v-card>
    </section>
  </div>
</template>

<style scoped>
.delete-container { display: grid; grid-template-columns: 1.05fr 0.95fr; min-height: 100vh; background: var(--color-background); }
.delete-intro { display: flex; align-items: center; justify-content: center; padding: var(--spacing-3xl); background: linear-gradient(140deg, #0a5149, #13796b 58%, #42a799); color: white; }
.intro-content { max-width: 520px; }
.brand-intro { display: flex; align-items: center; gap: var(--spacing-md); margin-bottom: var(--spacing-3xl); }
.brand-title { margin: 0; font-size: 44px; font-weight: 800; color: white; }
.brand-subtitle { margin: 6px 0 0; color: #d7fffa; }
.intro-description h2 { margin: 0 0 var(--spacing-md); font-size: 32px; color: white; }
.intro-description p { margin: 0; line-height: 1.8; color: rgba(255, 255, 255, .86); }
.delete-panel { display: flex; align-items: center; justify-content: center; padding: var(--spacing-lg); background: var(--color-surface); }
.delete-card { width: 100%; max-width: 440px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
.delete-header { padding: var(--spacing-xl); text-align: center; border-bottom: 1px solid var(--color-border); }
.delete-icon { display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; margin: 0 auto var(--spacing-lg); background: rgba(220, 38, 38, .1); color: var(--color-error); border-radius: var(--radius-lg); }
.delete-header h2 { margin: 0 0 var(--spacing-sm); font-size: 24px; color: var(--color-text); }
.delete-header p { margin: 0; color: var(--color-text-muted); line-height: 1.6; }
.delete-form, .done-state { display: flex; flex-direction: column; gap: var(--spacing-lg); padding: var(--spacing-xl); }
.helper-text { display: flex; align-items: center; gap: var(--spacing-sm); margin: 0; padding: var(--spacing-md); background: var(--color-background); border-radius: var(--radius-md); font-size: 12px; color: var(--color-text-muted); }
.delete-button { font-weight: 700; text-transform: none; letter-spacing: 0; }
.form-actions { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); }
.done-copy { margin: 0; color: var(--color-text-muted); line-height: 1.7; }
@media (max-width: 1000px) { .delete-container { grid-template-columns: 1fr; } .delete-intro { display: none; } .delete-panel { min-height: 100vh; } }
@media (max-width: 600px) { .delete-panel { padding: var(--spacing-md); } .delete-card { border: none; } .delete-form, .done-state, .delete-header { padding: var(--spacing-lg); } .form-actions { flex-direction: column; align-items: stretch; } }
</style>
