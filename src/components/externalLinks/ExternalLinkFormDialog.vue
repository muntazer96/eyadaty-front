<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import api from '../../services/api'
import { useNotifications } from '../../composables/useNotifications'
import type {
  ApiResponse,
  DoctorExternalLinkItem,
  CreateDoctorExternalLinkRequest,
  UpdateDoctorExternalLinkRequest,
} from '../../types/api'
import { getErrorMessage } from '../../utils/errors'
import { EXTERNAL_LINK_TYPES, getLinkTypeConfig } from '../../constants/externalLinkTypes'

interface Props {
  modelValue: boolean
  link?: DoctorExternalLinkItem
  doctorId?: number
  isDoctor?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isDoctor: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const { success: showSuccess, error: showError } = useNotifications()

const saving = ref(false)
const form = reactive({
  type: 1,
  value: '',
  displayName: '',
  isActive: true,
})

const validationError = ref('')

const currentConfig = computed(() => getLinkTypeConfig(form.type))

const isEditing = computed(() => Boolean(props.link))

const canSubmit = computed(() => {
  if (!form.value.trim()) return false
  if (form.type === 4) {
    return /^[\d\s\-\+]+$/.test(form.value.trim()) && form.value.trim().length >= 8
  }
  return form.value.trim().length >= 3
})

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      validationError.value = ''
      if (props.link) {
        form.type = props.link.type
        form.value = props.link.value
        form.displayName = props.link.displayName
        form.isActive = props.link.isActive
      } else {
        form.type = 1
        form.value = ''
        form.displayName = ''
        form.isActive = true
      }
    }
  }
)

function selectType(type: number) {
  form.type = type
  form.value = ''
  form.displayName = ''
  validationError.value = ''
}

async function save() {
  validationError.value = ''
  saving.value = true
  try {
    if (isEditing.value && props.link) {
      const payload: UpdateDoctorExternalLinkRequest = {
        type: form.type,
        value: form.value.trim(),
        isActive: form.isActive,
      }
      if (!props.isDoctor && props.doctorId) payload.doctorId = props.doctorId
      if (form.displayName.trim()) {
        payload.displayName = form.displayName.trim()
      }
      await api.put(`/DoctorExternalLink/${props.link.id}`, payload)
      showSuccess('تم تحديث الرابط بنجاح.')
    } else {
      const payload: CreateDoctorExternalLinkRequest = {
        type: form.type,
        value: form.value.trim(),
      }
      if (!props.isDoctor && props.doctorId) payload.doctorId = props.doctorId
      await api.post('/DoctorExternalLink', payload)
      showSuccess('تم إضافة الرابط بنجاح.')
    }
    emit('saved')
  } catch (e: any) {
    const message = getErrorMessage(e)
    if (e.response?.status === 400 || e.response?.status === 409) {
      validationError.value = message
    } else {
      showError(message)
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="dialog-title">
        <v-icon :icon="isEditing ? 'mdi-pencil' : 'mdi-plus'" color="primary" size="20" />
        {{ isEditing ? 'تعديل الرابط' : 'إضافة رابط جديد' }}
      </v-card-title>
      <v-divider />

      <v-card-text class="dialog-body">
        <!-- Type Selector -->
        <label class="form-label">نوع الرابط <span class="required">*</span></label>
        <div class="type-grid">
          <button
            v-for="t in EXTERNAL_LINK_TYPES"
            :key="t.value"
            type="button"
            class="type-btn"
            :class="{ 'type-btn--active': form.type === t.value }"
            @click="selectType(t.value)"
          >
            <v-icon :icon="t.icon" size="20" :color="form.type === t.value ? t.color : undefined" />
            <span>{{ t.label }}</span>
          </button>
        </div>

        <!-- Value Input -->
        <div class="form-field" style="margin-top: 16px;">
          <label class="form-label">{{ currentConfig.inputLabel }} <span class="required">*</span></label>
          <input
            v-model="form.value"
            class="form-input"
            :placeholder="currentConfig.placeholder"
            :type="form.type === 4 ? 'tel' : 'text'"
          />
          <p class="form-hint">{{ currentConfig.hint }}</p>
        </div>

        <!-- Display Name (optional) -->
        <div v-if="form.type !== 4" class="form-field">
          <label class="form-label">اسم العرض <span class="optional">(اختياري)</span></label>
          <input
            v-model="form.displayName"
            class="form-input"
            :placeholder="currentConfig.label"
          />
        </div>

        <!-- Active Toggle -->
        <div class="form-field">
          <v-switch
            v-model="form.isActive"
            color="primary"
            :label="form.isActive ? 'نشط — يظهر للمرضى' : 'غير نشط — مخفي عن المرضى'"
            hide-details
            density="compact"
          />
        </div>

        <!-- Validation Error -->
        <v-alert
          v-if="validationError"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3"
          closable
          @click:close="validationError = ''"
        >
          {{ validationError }}
        </v-alert>
      </v-card-text>

      <v-divider />
      <v-card-actions class="dialog-actions">
        <v-btn variant="outlined" @click="emit('update:modelValue', false)">تراجع</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="!canSubmit" @click="save">
          {{ isEditing ? 'حفظ التعديلات' : 'إضافة الرابط' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.dialog-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) !important;
  font-size: 16px !important;
  font-weight: 700;
  color: var(--color-text);
}

.dialog-body {
  padding: var(--spacing-lg) !important;
}

.dialog-actions {
  padding: var(--spacing-lg) !important;
  gap: var(--spacing-md);
  justify-content: flex-end;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 6px;
}

.required {
  color: var(--color-error);
}

.optional {
  color: var(--color-text-muted);
  font-weight: 400;
  font-size: 12px;
}

.form-field {
  margin-top: var(--spacing-lg);
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-family-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: var(--color-primary);
}

.form-hint {
  margin: 4px 0 0 0;
  font-size: 11px;
  color: var(--color-text-muted);
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
}

.type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--spacing-md) var(--spacing-sm);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: var(--font-family-primary);
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text);
}

.type-btn:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.type-btn--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

@media (max-width: 480px) {
  .type-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
