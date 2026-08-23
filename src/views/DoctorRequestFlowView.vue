<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '../services/api'
import { checkPhone, sendOtp, verifyOtp, submitDoctorRequest } from '../services/doctorRequestService'
import { getErrorMessage } from '../utils/errors'
import type { ApiResponse, SpecializationItem, DoctorRequestResponse } from '../types/api'

interface ProvinceItem {
  id: number
  name: string
  normalizedName: string
}

const steps = ['التحقق من رقم الهاتف', 'رمز التحقق', 'معلومات التسجيل', 'تم الإرسال']
const currentStep = ref(0)
const loading = ref(false)
const errorMsg = ref('')

const phoneNumber = ref('')
const userId = ref<string | undefined>()
const otpCode = ref('')
const verificationTokenId = ref(0)
const fullName = ref('')
const knownName = ref('')
const email = ref('')
const doctorDescription = ref('')
const selectedProvince = ref<number | null>(null)
const birthDay = ref('')
const selectedSpecialization = ref<number | null>(null)
const identityFront = ref<File | null>(null)
const identityBack = ref<File | null>(null)
const doctorImage = ref<File | null>(null)
const clinicLicense = ref<File | null>(null)
const frontPreview = ref('')
const backPreview = ref('')
const doctorPreview = ref('')
const clinicLicenseName = ref('')
const licenseNumber = ref('')
const clinicName = ref('')
const clinicAddress = ref('')
const clinicPhoneNumber = ref('')
const clinicMapUrl = ref('')
const consultationPrice = ref<number | null>(null)
const showConsultationPrice = ref(false)
const acceptedTerms = ref(false)
const acceptedPrivacyPolicy = ref(false)
const requestResult = ref<DoctorRequestResponse | null>(null)
const pageTitle = 'تقديم طلب تسجيل في عيادتي'
const maxBirthDate = new Date().toISOString().slice(0, 10)

const provinces = ref<ProvinceItem[]>([])
const specializations = ref<SpecializationItem[]>([])
const availabilities = ref([
  { dayId: 1, name: 'السبت', enabled: false, startTime: '16:00', endTime: '21:00', maxAppointments: 20 },
  { dayId: 2, name: 'الأحد', enabled: false, startTime: '16:00', endTime: '21:00', maxAppointments: 20 },
  { dayId: 3, name: 'الاثنين', enabled: false, startTime: '16:00', endTime: '21:00', maxAppointments: 20 },
  { dayId: 4, name: 'الثلاثاء', enabled: false, startTime: '16:00', endTime: '21:00', maxAppointments: 20 },
  { dayId: 5, name: 'الأربعاء', enabled: false, startTime: '16:00', endTime: '21:00', maxAppointments: 20 },
  { dayId: 6, name: 'الخميس', enabled: false, startTime: '16:00', endTime: '21:00', maxAppointments: 20 },
  { dayId: 7, name: 'الجمعة', enabled: false, startTime: '16:00', endTime: '21:00', maxAppointments: 20 },
])
const socialLinks = ref([
  { type: 1, label: 'Instagram', value: '' },
  { type: 2, label: 'Facebook', value: '' },
  { type: 3, label: 'TikTok', value: '' },
  { type: 4, label: 'WhatsApp', value: '' },
  { type: 5, label: 'Website', value: '' },
])

const captchaFirstNumber = ref(0)
const captchaSecondNumber = ref(0)
const captchaAnswer = ref('')
const captchaNonce = ref('')
const captchaExpectedAnswer = computed(() => captchaFirstNumber.value + captchaSecondNumber.value)
const captchaVerified = computed(() =>
  captchaAnswer.value.trim() !== '' &&
  Number(captchaAnswer.value.trim()) === captchaExpectedAnswer.value
)

const isPhoneValid = computed(() => /^07\d{9}$/.test(phoneNumber.value) && captchaVerified.value)
const isOtpValid = computed(() => /^\d{6}$/.test(otpCode.value))
const isEmailValid = computed(() =>
  email.value.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())
)
const isFormValid = computed(() =>
  fullName.value.trim().length >= 3 &&
  knownName.value.trim().length >= 3 &&
  doctorDescription.value.trim().length >= 10 &&
  selectedProvince.value !== null &&
  birthDay.value !== '' && birthDay.value <= maxBirthDate &&
  isEmailValid.value &&
  selectedSpecialization.value !== null &&
  doctorImage.value !== null &&
  clinicLicense.value !== null &&
  clinicName.value.trim().length >= 3 &&
  /^07\d{9}$/.test(clinicPhoneNumber.value) &&
  clinicAddress.value.trim().length >= 5 &&
  availabilities.value.some(a => a.enabled) &&
  availabilities.value.filter(a => a.enabled).every(a => a.startTime && a.endTime && a.startTime < a.endTime && a.maxAppointments > 0 && a.maxAppointments <= 500) &&
  (consultationPrice.value === null || consultationPrice.value >= 0) &&
  acceptedTerms.value &&
  acceptedPrivacyPolicy.value
)

// --- إعادة إرسال الرمز مع عداد تنازلي ---
const resendCooldown = ref(0)
let resendTimer: ReturnType<typeof setInterval> | null = null

