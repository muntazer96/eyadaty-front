<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

type Language = 'ar' | 'en'

const language = ref<Language>('ar')

const copy = {
  ar: {
    dir: 'rtl',
    title: 'سياسة الخصوصية',
    pageTitle: 'سياسة الخصوصية - عيادتي',
    metaDescription: 'سياسة الخصوصية لتطبيق عيادتي، وتشمل طريقة جمع البيانات واستخدامها وحمايتها وحقوق المستخدمين.',
    appPage: 'العودة إلى التحميل',
    badge: 'خصوصيتك جزء أساسي من الخدمة',
    intro:
      'توضح هذه السياسة كيف يتعامل تطبيق عيادتي مع بيانات المستخدمين، ولماذا نحتاج بعض المعلومات لتقديم خدمات الحجز والمتابعة الطبية بصورة آمنة ومنظمة.',
    lastUpdated: '12 تموز 2026',
    lastUpdatedLabel: 'آخر تحديث',
    scope: 'تنطبق على التطبيق ولوحة الخدمات المرتبطة به',
    summaryLabel: 'ملخص سياسة الخصوصية',
    summaryTitle: 'ملخص سريع',
    summaryText:
      'نجمع الحد الأدنى من البيانات اللازمة لتشغيل الحسابات والحجوزات والإشعارات. لا نبيع بياناتك، ولا نشاركها إلا لتقديم الخدمة أو عند وجود التزام قانوني.',
    summaryPoints: ['استخدام محدد وواضح', 'حماية تقنية وتنظيمية', 'حقوق وصول وتصحيح وحذف'],
    sections: {
      collectedTitle: 'البيانات التي قد نجمعها',
      collectedText: 'تختلف البيانات حسب طريقة استخدامك للتطبيق ونوع الحساب والخدمات التي تختارها.',
      useTitle: 'كيف نستخدم البيانات',
      useText: 'نستخدم البيانات لتقديم الخدمة وتحسينها وحماية المستخدمين.',
      sharingTitle: 'مشاركة البيانات',
      sharingText: 'لا نقوم ببيع بياناتك الشخصية. قد تتم مشاركة قدر محدود من البيانات في الحالات التالية فقط.',
      healthTitle: 'تنبيه بخصوص البيانات الصحية',
      healthText:
        'المعلومات الصحية التي تقدمها داخل التطبيق تستخدم لتسهيل تقديم الخدمة ولا تعد بديلا عن استشارة طبية مباشرة. يرجى مشاركة المعلومات الطبية الحساسة فقط عند الحاجة وبالقدر المناسب للخدمة المطلوبة.',
      securityTitle: 'الأمان والاحتفاظ بالبيانات',
      securityText: 'نعمل على حماية البيانات من الوصول غير المصرح به أو الفقدان أو سوء الاستخدام.',
      rightsTitle: 'حقوقك وخياراتك',
      rightsText: 'يمكنك طلب إدارة بياناتك بما يتوافق مع طبيعة الخدمة والمتطلبات النظامية.',
      childrenTitle: 'الأطفال وتحديث السياسة',
      childrenText: 'الخدمة موجهة للاستخدام الصحي والإداري المسؤول.',
      childrenBody:
        'إذا كان المستخدم قاصرا، فيجب أن يتم استخدام الخدمة بإشراف ولي الأمر أو من ينوب عنه. قد نقوم بتحديث هذه السياسة عند تطوير الخدمة أو تغيير طريقة معالجة البيانات، وسيتم نشر النسخة الأحدث في هذه الصفحة.',
      contactTitle: 'التواصل بخصوص الخصوصية',
      contactText:
        'لأي طلب متعلق بالخصوصية أو إدارة البيانات، يرجى التواصل مع فريق عيادتي من خلال قنوات الدعم الرسمية داخل التطبيق أو لوحة الخدمة.',
    },
    dataCategories: [
      {
        icon: 'mdi-account-heart',
        title: 'بيانات الحساب والهوية',
        items: ['الاسم ورقم الهاتف', 'معلومات تسجيل الدخول', 'نوع الحساب: مريض أو طبيب أو مدير'],
      },
      {
        icon: 'mdi-calendar-clock',
        title: 'بيانات الحجز والخدمات',
        items: ['المواعيد والحجوزات', 'العيادة أو الطبيب المختار', 'حالة الطلبات والإشعارات المرتبطة بها'],
      },
      {
        icon: 'mdi-stethoscope',
        title: 'بيانات صحية تقدمها أنت',
        items: ['ملاحظات طبية أو أعراض يتم إدخالها داخل التطبيق', 'ملفات أو معلومات مرفقة بطلبات الخدمة عند توفرها'],
      },
      {
        icon: 'mdi-cellphone-cog',
        title: 'بيانات تقنية وتشغيلية',
        items: ['نوع الجهاز ونظام التشغيل', 'سجلات الأخطاء والاستخدام', 'رموز الإشعارات لتحسين وصول التنبيهات'],
      },
    ],
    useCases: [
      'إنشاء الحساب وتسجيل الدخول والتحقق من هوية المستخدم.',
      'إدارة الحجوزات والمواعيد والتواصل بين المرضى والأطباء والعيادات.',
      'إرسال الإشعارات المهمة مثل تذكير الموعد أو تحديث حالة الطلب.',
      'تحسين جودة التطبيق، تحليل الأعطال، وتطوير الخدمات.',
      'حماية الحسابات ومنع إساءة الاستخدام أو محاولات الوصول غير المصرح بها.',
    ],
    sharingPanels: [
      {
        title: 'مع مقدمي الخدمة داخل عيادتي',
        text: 'قد تظهر بيانات الحجز أو بيانات التواصل للطبيب أو العيادة عند الحاجة لإكمال الموعد أو متابعة الخدمة.',
      },
      {
        title: 'مع مزودي البنية التقنية',
        text: 'نستخدم خدمات تشغيل واستضافة وإشعارات تساعدنا في تشغيل التطبيق، مع تقييد الوصول للبيانات حسب الحاجة.',
      },
      {
        title: 'عند المتطلبات القانونية',
        text: 'قد نكشف بيانات محددة إذا تطلب القانون ذلك أو لحماية حقوق المستخدمين وسلامة المنصة.',
      },
    ],
    securityPanels: [
      {
        title: 'إجراءات الحماية',
        text: 'نعتمد ضوابط وصول، اتصال آمن عند توفره، مراجعة صلاحيات، ومتابعة للأخطاء لتحسين أمان الخدمة.',
      },
      {
        title: 'مدة الاحتفاظ',
        text: 'نحتفظ بالبيانات للمدة اللازمة لتقديم الخدمة أو الامتثال للمتطلبات النظامية أو حل النزاعات التشغيلية.',
      },
    ],
    rights: [
      'طلب الاطلاع على بياناتك الشخصية المتوفرة لدينا.',
      'طلب تصحيح البيانات غير الدقيقة أو تحديث معلومات الحساب.',
      'طلب حذف الحساب أو بعض البيانات متى كان ذلك ممكنا نظاميا وتشغيليا.',
      'إيقاف الإشعارات غير الضرورية من إعدادات الجهاز أو التطبيق.',
    ],
  },
  en: {
    dir: 'ltr',
    title: 'Privacy Policy',
    pageTitle: 'Privacy Policy - Eyadaty',
    metaDescription:
      'Privacy policy for the Eyadaty app, including how data is collected, used, protected, and user rights.',
    appPage: 'Back to download',
    badge: 'Your privacy is a core part of the service',
    intro:
      'This policy explains how the Eyadaty app handles user data and why we need certain information to provide booking and medical follow-up services safely and reliably.',
    lastUpdated: 'July 12, 2026',
    lastUpdatedLabel: 'Last updated',
    scope: 'Applies to the app and related service dashboard',
    summaryLabel: 'Privacy policy summary',
    summaryTitle: 'Quick Summary',
    summaryText:
      'We collect the minimum data needed to operate accounts, bookings, and notifications. We do not sell your data, and we only share it to provide the service or when legally required.',
    summaryPoints: ['Clear and limited use', 'Technical and organizational protection', 'Access, correction, and deletion rights'],
    sections: {
      collectedTitle: 'Data We May Collect',
      collectedText: 'The data may vary depending on how you use the app, your account type, and the services you choose.',
      useTitle: 'How We Use Data',
      useText: 'We use data to provide and improve the service and protect users.',
      sharingTitle: 'Data Sharing',
      sharingText: 'We do not sell your personal data. A limited amount of data may be shared only in the following cases.',
      healthTitle: 'Notice About Health Data',
      healthText:
        'Health information you provide in the app is used to help deliver the service and is not a substitute for direct medical advice. Please share sensitive medical information only when needed and only to the extent appropriate for the requested service.',
      securityTitle: 'Security and Data Retention',
      securityText: 'We work to protect data from unauthorized access, loss, or misuse.',
      rightsTitle: 'Your Rights and Choices',
      rightsText: 'You may request to manage your data in accordance with the service nature and applicable requirements.',
      childrenTitle: 'Children and Policy Updates',
      childrenText: 'The service is intended for responsible medical and administrative use.',
      childrenBody:
        'If the user is a minor, the service should be used under the supervision of a parent, guardian, or authorized representative. We may update this policy as the service evolves or as our data processing practices change, and the latest version will be published on this page.',
      contactTitle: 'Privacy Contact',
      contactText:
        'For any privacy or data management request, please contact the Eyadaty team through the official support channels inside the app or service dashboard.',
    },
    dataCategories: [
      {
        icon: 'mdi-account-heart',
        title: 'Account and Identity Data',
        items: ['Name and phone number', 'Login information', 'Account type: patient, doctor, or administrator'],
      },
      {
        icon: 'mdi-calendar-clock',
        title: 'Booking and Service Data',
        items: ['Appointments and bookings', 'Selected clinic or doctor', 'Request status and related notifications'],
      },
      {
        icon: 'mdi-stethoscope',
        title: 'Health Data You Provide',
        items: ['Medical notes or symptoms entered in the app', 'Files or information attached to service requests when available'],
      },
      {
        icon: 'mdi-cellphone-cog',
        title: 'Technical and Operational Data',
        items: ['Device type and operating system', 'Error and usage logs', 'Notification tokens to improve alert delivery'],
      },
    ],
    useCases: [
      'Creating accounts, signing in, and verifying user identity.',
      'Managing bookings, appointments, and communication between patients, doctors, and clinics.',
      'Sending important notifications such as appointment reminders or request status updates.',
      'Improving app quality, analyzing failures, and developing services.',
      'Protecting accounts and preventing misuse or unauthorized access attempts.',
    ],
    sharingPanels: [
      {
        title: 'With Service Providers Inside Eyadaty',
        text: 'Booking or contact data may be shown to the doctor or clinic when needed to complete an appointment or follow up on a service.',
      },
      {
        title: 'With Technical Infrastructure Providers',
        text: 'We use hosting, operations, and notification services that help us run the app, while limiting access to data based on need.',
      },
      {
        title: 'When Legally Required',
        text: 'We may disclose specific data if required by law or to protect user rights and platform safety.',
      },
    ],
    securityPanels: [
      {
        title: 'Protection Measures',
        text: 'We use access controls, secure connections where available, permission reviews, and error monitoring to improve service security.',
      },
      {
        title: 'Retention Period',
        text: 'We keep data for as long as needed to provide the service, comply with legal requirements, or resolve operational disputes.',
      },
    ],
    rights: [
      'Request access to the personal data we have about you.',
      'Request correction of inaccurate data or updates to account information.',
      'Request deletion of your account or some data when legally and operationally possible.',
      'Disable non-essential notifications from your device or app settings.',
    ],
  },
} as const

