<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

type Language = 'ar' | 'en'

const language = ref<Language>('ar')

const copy = {
  ar: {
    dir: 'rtl',
    pageTitle: 'دعم عيادتي',
    metaDescription: 'صفحة دعم مستخدمي تطبيق عيادتي لمشاكل الحساب والحجوزات والرسائل والخصوصية.',
    appPage: 'صفحة التطبيق',
    helpCenter: 'مركز المساعدة',
    description: 'نحن هنا لمساعدتك في مشاكل الحساب، الحجوزات، الرسائل، أو استخدام التطبيق.',
    languageLabel: 'اللغة',
    channelsLabel: 'وسائل التواصل والدعم',
    topicsLabel: 'أقسام الدعم',
    topicsTitle: 'اختر الموضوع الأقرب لمشكلتك عند التواصل معنا',
    privacyTitle: 'سياسة الخصوصية',
    privacyText: 'يمكنك الاطلاع على سياسة الخصوصية لمعرفة طريقة تعامل عيادتي مع بيانات المستخدمين وطلبات حذف الحساب.',
    privacyAction: 'فتح سياسة الخصوصية',
    channels: {
      email: 'البريد الإلكتروني',
      phone: 'رقم الهاتف / واتساب',
      hours: 'ساعات الدعم',
      hoursValue: '24 ساعة',
    },
    topics: [
      {
        icon: 'mdi-account-key-outline',
        title: 'مشاكل الحساب وتسجيل الدخول',
        text: 'مساعدة في الدخول للحساب، رمز التحقق، تغيير رقم الهاتف، أو مشاكل الوصول للخدمة.',
      },
      {
        icon: 'mdi-calendar-check-outline',
        title: 'مشاكل الحجوزات والمواعيد',
        text: 'متابعة حالة الحجز، تعديل الموعد، الإلغاء، أو أي مشكلة تظهر أثناء حجز زيارة.',
      },
      {
        icon: 'mdi-message-text-outline',
        title: 'التواصل مع الطبيب أو الرسائل',
        text: 'دعم مشاكل إرسال الرسائل، استلام الردود، أو ظهور المحادثات داخل التطبيق.',
      },
      {
        icon: 'mdi-shield-account-outline',
        title: 'حذف الحساب والخصوصية',
        text: 'مساعدة في طلب حذف الحساب، إدارة البيانات، أو الاستفسارات المتعلقة بالخصوصية.',
      },
    ],
  },
  en: {
    dir: 'ltr',
    pageTitle: 'Eyadaty Support',
    metaDescription: 'Support page for Eyadaty app users, covering account, booking, messaging, and privacy issues.',
    appPage: 'App page',
    helpCenter: 'Help Center',
    description: 'We are here to help with account issues, bookings, messages, or using the app.',
    languageLabel: 'Language',
    channelsLabel: 'Contact and support channels',
    topicsLabel: 'Support topics',
    topicsTitle: 'Choose the topic closest to your issue when contacting us',
    privacyTitle: 'Privacy Policy',
    privacyText: 'You can review the privacy policy to learn how Eyadaty handles user data and account deletion requests.',
    privacyAction: 'Open Privacy Policy',
    channels: {
      email: 'Email',
      phone: 'Phone / WhatsApp',
      hours: 'Support hours',
      hoursValue: '24 hours',
    },
    topics: [
      {
        icon: 'mdi-account-key-outline',
        title: 'Account and login issues',
        text: 'Help with signing in, verification codes, changing phone numbers, or account access issues.',
      },
      {
        icon: 'mdi-calendar-check-outline',
        title: 'Booking and appointment issues',
        text: 'Follow up on booking status, appointment changes, cancellation, or issues while booking a visit.',
      },
      {
        icon: 'mdi-message-text-outline',
        title: 'Doctor communication and messages',
        text: 'Support for sending messages, receiving replies, or viewing conversations inside the app.',
      },
      {
        icon: 'mdi-shield-account-outline',
        title: 'Account deletion and privacy',
        text: 'Help with account deletion requests, data management, or privacy-related questions.',
      },
    ],
  },
} as const

const currentCopy = computed(() => copy[language.value])
const isArabic = computed(() => language.value === 'ar')

