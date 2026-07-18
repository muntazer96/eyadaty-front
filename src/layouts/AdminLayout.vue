<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useAuthStore } from '../stores/auth'
import { useLayoutStore } from '../stores/layout'
import { getNavigationItems } from '../constants/navigation'
import AppBar from '../components/common/Appbar.vue'
import NavigationDrawer from '../components/common/Navigationdrawer.vue'
import type { NavItem } from '../components/common/Navigationdrawer.vue'

const auth = useAuthStore()
const layout = useLayoutStore()
const route = useRoute()
const router = useRouter()
const { mdAndUp } = useDisplay()

const pageTitle = computed(() => (route.meta.title as string | undefined) ?? 'لوحة التحكم')
const navItems = computed<NavItem[]>(() => getNavigationItems(auth.roles))
const isPermanentSidebar = computed(() => mdAndUp.value)

const handleNavItemClick = (_item: NavItem): void => {
  if (!isPermanentSidebar.value) layout.closeSidebar()
}

const handleMenuToggle = (): void => layout.toggleSidebar()

const handleSettingsClick = (): void => {
  router.push('/profile')
}

onMounted(() => {
  if (isPermanentSidebar.value) layout.openSidebar()
  else layout.closeSidebar()
})

watch(isPermanentSidebar, (isPermanent) => {
  if (isPermanent) layout.openSidebar()
  else layout.closeSidebar()
})
</script>

<template>
  <v-app class="admin-app">
    <AppBar
      :title="pageTitle"
      :show-menu-toggle="true"
      :show-notifications="true"
      :show-user-menu="true"
      @menu-toggle="handleMenuToggle"
      @settings-click="handleSettingsClick"
    />

    <NavigationDrawer
      v-model="layout.sidebarOpen"
      :items="navItems"
      :permanent="isPermanentSidebar"
      @item-click="handleNavItemClick"
    />

    <v-main class="main-content">
      <v-container fluid class="content-container pa-6">
        <RouterView />
      </v-container>

      <footer class="app-footer">
        <div class="footer-content">
          <div class="footer-brand">
            <span class="footer-text">برمجة وتطوير</span>
            <img src="../assets/godev_logo.png" alt="GoDev" class="godev-logo" />
          </div>

          <a class="footer-phone" href="tel:07701234567" dir="ltr">
            <v-icon icon="mdi-phone" size="15" />
            0770 123 4567
          </a>
        </div>
      </footer>
    </v-main>
  </v-app>
</template>

<style scoped>
.admin-app {
  background-color: var(--color-background);
}

.main-content {
  background-color: var(--color-background);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.content-container {
  flex: 1 0 auto;
  padding-bottom: 70px !important;
}

.app-footer {
  position: fixed;
  right: var(--v-layout-right, 0px);
  bottom: 0;
  left: var(--v-layout-left, 0px);
  z-index: 900;
  min-height: 52px;
  padding: 8px var(--spacing-xl);
  border-top: 1px solid var(--color-border);
  background-color: var(--color-surface);
  box-shadow: 0 -4px 14px rgba(22, 49, 45, 0.06);
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
  width: 100%;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.footer-text {
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 700;
  line-height: 1.2;
}

.godev-logo {
  width: 48px;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
}

.footer-phone {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

@media (max-width: 600px) {
  :deep(.v-container) {
    padding: var(--spacing-lg) var(--spacing-md) !important;
  }

  .app-footer {
    min-height: 50px;
    padding: 7px var(--spacing-md);
  }

  .footer-content {
    justify-content: center;
    gap: var(--spacing-md);
    text-align: center;
  }

  .footer-brand {
    justify-content: center;
    min-width: 0;
  }

  .footer-phone {
    order: -1;
  }
}
</style>
