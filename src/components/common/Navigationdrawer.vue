<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

export interface NavItem {
  label?: string
  to?: string
  icon?: string
  roles?: string[]
  children?: NavItem[]
  divider?: boolean
}

interface Props {
  items: NavItem[]
  modelValue?: boolean
  permanent?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  permanent: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'item-click': [item: NavItem]
}>()

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const expandedItems = ref<Set<string>>(new Set())
const collapsedItems = ref<Set<string>>(new Set())

const visibleItems = computed(() =>
  props.items.filter((item) => {
    if (item.divider) return true
    if (!item.roles || item.roles.length === 0) return true
    return auth.hasAnyRole(item.roles)
  })
)

function isActive(path?: string): boolean {
  if (!path) return false
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(`${path}/`)
}

function isParentActive(item: NavItem): boolean {
  if (!item.children) return false
  return item.children.some((child) => isActive(child.to))
}

function toggleExpanded(item: NavItem, index: number): void {
  const key = `${index}-${item.label}`
  if (isExpanded(item, index)) {
    expandedItems.value.delete(key)
    collapsedItems.value.add(key)
  } else {
    expandedItems.value.add(key)
    collapsedItems.value.delete(key)
  }
}

function isExpanded(item: NavItem, index: number): boolean {
  const key = `${index}-${item.label}`
  if (collapsedItems.value.has(key)) return false
  return expandedItems.value.has(key) || isParentActive(item)
}

function handleNavigation(item: NavItem): void {
  if (item.to && !item.children) {
    router.push(item.to)
    if (!props.permanent) {
      emit('update:modelValue', false)
    }
  }
  emit('item-click', item)
}

function linkHref(item: NavItem): string {
  return item.to ? router.resolve(item.to).href : '#'
}

function handleLinkClick(event: MouseEvent, item: NavItem): void {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return
  }

  event.preventDefault()
  handleNavigation(item)
}
</script>

<template>
  <v-navigation-drawer
    :model-value="modelValue"
    :permanent="permanent"
    :temporary="!permanent"
    location="right"
    width="260"
    class="nav-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- Header -->
    <div class="drawer-header">
      <div class="brand-logo">
        <img src="/app-logo.png" alt="Eyadaty" class="brand-mark" />
        <div>
          <p class="brand-name">عيادتي</p>
          <p class="brand-subtitle">لوحة التحكم</p>
        </div>
      </div>
    </div>

    <v-divider />

    <!-- Nav Items -->
    <div class="nav-list">
      <template v-for="(item, index) in visibleItems" :key="index">

        <!-- Divider -->
        <div v-if="item.divider" class="nav-divider" />

        <!-- Parent with children -->
        <div v-else-if="item.children && item.children.length > 0">
          <button
            class="nav-item nav-parent"
            :class="{ 'nav-active': isParentActive(item) }"
            @click="toggleExpanded(item, index)"
          >
            <v-icon :icon="item.icon || 'mdi-folder'" size="20" class="nav-icon" />
            <span class="nav-text">{{ item.label }}</span>
            <v-icon
              :icon="isExpanded(item, index) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
              size="18"
              class="nav-chevron"
            />
          </button>

          <div v-if="isExpanded(item, index)" class="nav-children">
            <a
              v-for="(child, ci) in item.children"
              :key="ci"
              :href="linkHref(child)"
              class="nav-item nav-child"
              :class="{ 'nav-active': isActive(child.to) }"
              @click="handleLinkClick($event, child)"
            >
              <v-icon :icon="child.icon || 'mdi-circle-small'" size="18" class="nav-icon" />
              <span class="nav-text">{{ child.label }}</span>
            </a>
          </div>
        </div>

        <!-- Regular item -->
        <a
          v-else
          :href="linkHref(item)"
          class="nav-item"
          :class="{ 'nav-active': isActive(item.to) }"
          @click="handleLinkClick($event, item)"
        >
          <v-icon :icon="item.icon || 'mdi-circle'" size="20" class="nav-icon" />
          <span class="nav-text">{{ item.label }}</span>
        </a>

      </template>
    </div>

    <!-- Footer -->
    <!-- <template #append>
      <v-divider />
      <div class="drawer-footer">
        <p class="footer-row"><span>النسخة</span><strong>1.0.0</strong></p>
        <p class="footer-row"><span>الدور</span><strong>{{ auth.primaryRole }}</strong></p>
      </div>
    </template> -->
  </v-navigation-drawer>
</template>

<style scoped>
/* Drawer */
:deep(.v-navigation-drawer__content) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.drawer-header {
  padding: 16px;
  flex-shrink: 0;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  object-fit: contain;
  background: #ffffff;
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.brand-name {
  margin: 0;
  padding: 0;
  font-size: 17px;
  font-weight: 800;
  color: var(--color-primary);
  line-height: 1.3;
}

.brand-subtitle {
  margin: 0;
  padding: 0;
  font-size: 11px;
  color: var(--color-text-muted);
}

/* Nav List */
.nav-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
}

.nav-list::-webkit-scrollbar {
  width: 4px;
}
.nav-list::-webkit-scrollbar-track {
  background: transparent;
}
.nav-list::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
}

/* Nav Items - base button */
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: right;
  color: var(--color-text-muted);
  font-family: var(--font-family-primary);
  font-size: 14px;
  font-weight: 500;
  transition: background 0.15s ease, color 0.15s ease;
  margin-bottom: 2px;
  min-width: 0;
}

.nav-item:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.nav-active {
  background: var(--color-primary-soft) !important;
  color: var(--color-primary) !important;
  font-weight: 700;
}

/* Icon */
.nav-icon {
  flex-shrink: 0;
  color: inherit;
}

/* Text - NO truncation */
.nav-text {
  flex: 1;
  white-space: normal;
  word-break: break-word;
  line-height: 1.4;
  text-align: right;
}

/* Chevron */
.nav-chevron {
  flex-shrink: 0;
  color: inherit;
  opacity: 0.6;
}

/* Children */
.nav-children {
  padding-right: 16px;
  padding-left: 0;
  margin-bottom: 4px;
}

[dir='rtl'] .nav-children {
  padding-right: 16px;
  padding-left: 0;
}

.nav-child {
  font-size: 13px;
  padding: 8px 12px;
}

/* Divider */
.nav-divider {
  height: 1px;
  background: var(--color-border);
  margin: 8px 4px;
}

/* Footer */
.drawer-footer {
  padding: 12px 16px;
  background: var(--color-surface-variant);
}

.footer-row {
  display: flex;
  justify-content: space-between;
  margin: 0 0 4px 0;
  padding: 0;
  font-size: 11px;
  color: var(--color-text-muted);
}

.footer-row:last-child {
  margin-bottom: 0;
}

.footer-row strong {
  color: var(--color-text);
  font-weight: 700;
}

@media (max-width: 959px) {
  .nav-drawer {
    max-width: min(82vw, 300px);
  }
}
</style>
