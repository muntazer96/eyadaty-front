<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import api from '../../services/api'
import { useNotifications } from '../../composables/useNotifications'
import type {
  ApiResponse,
  DoctorExternalLinkItem,
  UpdateDoctorExternalLinkRequest,
  ReorderDoctorExternalLinkRequest,
} from '../../types/api'
import { getErrorMessage } from '../../utils/errors'
import { getLinkTypeConfig, getLinkTypeIcon, getLinkTypeColor } from '../../constants/externalLinkTypes'
import ExternalLinkFormDialog from './ExternalLinkFormDialog.vue'
import ConfirmDialog from '../dialogs/ConfirmDialog.vue'

interface Props {
  doctorId?: number
  isDoctor?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isDoctor: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { success: showSuccess, error: showError } = useNotifications()

const links = ref<DoctorExternalLinkItem[]>([])
const loading = ref(false)
const formOpen = ref(false)
const editingLink = ref<DoctorExternalLinkItem | undefined>()
const deleteDialog = ref(false)
const deletingLink = ref<DoctorExternalLinkItem | undefined>()
const deleting = ref(false)
const reordering = ref(false)
const dragIndex = ref<number | null>(null)

const sortedLinks = computed(() =>
  [...links.value].sort((a, b) => a.displayOrder - b.displayOrder)
)

const myEndpoint = computed(() =>
  props.isDoctor ? '/DoctorExternalLink/my' : `/DoctorExternalLink/doctor/${props.doctorId}`
)

async function loadLinks() {
  loading.value = true
  try {
    const r = await api.get<ApiResponse<DoctorExternalLinkItem[]>>(myEndpoint.value)
    links.value = r.data.data
  } catch (e: any) {
    if (e.response?.status !== 404) showError(getErrorMessage(e))
    links.value = []
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editingLink.value = undefined
  formOpen.value = true
}

function openEdit(link: DoctorExternalLinkItem) {
  editingLink.value = link
  formOpen.value = true
}

async function handleSaved() {
  formOpen.value = false
  editingLink.value = undefined
  await loadLinks()
}

function askDelete(link: DoctorExternalLinkItem) {
  deletingLink.value = link
  deleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingLink.value) return
  deleting.value = true
  try {
    const params: Record<string, string | number> = {}
    if (!props.isDoctor && props.doctorId) params.doctorId = props.doctorId
    await api.delete(`/DoctorExternalLink/${deletingLink.value.id}`, { params })
    showSuccess('تم حذف الرابط بنجاح.')
    deleteDialog.value = false
    deletingLink.value = undefined
    await loadLinks()
  } catch (e) {
    showError(getErrorMessage(e))
  } finally {
    deleting.value = false
  }
}

async function toggleActive(link: DoctorExternalLinkItem) {
  try {
    const payload: UpdateDoctorExternalLinkRequest = {
      type: link.type,
      value: link.value,
      displayName: link.displayName,
      isActive: !link.isActive,
    }
    if (!props.isDoctor && props.doctorId) payload.doctorId = props.doctorId
    await api.put(`/DoctorExternalLink/${link.id}`, payload)
    link.isActive = !link.isActive
  } catch (e) {
    showError(getErrorMessage(e))
  }
}

function onDragStart(index: number, event: DragEvent) {
  dragIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onDrop(index: number) {
  if (dragIndex.value === null || dragIndex.value === index) return
  const reordered = [...sortedLinks.value]
  const [moved] = reordered.splice(dragIndex.value, 1)
  reordered.splice(index, 0, moved)
  links.value = reordered.map((link, i) => ({ ...link, displayOrder: i + 1 }))
  dragIndex.value = null
  saveOrder()
}

function onDragEnd() {
  dragIndex.value = null
}

async function saveOrder() {
  reordering.value = true
  try {
    const payload: ReorderDoctorExternalLinkRequest = {
      linkIds: sortedLinks.value.map((l) => l.id),
    }
    await api.put('/DoctorExternalLink/reorder', payload, {
      params: !props.isDoctor && props.doctorId ? { doctorId: props.doctorId } : undefined,
    })
  } catch (e) {
    showError(getErrorMessage(e))
    await loadLinks()
  } finally {
    reordering.value = false
  }
}

onMounted(loadLinks)

defineExpose({ loadLinks })
</script>

<template>
  <div class="external-links-section">
    <!-- Header -->
    <div class="section-header">
      <div class="section-header-info">
        <div class="section-header-icon">
          <v-icon icon="mdi-link-variant" size="20" color="primary" />
        </div>
        <div>
          <h3 class="section-title">الروابط الخارجية</h3>
          <p class="section-subtitle">أضف روابط حسابات الطبيب ومواقع التواصل التي تظهر في ملف الطبيب.</p>
        </div>
      </div>
      <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openAdd">إضافة رابط</v-btn>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <v-skeleton-loader v-for="i in 3" :key="i" type="list-item" />
    </div>

    <!-- Empty State -->
    <div v-else-if="!sortedLinks.length" class="empty-state">
      <v-icon icon="mdi-link-variant" size="48" color="grey-lighten-1" />
      <p class="empty-title">لا توجد روابط خارجية</p>
      <p class="empty-desc">أضف روابط الطبيب حتى تظهر للمراجعين في ملفه.</p>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openAdd">إضافة رابط</v-btn>
    </div>

    <!-- Links List -->
    <div v-else class="links-list">
      <TransitionGroup name="list">
        <div
          v-for="(link, index) in sortedLinks"
          :key="link.id"
          class="link-item"
          :class="{ 'link-item--inactive': !link.isActive, 'link-item--dragging': dragIndex === index }"
          draggable="true"
          @dragstart="onDragStart(index, $event)"
          @dragover="onDragOver($event)"
          @drop="onDrop(index)"
          @dragend="onDragEnd"
        >
          <div class="link-drag-handle">
            <v-icon icon="mdi-drag-vertical" size="18" color="grey" />
          </div>
          <div class="link-icon" :style="{ color: getLinkTypeColor(link.type) }">
            <v-icon :icon="getLinkTypeIcon(link.type)" size="22" />
          </div>
          <div class="link-info">
            <div class="link-name">{{ link.displayName || getLinkTypeConfig(link.type).label }}</div>
            <div class="link-url ltr">{{ link.value }}</div>
          </div>
          <div class="link-status">
            <v-chip
              size="x-small"
              :color="link.isActive ? 'success' : 'default'"
              variant="tonal"
            >
              {{ link.isActive ? 'نشط' : 'غير نشط' }}
            </v-chip>
          </div>
          <div class="link-actions">
            <v-btn icon size="x-small" variant="text" @click="toggleActive(link)">
              <v-icon :icon="link.isActive ? 'mdi-eye' : 'mdi-eye-off'" size="16" :color="link.isActive ? 'success' : 'grey'" />
            </v-btn>
            <v-btn icon size="x-small" variant="text" color="primary" @click="openEdit(link)">
              <v-icon icon="mdi-pencil" size="16" />
            </v-btn>
            <v-btn icon size="x-small" variant="text" color="error" @click="askDelete(link)">
              <v-icon icon="mdi-delete" size="16" />
            </v-btn>
          </div>
        </div>
      </TransitionGroup>

      <div v-if="reordering" class="reorder-loading">
        <v-progress-linear indeterminate color="primary" height="2" />
      </div>
    </div>

    <!-- Form Dialog -->
    <ExternalLinkFormDialog
      v-model="formOpen"
      :link="editingLink"
      :doctor-id="doctorId"
      :is-doctor="isDoctor"
      @saved="handleSaved"
    />

    <!-- Delete Confirmation -->
    <ConfirmDialog
      v-model="deleteDialog"
      title="تأكيد حذف الرابط"
      :message="`هل أنت متأكد من حذف هذا الرابط؟ ${deletingLink ? getLinkTypeConfig(deletingLink.type).label : ''} — ${deletingLink?.value ?? ''}`"
      confirm-label="حذف"
      :is-dangerous="true"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="deleteDialog = false"
    />
  </div>
</template>

<style scoped>
.external-links-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
}

.section-header-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.section-header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--color-primary-soft);
  flex-shrink: 0;
}