const currentCopy = computed(() => copy[language.value])
const isArabic = computed(() => language.value === 'ar')

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
  <main class="privacy-page" :dir="currentCopy.dir" :lang="language">
    <section class="privacy-hero">
      <div class="privacy-hero__content">
        <div class="privacy-topbar">
          <RouterLink to="/download" class="privacy-back">
            <v-icon :icon="isArabic ? 'mdi-arrow-right' : 'mdi-arrow-left'" size="18" />
            {{ currentCopy.appPage }}
          </RouterLink>

          <div class="language-switch" aria-label="Language">
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

        <div class="privacy-badge">
          <v-icon icon="mdi-shield-check" size="18" />
          {{ currentCopy.badge }}
        </div>

        <h1>{{ currentCopy.title }}</h1>
        <p>{{ currentCopy.intro }}</p>

        <div class="privacy-meta">
          <span>
            <v-icon icon="mdi-calendar-edit" size="17" />
            {{ currentCopy.lastUpdatedLabel }}: {{ currentCopy.lastUpdated }}
          </span>
          <span>
            <v-icon icon="mdi-web" size="17" />
            {{ currentCopy.scope }}
          </span>
        </div>
      </div>
    </section>

    <section class="privacy-shell">
      <aside class="privacy-summary" :aria-label="currentCopy.summaryLabel">
        <h2>{{ currentCopy.summaryTitle }}</h2>
        <p>{{ currentCopy.summaryText }}</p>
        <div class="summary-points">
          <span v-for="(point, index) in currentCopy.summaryPoints" :key="point">
            <v-icon
              :icon="index === 0 ? 'mdi-check-circle' : index === 1 ? 'mdi-lock-outline' : 'mdi-account-check-outline'"
              size="17"
            />
            {{ point }}
          </span>
        </div>
      </aside>

      <div class="privacy-content">
        <section class="policy-section">
          <div class="section-heading">
            <span class="section-number">01</span>
            <div>
              <h2>{{ currentCopy.sections.collectedTitle }}</h2>
              <p>{{ currentCopy.sections.collectedText }}</p>
            </div>
          </div>

          <div class="data-grid">
            <article v-for="category in currentCopy.dataCategories" :key="category.title" class="data-card">
              <div class="data-icon">
                <v-icon :icon="category.icon" size="24" />
              </div>
              <h3>{{ category.title }}</h3>
              <ul>
                <li v-for="item in category.items" :key="item">{{ item }}</li>
              </ul>
            </article>
          </div>
        </section>

        <section class="policy-section">
          <div class="section-heading">
            <span class="section-number">02</span>
            <div>
              <h2>{{ currentCopy.sections.useTitle }}</h2>
              <p>{{ currentCopy.sections.useText }}</p>
            </div>
          </div>

          <ul class="policy-list">
            <li v-for="useCase in currentCopy.useCases" :key="useCase">
              <v-icon icon="mdi-check" size="18" />
              <span>{{ useCase }}</span>
            </li>
          </ul>
        </section>

        <section class="policy-section">
          <div class="section-heading">
            <span class="section-number">03</span>
            <div>
              <h2>{{ currentCopy.sections.sharingTitle }}</h2>
              <p>{{ currentCopy.sections.sharingText }}</p>
            </div>
          </div>

          <div class="split-grid">
            <div v-for="panel in currentCopy.sharingPanels" :key="panel.title" class="plain-panel">
              <h3>{{ panel.title }}</h3>
              <p>{{ panel.text }}</p>
            </div>
          </div>
        </section>

        <section class="policy-section notice-section">
          <div class="notice-icon">
            <v-icon icon="mdi-medical-bag" size="28" />
          </div>
          <div>
            <h2>{{ currentCopy.sections.healthTitle }}</h2>
            <p>{{ currentCopy.sections.healthText }}</p>
          </div>
        </section>

        <section class="policy-section">
          <div class="section-heading">
            <span class="section-number">04</span>
            <div>
              <h2>{{ currentCopy.sections.securityTitle }}</h2>
              <p>{{ currentCopy.sections.securityText }}</p>
            </div>
          </div>

          <div class="split-grid split-grid--two">
            <div v-for="panel in currentCopy.securityPanels" :key="panel.title" class="plain-panel">
              <h3>{{ panel.title }}</h3>
              <p>{{ panel.text }}</p>
            </div>
          </div>
        </section>

        <section class="policy-section">
          <div class="section-heading">
            <span class="section-number">05</span>
            <div>
              <h2>{{ currentCopy.sections.rightsTitle }}</h2>
              <p>{{ currentCopy.sections.rightsText }}</p>
            </div>
          </div>

          <ul class="policy-list">
            <li v-for="right in currentCopy.rights" :key="right">
              <v-icon icon="mdi-account-lock-open-outline" size="18" />
              <span>{{ right }}</span>
            </li>
          </ul>
        </section>

        <section class="policy-section">
          <div class="section-heading">
            <span class="section-number">06</span>
            <div>
              <h2>{{ currentCopy.sections.childrenTitle }}</h2>
              <p>{{ currentCopy.sections.childrenText }}</p>
            </div>
          </div>

          <p class="body-copy">{{ currentCopy.sections.childrenBody }}</p>
        </section>

        <section class="contact-section">
          <div>
            <h2>{{ currentCopy.sections.contactTitle }}</h2>
            <p>{{ currentCopy.sections.contactText }}</p>
          </div>
          <RouterLink to="/download" class="contact-action">
            <v-icon icon="mdi-download" size="19" />
            {{ currentCopy.appPage }}
          </RouterLink>
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped>
.privacy-page {
  min-height: 100vh;
  background:
    linear-gradient(180deg, rgba(228, 244, 240, 0.92) 0%, rgba(246, 249, 248, 0.98) 42%, #ffffff 100%);
  color: var(--color-text);
}

.privacy-page[dir='ltr'] {
  direction: ltr;
  text-align: left;
}

.privacy-page[dir='rtl'] {
  direction: rtl;
  text-align: right;
}

.privacy-hero {
  padding: 28px 18px 38px;
}

.privacy-hero__content {
  width: min(1080px, 100%);
  margin: 0 auto;
}

.privacy-back,
.privacy-badge,
.privacy-meta span,
.summary-points span,
.contact-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.privacy-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.privacy-back {
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid rgba(19, 121, 107, 0.18);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.7);
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

.privacy-badge {
  display: flex;
  width: fit-content;
  margin-top: 34px;
  margin-inline: auto;
  padding: 8px 12px;
  border-radius: 999px;
  background: #ffffff;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 700;
  box-shadow: var(--shadow-sm);
}

.privacy-hero h1 {
  max-width: 780px;
  margin: 18px auto 12px;
  font-size: clamp(34px, 7vw, 62px);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: 0;
  text-align: center;
}

.privacy-hero p {
  max-width: 760px;
  margin: 0 auto;
  color: var(--color-text-secondary);
  font-size: clamp(16px, 2vw, 19px);
  line-height: 1.9;
  text-align: center;
}

.privacy-meta {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.privacy-meta span {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.72);
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.privacy-shell {
  display: grid;
  grid-template-columns: minmax(230px, 300px) minmax(0, 1fr);
  gap: 24px;
  width: min(1080px, calc(100% - 36px));
  margin: 0 auto;
  padding-bottom: 56px;
}

.privacy-summary {
  position: sticky;
  top: 18px;
  align-self: start;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.privacy-summary h2,
.policy-section h2,
.contact-section h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
}

.privacy-summary p,
.section-heading p,
.plain-panel p,
.notice-section p,
.contact-section p,
.body-copy {
  margin: 8px 0 0;
  color: var(--color-text-secondary);
  line-height: 1.8;
}

.summary-points {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.summary-points span {
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 700;
}

.privacy-content {
  display: grid;
  gap: 18px;
}

.policy-section,
.contact-section {
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow-sm);
}

.section-heading {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 18px;
}

.section-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: var(--radius-md);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 800;
}

.data-grid,
.split-grid {
  display: grid;
  gap: 14px;
}

.data-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.split-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.split-grid--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.data-card,
.plain-panel {
  padding: 18px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
}

.data-icon,
.notice-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.data-icon {
  width: 46px;
  height: 46px;
  margin-bottom: 12px;
}

.data-card h3,
.plain-panel h3 {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 800;
}

.data-card ul,
.policy-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.data-card li {
  position: relative;
  padding-inline-start: 16px;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.75;
}

.data-card li::before {
  content: '';
  position: absolute;
  inset-inline-start: 0;
  top: 12px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
}

.policy-list {
  display: grid;
  gap: 10px;
}

.policy-list li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.privacy-page[dir='ltr'] :is(.privacy-back, .privacy-badge, .privacy-meta span, .summary-points span, .policy-list li, .contact-action) {
  text-align: left;
}

.privacy-page[dir='rtl'] :is(.privacy-back, .privacy-badge, .privacy-meta span, .summary-points span, .policy-list li, .contact-action) {
  text-align: right;
}

.policy-list .v-icon {
  margin-top: 3px;
  color: var(--color-primary);
}

.notice-section {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  border-color: rgba(181, 107, 47, 0.24);
  background: linear-gradient(180deg, #ffffff 0%, var(--color-warning-light) 100%);
}

.notice-icon {
  width: 52px;
  height: 52px;
  flex: 0 0 52px;
  background: #ffffff;
  color: var(--color-warning);
  box-shadow: var(--shadow-sm);
}

.contact-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  background: var(--color-primary);
  color: #ffffff;
}

.contact-section p {
  color: rgba(255, 255, 255, 0.82);
}

.contact-action {
  min-height: 44px;
  flex: 0 0 auto;
  padding: 0 16px;
  border-radius: var(--radius-sm);
  background: #ffffff;
  color: var(--color-primary);
  font-weight: 800;
}

@media (max-width: 900px) {
  .privacy-shell,
  .data-grid,
  .split-grid,
  .split-grid--two {
    grid-template-columns: 1fr;
  }

  .privacy-summary {
    position: static;
  }
}

@media (max-width: 560px) {
  .privacy-hero {
    padding-inline: 14px;
  }

  .privacy-topbar {
    align-items: stretch;
    flex-direction: column;
  }

  .privacy-back,
  .language-switch {
    justify-content: center;
    width: 100%;
  }

  .language-switch__option {
    flex: 1 1 0;
  }

  .privacy-shell {
    width: calc(100% - 28px);
  }

  .policy-section,
  .contact-section,
  .privacy-summary {
    padding: 18px;
    border-radius: var(--radius-md);
  }

  .section-heading,
  .notice-section,
  .contact-section {
    flex-direction: column;
  }

  .contact-action {
    width: 100%;
    justify-content: center;
  }
}
</style>
