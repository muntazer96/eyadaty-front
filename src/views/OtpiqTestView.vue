<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import api from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import type { ApiResponse } from '../types/api'
import { getErrorMessage } from '../utils/errors'

interface OtpiqTestStatus {
  enabled: boolean
  provider: string
  otpProvider: string
  reminderProvider: string
  isOtpiqProvider: boolean
  isOtpOtpiqProvider: boolean
  isReminderOtpiqProvider: boolean
  isOtpCustomHttpProvider: boolean
  isReminderCustomHttpProvider: boolean
  hasEndpoint: boolean
  hasCheckPhoneEndpoint: boolean
  otpiqEndpoint: string
  otpiqProvider: string
  hasToken: boolean
  hasOtpiqToken: boolean
  hasOtpiqSenderId: boolean
  hasTemplateName: boolean
  hasWhatsappAccountId: boolean
  hasWhatsappPhoneId: boolean
}

const { success: showSuccess, error: showError } = useNotifications()

const status = ref<OtpiqTestStatus>()
const loadingStatus = ref(false)
const sendingOtp = ref(false)
const sendingReminder = ref(false)
const lastResult = ref('')

const otpForm = reactive({
  phoneNumber: '',
  code: '123456',
})

const reminderForm = reactive({
  phoneNumber: '',
  message: 'تذكير بموعدك اليوم في عيادتي. يرجى الحضور بالوقت المحدد، ونتمنى لك زيارة موفقة.',
})

const isOtpReady = computed(() => {
  if (status.value?.enabled !== true) return false
  const canTryOtpiq = status.value.isOtpOtpiqProvider && status.value.hasOtpiqToken
  const canUseHub = status.value.hasEndpoint
  return canTryOtpiq || canUseHub
})
const isReminderReady = computed(() => {
  if (status.value?.enabled !== true) return false
  if (status.value.isReminderOtpiqProvider) return status.value.hasOtpiqToken && status.value.hasOtpiqSenderId
  return status.value.hasEndpoint && status.value.hasCheckPhoneEndpoint
})
const isReady = computed(() => isOtpReady.value && isReminderReady.value)
const statusLabel = computed(() => {
  if (!status.value) return 'لم يتم الفحص بعد'
  if (isReady.value) return 'Otpiq مفعل للـ OTP والتذكير'
  if (!status.value.enabled) return 'الإرسال غير مفعل'
  return `OTP: ${status.value.otpProvider || '-'} / التذكير: ${status.value.reminderProvider || '-'}`
})

const deliveryStatusLabel = computed(() => {
  statusLabel.value
  if (!status.value) return 'لم يتم الفحص بعد'
  if (isReady.value) return 'الإرسال جاهز'
  if (!status.value.enabled) return 'الإرسال غير مفعل'
  return `OTP: ${status.value.otpProvider || '-'} / التذكير: ${status.value.reminderProvider || '-'}`
})

const configSnippet = computed(() =>
  JSON.stringify({
    WhatsAppMessages: {
      Enabled: true,
      Provider: 'CustomHttp',
      OtpProvider: 'Otpiq',
      ReminderProvider: 'CustomHttp',
      Endpoint: 'https://your-whatsapp-hub/send-message',
      CheckPhoneEndpoint: 'https://your-whatsapp-hub/check-phone',
      Token: 'CUSTOM_HTTP_TOKEN',
      OtpiqToken: 'OTPIQ_API_TOKEN',
      OtpiqEndpoint: status.value?.otpiqEndpoint || 'https://api.otpiq.com/api/sms',
      OtpiqProvider: status.value?.otpiqProvider || 'whatsapp',
      OtpiqSenderId: '',
      OtpiqWhatsappAccountId: '',
      OtpiqWhatsappPhoneId: '',
      OtpiqTemplateName: '',
    },
  }, null, 2)
)

function validatePhone(phoneNumber: string) {
  return /^07\d{9}$/.test(phoneNumber.trim())
}

async function loadStatus() {
  loadingStatus.value = true
  try {
    const response = await api.get<ApiResponse<OtpiqTestStatus>>('/OtpiqTest/status')
    status.value = response.data.data
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    loadingStatus.value = false
  }
}

async function sendOtp() {
  if (!validatePhone(otpForm.phoneNumber)) {
    showError('اكتب رقم هاتف عراقي صحيح يبدأ بـ 07 ويتكون من 11 رقم.')
    return
  }

  sendingOtp.value = true
  lastResult.value = ''
  try {
    const response = await api.post<ApiResponse<OtpiqTestStatus>>('/OtpiqTest/otp', {
      phoneNumber: otpForm.phoneNumber.trim(),
      code: otpForm.code.trim(),
    })
    status.value = response.data.data
    lastResult.value = response.data.message
    showSuccess(response.data.message)
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    sendingOtp.value = false
  }
}