function startResendCooldown() {
  resendCooldown.value = 60
  if (resendTimer) clearInterval(resendTimer)
  resendTimer = setInterval(() => {
    resendCooldown.value--
    if (resendCooldown.value <= 0 && resendTimer) {
      clearInterval(resendTimer)
      resendTimer = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (resendTimer) clearInterval(resendTimer)
  ;[frontPreview.value, backPreview.value, doctorPreview.value]
    .filter(Boolean)
    .forEach(url => URL.revokeObjectURL(url))
})

onMounted(async () => {
  document.title = `${pageTitle} | عيادتي`
  try {
    const [pRes, sRes] = await Promise.all([
      api.get<ApiResponse<ProvinceItem[]>>('/IraqiProvince'),
      api.get<ApiResponse<SpecializationItem[]>>('/Specialization'),
    ])
    provinces.value = pRes.data.data ?? []
    specializations.value = sRes.data.data ?? []
  } catch { }

  resetCaptchaChallenge()
})

function getCaptchaNonce() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function resetCaptchaChallenge() {
  captchaFirstNumber.value = Math.floor(Math.random() * 8) + 2
  captchaSecondNumber.value = Math.floor(Math.random() * 8) + 2
  captchaAnswer.value = ''
  captchaNonce.value = getCaptchaNonce()
}

function getCaptchaToken(): string {
  return `math-challenge:${captchaNonce.value}:${captchaFirstNumber.value}:${captchaSecondNumber.value}:${captchaAnswer.value.trim()}`
}

async function handleCheckPhone() {
  if (!isPhoneValid.value || loading.value) return
  errorMsg.value = ''
  loading.value = true
  try {
    const token = getCaptchaToken()
    if (!captchaVerified.value) {
      errorMsg.value = 'يرجى حل التحقق السريع قبل المتابعة.'
      return
    }
    const res = await checkPhone(phoneNumber.value, token)
    userId.value = res.data!.userId
    currentStep.value = 1
    // إرسال رمز التحقق تلقائياً مرة واحدة فقط عند الدخول للخطوة
    await handleSendOtp()
  } catch (e) {
    errorMsg.value = getErrorMessage(e)
    resetCaptchaChallenge()
  } finally {
    loading.value = false
  }
}

async function handleSendOtp() {
  errorMsg.value = ''
  loading.value = true
  try {
    await sendOtp(userId.value, phoneNumber.value)
    startResendCooldown()
  } catch (e) {
    errorMsg.value = getErrorMessage(e)
  } finally {
    loading.value = false
  }
}

async function handleVerifyOtp() {
  if (!isOtpValid.value || loading.value) return
  errorMsg.value = ''
  loading.value = true
  try {
    const res = await verifyOtp(userId.value, phoneNumber.value, otpCode.value)
    verificationTokenId.value = res.data!.verificationTokenId
    currentStep.value = 2
  } catch (e) {
    errorMsg.value = getErrorMessage(e)
  } finally {
    loading.value = false
  }
}

function setImageFile(e: Event, target: typeof identityFront, preview: typeof frontPreview, label: string) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!/\.(jpe?g|png|webp)$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
    errorMsg.value = `${label} يجب أن تكون بصيغة JPG أو PNG أو WebP وبحجم لا يتجاوز 5 ميجابايت.`
    ;(e.target as HTMLInputElement).value = ''
    return
  }
  if (preview.value) URL.revokeObjectURL(preview.value)
  errorMsg.value = ''
  target.value = file
  preview.value = URL.createObjectURL(file)
}

function onFrontUpload(e: Event) {
  setImageFile(e, identityFront, frontPreview, 'صورة الوجه الأمامي للهوية')
}

function onBackUpload(e: Event) {
  setImageFile(e, identityBack, backPreview, 'صورة الوجه الخلفي للهوية')
}

function onDoctorImageUpload(e: Event) {
  setImageFile(e, doctorImage, doctorPreview, 'صورة الطبيب')
}

function onClinicLicenseUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    const isPdf = /\.pdf$/i.test(file.name)
    const isImage = /\.(jpe?g|png|webp)$/i.test(file.name)
    const maxSize = isPdf ? 10 : 5
    if ((!isPdf && !isImage) || file.size > maxSize * 1024 * 1024) {
      errorMsg.value = `إجازة فتح العيادة يجب أن تكون PDF أو صورة مدعومة وبحجم لا يتجاوز ${maxSize} ميجابايت.`
      ;(e.target as HTMLInputElement).value = ''
      return
    }
    errorMsg.value = ''
    clinicLicense.value = file
    clinicLicenseName.value = file.name
  }
}

