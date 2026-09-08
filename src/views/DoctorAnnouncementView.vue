<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api'
import type { ApiResponse, ClinicItem, DoctorItem, PageResult } from '../types/api'
import { drawAnnouncement } from '../utils/doctorAnnouncement'
import { getErrorMessage } from '../utils/errors'
import { provinces } from '../constants/provinces'

const route = useRoute()
const canvas = ref<HTMLCanvasElement>()
const loading = ref(true)
const exporting = ref(false)
const error = ref('')
const ready = ref(false)
const clinics = ref<ClinicItem[]>([])
const clinicId = ref<number>()
const doctor = ref<DoctorItem>()
const province = ref('')
const postField = ref<HTMLTextAreaElement>()
const copying = ref(false)
const copyMessage = ref('')
const form = reactive({ title: 'الدكتور', name: '', specialty: '', phone: '', address: '', link: '' })
const postText = computed(() => {
  const female = form.title === 'الدكتورة'
  const hashtag = (value: string) => value.trim().replace(/[^\p{L}\p{N}\p{M}]+/gu, '_').replace(/^_+|_+$/g, '')
  const tags = ['عيادتي', 'أطباء العراق', province.value, form.specialty].map(hashtag).filter(Boolean)
  return `${female ? '👩‍⚕️ طبيبة جديدة انضمت' : '👨‍⚕️ طبيب جديد انضم'} إلى تطبيق عيادتي

نرحّب بانضمام ${form.title} ${form.name.trim() || '[اسم الطبيب]'}
${form.specialty.trim() || '[الاختصاص]'}

تگدر هسه تشوف من خلال تطبيق عيادتي:
✅ معلومات ${female ? 'الطبيبة' : 'الطبيب'} وتفاصيل العيادة
✅ أيام وأوقات الدوام
✅ عنوان وموقع العيادة على الخريطة
✅ رقم الحجز والاستفسار
✅ الحجز الإلكتروني مباشرةً في حال كان مفعّلاً من قِبل ${female ? 'الطبيبة' : 'الطبيب'}

📍 عنوان العيادة:
✅️ ${form.address.trim() || '[عنوان العيادة]'}

📞 رقم الحجز والاستفسار:
${form.phone.trim() || '[رقم الحجز]'}

تگدر تشوف معلومات ${form.title} وتحجز إلكترونياً من خلال تطبيق عيادتي
أو مباشرةً من خلال الرابط:
🔗 ${form.link.trim() || '[رابط الحجز]'}

${[...new Set(tags)].map(tag => `#${tag}`).join(' ')}`
})
watch(postText, () => { copyMessage.value = '' })
async function copyPost() {
  if (!valid.value || loading.value || copying.value) return
  copying.value = true
  copyMessage.value = ''
  const text = postText.value
  try {
    await navigator.clipboard.writeText(text)
    if (text === postText.value) copyMessage.value = 'تم نسخ نص المنشور، جاهز للصق والنشر.'
  } catch {
    postField.value?.focus()
    postField.value?.select()
    copyMessage.value = 'تعذر النسخ التلقائي. تم تحديد النص؛ انسخه من قائمة النسخ في جهازك.'
  } finally { copying.value = false }
}
let logo: HTMLImageElement
const valid = computed(() => Boolean(form.name.trim() && form.specialty.trim() && form.phone.trim() && form.address.trim() && /^https?:\/\/\S+$/i.test(form.link.trim())))
function render() { if (ready.value && canvas.value) drawAnnouncement(canvas.value, form, logo) }
watch(form, render)
function chooseClinic() {
  const clinic = clinics.value.find(item => item.id === clinicId.value)
  form.address = clinic ? [clinic.iraqiProvinceName, clinic.address].filter(Boolean).join(' - ') : doctor.value?.location || ''
  form.phone = clinic?.phoneNumber || doctor.value?.phoneNumber || ''
  province.value = clinic?.iraqiProvinceName || doctor.value?.iraqiProvinceName || ''
}
async function initialize() {
  loading.value = true; error.value = ''
  try {
    logo = new Image()
    logo.src = `${import.meta.env.BASE_URL}app-logo.png`
    await Promise.all([logo.decode(), document.fonts.load('800 60px Tajawal', 'عيادتي طبيب'), document.fonts.load('500 24px Tajawal', 'عيادتي طبيب'), document.fonts.load('700 30px Tajawal', 'عيادتي طبيب')])
    ready.value = true
    if (route.params.doctorId) {
      const id = Number(route.params.doctorId)
      const response = await api.get<ApiResponse<PageResult<DoctorItem>>>('/Doctor', { params: { id, page: 1, pageSize: 1 } })
      doctor.value = response.data.data.items[0]
      if (!doctor.value) throw new Error('لم يتم العثور على الطبيب. يمكنك إدخال البيانات يدوياً.')
      const d = doctor.value
      form.title = /^الدكتورة\s/.test(d.name) ? 'الدكتورة' : 'الدكتور'
      form.name = d.name.replace(/^(الدكتور|الدكتورة|د\.)\s*/, '')
      form.specialty = d.specialization?.name || ''
      form.phone = d.phoneNumber || ''
      form.address = d.location || ''
      province.value = d.iraqiProvinceName || ''
      form.link = `${window.location.origin}/d/${d.id}`
      const responseClinics = await api.get<ApiResponse<ClinicItem[]>>(`/Clinic/doctor/${id}/admin`)
      clinics.value = responseClinics.data.data
      clinicId.value = clinics.value[0]?.id
      chooseClinic()
    }
  } catch (e) { error.value = getErrorMessage(e) }
  finally { loading.value = false; render() }
}
async function download() {
  if (!canvas.value || !valid.value || exporting.value) return
  exporting.value = true; error.value = ''
  try {
    render()
    const blob = await new Promise<Blob>((resolve, reject) => canvas.value!.toBlob(value => value ? resolve(value) : reject(new Error('تعذر إنشاء الصورة')), 'image/png'))
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `عيادتي-انضمام-${form.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.png`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch { error.value = 'تعذر تنزيل الصورة، حاول مرة أخرى.' }
  finally { exporting.value = false }
}
onMounted(initialize)
</script>

<template>
  <main class="announcement-page" dir="rtl">
    <header class="announcement-header">
      <div><p class="eyebrow">عيادتي · استوديو الترحيب</p><h1>صورة انضمام طبيب</h1><p>بيانات بسيطة، وترحيب يليق بأطبائنا. عدّل النصوص وشاهد النتيجة مباشرة.</p></div>
      <v-btn variant="outlined" to="/doctors" prepend-icon="mdi-arrow-right">الأطباء</v-btn>
    </header>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" role="alert">{{ error }} <v-btn v-if="!ready" variant="text" @click="initialize">إعادة المحاولة</v-btn></v-alert>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <div class="announcement-layout">
      <form class="editor" @submit.prevent="download">
        <h2>بيانات الصورة والمنشور</h2><p class="editor-note">التعديلات هنا تخص الصورة ونص المنشور فقط ولا تغيّر ملف الطبيب.</p>
        <fieldset :disabled="loading || exporting">
          <label v-if="clinics.length">العيادة<select v-model="clinicId" @change="chooseClinic"><option v-for="clinic in clinics" :key="clinic.id" :value="clinic.id">{{ clinic.name }}</option></select></label>
          <label>اللقب<select v-model="form.title"><option>الدكتور</option><option>الدكتورة</option></select></label>
          <label>اسم الطبيب<input v-model="form.name" required maxlength="100" placeholder="مثال: نبيل الخواجة" /></label>
          <label>الاختصاص<input v-model="form.specialty" required maxlength="140" placeholder="طب وجراحة الفم والأسنان" /></label>
          <label>رقم الحجز والاستفسار<input v-model="form.phone" required maxlength="45" dir="ltr" inputmode="tel" placeholder="07xxxxxxxxx" /></label>
          <label>عنوان العيادة<textarea v-model="form.address" required maxlength="240" rows="3" placeholder="المحافظة - المنطقة - أقرب نقطة دالة" /></label>
          <label>المحافظة (لهاشتاغ المنشور)<select v-model="province"><option value="">بدون هاشتاغ المحافظة</option><option v-for="item in provinces" :key="item.value" :value="item.name">{{ item.name }}</option><option v-if="province && !provinces.some(item => item.name === province)" :value="province">{{ province }}</option></select></label>
          <label>رابط الحجز الإلكتروني<input v-model="form.link" required type="url" maxlength="180" dir="ltr" placeholder="https://eyadaty.techumbrella.net/d/35" /></label>
        </fieldset>
        <p class="editor-note">أكمل الحقول لإتاحة التنزيل. حجم الصورة 2160 × 2160 بكسل.</p>
        <v-btn type="submit" block color="primary" size="large" prepend-icon="mdi-download" :loading="exporting" :disabled="loading || !ready || !valid">تنزيل الصورة PNG</v-btn>
      </form>
      <section class="preview" aria-label="معاينة صورة الترحيب">
        <div class="preview-heading"><strong>المعاينة المباشرة</strong><span>منشور مربع · جودة عالية</span></div>
        <canvas ref="canvas" role="img" :aria-label="`صورة ترحيبية بانضمام ${form.title} ${form.name}، ${form.specialty}، ${form.address}، ${form.phone}، ${form.link}`" />
        <p>الصورة التي تنزّلها مطابقة للمعاينة، وجاهزة للنشر والمشاركة.</p>
      </section>
    </div>
    <section class="post-panel" aria-labelledby="post-heading">
      <div class="post-heading">
        <div><h2 id="post-heading">نص المنشور</h2><p class="editor-note">يتحدّث تلقائياً حسب البيانات أعلاه، مع رابط الحجز وهاشتاغ المحافظة والاختصاص.</p></div>
        <v-btn color="primary" prepend-icon="mdi-content-copy" :loading="copying" :disabled="loading || !valid" @click="copyPost">نسخ نص المنشور</v-btn>
      </div>
      <textarea ref="postField" :value="postText" readonly rows="24" aria-label="نص المنشور الجاهز للنسخ" class="post-text" />
      <p class="copy-status" role="status" aria-live="polite">{{ copyMessage || 'أكمل بيانات الطبيب أعلاه ثم انسخ النص للنشر.' }}</p>
    </section>
  </main>
</template>

<style scoped>
.post-panel{margin-top:28px;padding:24px;border:1px solid #dde7ed;border-radius:20px;background:#fff}.post-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.post-heading h2{font-size:20px}.post-text{line-height:1.9;font-size:15px;font-weight:500;unicode-bidi:plaintext}.copy-status{font-size:13px;color:#236783;margin-top:12px;min-height:24px}
.announcement-page{max-width:1450px;margin:auto;color:#163e54}.announcement-header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:28px}.announcement-header h1{font-size:30px;margin:4px 0 8px}.announcement-header p{color:#647989}.eyebrow{font-size:13px;font-weight:800;color:#237a86!important}.announcement-layout{display:grid;grid-template-columns:340px minmax(0,1fr);gap:28px;align-items:start}.editor{background:white;border:1px solid #dde7ed;border-radius:20px;padding:24px}.editor h2{font-size:20px}.editor-note{font-size:13px;color:#6d7f8d;line-height:1.8;margin:10px 0 18px}fieldset{border:0;padding:0;min-width:0}label{display:block;font-size:14px;font-weight:700;margin-bottom:15px}input,select,textarea{display:block;width:100%;border:1px solid #ccdce4;border-radius:10px;padding:10px 12px;margin-top:6px;color:#163e54;background:#fbfdfe;font:inherit;font-weight:500}textarea{resize:vertical}input:focus,select:focus,textarea:focus{outline:2px solid #258293;outline-offset:2px}.preview{min-width:0;background:#e9eff3;border-radius:20px;padding:22px}.preview-heading{display:flex;justify-content:space-between;gap:12px;margin-bottom:18px;font-size:14px}.preview-heading span,.preview>p{font-size:12px;color:#627988}.preview canvas{display:block;width:100%;height:auto;aspect-ratio:1;background:#fff;box-shadow:0 12px 35px #163e5415}.preview>p{text-align:center;margin:18px 0 0}@media(max-width:960px){.announcement-layout{grid-template-columns:1fr}.announcement-header{align-items:flex-start}.announcement-header h1{font-size:25px}.preview{padding:12px}.editor{padding:20px}}
</style>
