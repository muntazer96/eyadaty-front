<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import QRCode from 'qrcode'
import api from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import { getErrorMessage } from '../utils/errors'
import type { ApiResponse } from '../types/api'

interface UserProfile {
  isTwoFactorAuthenticatorEnabled: boolean
  twoFactorEnabledAt?: string
}

interface SetupResult {
  secret: string
  otpAuthUri: string
}

interface VerifyResult {
  isEnabled: boolean
  enabledAt: string
  recoveryCodes: string[]
}

interface RecoveryCodesResult {
  recoveryCodes: string[]
}

const { success: showSuccess, error: showError } = useNotifications()

const loading = ref(false)
const setupLoading = ref(false)
const verifyLoading = ref(false)
const disableLoading = ref(false)
const regenerateLoading = ref(false)
const profile = ref<UserProfile>()
const setup = ref<SetupResult>()
const qrCodeUrl = ref('')
const verificationCode = ref('')
const proofPassword = ref('')
const proofCode = ref('')
const recoveryCodes = ref<string[]>([])

const isEnabled = computed(() => Boolean(profile.value?.isTwoFactorAuthenticatorEnabled))
const canVerify = computed(() => Boolean(setup.value && verificationCode.value.trim().length >= 6 && !verifyLoading.value))
const canStrongVerify = computed(() => Boolean((proofPassword.value.trim() || proofCode.value.trim()) && !disableLoading.value && !regenerateLoading.value))

function normalizeSecurityCodeInput(value: string) {
  return value
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06F0))
    .replace(/[\uFF10-\uFF19]/g, (digit) => String(digit.charCodeAt(0) - 0xFF10))
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .trim()
}

function formatDate(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ar-IQ')
}

