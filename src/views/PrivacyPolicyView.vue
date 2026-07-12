<script setup lang="ts">
import { onMounted } from 'vue'

const lastUpdated = '12 تموز 2026'

const dataCategories = [
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
]

const useCases = [
  'إنشاء الحساب وتسجيل الدخول والتحقق من هوية المستخدم.',
  'إدارة الحجوزات والمواعيد والتواصل بين المرضى والأطباء والعيادات.',
  'إرسال الإشعارات المهمة مثل تذكير الموعد أو تحديث حالة الطلب.',
  'تحسين جودة التطبيق، تحليل الأعطال، وتطوير الخدمات.',
  'حماية الحسابات ومنع إساءة الاستخدام أو محاولات الوصول غير المصرح بها.',
]

const rights = [
  'طلب الاطلاع على بياناتك الشخصية المتوفرة لدينا.',
  'طلب تصحيح البيانات غير الدقيقة أو تحديث معلومات الحساب.',
  'طلب حذف الحساب أو بعض البيانات متى كان ذلك ممكنًا نظاميًا وتشغيليًا.',
  'إيقاف الإشعارات غير الضرورية من إعدادات الجهاز أو التطبيق.',
]

onMounted(() => {
  document.title = 'سياسة الخصوصية - عيادتي'

  let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (!metaDesc) {
    metaDesc = document.createElement('meta')
    metaDesc.name = 'description'
    document.head.appendChild(metaDesc)
  }
  metaDesc.content = 'سياسة الخصوصية لتطبيق عيادتي، وتشمل طريقة جمع البيانات واستخدامها وحمايتها وحقوق المستخدمين.'
})
</script>