const supportChannels = computed(() => [
  {
    icon: 'mdi-email-outline',
    label: currentCopy.value.channels.email,
    value: 'eyadaty.iq@gmail.com',
    href: 'mailto:eyadaty.iq@gmail.com',
  },
  {
    icon: 'mdi-whatsapp',
    label: currentCopy.value.channels.phone,
    value: '+9647702920080',
    href: 'https://wa.me/9647702920080',
  },
  {
    icon: 'mdi-clock-outline',
    label: currentCopy.value.channels.hours,
    value: currentCopy.value.channels.hoursValue,
    href: '',
  },
])

function setPageMeta() {
  document.title = currentCopy.value.pageTitle

  let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (!metaDesc) {
    metaDesc = document.createElement('meta')
    metaDesc.name = 'description'
    document.head.appendChild(metaDesc)
  }
  metaDesc.content = currentCopy.value.metaDescription
}

onMounted(setPageMeta)

watch(language, setPageMeta)

function switchLanguage(nextLanguage: Language) {
  language.value = nextLanguage
}
</script>

<template>
  <main class="support-page" :dir="currentCopy.dir" :lang="language">
    <section class="support-hero">
      <div class="support-hero__inner">
        <div class="support-topbar">
          <RouterLink to="/download" class="support-back">
            <v-icon :icon="isArabic ? 'mdi-arrow-right' : 'mdi-arrow-left'" size="18" />
            {{ currentCopy.appPage }}
          </RouterLink>

          <div class="language-switch" :aria-label="currentCopy.languageLabel">
            <button
              type="button"
              :class="{ 'language-switch__option--active': language === 'ar' }"
              class="language-switch__option"
              @click="switchLanguage('ar')"
            >
              العربية
            </button>
            <button
              type="button"
              :class="{ 'language-switch__option--active': language === 'en' }"
              class="language-switch__option"
              @click="switchLanguage('en')"
            >
              English
            </button>
          </div>
        </div>

        <div class="support-brand">
          <img src="/app-logo.png" alt="Eyadaty" class="support-logo" />
          <span>{{ currentCopy.helpCenter }}</span>
        </div>

        <div class="support-hero__grid">
          <div class="support-hero__copy">
            <h1>{{ currentCopy.pageTitle }}</h1>
            <p>
              {{ currentCopy.description }}
            </p>
          </div>

          
        </div>
      </div>
    </section>

    <section class="support-shell" :aria-label="currentCopy.channelsLabel">
      <div class="contact-grid">
        <a
          v-for="channel in supportChannels"
          :key="channel.label"
          class="contact-card"
          :href="channel.href || undefined"
        >
          <span class="contact-icon">
            <v-icon :icon="channel.icon" size="24" />
          </span>
          <span class="contact-label">{{ channel.label }}</span>
          <strong>{{ channel.value }}</strong>
        </a>
      </div>

      <div class="support-content">
        <section class="topics-section">
          <div class="section-heading">
            <span>{{ currentCopy.topicsLabel }}</span>
            <h2>{{ currentCopy.topicsTitle }}</h2>
          </div>

          <div class="topics-grid">
            <article v-for="topic in currentCopy.topics" :key="topic.title" class="topic-card">
              <div class="topic-icon">
                <v-icon :icon="topic.icon" size="24" />
              </div>
              <h3>{{ topic.title }}</h3>
              <p>{{ topic.text }}</p>
            </article>
          </div>
        </section>

        <section class="privacy-section">
          <div>
            <h2>{{ currentCopy.privacyTitle }}</h2>
            <p>
              {{ currentCopy.privacyText }}
            </p>
          </div>
          <a
            class="privacy-link"
            href="https://eyadaty.techumbrella.net/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            <v-icon icon="mdi-open-in-new" size="18" />
            {{ currentCopy.privacyAction }}
          </a>
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped>
.support-page {
  min-height: 100vh;
  background:
    linear-gradient(180deg, rgba(228, 244, 240, 0.94) 0%, rgba(246, 249, 248, 0.98) 45%, #ffffff 100%);
  color: var(--color-text);
}

.support-page[dir='ltr'] {
  direction: ltr;
  text-align: left;
}

.support-page[dir='rtl'] {
  direction: rtl;
  text-align: right;
}

.support-hero {
  padding: 28px 18px 34px;
}

.support-hero__inner,
.support-shell {
  width: min(1080px, calc(100% - 36px));
  margin: 0 auto;
}

.support-back,
.support-brand,
.contact-card,
.privacy-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.support-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.support-back {
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid rgba(19, 121, 107, 0.18);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.72);
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 700;
}

