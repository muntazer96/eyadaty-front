<script setup lang="ts">
import { computed, ref } from 'vue'
import api from '../services/api'
import PageHeader from '../components/common/Pageheader.vue'
import { useNotifications } from '../composables/useNotifications'
import { getErrorMessage } from '../utils/errors'
import type { ApiResponse, ProblemReportItem } from '../types/api'

const { success: showSuccess, error: showError } = useNotifications()

const loading = ref(false)
const form = ref({
  title: '',
  description: '',
  reporterName: '',
  reporterPhone: '',
})

const canSubmit = computed(() => form.value.title.trim().length >= 3 && form.value.description.trim().length >= 10)

async function submitReport() {
  if (!canSubmit.value || loading.value) return
  loading.value = true
  try {
    const payload = {
      ...form.value,
      source: 'DoctorWeb',
      pageUrl: window.location.href,
      deviceInfo: navigator.userAgent,
    }
    const response = await api.post<ApiResponse<ProblemReportItem>>('/ProblemReport/doctor/my', payload)
    showSuccess(response.data.message)
    form.value = { title: '', description: '', reporterName: '', reporterPhone: '' }
  } catch (e) {
    showError(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="problem-report-page">
    <PageHeader title="الإبلاغ عن مشكلة" subtitle="أرسل تفاصيل المشكلة ليتمكن السوبر أدمن من متابعتها" />

    <v-card elevation="0" class="report-card">
      <v-form @submit.prevent="submitReport">
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label class="form-label">عنوان المشكلة <span class="required">*</span></label>
            <input
              v-model="form.title"
              class="form-input"
              maxlength="160"
              required
              placeholder="اكتب عنوانا مختصرا للمشكلة"
            />
          </div>

          <div class="form-field form-field--full">
            <label class="form-label">تفاصيل المشكلة <span class="required">*</span></label>
            <textarea
              v-model="form.description"
              class="form-textarea"
              rows="7"
              maxlength="3000"
              required
              placeholder="اشرح ما حدث والخطوات التي أدت للمشكلة"
            />
          </div>

          <div class="contact-grid">
            <div class="form-field">
              <label class="form-label">الاسم للتواصل</label>
              <input v-model="form.reporterName" class="form-input" maxlength="200" />
            </div>
            <div class="form-field">
              <label class="form-label">رقم الهاتف</label>
              <input v-model="form.reporterPhone" class="form-input ltr-input" maxlength="30" dir="ltr" />
            </div>
          </div>

          <div class="actions-row">
            <v-btn
              type="submit"
              color="primary"
              prepend-icon="mdi-send"
              :disabled="!canSubmit"
              :loading="loading"
            >
              إرسال البلاغ
            </v-btn>
          </div>
        </div>
      </v-form>
    </v-card>
  </div>
</template>

<style scoped>
.problem-report-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.report-card {
  border: 1px solid var(--color-border) !important;
  border-radius: var(--radius-lg) !important;
  padding: var(--spacing-xl);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-lg);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field--full {
  grid-column: 1 / -1;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.required {
  color: var(--color-error);
}

.contact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.form-input,
.form-textarea {
  width: 100%;
}

.form-textarea {
  resize: vertical;
}

.ltr-input {
  text-align: left;
}

.actions-row {
  display: flex;
  justify-content: flex-start;
}

@media (max-width: 900px) {
  .contact-grid {
    grid-template-columns: 1fr;
  }
}
</style>