async function handleSubmit() {
  if (!isFormValid.value || loading.value) return
  errorMsg.value = ''
  loading.value = true
  try {
    const fd = new FormData()
    fd.append('verificationTokenId', verificationTokenId.value.toString())
    fd.append('fullName', fullName.value.trim())
    fd.append('knownName', knownName.value.trim())
    if (email.value.trim()) fd.append('email', email.value.trim())
    fd.append('doctorDescription', doctorDescription.value.trim())
    fd.append('province', selectedProvince.value!.toString())
    fd.append('birthDay', birthDay.value)
    fd.append('specializationId', selectedSpecialization.value!.toString())
    if (identityFront.value) fd.append('identityFront', identityFront.value)
    if (identityBack.value) fd.append('identityBack', identityBack.value)
    fd.append('doctorImage', doctorImage.value!)
    fd.append('clinicLicense', clinicLicense.value!)
    if (licenseNumber.value.trim()) fd.append('licenseNumber', licenseNumber.value.trim())
    fd.append('clinicName', clinicName.value.trim())
    fd.append('clinicAddress', clinicAddress.value.trim())
    fd.append('clinicPhoneNumber', clinicPhoneNumber.value.trim())
    if (clinicMapUrl.value.trim()) fd.append('clinicMapUrl', clinicMapUrl.value.trim())
    if (consultationPrice.value !== null) fd.append('consultationPrice', consultationPrice.value.toString())
    fd.append('showConsultationPrice', showConsultationPrice.value.toString())
    availabilities.value.filter(item => item.enabled).forEach((item, index) => {
      fd.append(`availabilities[${index}].dayId`, item.dayId.toString())
      fd.append(`availabilities[${index}].startTime`, item.startTime)
      fd.append(`availabilities[${index}].endTime`, item.endTime)
      fd.append(`availabilities[${index}].maxAppointments`, item.maxAppointments.toString())
    })
    socialLinks.value
      .filter(item => item.value.trim())
      .forEach((item, index) => {
        fd.append(`externalLinks[${index}].type`, item.type.toString())
        fd.append(`externalLinks[${index}].value`, item.value.trim())
        fd.append(`externalLinks[${index}].displayName`, item.label)
      })
    fd.append('acceptedTerms', acceptedTerms.value.toString())
    fd.append('acceptedPrivacyPolicy', acceptedPrivacyPolicy.value.toString())
    const res = await submitDoctorRequest(fd)
    requestResult.value = res.data!
    currentStep.value = 3
  } catch (e) {
    errorMsg.value = getErrorMessage(e)
  } finally {
    loading.value = false
  }
}

function goBack() {
  if (currentStep.value > 0) {
    currentStep.value--
    errorMsg.value = ''
  }
}
</script>

