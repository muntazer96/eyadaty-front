<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { provinces } from '../constants/provinces'
import api from '../services/api'
import { useNotifications } from '../composables/useNotifications'
import type { ApiResponse, DayItem, DoctorCreateResult, SpecializationItem } from '../types/api'
import { getErrorMessage } from '../utils/errors'

interface ScheduleDay extends DayItem {
  enabled: boolean
  startTime: string
  endTime: string
  maxAppointments: number
}

const router = useRouter()
const { success: showSuccess, error: showError } = useNotifications()

const specializations = ref<SpecializationItem[]>([])
const days = ref<DayItem[]>([])
const scheduleDays = ref<ScheduleDay[]>([])
const saving = ref(false)
const imagePreview = ref('')
const fileInput = ref<HTMLInputElement>()
let localPreviewUrl = ''

const defaultProvinceValue = String(provinces[0]?.value ?? 0)
const form = reactive({
  name: '',
  normalizedName: '',
  specializationId: '',
  description: '',
  iraqiProvince: defaultProvinceValue,
  birthDay: '',
  phoneNumber: '',
  doctorLocation: '',
  imageName: undefined as File | undefined,
  clinicAddress: '',
  clinicMapUrl: '',
  clinicPhoneNumber: '',
})

const selectedScheduleCount = computed(() => scheduleDays.value.filter((day) => day.enabled).length)

async function loadSpecializations() {
  try {
    const r = await api.get<ApiResponse<SpecializationItem[]>>('/Specialization')
    specializations.value = r.data.data
  } catch (e) { showError(getErrorMessage(e)) }
}

async function loadDays() {
  try {
    const r = await api.get<ApiResponse<DayItem[]>>('/Day')
    days.value = r.data.data
    scheduleDays.value = days.value.map((day) => ({
      ...day,
      enabled: false,
      startTime: '09:00',
      endTime: '14:00',
      maxAppointments: 20,
    }))
  } catch (e) { showError(getErrorMessage(e)) }
}

function setImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    form.imageName = undefined
    clearImagePreview()
    showError('الصورة يجب أن تكون JPG أو PNG أو WEBP وبحجم لا يتجاوز 5MB.')
    input.value = ''
    return
  }
  clearImagePreview()
  form.imageName = file
  localPreviewUrl = URL.createObjectURL(file)
  imagePreview.value = localPreviewUrl
}

function clearImagePreview() {
  if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl)
  localPreviewUrl = ''
  imagePreview.value = ''
}

function validateForm() {
  if (!form.imageName) return 'صورة الطبيب مطلوبة.'
  if (!form.name.trim()) return 'اسم الطبيب مطلوب.'
  if (!form.normalizedName.trim()) return 'اسم البحث مطلوب.'
  if (!form.specializationId) return 'الاختصاص مطلوب.'
  if (!form.birthDay) return 'تاريخ الميلاد مطلوب.'
  if (!form.phoneNumber.trim()) return 'رقم الهاتف مطلوب.'
  if (!form.doctorLocation.trim()) return 'موقع الطبيب مطلوب.'
  if (!form.clinicAddress.trim()) return 'عنوان العيادة الافتراضية مطلوب.'
  if (!form.clinicMapUrl.trim()) return 'رابط موقع العيادة الافتراضية مطلوب.'
  if (!form.clinicPhoneNumber.trim()) return 'رقم هاتف العيادة أو الحجز مطلوب.'

  for (const day of scheduleDays.value.filter((item) => item.enabled)) {
    if (day.startTime >= day.endTime) return `وقت دوام ${day.name} غير صحيح.`
    if (!day.maxAppointments || day.maxAppointments < 1) return `عدد أدوار ${day.name} يجب أن يكون 1 أو أكثر.`
  }

  return ''
}

async function save() {
  const error = validateForm()
  if (error) { showError(error); return }

  saving.value = true
  try {
    const data = new FormData()
    data.append('Name', form.name)
    data.append('NormalizedName', form.normalizedName)
    data.append('SpecializationId', form.specializationId)
    data.append('Description', form.description)
    data.append('IraqiProvince', String(form.iraqiProvince))
    data.append('BirthDay', form.birthDay)
    data.append('PhoneNumber', form.phoneNumber)
    data.append('Location', form.doctorLocation)
    data.append('DefaultClinicLocation', form.clinicAddress)
    data.append('DefaultClinicMapUrl', form.clinicMapUrl)
    data.append('DefaultClinicPhoneNumber', form.clinicPhoneNumber)
    if (form.imageName) data.append('ImageName', form.imageName)

    scheduleDays.value
      .filter((day) => day.enabled)
      .forEach((day, index) => {
        data.append(`DefaultClinicAvailabilities[${index}].DayId`, String(day.id))
        data.append(`DefaultClinicAvailabilities[${index}].StartTime`, `${day.startTime}:00`)
        data.append(`DefaultClinicAvailabilities[${index}].EndTime`, `${day.endTime}:00`)
        data.append(`DefaultClinicAvailabilities[${index}].MaxAppointments`, String(day.maxAppointments))
      })

    const r = await api.post<ApiResponse<DoctorCreateResult>>('/Doctor/with-default-clinic', data)
    showSuccess(r.data.message)
    router.push('/doctors')
  } catch (e) { showError(getErrorMessage(e)) }
  finally { saving.value = false }
}

