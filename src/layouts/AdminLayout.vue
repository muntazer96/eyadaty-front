<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLayoutStore } from '../stores/layout'
import { getNavigationItems } from '../constants/navigation'
import AppBar from '../components/common/Appbar.vue'
import NavigationDrawer from '../components/common/Navigationdrawer.vue'
import NotificationCenter from '../components/common/NotificationCenter.vue'
import type { NavItem } from '../components/common/Navigationdrawer.vue'

const auth   = useAuthStore()
const layout = useLayoutStore()
const route  = useRoute()
const router = useRouter()

const pageTitle = computed(() => (route.meta.title as string | undefined) ?? 'لوحة التحكم')
const navItems  = computed<NavItem[]>(() => getNavigationItems(auth.primaryRole))

// يغلق فقط على موبايل
const handleNavItemClick = (_item: NavItem): void => {
  if (window.innerWidth < 960) layout.closeSidebar()
}

// زر الهامبرغر يفتح/يغلق
const handleMenuToggle = (): void => layout.toggleSidebar()

const handleSettingsClick = (): void => { router.push('/profile') }

onMounted(() => {
  // على الديسكتوب يبقى مفتوح دائماً
  if (window.innerWidth >= 960) layout.openSidebar()
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

    <!-- permanent مرتبط بـ sidebarOpen فقط عند الديسكتوب -->
    <NavigationDrawer
      v-model="layout.sidebarOpen"
      :items="navItems"
      :permanent="layout.sidebarOpen"
      @item-click="handleNavItemClick"
    />

    <v-main class="main-content">
      <v-container fluid class="pa-6">
        <RouterView />
      </v-container>

      <footer class="app-footer">
        <div class="footer-content">
          <p class="footer-text">© 2024 عيادتي. جميع الحقوق محفوظة</p>
          <p class="footer-version">النسخة: 1.0.0</p>
        </div>
      </footer>
    </v-main>

    <NotificationCenter />
  </v-app>
</template>

<style scoped>
.admin-app {
  background-color: var(--color-background);
}

.main-content {
  background-color: var(--color-background);
}

.app-footer {
  margin-top: auto;
  padding: var(--spacing-xl);
  border-top: 1px solid var(--color-border);
  background-color: var(--color-surface);
  text-align: center;
}

.footer-content {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
}

.footer-text,
.footer-version {
  margin: 0;
  padding: 0;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

@media (max-width: 600px) {
  :deep(.v-container) {
    padding: var(--spacing-lg) var(--spacing-md) !important;
  }

  .app-footer {
    padding: var(--spacing-lg) var(--spacing-md);
  }

  .footer-content {
    flex-direction: column;
    gap: var(--spacing-md);
  }
}
</style>