<template>
  <main class="dr-page">
    <div class="dr-glow dr-glow-1"></div>
    <div class="dr-glow dr-glow-2"></div>

    <div class="dr-container">
      <div class="dr-card">
        <!-- Header band -->
        <div class="dr-header">
          <div class="dr-logo">
            <img src="/app-logo.png" alt="Eyadaty" class="dr-logo-img" />
          </div>
          <h1 class="dr-title">تقديم طلب تسجيل في عيادتي</h1>
          <p class="dr-subtitle">قم بتعبئة البيانات لغرض تسجيل عيادتك</p>
        </div>

        <div class="dr-body">
          <!-- Steps Indicator -->
          <div class="dr-stepper">
            <div class="dr-stepper-track">
              <div
                class="dr-stepper-fill"
                :style="{ width: `${(currentStep / (steps.length - 1)) * 100}%` }"
              ></div>
            </div>
            <div class="dr-steps">
              <div
                v-for="(step, i) in steps"
                :key="i"
                class="dr-step"
                :class="{
                  'dr-step--active': currentStep === i,
                  'dr-step--done': currentStep > i,
                }"
              >
                <div class="dr-step-num">
                  <v-icon v-if="currentStep > i" icon="mdi-check-circle" size="14" />
                  <span v-else>{{ i + 1 }}</span>
                </div>
                <span class="dr-step-label">{{ step }}</span>
              </div>
            </div>
          </div>

          <!-- Error -->
          <Transition name="dr-fade">
            <div v-if="errorMsg" class="dr-error" role="alert" aria-live="polite">
              <span class="dr-error-dot"></span>
              {{ errorMsg }}
            </div>
          </Transition>

          <!-- Step 0: Phone -->
          <Transition name="dr-fade" mode="out-in">
          <div v-if="currentStep === 0" class="dr-step-content" key="0">
            <div class="dr-field">
              <label class="dr-label">رقم الهاتف</label>
              <div class="dr-input-group">
                <v-icon icon="mdi-phone" size="18" class="dr-input-icon" />
                <input
                  v-model="phoneNumber"
                  iraqi-phone
                  type="tel"
                  class="dr-input"
                  placeholder="07XXXXXXXXX"
                  maxlength="11"
                  inputmode="numeric"
                  autocomplete="tel"
                  dir="ltr"
                />
              </div>
              <div class="dr-hint">أدخل رقم هاتف متاح على واتساب لاستلام رمز التحقق</div>
            </div>

            <div class="dr-captcha">
              <div class="dr-captcha-question">
                <span class="dr-captcha-box" :class="{ 'dr-captcha-box--valid': captchaVerified }">
                  <v-icon :icon="captchaVerified ? 'mdi-check-circle' : 'mdi-shield-check'" size="14" />
                </span>
                <span class="dr-captcha-label">
                  تحقق سريع: كم ناتج {{ captchaFirstNumber }} + {{ captchaSecondNumber }}؟
                </span>
              </div>
              <input
                v-model="captchaAnswer"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                class="dr-input dr-captcha-answer"
                placeholder="اكتب الناتج"
                @keyup.enter="handleCheckPhone"
              />
            </div>

            <button
              class="dr-btn dr-btn-primary dr-btn-block"
              :disabled="!isPhoneValid || loading"
              @click="handleCheckPhone"
            >
              <span v-if="loading" class="dr-spinner"></span>
              <template v-if="loading">جاري التحقق...</template>
              <template v-else>
                تحقق من الرقم
                <v-icon icon="mdi-arrow-left" size="18" />
              </template>
            </button>
          </div>

          <!-- Step 1: OTP -->
          <div v-else-if="currentStep === 1" class="dr-step-content" key="1">
            <div class="dr-field">
              <label class="dr-label">رمز التحقق</label>
              <div class="dr-input-group">
                <v-icon icon="mdi-shield-check" size="18" class="dr-input-icon" />
                <input
                  v-model="otpCode"
                  type="text"
                  class="dr-input dr-otp"
                  placeholder="000000"
                  maxlength="6"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  autocomplete="one-time-code"
                  dir="ltr"
                  @keyup.enter="handleVerifyOtp"
                />
              </div>
              <div class="dr-hint">
                تم إرسال رمز التحقق إلى <strong class="dr-hint-strong">{{ phoneNumber }}</strong> عبر واتساب
              </div>

              <!-- إعادة إرسال الرمز -->
              <div class="dr-resend">
                <button
                  v-if="resendCooldown === 0"
                  type="button"
                  class="dr-resend-btn"
                  :disabled="loading"
                  @click="handleSendOtp"
                >
                  <v-icon icon="mdi-refresh" size="15" />
                  إعادة إرسال الرمز
                </button>
                <span v-else class="dr-resend-wait">
                  يمكنك إعادة الإرسال خلال {{ resendCooldown }} ثانية
                </span>
              </div>
            </div>
            <div class="dr-btn-row">
              <button class="dr-btn dr-btn-ghost" @click="goBack">
                <v-icon icon="mdi-arrow-right" size="18" /> رجوع
              </button>
              <button
                class="dr-btn dr-btn-primary"
                :disabled="!isOtpValid || loading"
                @click="handleVerifyOtp"
              >
                <span v-if="loading" class="dr-spinner"></span>
                <template v-if="loading">جاري التحقق...</template>
                <template v-else>
                  تحقق
                  <v-icon icon="mdi-arrow-left" size="18" />
                </template>
              </button>
            </div>
          </div>

          <!-- Step 2: Form -->
          <div v-else-if="currentStep === 2" class="dr-step-content" key="2">
            <div class="dr-form-grid">
              <div class="dr-field">
                <label class="dr-label">الاسم الكامل</label>
                <div class="dr-input-group">
                  <v-icon icon="mdi-account" size="18" class="dr-input-icon" />
                  <input v-model="fullName" type="text" class="dr-input" placeholder="الاسم الرباعي" autocomplete="name" />
                </div>
              </div>
              <div class="dr-field">
                <label class="dr-label">الاسم المعروف به</label>
                <div class="dr-input-group">
                  <v-icon icon="mdi-account" size="18" class="dr-input-icon" />
                  <input v-model="knownName" type="text" class="dr-input" placeholder="مثال: د. محمد" />
                </div>
              </div>
              <div class="dr-field">
                <label class="dr-label">المحافظة</label>
                <div class="dr-input-group">
                  <v-icon icon="mdi-map-marker" size="18" class="dr-input-icon" />
                  <v-autocomplete
                    v-model="selectedProvince"
                    :items="provinces.map(p => ({ value: p.id, label: p.name }))"
                    item-title="label"
                    item-value="value"
                    class="dr-input dr-select"
                    density="compact"
                    variant="plain"
                    hide-details
                    placeholder="اختر المحافظة"
                  />
                </div>
              </div>
              <div class="dr-field">
                <label class="dr-label">التخصص</label>
                <div class="dr-input-group">
                  <v-icon icon="mdi-stethoscope" size="18" class="dr-input-icon" />
                  <v-autocomplete
                    v-model="selectedSpecialization"
                    :items="specializations.map(s => ({ value: s.id, label: s.name }))"
                    item-title="label"
                    item-value="value"
                    class="dr-input dr-select"
                    density="compact"
                    variant="plain"
                    hide-details
                    placeholder="اختر التخصص"
                  />
                </div>
              </div>
              <div class="dr-field dr-field-full">
                <label class="dr-label">تاريخ الميلاد</label>
                <div class="dr-input-group">
                  <v-icon icon="mdi-cake-variant" size="18" class="dr-input-icon" />
                  <input v-model="birthDay" type="date" class="dr-input" :max="maxBirthDate" />
                </div>
              </div>

              <div class="dr-field">
                <label class="dr-label">البريد الإلكتروني <span class="dr-optional">اختياري</span></label>
                <div class="dr-input-group">
                  <v-icon icon="mdi-email" size="18" class="dr-input-icon" />
                  <input v-model="email" type="email" class="dr-input" placeholder="doctor@example.com" autocomplete="email" dir="ltr" />
                </div>
                <div v-if="!isEmailValid" class="dr-field-error">يرجى إدخال بريد إلكتروني صحيح</div>
              </div>

              <div class="dr-field">
                <label class="dr-label">رقم إجازة فتح العيادة <span class="dr-optional">اختياري</span></label>
                <div class="dr-input-group">
                  <v-icon icon="mdi-certificate" size="18" class="dr-input-icon" />
                  <input v-model="licenseNumber" type="text" class="dr-input" placeholder="رقم الإجازة" />
                </div>
              </div>

              <div class="dr-field dr-field-full">
                <label class="dr-label">نبذة الطبيب</label>
                <textarea
                  v-model="doctorDescription"
                  class="dr-input dr-textarea"
                  rows="3"
                  placeholder="اكتب نبذة مختصرة عن الخبرة والخدمات الطبية"
                ></textarea>
              </div>

              <div class="dr-field dr-field-full">
                <label class="dr-label">صورة الطبيب</label>
                <label class="dr-upload" :class="{ 'dr-upload--filled': doctorImage }">
                  <input type="file" accept="image/*" hidden @change="onDoctorImageUpload" />
                  <template v-if="!doctorPreview">
                    <v-icon icon="mdi-account-box" size="22" class="dr-upload-icon" />
                    <span class="dr-upload-text">اضغط لاختيار صورة الطبيب</span>
                  </template>
                  <div v-else class="dr-upload-filled">
                    <img :src="doctorPreview" class="dr-preview" />
                    <span class="dr-upload-filename">
                      <v-icon icon="mdi-image" size="14" /> {{ doctorImage?.name }}
                    </span>
                  </div>
                </label>
              </div>

              <div class="dr-field dr-field-full">
                <label class="dr-label">إجازة فتح العيادة</label>
                <label class="dr-upload" :class="{ 'dr-upload--filled': clinicLicense }">
                  <input type="file" accept="image/*,.pdf" hidden @change="onClinicLicenseUpload" />
                  <v-icon icon="mdi-file-certificate" size="22" class="dr-upload-icon" />
                  <span class="dr-upload-text">{{ clinicLicenseName || 'اضغط لاختيار ملف الإجازة PDF أو صورة' }}</span>
                </label>
              </div>

              <div class="dr-field">
                <label class="dr-label">اسم العيادة</label>
                <div class="dr-input-group">
                  <v-icon icon="mdi-hospital-building" size="18" class="dr-input-icon" />
                  <input v-model="clinicName" type="text" class="dr-input" placeholder="اسم العيادة" />
                </div>
              </div>

              <div class="dr-field">
                <label class="dr-label">رقم هاتف الحجز</label>
                <div class="dr-input-group">
                  <v-icon icon="mdi-phone" size="18" class="dr-input-icon" />
                  <input v-model="clinicPhoneNumber" iraqi-phone type="tel" class="dr-input" placeholder="07XXXXXXXXX" maxlength="11" inputmode="numeric" autocomplete="tel" dir="ltr" />
                </div>
              </div>

              <div class="dr-field dr-field-full">
                <label class="dr-label">عنوان العيادة</label>
                <div class="dr-input-group">
                  <v-icon icon="mdi-map-marker" size="18" class="dr-input-icon" />
                  <input v-model="clinicAddress" type="text" class="dr-input" placeholder="المحافظة، المنطقة، أقرب نقطة دالة" />
                </div>
              </div>

              <div class="dr-field dr-field-full">
                <label class="dr-label">رابط الخريطة <span class="dr-optional">اختياري</span></label>
                <div class="dr-input-group">
                  <v-icon icon="mdi-map" size="18" class="dr-input-icon" />
                  <input v-model="clinicMapUrl" type="url" class="dr-input" placeholder="Google Maps link" dir="ltr" />
                </div>
              </div>

              <div class="dr-field">
                <label class="dr-label">سعر الكشف <span class="dr-optional">اختياري</span></label>
                <div class="dr-input-group">
                  <v-icon icon="mdi-cash" size="18" class="dr-input-icon" />
                  <input v-model.number="consultationPrice" type="number" min="0" inputmode="decimal" class="dr-input" placeholder="مثال: 25000" />
                </div>
              </div>

              <div class="dr-field dr-checkbox-field">
                <v-checkbox
                  v-model="showConsultationPrice"
                  label="إظهار سعر الكشف للمرضى"
                  density="compact"
                  hide-details
                />
              </div>

              <div class="dr-field dr-field-full">
                <label class="dr-label">صورة الهوية (الوجه الأمامي) <span class="dr-optional">اختياري</span></label>
                <label class="dr-upload" :class="{ 'dr-upload--filled': identityFront }">
                  <input type="file" accept="image/*" hidden @change="onFrontUpload" />
                  <template v-if="!frontPreview">
                    <v-icon icon="mdi-cloud-upload" size="22" class="dr-upload-icon" />
                    <span class="dr-upload-text">اضغط لاختيار صورة الهوية (الوجه الأمامي)</span>
                  </template>
                  <div v-else class="dr-upload-filled">
                    <img :src="frontPreview" class="dr-preview" />
                    <span class="dr-upload-filename">
                      <v-icon icon="mdi-card-account-details" size="14" /> {{ identityFront?.name }}
                    </span>
                  </div>
                </label>
              </div>

              <div class="dr-field dr-field-full">
                <label class="dr-label">صورة الهوية (الوجه الخلفي) <span class="dr-optional">اختياري</span></label>
                <label class="dr-upload" :class="{ 'dr-upload--filled': identityBack }">
                  <input type="file" accept="image/*" hidden @change="onBackUpload" />
                  <template v-if="!backPreview">
                    <v-icon icon="mdi-image" size="22" class="dr-upload-icon" />
                    <span class="dr-upload-text">اضغط لاختيار صورة الهوية (الوجه الخلفي)</span>
                  </template>
                  <div v-else class="dr-upload-filled">
                    <img :src="backPreview" class="dr-preview" />
                    <span class="dr-upload-filename">
                      <v-icon icon="mdi-card-account-details" size="14" /> {{ identityBack?.name }}
                    </span>
                  </div>
                </label>
              </div>

              <div class="dr-field dr-field-full">
                <div class="dr-section-header">
                  <label class="dr-label">أوقات الدوام</label>
                </div>
                <div class="dr-hours-list">
                  <div v-for="item in availabilities" :key="item.dayId" class="dr-hours-row" :class="{ 'dr-hours-row--off': !item.enabled }">
                    <label class="dr-day-toggle">
                      <input v-model="item.enabled" type="checkbox" />
                      <span>{{ item.name }}</span>
                    </label>
                    <label class="dr-hours-control"><span>من</span><input v-model="item.startTime" type="time" class="dr-input dr-hours-time" :disabled="!item.enabled" /></label>
                    <label class="dr-hours-control"><span>إلى</span><input v-model="item.endTime" type="time" class="dr-input dr-hours-time" :disabled="!item.enabled" /></label>
                    <label class="dr-hours-control"><span>الحجوزات</span><input v-model.number="item.maxAppointments" type="number" min="1" max="500" inputmode="numeric" class="dr-input dr-hours-count" :disabled="!item.enabled" /></label>
                  </div>
                </div>
              </div>

              <div class="dr-field dr-field-full">
                <label class="dr-label">روابط السوشل ميديا <span class="dr-optional">اختياري</span></label>
                <div class="dr-social-grid">
                  <div v-for="link in socialLinks" :key="link.type" class="dr-input-group">
                    <v-icon icon="mdi-link-variant" size="18" class="dr-input-icon" />
                    <input v-model="link.value" type="url" class="dr-input" :placeholder="link.label" dir="ltr" />
                  </div>
                </div>
              </div>

              <div class="dr-field dr-field-full dr-terms">
                <v-checkbox
                  v-model="acceptedTerms"
                  density="compact"
                  hide-details
                  label="أوافق على الشروط والأحكام الخاصة بتسجيل الأطباء"
                />
                <v-checkbox
                  v-model="acceptedPrivacyPolicy"
                  density="compact"
                  hide-details
                  label="أوافق على سياسة الخصوصية ومعالجة البيانات والملفات المرفوعة"
                />
              </div>
            </div>

            <div class="dr-btn-row">
              <button class="dr-btn dr-btn-ghost" @click="goBack">
                <v-icon icon="mdi-arrow-right" size="18" /> رجوع
              </button>
              <button
                class="dr-btn dr-btn-primary"
                :disabled="!isFormValid || loading"
                @click="handleSubmit"
              >
                <span v-if="loading" class="dr-spinner"></span>
                <template v-if="loading">جاري الإرسال...</template>
                <template v-else>
                  إرسال الطلب
                  <v-icon icon="mdi-arrow-left" size="18" />
                </template>
              </button>
            </div>
          </div>

          <!-- Step 3: Success -->
          <div v-else-if="currentStep === 3 && requestResult" class="dr-step-content dr-success" key="3">
            <div class="dr-success-icon">
              <v-icon icon="mdi-check-circle" size="44" />
            </div>
            <h2 class="dr-success-title">تم إرسال الطلب بنجاح</h2>
            <p class="dr-success-code">
              كود متابعة الطلب
              <strong>{{ requestResult.code }}</strong>
            </p>
            <div class="dr-success-info">
              <p>يمكنك متابعة حالة الطلب باستخدام الكود أعلاه</p>
              <p>سيتم مراجعة طلبك من قبل الإدارة والتواصل معك عبر واتساب</p>
            </div>
            <div class="dr-btn-row dr-btn-row-center">
              <RouterLink to="/doctor-request/status" class="dr-btn dr-btn-outline">
                متابعة حالة الطلب
              </RouterLink>
              <RouterLink to="/download" class="dr-btn dr-btn-primary">
                العودة للصفحة الرئيسية
              </RouterLink>
            </div>
          </div>
          </Transition>
        </div>
      </div>

      <div class="dr-footer-link">
        <RouterLink to="/download">تحميل التطبيق</RouterLink>
        <span class="dr-footer-sep">|</span>
        لديك طلب موجود؟
        <RouterLink to="/doctor-request/status">متابعة حالة الطلب</RouterLink>
      </div>
    </div>
  </main>