onMounted(() => Promise.all([loadSpecializations(), loadDays()]))
onBeforeUnmount(clearImagePreview)
</script>

<template>
  <div class="create-page">
    <div class="page-top">
      <div>
        <p class="page-kicker">إضافة تفصيلية</p>
        <h1 class="page-title">إضافة طبيب مع العيادة الافتراضية</h1>
      </div>
      <div class="page-actions">
        <v-btn variant="outlined" prepend-icon="mdi-arrow-right" @click="router.push('/doctors')">رجوع</v-btn>
      </div>
    </div>

    <section class="section-panel">
      <div class="section-head">
        <v-icon icon="mdi-stethoscope" color="primary" size="20" />
        <h2>بيانات الطبيب</h2>
      </div>
      <div class="form-grid">
        <div class="form-field">
          <label class="form-label">اسم الطبيب <span class="required">*</span></label>
          <input v-model="form.name" class="form-input" />
        </div>
        <div class="form-field">
          <label class="form-label">الاسم في البحث <span class="required">*</span></label>
          <input v-model="form.normalizedName" class="form-input" />
        </div>
        <div class="form-field">
          <label class="form-label">الاختصاص <span class="required">*</span></label>
          <v-autocomplete
            v-model="form.specializationId"
            :items="specializations.map((s) => ({ value: String(s.id), label: s.name }))"
            item-title="label"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
          />
        </div>
        <div class="form-field">
          <label class="form-label">المحافظة <span class="required">*</span></label>
          <v-autocomplete
            v-model="form.iraqiProvince"
            :items="provinces.map((p) => ({ value: String(p.value), label: p.name }))"
            item-title="label"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
          />
        </div>
        <div class="form-field">
          <label class="form-label">تاريخ الميلاد <span class="required">*</span></label>
          <input v-model="form.birthDay" type="date" class="form-input" />
        </div>
        <div class="form-field">
          <label class="form-label">رقم هاتف الطبيب <span class="required">*</span></label>
          <input v-model="form.phoneNumber" class="form-input" />
        </div>
        <div class="form-field form-field--full">
          <label class="form-label">موقع الطبيب <span class="required">*</span></label>
          <input v-model="form.doctorLocation" class="form-input" />
        </div>
        <div class="form-field form-field--full">
          <label class="form-label">الوصف</label>
          <textarea v-model="form.description" rows="4" class="form-textarea" />
        </div>
        <div class="form-field form-field--full">
          <label class="form-label">صورة الطبيب <span class="required">*</span></label>
          <div class="file-zone" @click="fileInput?.click()">
            <input ref="fileInput" type="file" accept=".jpg,.jpeg,.png,.webp" class="file-hidden" @change="setImage" />
            <v-icon :icon="form.imageName ? 'mdi-image-check' : 'mdi-image-plus'" :color="form.imageName ? 'success' : 'primary'" size="28" />
            <div>
              <strong>{{ form.imageName ? form.imageName.name : 'اضغط لاختيار صورة' }}</strong>
              <span>JPG أو PNG أو WEBP، بحد أقصى 5MB</span>
            </div>
          </div>
          <img v-if="imagePreview" :src="imagePreview" alt="معاينة" class="image-preview" />
        </div>
      </div>
    </section>

    <section class="section-panel">
      <div class="section-head">
        <v-icon icon="mdi-hospital-building" color="primary" size="20" />
        <h2>العيادة الافتراضية</h2>
      </div>
      <div class="form-grid">
        <div class="form-field form-field--full">
          <label class="form-label">رقم هاتف العيادة أو الحجز <span class="required">*</span></label>
          <input v-model="form.clinicPhoneNumber" class="form-input" />
        </div>
        <div class="form-field form-field--full">
          <label class="form-label">عنوان العيادة النصي <span class="required">*</span></label>
          <input v-model="form.clinicAddress" class="form-input" placeholder="مثلاً: بغداد - الحارثية - قرب ..." />
        </div>
        <div class="form-field form-field--full">
          <label class="form-label">رابط موقع العيادة <span class="required">*</span></label>
          <input v-model="form.clinicMapUrl" class="form-input ltr-input" placeholder="https://maps.google.com/..." />
        </div>
      </div>
    </section>

    <section class="section-panel">
      <div class="section-head">
        <v-icon icon="mdi-calendar-clock" color="primary" size="20" />
        <h2>أيام دوام العيادة</h2>
        <v-chip size="small" variant="tonal" color="primary">{{ selectedScheduleCount }} يوم محدد</v-chip>
      </div>
      <v-alert type="info" variant="tonal" class="mb-4" icon="mdi-information">
        اختيار أيام الدوام اختياري. يمكن تركها فارغة وإضافتها لاحقاً من صفحة العيادات.
      </v-alert>

      <div class="schedule-list">
        <div
          v-for="day in scheduleDays"
          :key="day.id"
          class="schedule-row"
          :class="{ 'schedule-row--disabled': !day.enabled }"
        >
          <label class="day-toggle">
            <input v-model="day.enabled" type="checkbox" class="check-native" />
            <span class="check-box"><v-icon v-if="day.enabled" icon="mdi-check" size="12" color="white" /></span>
            <strong class="day-name">{{ day.name }}</strong>
          </label>
          <div class="schedule-fields">
            <div class="schedule-field">
              <label class="schedule-label">من</label>
              <input v-model="day.startTime" type="time" class="time-input" :disabled="!day.enabled" />
            </div>
            <div class="schedule-field">
              <label class="schedule-label">إلى</label>
              <input v-model="day.endTime" type="time" class="time-input" :disabled="!day.enabled" />
            </div>
            <div class="schedule-field">
              <label class="schedule-label">الأدوار</label>
              <input v-model.number="day.maxAppointments" type="number" min="1" class="number-input" :disabled="!day.enabled" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="bottom-actions">
      <!-- <v-btn variant="outlined" prepend-icon="mdi-arrow-right" @click="router.push('/doctors')">رجوع</v-btn> -->
      <v-btn color="primary" prepend-icon="mdi-content-save" :loading="saving" @click="save">حفظ</v-btn>
    </div>
  </div>