.section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
}

.section-subtitle {
  margin: 2px 0 0 0;
  font-size: 12px;
  color: var(--color-text-muted);
}

.loading-state {
  padding: var(--spacing-lg);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-2xl) var(--spacing-lg);
  text-align: center;
}

.empty-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
}

.empty-desc {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
  max-width: 300px;
}

.links-list {
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.link-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  transition: all 0.15s ease;
  cursor: default;
}

.link-item:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.link-item--inactive {
  opacity: 0.6;
}

.link-item--dragging {
  opacity: 0.4;
  transform: scale(0.98);
}

.link-drag-handle {
  cursor: grab;
  display: flex;
  align-items: center;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.link-drag-handle:active {
  cursor: grabbing;
}

.link-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--color-background);
  flex-shrink: 0;
}

.link-info {
  flex: 1;
  min-width: 0;
}

.link-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
}

.link-url {
  font-size: 11px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  direction: ltr;
  text-align: right;
}

.link-status {
  flex-shrink: 0;
}

.link-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.reorder-loading {
  padding-top: var(--spacing-sm);
}

/* Transitions */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.25s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.list-leave-active {
  position: absolute;
}

@media (max-width: 768px) {
  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);
  }

  .link-item {
    flex-wrap: wrap;
  }

  .link-url {
    max-width: 200px;
  }
}
</style>
