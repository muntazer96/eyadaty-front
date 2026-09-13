import { createRouter, createWebHistory } from 'vue-router'
import { pinia } from '../stores/index.ts'
import { useAuthStore } from '../stores/auth.ts'
import AdminLayout from '../layouts/AdminLayout.vue'
import AnalyticsView from '../views/AnalyticsView.vue'
import DownloadAppView from '../views/DownloadApp.vue'
import AppointmentsView from '../views/AppointmentsView.vue'
import AppVersionManagementView from '../views/AppVersionManagement.vue'
import AppVersionsView from '../views/AppVersionsView.vue'
import LoginView from '../views/LoginView.vue'
import ClinicsView from '../views/ClinicsView.vue'
import DashboardView from '../views/DashboardView.vue'
import DoctorDetailsView from '../views/DoctorDetailsView.vue'
import DoctorCreateWithClinicView from '../views/DoctorCreateWithClinicView.vue'
import DoctorsView from '../views/DoctorsView.vue'
import ExceptionsView from '../views/ExceptionsView.vue'
import FeaturesView from '../views/FeaturesView.vue'
import NotificationsView from '../views/NotificationsView.vue'
import MessagesView from '../views/MessagesView.vue'
import OffersView from '../views/OffersView.vue'
import PasswordResetView from '../views/PasswordResetView.vue'
import ProfileView from '../views/ProfileView.vue'
import PrivacyPolicyView from '../views/PrivacyPolicyView.vue'
import ProblemReportView from '../views/ProblemReportView.vue'
import PublicDoctorLinkView from '../views/PublicDoctorLinkView.vue'
import WaitingRoomControlView from '../views/WaitingRoomControlView.vue'
import WaitingRoomDisplayView from '../views/WaitingRoomDisplayView.vue'
import WaitingRoomsAdminView from '../views/WaitingRoomsAdminView.vue'
import KioskBookingView from '../views/KioskBookingView.vue'
import VisitorBookingView from '../views/VisitorBookingView.vue'

import ReviewsView from '../views/ReviewsView.vue'
import SpecializationsView from '../views/SpecializationsView.vue'
import SubscriptionsView from '../views/SubscriptionsView.vue'
import SupportView from '../views/SupportView.vue'
import UsersView from '../views/UsersView.vue'
import WhatsAppView from '../views/WhatsAppView.vue'
import OtpiqTestView from '../views/OtpiqTestView.vue'
import BackupRestoreView from '../views/BackupRestoreView.vue'
import CareSubscriptionsView from '../views/CareSubscriptionsView.vue'
import DoctorRequestFlowView from '../views/DoctorRequestFlowView.vue'
import DoctorRequestStatusView from '../views/DoctorRequestStatusView.vue'
import AdminDoctorRequestListView from '../views/admin/DoctorRequestListView.vue'
import AdminDoctorRequestDetailView from '../views/admin/DoctorRequestDetailView.vue'
import AdminNotificationSendView from '../views/AdminNotificationSendView.vue'
import AdminContentReportsView from '../views/admin/ContentReportsView.vue'
import AdminProblemReportsView from '../views/admin/ProblemReportsView.vue'
import AccountDeletionView from '../views/AccountDeletionView.vue'
import PendingAccountDeletionsView from '../views/PendingAccountDeletionsView.vue'
import DoctorGuideView from '../views/DoctorGuideView.vue'
import ExternalLinksView from '../views/ExternalLinksView.vue'
import DoctorSubscriptionPackagesView from '../views/DoctorSubscriptionPackagesView.vue'
import CareIntegrationView from '../views/CareIntegrationView.vue'

const defaultPageTitle = 'تحميل تطبيق عيادتي'
const defaultPageDescription =
  'حمّل تطبيق عيادتي لحجز المواعيد الطبية، متابعة الملفات الطبية، والتواصل مع الأطباء بسهولة وأمان.'