async function sendReminder() {
  if (!validatePhone(reminderForm.phoneNumber)) {
    showError('اكتب رقم هاتف عراقي صحيح يبدأ بـ 07 ويتكون من 11 رقم.')
    return
  }

  if (!reminderForm.message.trim()) {
    showError('اكتب نص رسالة التذكير قبل الإرسال.')
    return
  }

  sendingReminder.value = true
  lastResult.value = ''
  try {
    const response = await api.post<ApiResponse<OtpiqTestStatus>>('/OtpiqTest/reminder', {
      phoneNumber: reminderForm.phoneNumber.trim(),
      message: reminderForm.message.trim(),
    })
    status.value = response.data.data
    lastResult.value = response.data.message
    showSuccess(response.data.message)
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    sendingReminder.value = false
  }
}

async function copyConfig() {
  await navigator.clipboard.writeText(configSnippet.value)
  showSuccess('تم نسخ إعدادات appsettings.')
}

onMounted(loadStatus)
</script>

<template>
  <div class="otpiq-page">
    <div class="page-top">
      <div>
        <p class="page-kicker">Super Admin</p>
        <p class="page-subtitle">اختبار OTP مع fallback للـ hub، واختبار التذكير حسب ReminderProvider.</p>
        <h1 class="page-title">اختبار Otpiq</h1>
      </div>
      <div class="page-actions">
        <v-chip :color="isReady ? 'success' : 'warning'" variant="tonal">
          <v-icon :icon="isReady ? 'mdi-check-circle' : 'mdi-alert-circle'" size="18" start />
          {{ deliveryStatusLabel }}
        </v-chip>
        <v-btn variant="outlined" color="primary" prepend-icon="mdi-refresh" :loading="loadingStatus" @click="loadStatus">
          فحص الإعدادات
        </v-btn>
      </div>
    </div>

    <v-alert v-if="status && !isReady" type="warning" variant="tonal" icon="mdi-cog-alert" density="comfortable">
      حتى يشتغل الاختبار لازم تكون WhatsAppMessages مفعلة، و OtpProvider/ReminderProvider قيمتهم Otpiq حسب الخدمة اللي تريد تجربها.
    </v-alert>

    <div class="test-layout">
      <v-card elevation="0" class="test-card">
        <div class="card-toolbar">
          <v-icon icon="mdi-shield-key" color="primary" size="22" />
          <strong>إرسال كود تحقق</strong>
        </div>
        <div class="form-body">
          <div class="form-field">
            <label class="form-label">رقم الهاتف</label>
            <input v-model="otpForm.phoneNumber" class="form-input ltr" inputmode="numeric" placeholder="07701234567" dir="ltr" />
          </div>
          <div class="form-field">
            <label class="form-label">كود التحقق</label>
            <input v-model="otpForm.code" class="form-input ltr" inputmode="numeric" maxlength="8" dir="ltr" />
          </div>
          <v-btn color="primary" prepend-icon="mdi-send" :loading="sendingOtp" :disabled="!isOtpReady" @click="sendOtp">
            إرسال كود التحقق
          </v-btn>
        </div>
      </v-card>

      <v-card elevation="0" class="test-card">
        <div class="card-toolbar">
          <v-icon icon="mdi-calendar-clock" color="primary" size="22" />
          <strong>إرسال رسالة تذكير</strong>
        </div>
        <div class="form-body">
          <div class="form-field">
            <label class="form-label">رقم الهاتف</label>
            <input v-model="reminderForm.phoneNumber" class="form-input ltr" inputmode="numeric" placeholder="07701234567" dir="ltr" />
          </div>
          <div class="form-field">
            <label class="form-label">نص التذكير</label>
            <textarea v-model="reminderForm.message" class="form-textarea" maxlength="1000" rows="5" />
          </div>
          <v-btn color="primary" prepend-icon="mdi-message-arrow-right" :loading="sendingReminder" :disabled="!isReminderReady" @click="sendReminder">
            إرسال التذكير
          </v-btn>
        </div>
      </v-card>
    </div>

    <div class="details-layout">
      <v-card elevation="0" class="status-card">
        <div class="card-toolbar">
          <v-icon icon="mdi-format-list-checks" color="primary" size="22" />
          <strong>حالة appsettings</strong>
        </div>
        <div class="status-list">
          <div class="status-row"><span>Enabled</span><strong>{{ status?.enabled ? 'مفعل' : 'غير مفعل' }}</strong></div>
          <div class="status-row"><span>Provider</span><strong dir="ltr">{{ status?.provider || '-' }}</strong></div>
          <div class="status-row"><span>OtpProvider</span><strong dir="ltr">{{ status?.otpProvider || '-' }}</strong></div>
          <div class="status-row"><span>ReminderProvider</span><strong dir="ltr">{{ status?.reminderProvider || '-' }}</strong></div>
          <div class="status-row"><span>Hub Endpoint</span><strong>{{ status?.hasEndpoint ? 'موجود' : 'غير موجود' }}</strong></div>
          <div class="status-row"><span>Check Phone</span><strong>{{ status?.hasCheckPhoneEndpoint ? 'موجود' : 'غير موجود' }}</strong></div>
          <div class="status-row"><span>OtpiqToken</span><strong>{{ status?.hasOtpiqToken ? 'موجود' : 'غير موجود' }}</strong></div>
          <div class="status-row"><span>OtpiqSenderId</span><strong>{{ status?.hasOtpiqSenderId ? 'موجود' : 'مطلوب للتذكير المخصص' }}</strong></div>
          <div class="status-row"><span>Template</span><strong>{{ status?.hasTemplateName ? 'موجود' : 'اختياري/غير موجود' }}</strong></div>
          <div class="status-row"><span>WhatsApp IDs</span><strong>{{ status?.hasWhatsappAccountId || status?.hasWhatsappPhoneId ? 'موجودة' : 'اختيارية/غير موجودة' }}</strong></div>
        </div>
      </v-card>

      <v-card elevation="0" class="status-card">
        <div class="card-toolbar">
          <v-icon icon="mdi-code-json" color="primary" size="22" />
          <strong>مثال الإعدادات</strong>
        </div>
        <pre class="code-block" dir="ltr">{{ configSnippet }}</pre>
        <v-btn variant="outlined" color="primary" prepend-icon="mdi-content-copy" @click="copyConfig">
          نسخ
        </v-btn>
      </v-card>
    </div>

    <v-alert v-if="lastResult" type="success" variant="tonal" icon="mdi-check-circle">
      {{ lastResult }}
    </v-alert>
  </div>