</template>

<style scoped>
.dr-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: linear-gradient(160deg, #f4faf8 0%, #eaf7f2 45%, #e0f3ec 100%);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 16px;
}

.dr-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
  pointer-events: none;
  z-index: 0;
}

.dr-glow-1 {
  width: 420px;
  height: 420px;
  top: -160px;
  right: -120px;
  background: var(--color-primary);
}

.dr-glow-2 {
  width: 360px;
  height: 360px;
  bottom: -140px;
  left: -100px;
  background: #5ad1b3;
}

.dr-container {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 580px;
  min-width: 0;
}

.dr-card {
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 28px;
  box-shadow: 0 20px 60px -12px rgba(15, 80, 65, 0.18), 0 4px 16px rgba(15, 80, 65, 0.08);
  overflow: hidden;
  animation: fadeInUp 0.5s ease both;
}

/* Header band */
.dr-header {
  position: relative;
  text-align: center;
  padding: 36px 32px 28px;
  background: linear-gradient(135deg, var(--color-primary) 0%, #15a589 100%);
  color: #fff;
  overflow: hidden;
}

.dr-header::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15) 0, transparent 40%),
                     radial-gradient(circle at 85% 75%, rgba(255,255,255,0.12) 0, transparent 45%);
}

.dr-logo {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.35);
  color: #fff;
  margin-bottom: 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}

