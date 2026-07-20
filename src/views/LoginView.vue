<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useNotifications } from '../composables/useNotifications'
import { requestBrowserNotificationPermission } from '../services/browserNotifications'
import TextInput from '../components/forms/Textinput.vue'
import CheckboxField from '../components/forms/Checkboxfield.vue'

const auth = useAuthStore()
const router = useRouter()
const { error: showError, success: showSuccess, warning: showWarning } = useNotifications()

const phoneNumber = ref('')
const password = ref('')
const rememberMe = ref(false)
const challengeId = ref('')
const approvalChallengeId = ref('')
const canUseTwoFactorFallback = ref(false)
const twoFactorCode = ref('')
let approvalPollTimer: ReturnType<typeof window.setInterval> | undefined

const isTwoFactorStep = computed(() => Boolean(challengeId.value))
const isApprovalStep = computed(() => Boolean(approvalChallengeId.value))
const canSubmit = computed(() => Boolean(phoneNumber.value.trim() && password.value && !auth.loading && !isTwoFactorStep.value && !isApprovalStep.value))
const canSubmitTwoFactor = computed(() => Boolean(challengeId.value && twoFactorCode.value.trim() && !auth.loading))

async function finishAuthenticatedLogin(notificationPermission: Promise<NotificationPermission | 'unsupported'>) {
  if (!auth.hasAnyRole(['SuperAdmin', 'DoctorUser'])) {
    auth.logout()
    showError('هذا الحساب لا يملك صلاحية الدخول إلى لوحة التحكم.')
    return
  }

  showSuccess('تم تسجيل الدخول بنجاح!')
  const permission = await notificationPermission
  if (permission === 'denied') {
    showWarning('المتصفح مانع إشعارات سطح المكتب. فعلها من إعدادات الموقع.')
  } else if (permission === 'unsupported') {
    showWarning('إشعارات المتصفح تحتاج HTTPS أو localhost.')
  }
  await router.push('/')
}

function stopApprovalPolling() {
  if (approvalPollTimer) {
    window.clearInterval(approvalPollTimer)
    approvalPollTimer = undefined
  }
}

function startApprovalPolling(notificationPermission: Promise<NotificationPermission | 'unsupported'>) {
  stopApprovalPolling()
  approvalPollTimer = window.setInterval(async () => {
    if (!approvalChallengeId.value) return
    try {
      const status = await auth.getLoginApprovalStatus(approvalChallengeId.value)
      if (status === 'Approved') {
        stopApprovalPolling()
        approvalChallengeId.value = ''
        await finishAuthenticatedLogin(notificationPermission)
      } else if (status === 'Rejected') {
        stopApprovalPolling()
        approvalChallengeId.value = ''
        showError('تم رفض طلب تسجيل الدخول من الجهاز النشط.')
      }
    } catch (error) {
      stopApprovalPolling()
      approvalChallengeId.value = ''
      showError(auth.error || 'تعذر متابعة طلب الموافقة أو انتهت صلاحيته.')
    }
  }, 2500)
}

async function submit() {
  if (!canSubmit.value) {
    showError('أدخل رقم الهاتف وكلمة المرور.')
    return
  }

  const notificationPermission = requestBrowserNotificationPermission()

  try {
    const loginResult = await auth.login(phoneNumber.value.trim(), password.value)
    if (loginResult.requiresLoginApproval) {
      approvalChallengeId.value = loginResult.challengeId ?? ''
      canUseTwoFactorFallback.value = loginResult.canUseTwoFactor === true
      twoFactorCode.value = ''
      showSuccess('تم التحقق من كلمة المرور. بانتظار موافقة جهازك النشط.')
      startApprovalPolling(notificationPermission)
      return
    }
    if (loginResult.requiresTwoFactor) {
      challengeId.value = loginResult.challengeId ?? ''
      twoFactorCode.value = ''
      showSuccess('تم التحقق من كلمة المرور. أدخل رمز المصادقة الثنائية.')
      return
    }

    await finishAuthenticatedLogin(notificationPermission)
  } catch (error) {
    showError(auth.error || 'فشل تسجيل الدخول. حاول مرة أخرى.')
  }
}

async function submitTwoFactor() {
  if (!canSubmitTwoFactor.value) {
    showError('أدخل رمز المصادقة الثنائية أو رمز الاسترداد.')
    return
  }

  const notificationPermission = requestBrowserNotificationPermission()

  try {
    await auth.completeTwoFactorLogin(challengeId.value, twoFactorCode.value.trim())
    challengeId.value = ''
    twoFactorCode.value = ''
    await finishAuthenticatedLogin(notificationPermission)
  } catch (error) {
    showError(auth.error || 'تعذر التحقق من رمز المصادقة الثنائية.')
  }
}