</template>

<style scoped>
.otpiq-page { display: flex; flex-direction: column; gap: var(--spacing-lg); }
.page-top { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-lg); flex-wrap: wrap; }
.page-kicker { margin: 0 0 4px; font-size: 12px; font-weight: 700; color: var(--color-text-muted); }
.page-subtitle { margin: 0 0 6px; color: var(--color-text-muted); font-size: 13px; line-height: 1.6; }
.page-title { margin: 0; color: var(--color-text); font-size: 28px; font-weight: 800; }
.page-actions { display: flex; align-items: center; gap: var(--spacing-md); flex-wrap: wrap; }
.test-layout, .details-layout { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-lg); align-items: start; }
.test-card, .status-card { border: 1px solid var(--color-border) !important; border-radius: var(--radius-lg) !important; overflow: hidden; }
.card-toolbar { display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-lg); border-bottom: 1px solid var(--color-border); }
.card-toolbar strong { color: var(--color-text); }
.form-body { display: flex; flex-direction: column; gap: var(--spacing-lg); padding: var(--spacing-lg); }
.form-field { display: flex; flex-direction: column; gap: 8px; }
.form-label { color: var(--color-text); font-size: 13px; font-weight: 700; }
.form-input, .form-textarea { width: 100%; }
.form-textarea { min-height: 126px; }
.ltr { direction: ltr; text-align: left; }
.status-list { padding: var(--spacing-md) var(--spacing-lg); }
.status-row { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-md); padding: var(--spacing-md) 0; border-bottom: 1px solid var(--color-border-light); }
.status-row:last-child { border-bottom: 0; }
.status-row span { color: var(--color-text-muted); font-size: 13px; }
.status-row strong { color: var(--color-text); font-size: 13px; text-align: left; }
.code-block { max-width: 100%; max-height: 320px; overflow: auto; margin: var(--spacing-lg); padding: var(--spacing-lg); border-radius: var(--radius-md); background: #10231f; color: #a9e8d8; font-size: 12px; line-height: 1.7; text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; }
.status-card > .v-btn { margin: 0 var(--spacing-lg) var(--spacing-lg); }
@media (max-width: 900px) { .test-layout, .details-layout { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .page-actions, .page-actions .v-btn, .test-card .v-btn, .status-card > .v-btn { width: 100%; } .page-top { align-items: flex-start; } }
</style>
