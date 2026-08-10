<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import api from '../services/api'
import { getErrorMessage } from '../utils/errors'
import { provinces } from '../constants/provinces'

interface Specialty { id: number; name: string }
interface Clinic { id: number; name: string; iraqiProvinceName: string; address: string; bookingWindowDays?: number }
interface Doctor { id: number; name: string; specializationId: number; specializationName: string; imageName?: string; canBookOnline: boolean; averageRating?: number; reviewCount: number; clinics: Clinic[] }
interface Day { date: string; dayName: string; startTime?: string; endTime?: string; remainingAppointments: number; isAvailable: boolean; closureReason?: string }
interface BookingResult { appointmentId: number; code?: string; requiresOtp: boolean; queueNumber?: number }

const specialties = ref<Specialty[]>([])
const doctors = ref<Doctor[]>([])
const loadingDoctors = ref(false)
const loadingDays = ref(false)
const saving = ref(false)
const resending = ref(false)
const error = ref('')
const step = ref<'doctor' | 'details' | 'otp' | 'success'>('doctor')
const selectedDoctor = ref<Doctor>()
const selectedClinic = ref<Clinic>()
const selectedDay = ref<Day>()
const booking = ref<BookingResult>()
const resendSeconds = ref(0)
let resendTimer: number | undefined
const filters = reactive({ name: '', specialization: '', province: '' })
const form = reactive({ name: '', phone: '', notes: '', otp: '' })

const canContinue = computed(() => !!selectedDoctor.value && !!selectedClinic.value && !!selectedDay.value && form.name.trim().length > 2 && /^07\d{9}$/.test(form.phone))
const filteredDoctors = computed(() => doctors.value)
const specialtyOptions = computed(() => [{ value: '', label: 'كل الاختصاصات' }, ...specialties.value.map(item => ({ value: String(item.id), label: item.name }))])
const provinceOptions = computed(() => [{ value: '', label: 'كل المحافظات' }, ...provinces.map(item => ({ value: String(item.value), label: item.name }))])
const clinicOptions = computed(() => (selectedDoctor.value?.clinics ?? []).map(clinic => ({ title: `${clinic.name} — ${clinic.iraqiProvinceName}`, value: clinic })))
const maskedPhone = computed(() => form.phone.length > 4 ? `******${form.phone.slice(-4)}` : form.phone)