<template>
  <main class="privacy-page" dir="rtl">
    <section class="privacy-hero">
      <div class="privacy-hero__content">
        <RouterLink to="/download" class="privacy-back">
          <v-icon icon="mdi-arrow-right" size="18" />
          العودة إلى التحميل
        </RouterLink>

        <div class="privacy-badge">
          <v-icon icon="mdi-shield-check" size="18" />
          خصوصيتك جزء أساسي من الخدمة
        </div>

        <h1>سياسة الخصوصية</h1>
        <p>
          توضح هذه السياسة كيف يتعامل تطبيق عيادتي مع بيانات المستخدمين، ولماذا نحتاج بعض المعلومات لتقديم خدمات
          الحجز والمتابعة الطبية بصورة آمنة ومنظمة.
        </p>

        <div class="privacy-meta">
          <span>
            <v-icon icon="mdi-calendar-edit" size="17" />
            آخر تحديث: {{ lastUpdated }}
          </span>
          <span>
            <v-icon icon="mdi-web" size="17" />
            تنطبق على التطبيق ولوحة الخدمات المرتبطة به
          </span>
        </div>
      </div>
    </section>

    <section class="privacy-shell">
      <aside class="privacy-summary" aria-label="ملخص سياسة الخصوصية">
        <h2>ملخص سريع</h2>
        <p>
          نجمع الحد الأدنى من البيانات اللازمة لتشغيل الحسابات والحجوزات والإشعارات. لا نبيع بياناتك، ولا نشاركها
          إلا لتقديم الخدمة أو عند وجود التزام قانوني.
        </p>
        <div class="summary-points">
          <span><v-icon icon="mdi-check-circle" size="17" /> استخدام محدد وواضح</span>
          <span><v-icon icon="mdi-lock-outline" size="17" /> حماية تقنية وتنظيمية</span>
          <span><v-icon icon="mdi-account-check-outline" size="17" /> حقوق وصول وتصحيح وحذف</span>
        </div>
      </aside>

      <div class="privacy-content">
        <section class="policy-section">
          <div class="section-heading">
            <span class="section-number">01</span>
            <div>
              <h2>البيانات التي قد نجمعها</h2>
              <p>تختلف البيانات حسب طريقة استخدامك للتطبيق ونوع الحساب والخدمات التي تختارها.</p>
            </div>
          </div>

          <div class="data-grid">
            <article v-for="category in dataCategories" :key="category.title" class="data-card">
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
              <h2>كيف نستخدم البيانات</h2>
              <p>نستخدم البيانات لتقديم الخدمة وتحسينها وحماية المستخدمين.</p>
            </div>
          </div>

          <ul class="policy-list">
            <li v-for="useCase in useCases" :key="useCase">
              <v-icon icon="mdi-check" size="18" />
              <span>{{ useCase }}</span>
            </li>
          </ul>
        </section>

        <section class="policy-section">
          <div class="section-heading">
            <span class="section-number">03</span>
            <div>
              <h2>مشاركة البيانات</h2>
              <p>لا نقوم ببيع بياناتك الشخصية. قد تتم مشاركة قدر محدود من البيانات في الحالات التالية فقط.</p>
            </div>
          </div>

          <div class="split-grid">
            <div class="plain-panel">
              <h3>مع مقدمي الخدمة داخل عيادتي</h3>
              <p>
                قد تظهر بيانات الحجز أو بيانات التواصل للطبيب أو العيادة عند الحاجة لإكمال الموعد أو متابعة الخدمة.
              </p>
            </div>
            <div class="plain-panel">
              <h3>مع مزودي البنية التقنية</h3>
              <p>
                نستخدم خدمات تشغيل واستضافة وإشعارات تساعدنا في تشغيل التطبيق، مع تقييد الوصول للبيانات حسب الحاجة.
              </p>
            </div>
            <div class="plain-panel">
              <h3>عند المتطلبات القانونية</h3>
              <p>
                قد نكشف بيانات محددة إذا تطلب القانون ذلك أو لحماية حقوق المستخدمين وسلامة المنصة.
              </p>
            </div>
          </div>
        </section>

        <section class="policy-section notice-section">
          <div class="notice-icon">
            <v-icon icon="mdi-medical-bag" size="28" />
          </div>
          <div>
            <h2>تنبيه بخصوص البيانات الصحية</h2>
            <p>
              المعلومات الصحية التي تقدمها داخل التطبيق تُستخدم لتسهيل تقديم الخدمة ولا تُعد بديلًا عن استشارة طبية
              مباشرة. يرجى مشاركة المعلومات الطبية الحساسة فقط عند الحاجة وبالقدر المناسب للخدمة المطلوبة.
            </p>
          </div>
        </section>

        <section class="policy-section">
          <div class="section-heading">
            <span class="section-number">04</span>
            <div>
              <h2>الأمان والاحتفاظ بالبيانات</h2>
              <p>نعمل على حماية البيانات من الوصول غير المصرح به أو الفقدان أو سوء الاستخدام.</p>
            </div>
          </div>

          <div class="split-grid">
            <div class="plain-panel">
              <h3>إجراءات الحماية</h3>
              <p>
                نعتمد ضوابط وصول، اتصال آمن عند توفره، مراجعة صلاحيات، ومتابعة للأخطاء لتحسين أمان الخدمة.
              </p>
            </div>
            <div class="plain-panel">
              <h3>مدة الاحتفاظ</h3>
              <p>
                نحتفظ بالبيانات للمدة اللازمة لتقديم الخدمة أو الامتثال للمتطلبات النظامية أو حل النزاعات التشغيلية.
              </p>
            </div>
          </div>
        </section>

        <section class="policy-section">
          <div class="section-heading">
            <span class="section-number">05</span>
            <div>
              <h2>حقوقك وخياراتك</h2>
              <p>يمكنك طلب إدارة بياناتك بما يتوافق مع طبيعة الخدمة والمتطلبات النظامية.</p>
            </div>
          </div>

          <ul class="policy-list">
            <li v-for="right in rights" :key="right">
              <v-icon icon="mdi-account-lock-open-outline" size="18" />
              <span>{{ right }}</span>
            </li>
          </ul>
        </section>

        <section class="policy-section">
          <div class="section-heading">
            <span class="section-number">06</span>
            <div>
              <h2>الأطفال وتحديث السياسة</h2>
              <p>الخدمة موجهة للاستخدام الصحي والإداري المسؤول.</p>
            </div>
          </div>

          <p class="body-copy">
            إذا كان المستخدم قاصرًا، فيجب أن يتم استخدام الخدمة بإشراف ولي الأمر أو من ينوب عنه. قد نقوم بتحديث هذه
            السياسة عند تطوير الخدمة أو تغيير طريقة معالجة البيانات، وسيتم نشر النسخة الأحدث في هذه الصفحة.
          </p>
        </section>

        <section class="contact-section">
          <div>
            <h2>التواصل بخصوص الخصوصية</h2>
            <p>
              لأي طلب متعلق بالخصوصية أو إدارة البيانات، يرجى التواصل مع فريق عيادتي من خلال قنوات الدعم الرسمية
              داخل التطبيق أو لوحة الخدمة.
            </p>
          </div>
          <RouterLink to="/download" class="contact-action">
            <v-icon icon="mdi-download" size="19" />
            صفحة التطبيق
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

.privacy-badge {
  margin-top: 34px;
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
  margin: 18px 0 12px;
  font-size: clamp(34px, 7vw, 62px);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: 0;
}

.privacy-hero p {
  max-width: 760px;
  margin: 0;
  color: var(--color-text-secondary);
  font-size: clamp(16px, 2vw, 19px);
  line-height: 1.9;
}

.privacy-meta {
  display: flex;
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
  .split-grid {
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