.language-switch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 42px;
  padding: 5px;
  border: 1px solid rgba(19, 121, 107, 0.24);
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 8px 22px rgba(29, 74, 68, 0.08);
}

.language-switch__option {
  min-height: 32px;
  min-width: 86px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0;
  text-align: center;
  transition: background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.language-switch__option:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.language-switch__option--active {
  background: var(--color-primary);
  color: #ffffff;
  box-shadow: 0 6px 14px rgba(19, 121, 107, 0.22);
}

.language-switch__option--active:hover {
  background: var(--color-primary);
  color: #ffffff;
}

.support-brand {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  margin-top: 32px;
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 800;
  text-align: center;
}

.support-logo {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: var(--shadow-sm);
  object-fit: contain;
}

.support-hero__grid {
  display: grid;
  grid-template-columns: 1fr;
  justify-items: center;
  gap: 18px;
  margin-top: 20px;
}

.support-hero__copy {
  width: 100%;
  text-align: center;
}

.support-hero h1 {
  max-width: 780px;
  margin: 0 auto 12px;
  font-size: clamp(36px, 7vw, 64px);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: 0;
}

.support-hero__copy p {
  max-width: 740px;
  margin: 0 auto;
  color: var(--color-text-secondary);
  font-size: clamp(16px, 2vw, 19px);
  line-height: 1.9;
}

.support-note {
  display: grid;
  gap: 12px;
  width: min(620px, 100%);
  padding: 18px;
  border: 1px solid rgba(52, 111, 177, 0.18);
  border-radius: var(--radius-lg);
  background: var(--color-info-light);
  color: var(--color-info);
  text-align: center;
  box-shadow: var(--shadow-sm);
}

.support-note .v-icon {
  margin-inline: auto;
}

.support-note p {
  margin: 0;
  color: #315f91;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.8;
}

.support-shell {
  display: grid;
  gap: 22px;
  padding-bottom: 56px;
}

.contact-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.contact-card {
  min-height: 132px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: var(--shadow-sm);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.contact-card:hover {
  border-color: rgba(19, 121, 107, 0.32);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.contact-icon,
.topic-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.contact-icon {
  width: 46px;
  height: 46px;
}

.contact-label {
  margin-top: 8px;
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 700;
}

.contact-card strong {
  max-width: 100%;
  color: var(--color-text);
  font-size: 18px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.support-page[dir='ltr'] :is(.support-back, .contact-card, .topic-card, .privacy-section, .privacy-link) {
  text-align: left;
}

.support-page[dir='rtl'] :is(.support-back, .contact-card, .topic-card, .privacy-section, .privacy-link) {
  text-align: right;
}

.support-content {
  display: grid;
  gap: 18px;
}

.topics-section,
.privacy-section {
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow-sm);
}

.section-heading {
  margin-bottom: 18px;
}

.section-heading span {
  display: inline-flex;
  margin-bottom: 8px;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 800;
}

.section-heading h2,
.privacy-section h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.35;
}

.topics-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.topic-card {
  padding: 18px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
}

.topic-icon {
  width: 46px;
  height: 46px;
  margin-bottom: 12px;
}

.topic-card h3 {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 800;
}

.topic-card p,
.privacy-section p {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.8;
}

.privacy-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-color: rgba(181, 107, 47, 0.24);
  background: linear-gradient(180deg, #ffffff 0%, var(--color-warning-light) 100%);
}

.privacy-section p {
  margin-top: 8px;
}

.privacy-link {
  min-height: 44px;
  flex: 0 0 auto;
  padding: 0 16px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: #ffffff;
  font-weight: 800;
}

@media (max-width: 900px) {
  .support-hero__grid,
  .contact-grid,
  .topics-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .support-hero {
    padding-inline: 14px;
  }

  .support-topbar {
    align-items: stretch;
    flex-direction: column;
  }

  .support-back,
  .language-switch {
    justify-content: center;
    width: 100%;
  }

  .language-switch__option {
    flex: 1 1 0;
  }

  .support-hero__inner,
  .support-shell {
    width: calc(100% - 28px);
  }

  .support-brand {
    margin-top: 24px;
  }

  .support-note,
  .contact-card,
  .topics-section,
  .privacy-section {
    padding: 18px;
    border-radius: var(--radius-md);
  }

  .privacy-section {
    align-items: stretch;
    flex-direction: column;
  }

  .privacy-link {
    justify-content: center;
    width: 100%;
  }
}
</style>