</template>

<style scoped>
.create-page { display: flex; flex-direction: column; gap: var(--spacing-lg); }
.page-top { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-lg); flex-wrap: wrap; }
.page-kicker { margin: 0 0 4px; font-size: 12px; font-weight: 700; color: var(--color-text-muted); }
.page-title { margin: 0; font-size: 26px; font-weight: 800; color: var(--color-text); }
.page-actions { display: flex; gap: var(--spacing-md); flex-wrap: wrap; }
.bottom-actions { display: flex; justify-content: center; gap: var(--spacing-md); padding: var(--spacing-lg); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.section-panel { padding: var(--spacing-lg); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.section-head { display: flex; align-items: center; gap: var(--spacing-md); margin-bottom: var(--spacing-lg); }
.section-head h2 { margin: 0; flex: 1; font-size: 16px; font-weight: 800; color: var(--color-text); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-lg); }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field--full { grid-column: 1 / -1; }
.form-label { font-size: 13px; font-weight: 600; color: var(--color-text); }
.required { color: var(--color-error); }
.form-input, .form-textarea { padding: 10px 12px; border: 1.5px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text); font-family: var(--font-family-primary); font-size: 14px; outline: none; width: 100%; transition: border-color 0.2s; }
.form-input:focus, .form-textarea:focus { border-color: var(--color-primary); }
.form-textarea { resize: vertical; }
.ltr-input { direction: ltr; text-align: left; }
.file-zone { display: flex; align-items: center; gap: var(--spacing-lg); padding: var(--spacing-lg); border: 2px dashed var(--color-border); border-radius: var(--radius-md); background: var(--color-background); cursor: pointer; transition: all 0.2s ease; }
.file-zone:hover { border-color: var(--color-primary); background: var(--color-primary-soft); }
.file-hidden { display: none; }
.file-zone strong { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 2px; }
.file-zone span { font-size: 12px; color: var(--color-text-muted); }
.image-preview { width: 88px; height: 88px; object-fit: cover; border-radius: var(--radius-md); border: 1px solid var(--color-border); margin-top: var(--spacing-md); }
.schedule-list { display: flex; flex-direction: column; gap: var(--spacing-md); }
.schedule-row { display: grid; grid-template-columns: 170px 1fr; align-items: center; gap: var(--spacing-lg); padding: var(--spacing-md); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); transition: opacity 0.15s ease, background 0.15s ease; }
.schedule-row--disabled { opacity: 0.55; background: var(--color-background); }
.day-toggle { display: flex; align-items: center; gap: var(--spacing-md); cursor: pointer; }
.check-native { position: absolute; opacity: 0; width: 0; height: 0; }
.check-box { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--color-border); background: var(--color-surface); }
.check-native:checked + .check-box { border-color: var(--color-primary); background: var(--color-primary); }
.day-name { font-size: 13px; color: var(--color-text); }
.schedule-fields { display: grid; grid-template-columns: repeat(3, minmax(110px, 1fr)); gap: var(--spacing-md); }
.schedule-field { display: flex; flex-direction: column; gap: 4px; }
.schedule-label { font-size: 11px; font-weight: 700; color: var(--color-text-muted); }
.time-input, .number-input { height: 38px; padding: 0 10px; border: 1.5px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text); font-family: var(--font-family-primary); outline: none; }
.time-input:disabled, .number-input:disabled { cursor: not-allowed; opacity: 0.7; }
@media (max-width: 768px) {
  .form-grid { grid-template-columns: 1fr; }
  .schedule-row { grid-template-columns: 1fr; }
  .schedule-fields { grid-template-columns: 1fr; }
  .page-actions { width: 100%; }
  .bottom-actions { flex-direction: column-reverse; }
}
</style>