function setMetaContent(selector: string, content: string) {
  let element = document.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    if (selector.includes('property=')) {
      element.setAttribute('property', selector.match(/property="([^"]+)"/)?.[1] ?? '')
    } else {
      element.name = selector.match(/name="([^"]+)"/)?.[1] ?? ''
    }
    document.head.appendChild(element)
  }
  element.content = content
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { guestOnly: true, title: 'تسجيل الدخول' } },
    { path: '/password-reset', name: 'password-reset', component: PasswordResetView, meta: { title: 'استعادة كلمة المرور' } },
    {
      path: '/download',
      name: 'download-app',
      component: DownloadAppView,
      meta: {
        title: 'تحميل تطبيق عيادتي',
        description: defaultPageDescription,
      },
    },
    {
      path: '/support',
      name: 'support',
      component: SupportView,
      meta: {
        title: 'دعم عيادتي',
        description: 'صفحة دعم مستخدمي تطبيق عيادتي لمشاكل الحساب والحجوزات والرسائل والخصوصية.',
      },
    },
    {
      path: '/privacy-policy',
      name: 'privacy-policy',
      component: PrivacyPolicyView,
      meta: {
        title: 'سياسة الخصوصية | عيادتي',
        description: 'سياسة الخصوصية لتطبيق عيادتي، وتشمل طريقة جمع البيانات واستخدامها وحمايتها وحقوق المستخدمين.',
      },
    },
    { path: '/privacy', redirect: '/privacy-policy' },
    { path: '/account-deletion', name: 'account-deletion', component: AccountDeletionView, meta: { title: 'حذف حساب عيادتي' } },
    { path: '/d/:doctorId', name: 'public-doctor-deep-link', component: PublicDoctorLinkView, meta: { title: 'ملف طبيب في عيادتي' } },
    { path: '/waiting-room/:accessToken', name: 'waiting-room-display', component: WaitingRoomDisplayView, meta: { title: 'شاشة انتظار الطبيب' } },
    { path: '/w/:accessToken', name: 'waiting-room-display-short', component: WaitingRoomDisplayView, meta: { title: 'شاشة انتظار الطبيب' } },
    { path: '/clinic-kiosk/:accessToken', name: 'clinic-kiosk', component: KioskBookingView, meta: { title: 'حجز موعد في العيادة' } },
    { path: '/booking', name: 'visitor-booking', component: VisitorBookingView, meta: { title: 'حجز موعد في عيادتي' } },
    {
      path: '/doctor-request',
      name: 'doctor-request',
      component: DoctorRequestFlowView,
      meta: {
        title: 'تقديم طلب تسجيل في عيادتي',
        description: 'سجل بياناتك وبيانات عيادتك حتى تتم مراجعتها ونشرها داخل تطبيق عيادتي.',
      },
    },
    { path: '/doctor-request/status', name: 'doctor-request-status', component: DoctorRequestStatusView, meta: { title: 'متابعة طلب تسجيل عيادة' } },

    {
      path: '/',
      component: AdminLayout,
      meta: { requiresAuth: true, roles: ['SuperAdmin', 'DoctorUser'] },
      children: [
        { path: '', name: 'dashboard', component: DashboardView, meta: { title: 'الرئيسية' } },
        { path: 'analytics', name: 'analytics', component: AnalyticsView, meta: { title: 'الإحصائيات', roles: ['SuperAdmin', 'DoctorUser'] } },
        { path: 'users', name: 'users', component: UsersView, meta: { title: 'إدارة المستخدمين', roles: ['SuperAdmin'] } },
        { path: 'pending-account-deletions', name: 'pending-account-deletions', component: PendingAccountDeletionsView, meta: { title: 'طلبات حذف الحساب', roles: ['SuperAdmin'] } },
        { path: 'doctors', name: 'doctors', component: DoctorsView, meta: { title: 'إدارة الأطباء', roles: ['SuperAdmin'] } },
        { path: 'doctors/announcement', name: 'doctor-announcement', component: () => import('../views/DoctorAnnouncementView.vue'), meta: { title: 'صورة انضمام طبيب', roles: ['SuperAdmin'] } },
        { path: 'doctors/:doctorId/announcement', name: 'doctor-announcement-prefilled', component: () => import('../views/DoctorAnnouncementView.vue'), meta: { title: 'صورة انضمام طبيب', roles: ['SuperAdmin'] } },
        { path: 'specializations', name: 'specializations', component: SpecializationsView, meta: { title: 'إدارة الاختصاصات', roles: ['SuperAdmin'] } },
        { path: 'doctors/create-with-clinic', name: 'doctor-create-with-clinic', component: DoctorCreateWithClinicView, meta: { title: 'إضافة طبيب مع عيادة', roles: ['SuperAdmin'] } },
        { path: 'doctors/:doctorId', name: 'doctor-details', component: DoctorDetailsView, meta: { title: 'تفاصيل الطبيب', roles: ['SuperAdmin'] } },
        { path: 'subscriptions', name: 'subscriptions', component: SubscriptionsView, meta: { title: 'الاشتراكات والباقات', roles: ['SuperAdmin'] } },
        { path: 'care-subscriptions', name: 'care-subscriptions', component: CareSubscriptionsView, meta: { title: 'اشتراكات عيادتي كير', roles: ['SuperAdmin'] } },
        { path: 'app-versions', name: 'app-versions', component: AppVersionsView, meta: { title: 'سياسات التحديث', roles: ['SuperAdmin'] } },
        { path: 'app-releases', name: 'app-releases', component: AppVersionManagementView, meta: { title: 'إصدارات APK', roles: ['SuperAdmin'] } },
        { path: 'whatsapp', name: 'whatsapp', component: WhatsAppView, meta: { title: 'WhatsApp OTP', roles: ['SuperAdmin'] } },
        { path: 'otpiq-test', name: 'otpiq-test', component: OtpiqTestView, meta: { title: 'اختبار واتساب', roles: ['SuperAdmin'] } },
        { path: 'backup-restore', name: 'backup-restore', component: BackupRestoreView, meta: { title: 'النسخ الاحتياطي', roles: ['SuperAdmin'] } },
        { path: 'doctor-requests', name: 'doctor-requests', component: AdminDoctorRequestListView, meta: { title: 'طلبات تسجيل الأطباء', roles: ['SuperAdmin'] } },
        { path: 'doctor-requests/:id', name: 'doctor-request-detail', component: AdminDoctorRequestDetailView, meta: { title: 'تفاصيل الطلب', roles: ['SuperAdmin'] } },
        { path: 'content-reports', name: 'content-reports', component: AdminContentReportsView, meta: { title: 'بلاغات المحتوى', roles: ['SuperAdmin'] } },
        { path: 'problem-reports', name: 'problem-reports', component: AdminProblemReportsView, meta: { title: 'بلاغات المشاكل', roles: ['SuperAdmin'] } },
        { path: 'admin-notifications/send', name: 'admin-notifications-send', component: AdminNotificationSendView, meta: { title: 'إرسال إشعار', roles: ['SuperAdmin'] } },
        { path: 'waiting-rooms', name: 'waiting-rooms-admin', component: WaitingRoomsAdminView, meta: { title: 'مراقبة شاشات الانتظار', roles: ['SuperAdmin'] } },
        { path: 'offers', name: 'offers', component: OffersView, meta: { title: 'العروض', roles: ['SuperAdmin', 'DoctorUser'] } },
        { path: 'clinics', name: 'clinics', component: ClinicsView, meta: { title: 'العيادات', roles: ['SuperAdmin', 'DoctorUser'] } },
        { path: 'appointments', name: 'appointments', component: AppointmentsView, meta: { title: 'الحجوزات اليومية', roles: ['SuperAdmin', 'DoctorUser'] } },
        { path: 'waiting-room-control', name: 'waiting-room-control', component: WaitingRoomControlView, meta: { title: 'شاشة الانتظار', roles: ['DoctorUser'] } },
        { path: 'features', name: 'features', component: FeaturesView, meta: { title: 'مميزات الاشتراك', roles: ['DoctorUser'] } },
        { path: 'exceptions', name: 'exceptions', component: ExceptionsView, meta: { title: 'الإجازات والاستثناءات', roles: ['DoctorUser'] } },
        { path: 'notifications', name: 'notifications', component: NotificationsView, meta: { title: 'الإشعارات', roles: ['SuperAdmin', 'DoctorUser'] } },
        { path: 'messages', name: 'messages', component: MessagesView, meta: { title: 'الرسائل', roles: ['DoctorUser'] } },
        { path: 'reviews', name: 'reviews', component: ReviewsView, meta: { title: 'التقييمات', roles: ['DoctorUser'] } },
        { path: 'profile', name: 'profile', component: ProfileView, meta: { title: 'الملف الشخصي', roles: ['DoctorUser'] } },
        { path: 'problem-report', name: 'problem-report', component: ProblemReportView, meta: { title: 'الإبلاغ عن مشكلة', roles: ['DoctorUser'] } },
        { path: 'doctor-guide', name: 'doctor-guide', component: DoctorGuideView, meta: { title: 'دليل استخدام الطبيب', roles: ['DoctorUser'] } },
        { path: 'external-links', name: 'external-links', component: ExternalLinksView, meta: { title: 'الروابط الخارجية', roles: ['DoctorUser'] } },
        { path: 'subscription-packages', name: 'subscription-packages', component: DoctorSubscriptionPackagesView, meta: { title: 'أنواع الاشتراكات', roles: ['DoctorUser'] } },
        { path: 'care-integration', name: 'care-integration', component: CareIntegrationView, meta: { title: 'ربط عيادتي كير', roles: ['DoctorUser'] } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia)
  const needsSession = Boolean(to.meta.requiresAuth || to.meta.guestOnly || to.meta.roles)
  const hasSession = needsSession ? await auth.ensureSession() : false

  if (to.meta.guestOnly && hasSession) return { name: 'dashboard' }
  if (to.meta.requiresAuth && !hasSession) return { name: 'login' }

  const roles = (to.meta.roles as string[] | undefined) ?? []
  if (roles.length && !auth.hasAnyRole(roles)) return { name: 'dashboard' }
})

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? defaultPageTitle
  const description = (to.meta.description as string | undefined) ?? defaultPageDescription
  const canonicalUrl = new URL(to.fullPath, 'https://eyadaty.techumbrella.net').toString()

  document.title = title.includes('عيادتي') ? title : `${title} | عيادتي`
  setMetaContent('meta[name="description"]', description)
  setMetaContent('meta[property="og:title"]', document.title)
  setMetaContent('meta[property="og:description"]', description)
  setMetaContent('meta[property="og:url"]', canonicalUrl)
  setMetaContent('meta[name="twitter:title"]', document.title)
  setMetaContent('meta[name="twitter:description"]', description)
})

export default router