.dr-logo-img {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  object-fit: contain;
  background: #ffffff;
}

.dr-title {
  position: relative;
  margin: 0 0 6px;
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.2px;
}

.dr-subtitle {
  position: relative;
  margin: 0;
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.6;
}

.dr-body {
  padding: 28px 32px 32px;
}

/* Stepper */
.dr-stepper {
  margin-bottom: 28px;
}

.dr-stepper-track {
  position: relative;
  height: 4px;
  background: var(--color-border);
  border-radius: 999px;
  margin-bottom: 16px;
  overflow: hidden;
}

.dr-stepper-fill {
  position: absolute;
  inset-block: 0;
  right: 0;
  background: linear-gradient(90deg, var(--color-primary), #15a589);
  border-radius: 999px;
  transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

.dr-steps {
  display: flex;
  justify-content: space-between;
  gap: 4px;
}

.dr-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-muted);
  flex: 1;
  min-width: 0;
  text-align: center;
}

.dr-step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  color: var(--color-text-muted);
  font-weight: 700;
  font-size: 11.5px;
  flex-shrink: 0;
  transition: all 0.25s ease;
}

.dr-step--active .dr-step-num {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
  box-shadow: 0 0 0 4px var(--color-primary-soft);
}

.dr-step--active .dr-step-label {
  color: var(--color-primary);
  font-weight: 700;
}