async function loadProfile() {
  loading.value = true
  try {
    const response = await api.get<ApiResponse<UserProfile>>('/User/me')
    profile.value = response.data.data
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function startSetup() {
  setupLoading.value = true
  recoveryCodes.value = []
  try {
    const response = await api.post<ApiResponse<SetupResult>>('/User/2fa/authenticator/setup')
    setup.value = response.data.data
    qrCodeUrl.value = await QRCode.toDataURL(setup.value.otpAuthUri, { margin: 1, width: 240 })
    showSuccess('تم إنشاء مفتاح الربط. امسح رمز QR بتطبيق المصادقة.')
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    setupLoading.value = false
  }
}

async function verifySetup() {
  if (!canVerify.value) return
  verifyLoading.value = true
  try {
    const response = await api.post<ApiResponse<VerifyResult>>('/User/2fa/authenticator/verify', {
      code: normalizeSecurityCodeInput(verificationCode.value),
    })
    profile.value = {
      isTwoFactorAuthenticatorEnabled: response.data.data.isEnabled,
      twoFactorEnabledAt: response.data.data.enabledAt,
    }
    recoveryCodes.value = response.data.data.recoveryCodes
    setup.value = undefined
    qrCodeUrl.value = ''
    verificationCode.value = ''
    showSuccess('تم تفعيل المصادقة الثنائية.')
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    verifyLoading.value = false
  }
}

async function disableTwoFactor() {
  if (!canStrongVerify.value) return
  disableLoading.value = true
  try {
    await api.post('/User/2fa/authenticator/disable', {
      password: proofPassword.value.trim() || undefined,
      code: proofCode.value.trim() ? normalizeSecurityCodeInput(proofCode.value) : undefined,
    })
    proofPassword.value = ''
    proofCode.value = ''
    recoveryCodes.value = []
    await loadProfile()
    showSuccess('تم تعطيل المصادقة الثنائية.')
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    disableLoading.value = false
  }
}

async function regenerateRecoveryCodes() {
  if (!canStrongVerify.value) return
  regenerateLoading.value = true
  try {
    const response = await api.post<ApiResponse<RecoveryCodesResult>>('/User/2fa/recovery-codes/regenerate', {
      password: proofPassword.value.trim() || undefined,
      code: proofCode.value.trim() ? normalizeSecurityCodeInput(proofCode.value) : undefined,
    })
    recoveryCodes.value = response.data.data.recoveryCodes
    proofPassword.value = ''
    proofCode.value = ''
    showSuccess('تم توليد رموز استرداد جديدة.')
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    regenerateLoading.value = false
  }
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value)
  showSuccess('تم النسخ.')
}

onMounted(loadProfile)
</script>

<template>
  <div class="security-page">
    <div class="page-top">
      <div>
        <p class="page-kicker">أمان الحساب</p>
        <h1 class="page-title">المصادقة الثنائية</h1>
      </div>
      <v-btn variant="outlined" color="primary" prepend-icon="mdi-refresh" :loading="loading" @click="loadProfile">
        تحديث
      </v-btn>
    </div>

    <v-alert type="info" variant="tonal" icon="mdi-cellphone-key" density="comfortable">
      تعمل هذه الميزة مع أي تطبيق Authenticator يدعم TOTP مثل Microsoft Authenticator وAuthy و1Password وBitwarden وغيرها.
    </v-alert>

    <div class="status-panel">
      <div>
        <p class="status-label">الحالة الحالية</p>
        <h2>{{ isEnabled ? 'مفعلة' : 'غير مفعلة' }}</h2>
        <span v-if="isEnabled">تاريخ التفعيل: {{ formatDate(profile?.twoFactorEnabledAt) }}</span>
      </div>
      <v-chip :color="isEnabled ? 'success' : 'warning'" variant="tonal">
        <v-icon :icon="isEnabled ? 'mdi-shield-check' : 'mdi-shield-off'" size="16" start />
        {{ isEnabled ? 'الحساب محمي' : 'تحتاج تفعيل' }}
      </v-chip>
    </div>

    <div v-if="!isEnabled" class="tool-panel">
      <div class="panel-heading">
        <v-icon icon="mdi-qrcode-scan" color="primary" />
        <h3>ربط تطبيق المصادقة</h3>
      </div>

      <v-btn color="primary" prepend-icon="mdi-plus" :loading="setupLoading" @click="startSetup">
        بدء الربط
      </v-btn>

      <div v-if="setup" class="setup-grid">
        <div class="qr-box">
          <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="TOTP QR code" />
        </div>
        <div class="secret-box">
          <span>المفتاح اليدوي</span>
          <code>{{ setup.secret }}</code>
          <v-btn size="small" variant="outlined" prepend-icon="mdi-content-copy" @click="copyText(setup.secret)">
            نسخ المفتاح
          </v-btn>
        </div>
      </div>

      <div v-if="setup" class="verify-row">
        <v-text-field
          v-model="verificationCode"
          label="كود التحقق"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          variant="outlined"
          density="compact"
          hide-details
          dir="ltr"
        />
        <v-btn color="primary" prepend-icon="mdi-check" :loading="verifyLoading" :disabled="!canVerify" @click="verifySetup">
          تفعيل
        </v-btn>
      </div>
    </div>

    <div v-else class="tool-panel">
      <div class="panel-heading">
        <v-icon icon="mdi-shield-key" color="primary" />
        <h3>إدارة الحماية</h3>
      </div>

      <div class="proof-grid">
        <v-text-field v-model="proofPassword" label="كلمة المرور" type="password" variant="outlined" density="compact" />
        <v-text-field v-model="proofCode" label="كود 2FA أو recovery code" variant="outlined" density="compact" dir="ltr" />
      </div>

      <div class="actions-row">
        <v-btn color="primary" variant="outlined" prepend-icon="mdi-refresh" :loading="regenerateLoading" :disabled="!canStrongVerify" @click="regenerateRecoveryCodes">
          توليد رموز استرداد جديدة
        </v-btn>
        <v-btn color="error" variant="outlined" prepend-icon="mdi-shield-remove" :loading="disableLoading" :disabled="!canStrongVerify" @click="disableTwoFactor">
          تعطيل المصادقة الثنائية
        </v-btn>
      </div>
    </div>

    <div v-if="recoveryCodes.length" class="recovery-panel">
      <div class="panel-heading">
        <v-icon icon="mdi-key-chain" color="warning" />
        <h3>رموز الاسترداد</h3>
      </div>
      <v-alert type="warning" variant="tonal" density="compact">
        خزّن هذه الرموز الآن. لن تظهر مرة أخرى، وكل رمز يستخدم مرة واحدة فقط.
      </v-alert>
      <div class="codes-grid">
        <button v-for="code in recoveryCodes" :key="code" type="button" class="code-pill" @click="copyText(code)">
          {{ code }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.security-page { display: flex; flex-direction: column; gap: var(--spacing-lg); }
.page-top { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-lg); flex-wrap: wrap; }
.page-kicker { margin: 0 0 4px; font-size: 12px; font-weight: 700; color: var(--color-text-muted); }
.page-title { margin: 0; font-size: 28px; font-weight: 800; color: var(--color-text); }
.status-panel, .tool-panel, .recovery-panel {
  padding: var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.status-panel { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-lg); flex-wrap: wrap; }
.status-label { margin: 0 0 4px; color: var(--color-text-muted); font-weight: 700; font-size: 12px; }
.status-panel h2 { margin: 0 0 4px; color: var(--color-text); }
.status-panel span { color: var(--color-text-muted); font-size: 13px; }
.tool-panel, .recovery-panel { display: flex; flex-direction: column; gap: var(--spacing-lg); }
.panel-heading { display: flex; align-items: center; gap: var(--spacing-sm); }
.panel-heading h3 { margin: 0; font-size: 18px; color: var(--color-text); }
.setup-grid { display: grid; grid-template-columns: 260px 1fr; gap: var(--spacing-xl); align-items: center; }
.qr-box { display: flex; align-items: center; justify-content: center; min-height: 260px; border: 1px dashed var(--color-border); border-radius: var(--radius-md); background: white; }
.qr-box img { width: 240px; height: 240px; }
.secret-box { display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-sm); min-width: 0; }
.secret-box span { color: var(--color-text-muted); font-size: 13px; font-weight: 700; }
.secret-box code { max-width: 100%; overflow-wrap: anywhere; direction: ltr; padding: 10px 12px; border-radius: var(--radius-md); background: var(--color-background); color: var(--color-text); }
.verify-row { display: grid; grid-template-columns: minmax(240px, 360px) auto; align-items: start; gap: var(--spacing-md); }
.actions-row { display: flex; align-items: flex-start; gap: var(--spacing-md); flex-wrap: wrap; }
.verify-row .v-input { width: 100%; max-width: none; }
.verify-row .v-btn { min-height: 40px; align-self: start; }
.proof-grid { display: grid; grid-template-columns: repeat(2, minmax(220px, 1fr)); gap: var(--spacing-md); }
.codes-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--spacing-sm); }
.code-pill { padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: white; color: var(--color-text); font-family: monospace; cursor: pointer; direction: ltr; }
.code-pill:hover { border-color: var(--color-primary); color: var(--color-primary); }
@media (max-width: 760px) {
  .setup-grid, .proof-grid { grid-template-columns: 1fr; }
  .verify-row { grid-template-columns: 1fr; }
}
</style>