function payload<T>(response: any): T { return response.data?.data as T }
function imageFor(doctor: Doctor) {
  return doctor.imageName
    ? `${String(api.defaults.baseURL).replace(/\/api$/, '')}/api/Files/doctor-image/${encodeURIComponent(doctor.imageName)}`
    : ''
}
function time(value?: string) { return value ? value.slice(0, 5) : '' }
function dateLabel(value: string) { return new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`)) }
function onPhoneInput() {
  form.phone = form.phone
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\D/g, '')
    .slice(0, 11)
}

async function loadDoctors() {
  loadingDoctors.value = true; error.value = ''
  try {
    const params: Record<string, string | number> = { page: 1, pageSize: 100 }
    if (filters.name.trim()) params.name = filters.name.trim()
    if (filters.specialization) params.specialization = Number(filters.specialization)
    if (filters.province) params.iraqiProvince = Number(filters.province)
    const result = payload<{ items: Doctor[] }>(await api.get('/Doctor/public', { params }))
    doctors.value = result?.items ?? []
  } catch (e) { error.value = getErrorMessage(e) } finally { loadingDoctors.value = false }
}
async function loadSpecialties() {
  try { specialties.value = payload<Specialty[]>(await api.get('/Specialization')) ?? [] } catch { /* the doctor search remains usable */ }
}
async function chooseDoctor(doctor: Doctor) {
  selectedDoctor.value = doctor; selectedClinic.value = doctor.clinics[0]; selectedDay.value = undefined; step.value = 'details'
  await loadDays()
}
async function loadDays() {
  if (!selectedClinic.value) return
  loadingDays.value = true; error.value = ''
  try {
    const result = payload<Day[]>(await api.get(`/Appointment/queue-availability/${selectedClinic.value.id}`, { params: { days: selectedClinic.value.bookingWindowDays ?? 14 } }))
    const days = result ?? []
    selectedDay.value = days.find(day => day.isAvailable)
    ;(selectedClinic.value as any)._days = days
  } catch (e) { error.value = getErrorMessage(e) } finally { loadingDays.value = false }
}
const days = computed<Day[]>(() => (selectedClinic.value as any)?._days ?? [])
function backToDoctors() { step.value = 'doctor'; selectedDoctor.value = undefined; selectedClinic.value = undefined; selectedDay.value = undefined; error.value = '' }
async function createBooking() {
  if (!canContinue.value || !selectedDoctor.value || !selectedClinic.value || !selectedDay.value) return
  saving.value = true; error.value = ''
  try {
    booking.value = payload<BookingResult>(await api.post('/Appointment', { doctorId: selectedDoctor.value.id, clinicId: selectedClinic.value.id, appointmentDate: selectedDay.value.date, guestName: form.name.trim(), guestPhoneNumber: form.phone, notes: form.notes.trim() || undefined }))
    if (booking.value?.requiresOtp && booking.value.code) { step.value = 'otp'; startCooldown() } else step.value = 'success'
  } catch (e) { error.value = getErrorMessage(e) } finally { saving.value = false }
}
async function confirmOtp() {
  if (!booking.value?.code || form.otp.replace(/\D/g, '').length !== 6) return
  saving.value = true; error.value = ''
  try { await api.post('/Appointment/otp/confirm', { phoneNumber: form.phone, bookingCode: booking.value.code, otpCode: form.otp }); step.value = 'success' } catch (e) { error.value = getErrorMessage(e) } finally { saving.value = false }
}
function startCooldown() { window.clearInterval(resendTimer); resendSeconds.value = 60; resendTimer = window.setInterval(() => { if (resendSeconds.value <= 1) { window.clearInterval(resendTimer); resendSeconds.value = 0 } else resendSeconds.value-- }, 1000) }
async function resendOtp() { if (resending.value || resendSeconds.value || !booking.value?.code) return; resending.value = true; try { await api.post('/Appointment/otp/resend', { phoneNumber: form.phone, bookingCode: booking.value.code }); form.otp = ''; startCooldown() } catch (e) { error.value = getErrorMessage(e) } finally { resending.value = false } }
function startOver() { step.value = 'doctor'; selectedDoctor.value = undefined; selectedClinic.value = undefined; selectedDay.value = undefined; booking.value = undefined; form.name = ''; form.phone = ''; form.notes = ''; form.otp = ''; loadDoctors() }
watch(() => [filters.name, filters.specialization, filters.province], () => { window.clearTimeout((loadDoctors as any)._timer); (loadDoctors as any)._timer = window.setTimeout(loadDoctors, 300) })
onMounted(() => { loadSpecialties(); loadDoctors() })
</script>

<template>
  <main class="visitor-booking" dir="rtl">
    <header class="site-header"><div class="brand"><v-icon icon="mdi-heart-pulse" size="29" /><b>عيادتي</b></div><span>حجز موعدك الطبي بسهولة</span></header>
    <section class="hero"><p>حجز الزائر</p><h1>احجز موعدك مع الطبيب المناسب</h1><span>اختر الاختصاص والطبيب والموعد، ثم أكد رقم هاتفك لإتمام الحجز.</span></section>
    <div class="steps"><span :class="{ active: step === 'doctor' }">١. اختيار الطبيب</span><i></i><span :class="{ active: step === 'details' }">٢. بيانات الحجز</span><i></i><span :class="{ active: step === 'otp' }">٣. تأكيد الهاتف</span></div>
    <v-alert v-if="error" type="error" variant="tonal" closable class="alert" @click:close="error = ''">{{ error }}</v-alert>

    <section v-if="step === 'doctor'" class="content">
      <div class="filters">
        <div class="field"><label>ابحث عن طبيب</label><v-text-field v-model="filters.name" placeholder="اسم الطبيب" class="filter-select" density="compact" variant="outlined" hide-details clearable /></div>
        <div class="field"><label>الاختصاص</label><v-autocomplete v-model="filters.specialization" :items="specialtyOptions" item-title="label" item-value="value" class="filter-select" density="compact" variant="outlined" hide-details clearable /></div>
        <div class="field"><label>المحافظة</label><v-autocomplete v-model="filters.province" :items="provinceOptions" item-title="label" item-value="value" class="filter-select" density="compact" variant="outlined" hide-details clearable /></div>
      </div>
      <div v-if="loadingDoctors" class="state"><v-progress-circular indeterminate color="primary" /><span>جارٍ البحث عن الأطباء...</span></div>
      <div v-else-if="!filteredDoctors.length" class="state"><v-icon icon="mdi-doctor" size="44" /><span>لا يوجد أطباء مطابقون للفلاتر الحالية.</span></div>
      <div v-else class="doctor-grid"><article v-for="doctor in filteredDoctors" :key="doctor.id" class="doctor-card"><div class="doctor-head"><img v-if="imageFor(doctor)" :src="imageFor(doctor)" :alt="doctor.name" /><v-icon v-else icon="mdi-account-heart" size="42" /><div><h2>{{ doctor.name }}</h2><p>{{ doctor.specializationName }}</p><small v-if="doctor.averageRating">★ {{ doctor.averageRating.toFixed(1) }} ({{ doctor.reviewCount }})</small></div></div><div class="clinic"><v-icon icon="mdi-map-marker-outline" size="18" />{{ doctor.clinics[0]?.iraqiProvinceName || '—' }} · {{ doctor.clinics[0]?.name || 'لا توجد عيادة متاحة' }}</div><v-btn block color="primary" :class="{ 'booking-unavailable': !doctor.canBookOnline || !doctor.clinics.length }" :disabled="!doctor.canBookOnline || !doctor.clinics.length" @click="chooseDoctor(doctor)">{{ doctor.canBookOnline ? 'اختيار الطبيب' : 'الحجز الإلكتروني غير متاح' }}</v-btn></article></div>
    </section>

    <section v-else-if="step === 'details'" class="booking-layout content"><div class="booking-card"><button class="back" @click="backToDoctors"><v-icon icon="mdi-arrow-right" /> العودة للأطباء</button><h2>تفاصيل الحجز</h2><p class="muted">{{ selectedDoctor?.name }} · {{ selectedDoctor?.specializationName }}</p><div class="field"><label>العيادة</label><v-select v-model="selectedClinic" :items="clinicOptions" item-title="title" item-value="value" placeholder="اختر العيادة" class="filter-select" density="compact" variant="outlined" hide-details @update:model-value="loadDays" /></div><div class="field"><label>اختر اليوم المتاح</label><div v-if="loadingDays" class="mini-loading"><v-progress-circular indeterminate size="25" /></div><div v-else class="days"><button v-for="day in days" :key="day.date" :disabled="!day.isAvailable" :class="{ selected: selectedDay?.date === day.date }" @click="selectedDay = day"><b>{{ day.dayName }}</b><span>{{ dateLabel(day.date) }}</span><small v-if="day.isAvailable">{{ day.remainingAppointments }} موعد متاح</small><small v-else>{{ day.closureReason || 'غير متاح' }}</small></button></div></div></div><form class="booking-card" @submit.prevent="createBooking"><h2>بيانات المراجع</h2><div class="field"><label>الاسم الكامل</label><v-text-field v-model="form.name" placeholder="اكتب الاسم الثلاثي" class="filter-select" density="compact" variant="outlined" hide-details /></div><div class="field"><label>رقم الهاتف</label><v-text-field v-model="form.phone" type="tel" inputmode="numeric" maxlength="11" dir="ltr" placeholder="07XXXXXXXXX" class="filter-select" density="compact" variant="outlined" hide-details @update:model-value="onPhoneInput" /></div><div class="field"><label>ملاحظات للحجز <em>اختياري</em></label><v-textarea v-model="form.notes" rows="3" placeholder="أي ملاحظة تريد إضافتها" class="filter-select" density="compact" variant="outlined" hide-details /></div><div class="summary" v-if="selectedDay"><span>موعدك المختار</span><b>{{ selectedDay.dayName }}، {{ dateLabel(selectedDay.date) }} {{ time(selectedDay.startTime) ? ` · ${time(selectedDay.startTime)}` : '' }}</b></div><v-btn type="submit" block size="large" color="primary" :disabled="!canContinue" :loading="saving">متابعة وتأكيد الحجز</v-btn></form></section>

    <section v-else-if="step === 'otp'" class="otp-card content"><v-icon icon="mdi-message-text-lock-outline" size="58" color="primary" /><h2>أكد رقم هاتفك</h2><p>أرسلنا رمز تحقق من 6 أرقام إلى <b dir="ltr">{{ maskedPhone }}</b></p><input v-model="form.otp" class="otp-input" dir="ltr" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" @input="form.otp = form.otp.replace(/\D/g, '')" /><v-btn block size="large" color="primary" :loading="saving" :disabled="form.otp.length !== 6" @click="confirmOtp">تأكيد الرمز</v-btn><v-btn variant="text" :disabled="!!resendSeconds || resending" :loading="resending" @click="resendOtp">{{ resendSeconds ? `إعادة الإرسال بعد ${resendSeconds} ثانية` : 'إعادة إرسال الرمز' }}</v-btn></section>

    <section v-else class="success-card content"><v-icon icon="mdi-check-decagram" size="78" color="success" /><h2>تم تأكيد حجزك بنجاح</h2><p>ننتظرك في {{ selectedClinic?.name }} لدى {{ selectedDoctor?.name }}.</p><div class="code"><span>كود الحجز</span><b dir="ltr">{{ booking?.code || '—' }}</b><small v-if="booking?.queueNumber">رقم الدور: {{ booking.queueNumber }}</small></div><v-btn color="primary" size="large" @click="startOver">حجز موعد آخر</v-btn></section>
  </main>
</template>

<style scoped>
.visitor-booking{min-height:100vh;background:#f4f8f7;color:#173d37;font-family:var(--font-family-primary);padding-bottom:56px}.site-header{height:68px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 max(5vw,22px);border-bottom:1px solid #e1ece9;color:#69817c}.brand{display:flex;gap:9px;align-items:center;color:#087c68;font-size:22px}.hero{text-align:center;padding:46px 20px 34px;background:radial-gradient(circle at top,#d9f5ed,#f4f8f7 70%)}.hero p{color:#087c68;font-weight:800;margin:0 0 7px}.hero h1{font-size:clamp(27px,5vw,42px);margin:0 0 10px}.hero span,.muted{color:#6a817c}.steps{display:flex;align-items:center;justify-content:center;gap:12px;color:#94a9a4;font-weight:800;font-size:14px;margin:0 15px 28px}.steps span.active{color:#087c68}.steps i{height:1px;width:44px;background:#cbdcd8}.content{width:min(1100px,calc(100% - 32px));margin:auto}.alert{width:min(900px,calc(100% - 32px));margin:0 auto 20px}.filters{background:#fff;border:1px solid #dbe9e5;border-radius:20px;padding:18px;display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px;margin-bottom:24px;box-shadow:0 7px 22px rgba(15,69,59,.05)}.field{display:grid;gap:7px}.field label{font-weight:800;font-size:14px}.field em{font-style:normal;font-weight:400;color:#849892}input,select,textarea{width:100%;border:1px solid #d4e3df;border-radius:11px;background:#fff;padding:12px 13px;outline:none;font:inherit;color:inherit}input:focus,select:focus,textarea:focus{border-color:#087c68;box-shadow:0 0 0 3px #d9f1eb}.doctor-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:17px}.doctor-card,.booking-card,.otp-card,.success-card{background:#fff;border:1px solid #dbe9e5;border-radius:20px;padding:22px;box-shadow:0 8px 26px rgba(15,69,59,.06)}.doctor-card{display:grid;gap:17px}.doctor-head{display:flex;align-items:center;gap:13px}.doctor-head img{height:58px;width:58px;object-fit:cover;border-radius:50%;background:#eaf5f1}.doctor-head h2,.booking-card h2,.otp-card h2,.success-card h2{font-size:19px;margin:0}.doctor-head p{margin:4px 0;color:#087c68}.doctor-head small{color:#a87312}.clinic{display:flex;align-items:center;gap:5px;color:#6a817c;font-size:13px;min-height:22px}.state{min-height:220px;display:grid;place-content:center;justify-items:center;gap:12px;color:#6a817c}.booking-layout{display:grid;grid-template-columns:1.15fr .85fr;gap:18px}.booking-card{display:grid;align-content:start;gap:16px}.back{border:0;background:none;color:#087c68;font:inherit;font-weight:800;justify-self:start;cursor:pointer;display:flex;align-items:center;gap:5px}.days{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.days button{border:1px solid #d8e6e2;border-radius:12px;background:#fbfdfc;padding:11px 6px;cursor:pointer;display:grid;gap:4px;color:#35554f}.days button.selected{background:#087c68;color:#fff;border-color:#087c68}.days button:disabled{opacity:.55;cursor:not-allowed}.days small{font-size:11px}.mini-loading{padding:28px;text-align:center}.summary{padding:13px;border-radius:12px;background:#eef8f5;display:grid;gap:4px}.summary span{font-size:12px;color:#64817a}.otp-card,.success-card{max-width:500px;text-align:center;display:grid;justify-items:center;gap:16px;padding:36px;margin-top:20px}.otp-card p,.success-card p{color:#6a817c;margin:0}.otp-input{font-size:28px;letter-spacing:10px;text-align:center;max-width:310px}.code{background:#edf8f4;border-radius:14px;padding:16px 42px;display:grid;gap:5px}.code span,.code small{color:#67817b}.code b{font-size:27px;letter-spacing:2px}.success-card{margin-top:20px}@media(max-width:760px){.site-header span{display:none}.hero{padding-top:32px}.filters,.booking-layout{grid-template-columns:1fr}.doctor-grid{grid-template-columns:1fr}.days{grid-template-columns:repeat(2,1fr)}.steps{font-size:11px;gap:6px}.steps i{width:18px}.content{width:min(100% - 20px,1100px)}.otp-card,.success-card{padding:25px 18px}}
.booking-unavailable.v-btn--disabled{background:#e4e8e7!important;color:#8b9693!important;opacity:1}
.field :deep(input.v-field__input){width:auto!important;border:0!important;border-radius:0!important;background:transparent!important;padding:0!important;box-shadow:none!important}
.field :deep(textarea.v-field__input){width:auto!important;border:0!important;border-radius:0!important;background:transparent!important;padding:0!important;box-shadow:none!important}
</style>
