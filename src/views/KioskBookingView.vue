<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api'
import { getErrorMessage } from '../utils/errors'
import type { ApiResponse } from '../types/api'

interface KioskInfo { doctorName: string; clinicName: string; expiresAt: string }
interface Puzzle { challengeId: string; question: string; expiresAt: string }

const route = useRoute()
const token = computed(() => String(route.params.accessToken || ''))
const info = ref<KioskInfo>()
const puzzle = ref<Puzzle>()
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const result = ref<{ queueNumber: number; code: string }>()
const form = reactive({ patientName: '', patientPhoneNumber: '', puzzleAnswer: '' })
const valid = computed(() => form.patientName.trim() && /^07\d{9}$/.test(form.patientPhoneNumber) &&
  puzzle.value && /^\d+$/.test(form.puzzleAnswer))

async function loadPuzzle() {
  const response = await api.get<ApiResponse<Puzzle>>(`/Appointment/kiosk/${token.value}/puzzle`)
  puzzle.value = response.data.data
  form.puzzleAnswer = ''
}
async function load() {
  loading.value = true
  try {
    const response = await api.get<ApiResponse<KioskInfo>>(`/Appointment/kiosk/${token.value}`)
    info.value = response.data.data
    await loadPuzzle()
  } catch (e) { error.value = getErrorMessage(e) }
  finally { loading.value = false }
}
async function book() {
  if (!valid.value || !puzzle.value) return
  saving.value = true
  error.value = ''
  try {
    const response = await api.post<ApiResponse<{ queueNumber: number; code: string }>>(
      `/Appointment/kiosk/${token.value}/book`,
      { patientName: form.patientName.trim(), patientPhoneNumber: form.patientPhoneNumber,
        challengeId: puzzle.value.challengeId, puzzleAnswer: Number(form.puzzleAnswer) })
    result.value = response.data.data
    window.setTimeout(reset, 12000)
  } catch (e) {
    error.value = getErrorMessage(e)
    await loadPuzzle().catch(() => undefined)
  } finally { saving.value = false }
}
async function reset() {
  result.value = undefined
  Object.assign(form, { patientName: '', patientPhoneNumber: '', puzzleAnswer: '' })
  await loadPuzzle().catch(() => { error.value = 'تعذر تجديد التحقق. حدّث الصفحة.' })
}
onMounted(load)
</script>

<template>
  <main class="kiosk-page" dir="rtl">
    <section v-if="loading" class="kiosk-card state"><v-progress-circular indeterminate color="primary" size="64" /></section>
    <section v-else-if="error && !info" class="kiosk-card state">
      <v-icon icon="mdi-link-off" color="error" size="72" /><h1>الرابط غير متاح</h1><p>{{ error }}</p>
    </section>
    <section v-else-if="result" class="kiosk-card success-state">
      <v-icon icon="mdi-check-circle" color="success" size="88" />
      <h1>تم تسجيل حضورك</h1><p>رقم دورك هو</p><strong>{{ result.queueNumber }}</strong>
      <p>يرجى الاحتفاظ بالرقم ومتابعة شاشة الانتظار.</p>
      <v-btn size="x-large" color="primary" @click="reset">حجز مراجع آخر</v-btn>
    </section>
    <section v-else class="kiosk-card">
      <header><v-icon icon="mdi-hospital-building" color="primary" size="48" />
        <div><h1>تسجيل الحضور والحجز</h1><p>{{ info?.clinicName }} — {{ info?.doctorName }}</p></div>
      </header>
      <v-alert v-if="error" type="error" variant="tonal" closable class="mb-5" @click:close="error = ''">{{ error }}</v-alert>
      <form @submit.prevent="book">
        <label>اسم المراجع</label>
        <input v-model="form.patientName" class="kiosk-input" maxlength="200" required autocomplete="off" />
        <label>رقم الهاتف</label>
        <input v-model="form.patientPhoneNumber" v-iraqi-phone class="kiosk-input ltr" required autocomplete="off" />
        <div class="puzzle">
          <div><span>تحقق أمني</span><strong>{{ puzzle?.question }}</strong></div>
          <input v-model="form.puzzleAnswer" class="puzzle-input" inputmode="numeric" maxlength="3" required />
          <v-btn icon="mdi-refresh" variant="text" title="تغيير السؤال" @click.prevent="loadPuzzle" />
        </div>
        <v-btn type="submit" block size="x-large" color="primary" :loading="saving" :disabled="!valid">تثبيت الحجز</v-btn>
      </form>
      <footer><v-icon icon="mdi-shield-check" size="18" /> رابط آمن ومؤقت — لا تتم مشاركة بياناتك</footer>
    </section>
  </main>
</template>

<style scoped>
.kiosk-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at top,#dcf7f1,#f5f8f7 55%);font-family:var(--font-family-primary)}
.kiosk-card{width:min(680px,100%);background:#fff;border:1px solid #dce9e6;border-radius:28px;padding:clamp(24px,5vw,48px);box-shadow:0 24px 70px rgba(13,75,66,.14)}
header{display:flex;align-items:center;gap:18px;margin-bottom:30px}h1{font-size:clamp(24px,4vw,36px);color:#123d37;margin:0}p{color:#58736e;margin:6px 0}
form{display:grid;gap:12px}label{font-weight:800;color:#244b45}.kiosk-input,.puzzle-input{height:58px;border:2px solid #dce8e5;border-radius:14px;padding:0 16px;font-size:20px;outline:none}.kiosk-input:focus,.puzzle-input:focus{border-color:var(--color-primary)}
.puzzle{display:flex;align-items:center;gap:16px;background:#f1f8f6;border-radius:16px;padding:14px;margin:8px 0}.puzzle div{flex:1;display:grid}.puzzle span{font-size:13px;color:#58736e}.puzzle strong{font-size:24px}.puzzle-input{width:105px;text-align:center}
footer{display:flex;justify-content:center;gap:7px;color:#68817d;margin-top:24px}.state,.success-state{text-align:center;display:grid;justify-items:center;gap:16px}.success-state>strong{font-size:96px;line-height:1;color:var(--color-primary)}
@media(max-width:520px){.kiosk-page{padding:10px}.kiosk-card{border-radius:20px;padding:22px}.puzzle{gap:8px}.puzzle-input{width:82px}}
</style>