function backToPasswordStep() {
  stopApprovalPolling()
  challengeId.value = ''
  approvalChallengeId.value = ''
  canUseTwoFactorFallback.value = false
  twoFactorCode.value = ''
  auth.error = ''
}

function useTwoFactorFallback() {
  stopApprovalPolling()
  challengeId.value = approvalChallengeId.value
  approvalChallengeId.value = ''
  twoFactorCode.value = ''
}

onBeforeUnmount(stopApprovalPolling)

const goToPasswordReset = (): void => {
  router.push('/password-reset')
}

const handleKeyPress = (event: KeyboardEvent): void => {
  if (event.key === 'Enter' && canSubmitTwoFactor.value) {
    submitTwoFactor()
  } else if (event.key === 'Enter' && canSubmit.value) {
    submit()
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-intro">
      <div class="intro-content">
        <div class="brand-intro">
          <v-icon icon="mdi-heart-pulse" size="40" class="brand-icon" />
          <h1 class="brand-title">عيادتي</h1>
          <p class="brand-subtitle">لوحة التحكم الطبية</p>
        </div>

        <div class="intro-description">
          <h2>إدارة عياداتك بوضوح</h2>
          <p>تابع الحجوزات اليومية، حدّث جداول الدوام، وأدر الاشتراكات والعيادات بسهولة من مكان واحد.</p>
        </div>

        <div class="intro-features">
          <div class="feature">
            <v-icon icon="mdi-shield-check" class="feature-icon" />
            <span>آمن وموثوق</span>
          </div>
          <div class="feature">
            <v-icon icon="mdi-lightning-bolt" class="feature-icon" />
            <span>سريع وفعّال</span>
          </div>
          <div class="feature">
            <v-icon icon="mdi-accessibility" class="feature-icon" />
            <span>سهل الاستخدام</span>
          </div>
        </div>

        <p class="intro-footer">© 2024 عيادتي - جميع الحقوق محفوظة</p>
      </div>
    </div>

    <div class="login-panel">
      <v-card class="login-card" elevation="0">
        <div class="mobile-brand">
          <v-icon icon="mdi-heart-pulse" size="28" class="brand-icon-mobile" />
          <h2>عيادتي</h2>
        </div>

        <div class="login-header">
          <span class="login-kicker">أهلاً بعودتك</span>
          <h2 class="login-title">تسجيل الدخول</h2>
          <p class="login-subtitle">أدخل بيانات حسابك للوصول إلى لوحة التحكم</p>
        </div>

        <v-alert
          v-if="auth.error"
          type="error"
          variant="outlined"
          closable
          class="login-alert"
          @update:model-value="auth.error = ''"
        >
          {{ auth.error }}
        </v-alert>

        <form class="login-form" @submit.prevent="submit" @keypress="handleKeyPress">
          <TextInput
            v-if="!isTwoFactorStep && !isApprovalStep"
            v-model="phoneNumber"
            label="رقم الهاتف أو اسم المستخدم"
            type="text"
            dir="rtl"
            inputmode="tel"
            autocomplete="username"
            icon="mdi-phone"
            placeholder="مثال: 0770XXXXXXX"
            :disabled="auth.loading"
            clearable
          />

          <TextInput
            v-if="!isTwoFactorStep && !isApprovalStep"
            v-model="password"
            label="كلمة المرور"
            type="password"
            dir="rtl"
            autocomplete="current-password"
            icon="mdi-lock"
            placeholder="أدخل كلمة المرور"
            :disabled="auth.loading"
            clearable
          />

          <div v-if="!isTwoFactorStep && !isApprovalStep" class="login-options">
            <CheckboxField
              v-model="rememberMe"
              label="تذكرني"
              :disabled="auth.loading"
            />
            <v-btn
              text
              size="small"
              color="primary"
              @click="goToPasswordReset"
              :disabled="auth.loading"
            >
              هل نسيت كلمة المرور؟
            </v-btn>
          </div>

          <v-alert v-if="isApprovalStep" type="info" variant="tonal" density="compact" icon="mdi-cellphone-check">
            تم إرسال طلب موافقة إلى جهازك النشط. وافق من الجهاز النشط أو استخدم رمز المصادقة الثنائية بدلاً من الموافقة.
          </v-alert>

          <div v-if="isApprovalStep" class="approval-waiting">
            <v-progress-circular indeterminate color="primary" size="34" width="3" />
            <span>بانتظار الموافقة...</span>
          </div>

          <v-alert v-if="isTwoFactorStep" type="info" variant="tonal" density="compact" icon="mdi-shield-key">
            أدخل رمز تطبيق المصادقة الثنائية المكوّن من 6 أرقام، أو أحد رموز الاسترداد.
          </v-alert>

          <TextInput
            v-if="isTwoFactorStep"
            v-model="twoFactorCode"
            label="رمز المصادقة الثنائية"
            type="text"
            dir="ltr"
            inputmode="text"
            autocomplete="one-time-code"
            icon="mdi-shield-key"
            placeholder="123456 أو رمز الاسترداد"
            :disabled="auth.loading"
            clearable
          />

          <v-btn
            v-if="!isTwoFactorStep && !isApprovalStep"
            type="submit"
            color="primary"
            size="large"
            block
            class="login-button"
            :loading="auth.loading"
            :disabled="!canSubmit"
          >
            {{ auth.loading ? 'جاري تسجيل الدخول...' : 'دخول إلى لوحة التحكم' }}
          </v-btn>

          <v-btn
            v-if="isTwoFactorStep"
            type="button"
            color="primary"
            size="large"
            block
            class="login-button"
            :loading="auth.loading"
            :disabled="!canSubmitTwoFactor"
            @click="submitTwoFactor"
          >
            تحقق وأكمل تسجيل الدخول
          </v-btn>

          <v-btn
            v-if="isApprovalStep && canUseTwoFactorFallback"
            type="button"
            color="primary"
            variant="outlined"
            block
            :disabled="auth.loading"
            @click="useTwoFactorFallback"
          >
            استخدام رمز المصادقة الثنائية بدلاً من الموافقة
          </v-btn>

          <v-btn
            v-if="isTwoFactorStep || isApprovalStep"
            type="button"
            variant="text"
            color="primary"
            :disabled="auth.loading"
            @click="backToPasswordStep"
          >
            الرجوع لتسجيل الدخول
          </v-btn>

          <p class="login-note">
            لوحة التحكم مخصصة لمدير النظام والطبيب المسجل فقط.
          </p>
        </form>

        <div class="login-footer">
          <p>برمجة وتطوير</p>
          <img src="../assets/godev_logo.png" alt="GoDev" class="godev-logo" />
        </div>
      </v-card>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  min-height: 100vh;
  background: var(--color-background);
}

/* Left Side - Branding */
.login-intro {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-3xl);
  background: linear-gradient(140deg, #0a5149, #13796b 58%, #42a799);
  color: white;
  position: relative;
  overflow: hidden;
}

.login-intro::before {
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

/* Right Side - Login Panel */
.login-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  background-color: var(--color-surface);
}

.login-card {
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

.login-header {
  padding: var(--spacing-xl);
  border-bottom: 1px solid var(--color-border);
}

.login-kicker {
  display: block;
  color: var(--color-primary);
  font-weight: 700;
  font-size: 12px;
  margin-bottom: var(--spacing-sm);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.login-title {
  margin: 0 0 var(--spacing-sm) 0;
  padding: 0;
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.2;
}

.login-subtitle {
  margin: 0;
  padding: 0;
  font-size: 14px;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.login-alert {
  margin: var(--spacing-lg);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding: var(--spacing-xl);
}

.login-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
  margin-top: calc(-1 * var(--spacing-md));
}

.login-button {
  margin-top: var(--spacing-md);
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
}

.approval-waiting {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  min-height: 64px;
  color: var(--color-text);
  font-weight: 700;
}

.login-note {
  margin: 0;
  padding: 0;
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: center;
  line-height: 1.5;
}

.login-footer {
  padding: var(--spacing-lg) var(--spacing-xl);
  border-top: 1px solid var(--color-border);
  background-color: var(--color-surface-variant);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.login-footer p {
  margin: 0;
  padding: 0;
  font-size: 10px;
  color: var(--color-text-muted);
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.godev-logo {
  width: 50px;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
}

/* Responsive */
@media (max-width: 1000px) {
  .login-intro {
    display: none;
  }

  .login-container {
    grid-template-columns: 1fr;
  }

  .login-panel {
    min-height: 100vh;
    padding: var(--spacing-lg);
  }

  .mobile-brand {
    display: flex;
  }

  .login-card {
    max-width: 100%;
  }
}

@media (max-width: 600px) {
  .login-panel {
    padding: var(--spacing-md);
  }

  .login-card {
    border: none;
    box-shadow: none;
  }

  .login-header {
    padding: var(--spacing-lg);
  }

  .login-form {
    padding: var(--spacing-lg);
  }

  .login-title {
    font-size: 22px;
  }

  .login-subtitle {
    font-size: 13px;
  }

  .mobile-brand {
    padding: var(--spacing-lg);
  }

  .mobile-brand h2 {
    font-size: 18px;
  }
}
</style>
