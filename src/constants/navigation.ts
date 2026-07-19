import type { NavItem } from '../components/common/Navigationdrawer.vue'

const adminNavigation: NavItem[] = [
  { label: 'الرئيسية', to: '/', icon: 'mdi-home', roles: ['SuperAdmin', 'DoctorUser'] },
  { label: 'الإحصائيات', to: '/analytics', icon: 'mdi-chart-box', roles: ['SuperAdmin', 'DoctorUser'] },
  {
    label: 'إدارة النظام',
    icon: 'mdi-cog',
    roles: ['SuperAdmin'],
    children: [
      { label: 'المستخدمون', to: '/users', icon: 'mdi-account-multiple', roles: ['SuperAdmin'] },
      { label: 'طلبات حذف الحساب', to: '/pending-account-deletions', icon: 'mdi-account-clock', roles: ['SuperAdmin'] },
      { label: 'الأطباء', to: '/doctors', icon: 'mdi-stethoscope', roles: ['SuperAdmin'] },
      { label: 'الاختصاصات', to: '/specializations', icon: 'mdi-shape-plus', roles: ['SuperAdmin'] },
      { label: 'الاشتراكات', to: '/subscriptions', icon: 'mdi-receipt', roles: ['SuperAdmin'] },
      { label: 'WhatsApp OTP', to: '/whatsapp', icon: 'mdi-whatsapp', roles: ['SuperAdmin'] },
      { label: 'النسخ الاحتياطي', to: '/backup-restore', icon: 'mdi-database', roles: ['SuperAdmin'] },
      { label: 'طلبات التحويل', to: '/doctor-requests', icon: 'mdi-file-document-edit', roles: ['SuperAdmin'] },
      { label: 'بلاغات المشاكل', to: '/problem-reports', icon: 'mdi-alert-circle', roles: ['SuperAdmin'] },
      { label: 'إرسال إشعارات', to: '/admin-notifications/send', icon: 'mdi-bell-plus', roles: ['SuperAdmin'] },
    ],
  },
  {
    label: 'إصدارات التطبيق',
    icon: 'mdi-package',
    roles: ['SuperAdmin'],
    children: [
      { label: 'سياسات التحديث', to: '/app-versions', icon: 'mdi-file-document', roles: ['SuperAdmin'] },
      { label: 'إصدارات APK', to: '/app-releases', icon: 'mdi-android', roles: ['SuperAdmin'] },
    ],
  },
  { divider: true, roles: ['SuperAdmin', 'DoctorUser'] },
  {
    label: 'العروض والحجوزات',
    icon: 'mdi-offer',
    roles: ['SuperAdmin', 'DoctorUser'],
    children: [
      { label: 'العروض', to: '/offers', icon: 'mdi-percent', roles: ['SuperAdmin', 'DoctorUser'] },
      { label: 'الحجوزات', to: '/appointments', icon: 'mdi-calendar', roles: ['SuperAdmin', 'DoctorUser'] },
    ],
  },
  { divider: true, roles: ['DoctorUser'] },
  { label: 'العيادات', to: '/clinics', icon: 'mdi-hospital-box', roles: ['SuperAdmin', 'DoctorUser'] },
  { label: 'مميزات الاشتراك', to: '/features', icon: 'mdi-star-circle', roles: ['DoctorUser'] },
  { label: 'الإجازات والاستثناءات', to: '/exceptions', icon: 'mdi-calendar-alert', roles: ['DoctorUser'] },
  { label: 'الإشعارات', to: '/notifications', icon: 'mdi-bell', roles: ['SuperAdmin', 'DoctorUser'] },
  { label: 'الرسائل', to: '/messages', icon: 'mdi-message-text', roles: ['DoctorUser'] },
  { label: 'التقييمات', to: '/reviews', icon: 'mdi-star', roles: ['DoctorUser'] },
  { label: 'الملف الشخصي', to: '/profile', icon: 'mdi-account', roles: ['DoctorUser'] },
  { label: 'المصادقة الثنائية', to: '/account/2fa', icon: 'mdi-shield-key', roles: ['SuperAdmin', 'DoctorUser'] },
  { label: 'الأجهزة والجلسات', to: '/account/sessions', icon: 'mdi-devices', roles: ['SuperAdmin', 'DoctorUser'] },
  { label: 'الإبلاغ عن مشكلة', to: '/problem-report', icon: 'mdi-alert-circle-outline', roles: ['DoctorUser'] },
]

export function getNavigationItems(userRole: string | string[] | undefined): NavItem[] {
  if (!userRole) return []
  const roles = Array.isArray(userRole) ? userRole : [userRole]
  return filterNavItemsByRole(adminNavigation, roles)
}

function filterNavItemsByRole(items: NavItem[], userRoles: string[]): NavItem[] {
  const normalizedUserRoles = userRoles.map((role) => role.trim().toLowerCase())

  return items
    .filter((item) => {
      if (item.divider) {
        return !item.roles || item.roles.some((role) => normalizedUserRoles.includes(role.trim().toLowerCase()))
      }
      if (!item.roles || item.roles.length === 0) return true
      return item.roles.some((role) => normalizedUserRoles.includes(role.trim().toLowerCase()))
    })
    .map((item) => {
      if (item.children && item.children.length > 0) {
        return {
          ...item,
          children: filterNavItemsByRole(item.children, userRoles),
        }
      }
      return item
    })
}

export default adminNavigation