.dr-step--done .dr-step-num {
  background: #16a34a;
  border-color: #16a34a;
  color: #fff;
}

.dr-step--done .dr-step-label {
  color: #16a34a;
}

.dr-step-label {
  display: none;
  line-height: 1.3;
}

@media (min-width: 480px) {
  .dr-step-label {
    display: inline;
  }
}

/* Error */
.dr-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  border-radius: 14px;
  font-size: 13.5px;
  margin-bottom: 20px;
  overflow-wrap: anywhere;
}

.dr-error-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #dc2626;
  flex-shrink: 0;
}

/* Content */
.dr-step-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dr-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 4px;
}

.dr-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.dr-field-error {
  color: #dc2626;
  font-size: 12px;
}

.dr-field-full {
  grid-column: 1 / -1;
}

.dr-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
}

.dr-optional {
  font-weight: 500;
  color: var(--color-text-muted);
  font-size: 12px;
}

.dr-input-group {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}

.dr-input-icon {
  position: absolute;
  right: 13px;
  color: var(--color-primary);
  opacity: 0.7;
  pointer-events: none;
}

.dr-input,
.dr-select {
  width: 100%;
  padding: 12px 42px 12px 14px;
  border: 1.5px solid var(--color-border);
  border-radius: 13px;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-family-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.dr-input:hover,
.dr-select:hover {
  border-color: #b9ded4;
}

.dr-input:focus,
.dr-select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px var(--color-primary-soft);
  background: #fff;
}

.dr-otp {
  letter-spacing: 8px;
  font-weight: 700;
  font-size: 18px;
  text-align: center;
  padding-inline: 14px;
}

.dr-select {
  appearance: auto;
  cursor: pointer;
}

.dr-textarea {
  min-height: 96px;
  resize: vertical;
  line-height: 1.7;
}

.dr-hint {
  font-size: 12.5px;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.dr-hint-strong {
  color: var(--color-primary);
  direction: ltr;
  display: inline-block;
}

/* Resend OTP */
.dr-resend {
  margin-top: 4px;
}

.dr-resend-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  color: var(--color-primary);
  font-weight: 700;
  font-size: 12.5px;
  cursor: pointer;
}

.dr-resend-btn:hover:not(:disabled) {
  text-decoration: underline;
}

.dr-resend-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dr-resend-wait {
  font-size: 12.5px;
  color: var(--color-text-muted);
}

/* Captcha */
.dr-captcha {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  margin: 6px 0 4px;
  background: #fafafa;
  border: 1.5px solid var(--color-border);
  border-radius: 14px;
  transition: border-color 0.2s, background 0.2s;
}

.dr-captcha:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.dr-captcha-question {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.dr-captcha-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 2px solid var(--color-border);
  border-radius: 6px;
  background: #fff;
  color: var(--color-primary);
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.dr-captcha-box--valid {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.dr-captcha-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.dr-captcha-answer {
  width: 120px;
  min-height: 38px;
  padding-block: 8px;
  text-align: center;
  direction: ltr;
}

/* Upload */
.dr-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 22px 16px;
  border: 2px dashed var(--color-border);
  border-radius: 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-muted);
  background: #fafdfc;
  transition: border-color 0.2s, background 0.2s;
  text-align: center;
}

.dr-upload:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.dr-upload--filled {
  padding: 12px;
  border-style: solid;
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.dr-upload-icon {
  color: var(--color-primary);
}

.dr-upload-text {
  line-height: 1.5;
}

.dr-upload-filled {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.dr-upload-filename {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-primary-dark);
  overflow-wrap: anywhere;
}

.dr-preview {
  width: 100%;
  max-height: 150px;
  object-fit: contain;
  border-radius: 10px;
  background: #fff;
  border: 1px solid var(--color-border);
}

.dr-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dr-mini-btn,
.dr-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--color-border);
  background: #fff;
  color: var(--color-primary);
  border-radius: 10px;
  font-family: var(--font-family-primary);
  font-weight: 700;
  cursor: pointer;
}

.dr-mini-btn {
  padding: 8px 12px;
  font-size: 12.5px;
}

.dr-icon-btn {
  width: 40px;
  height: 40px;
  color: #dc2626;
}

.dr-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dr-hours-list,
.dr-social-grid,
.dr-terms {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dr-hours-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) 105px 105px 92px;
  gap: 8px;
  align-items: center;
}

.dr-hours-control {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: 700;
}

.dr-hours-row--off {
  opacity: 0.72;
}

.dr-day-toggle {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 40px;
  padding: 0 12px;
  border: 1.5px solid var(--color-border);
  border-radius: 13px;
  background: #fff;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--color-text);
}

.dr-day-toggle input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.dr-hours-day,
.dr-hours-time,
.dr-hours-count {
  padding: 10px 12px;
}

.dr-checkbox-field {
  justify-content: end;
}

/* Buttons */
.dr-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px 26px;
  border: none;
  font-family: var(--font-family-primary);
  font-weight: 700;
  font-size: 14px;
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
  user-select: none;
  min-width: 0;
  text-align: center;
  line-height: 1.4;
}

.dr-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dr-btn-primary {
  background: linear-gradient(135deg, var(--color-primary), #15a589);
  color: #fff;
  box-shadow: 0 8px 20px -6px rgba(16, 159, 132, 0.55);
}

.dr-btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px -6px rgba(16, 159, 132, 0.65);
}

.dr-btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.dr-btn-outline {
  background: #fff;
  color: var(--color-text);
  border: 2px solid var(--color-border);
}

.dr-btn-outline:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.dr-btn-ghost {
  background: transparent;
  color: var(--color-text-muted);
}

.dr-btn-ghost:hover {
  color: var(--color-text);
}

.dr-btn-block {
  width: 100%;
  margin-top: 6px;
}

.dr-btn-row {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-top: 24px;
}

.dr-btn-row-center {
  justify-content: center;
  flex-wrap: wrap;
}

.dr-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* Success */
.dr-success {
  text-align: center;
  align-items: center;
}

.dr-success-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: #dcfce7;
  color: #16a34a;
  margin-bottom: 18px;
  animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.dr-success-title {
  margin: 0 0 10px;
  font-size: 21px;
  font-weight: 800;
  color: var(--color-text);
}

.dr-success-code {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  margin: 0 0 18px;
  padding: 10px 18px;
  background: var(--color-primary-soft);
  color: var(--color-primary-dark);
  border-radius: 12px;
}

.dr-success-code strong {
  font-size: 16px;
  font-weight: 800;
  direction: ltr;
  letter-spacing: 1px;
}

.dr-success-info {
  font-size: 13.5px;
  color: var(--color-text-muted);
  line-height: 1.8;
  margin-bottom: 22px;
}

.dr-success-info p {
  margin: 4px 0;
}

.dr-footer-link {
  text-align: center;
  margin-top: 22px;
  font-size: 13.5px;
  color: var(--color-text-muted);
}

.dr-footer-link a {
  color: var(--color-primary);
  font-weight: 700;
  text-decoration: none;
}

.dr-footer-link a:hover {
  text-decoration: underline;
}

.dr-footer-sep {
  color: var(--color-border);
  margin: 0 8px;
}

/* Transitions */
.dr-fade-enter-active,
.dr-fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.dr-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.dr-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pop {
  from { opacity: 0; transform: scale(0.6); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 600px) {
  .dr-page {
    min-height: 100dvh;
    padding: max(12px, env(safe-area-inset-top)) 10px max(20px, env(safe-area-inset-bottom));
  }
  .dr-card { border-radius: 22px; }
  .dr-header { padding: 24px 18px 20px; }
  .dr-logo { width: 52px; height: 52px; margin-bottom: 12px; }
  .dr-logo-img { width: 38px; height: 38px; }
  .dr-title { font-size: 19px; line-height: 1.45; }
  .dr-body { padding: 20px 16px 24px; }
  .dr-stepper { margin-bottom: 22px; }
  .dr-form-grid { grid-template-columns: 1fr; }
  .dr-input, .dr-select { min-height: 48px; font-size: 16px; }
  .dr-textarea { min-height: 112px; }
  .dr-upload { min-height: 92px; padding: 18px 12px; }
  .dr-btn { min-height: 48px; }
  .dr-captcha { flex-direction: column; align-items: stretch; }
  .dr-captcha-answer { width: 100%; }
  .dr-btn-row { flex-direction: column; }
  .dr-btn-row .dr-btn { width: 100%; min-height: 48px; }
  .dr-btn-row-center { flex-direction: row; }
  .dr-hours-row {
    grid-template-columns: 1fr 1fr;
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.7);
  }
  .dr-day-toggle {
    grid-column: 1 / -1;
  }
  .dr-hours-control:last-child { grid-column: 1 / -1; }
  .dr-checkbox-field { align-items: flex-start; }
}

@media (max-width: 380px) {
  .dr-page { padding: 14px 8px; }
  .dr-card { border-radius: 20px; }
  .dr-header { padding: 22px 16px 18px; }
  .dr-body { padding: 18px 14px 22px; }
  .dr-title { font-size: 18px; }
  .dr-subtitle { font-size: 12.5px; }
  .dr-steps { gap: 2px; }
  .dr-step-num {
    width: 24px;
    height: 24px;
    font-size: 10.5px;
  }
  .dr-btn,
  .dr-btn-row-center .dr-btn {
    width: 100%;
    padding-inline: 14px;
  }
  .dr-btn-row-center { flex-direction: column; }
  .dr-footer-link {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .dr-footer-sep { display: none; }
}
</style>
