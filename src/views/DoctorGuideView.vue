<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

type GuideItem = {
  title: string
  description: string
  icon: string
  color: string
  category: string
  path: string
  steps: string[]
  tip: string
}

const router = useRouter()
const search = ref('')
const selectedCategory = ref('الكل')

const categories = ['الكل', 'البداية', 'إدارة العيادة', 'التواصل', 'الحساب والاشتراك']

const guideItems: GuideItem[] = [
  {
    title: 'الصفحة الرئيسية والإحصائيات',
    description: 'ملخص سريع لأداء عيادتك: الحجوزات، المرضى، العروض، وحركة العمل خلال الفترة المحددة.',
    icon: 'mdi-view-dashboard-outline', color: 'primary', category: 'البداية', path: '/',
    steps: ['راجع بطاقات الأرقام لمعرفة وضع العيادة بسرعة.', 'غيّر الفترة الزمنية عند توفرها لمقارنة الأداء.', 'استخدم الاختصارات للوصول إلى المهام المتكررة.'],
    tip: 'ابدأ يومك من الرئيسية حتى تعرف عدد حجوزات اليوم وحالة اشتراكك.',
  },
  {
    title: 'الملف الشخصي للطبيب',
    description: 'بياناتك التي تظهر للمريض مثل الاسم، الاختصاص، النبذة، الصورة، ومعلومات التواصل.',
    icon: 'mdi-account-heart-outline', color: 'info', category: 'البداية', path: '/profile',
    steps: ['تأكد من صحة الاسم والاختصاص.', 'أضف صورة واضحة ونبذة مختصرة عن خبرتك.', 'احفظ التعديلات وراجع ظهور معلوماتك للمريض.'],
    tip: 'الملف المكتمل والواضح يساعد المريض على اختيارك بثقة.',
  },
  {
    title: 'العيادات وأوقات الدوام',
    description: 'إضافة عيادة أو تعديل عنوانها وموقعها وأوقات استقبال المرضى لكل يوم.',
    icon: 'mdi-hospital-building', color: 'success', category: 'إدارة العيادة', path: '/clinics',
    steps: ['أضف اسم العيادة والعنوان والمحافظة.', 'حدد الموقع بدقة ليسهل وصول المرضى.', 'اضبط أيام وساعات الدوام لكل عيادة ثم احفظ.'],
    tip: 'أي وقت متاح تضيفه قد يصبح موعداً قابلاً للحجز، لذلك راجعه بدقة.',
  },
  {
    title: 'الحجوزات اليومية',
    description: 'متابعة مواعيد المرضى وتأكيدها وإدارة حالتها طوال يوم العمل.',
    icon: 'mdi-calendar-check-outline', color: 'primary', category: 'إدارة العيادة', path: '/appointments',
    steps: ['اختر التاريخ والعيادة المطلوبة.', 'راجع اسم المريض ووقت الحجز وحالته.', 'حدّث حالة الموعد حسب حضور المريض أو إلغائه.'],
    tip: 'تحديث حالة كل حجز يحافظ على دقة الإحصائيات وينظم قائمة الانتظار.',
  },
  {
    title: 'شاشة وقائمة الانتظار',
    description: 'تنظيم دور المرضى داخل العيادة وعرض الرقم الحالي على شاشة منفصلة.',
    icon: 'mdi-monitor-dashboard', color: 'warning', category: 'إدارة العيادة', path: '/waiting-room-control',
    steps: ['اختر العيادة وافتح جلسة الانتظار.', 'استدعِ المريض التالي أو حدّث حالة الموجودين.', 'افتح شاشة العرض على تلفاز أو شاشة الاستقبال.'],
    tip: 'اترك شاشة العرض مفتوحة بوضع ملء الشاشة داخل قاعة الانتظار.',
  },
  {
    title: 'الإجازات والاستثناءات',
    description: 'إيقاف الحجوزات في يوم أو فترة محددة عند الإجازة أو تغيير الدوام الاعتيادي.',
    icon: 'mdi-calendar-alert-outline', color: 'error', category: 'إدارة العيادة', path: '/exceptions',
    steps: ['اختر العيادة وتاريخ الاستثناء.', 'حدد إن كان اليوم مغلقاً أو له وقت دوام مختلف.', 'احفظ الاستثناء قبل موعد الإجازة بوقت كافٍ.'],
    tip: 'استخدم الاستثناء بدلاً من تغيير جدول الدوام الأسبوعي بسبب إجازة مؤقتة.',
  },
  {
    title: 'العروض',
    description: 'إنشاء عروض للخدمات الطبية وتحديد تفاصيلها وفترة ظهورها للمستخدمين.',
    icon: 'mdi-tag-multiple-outline', color: 'warning', category: 'إدارة العيادة', path: '/offers',
    steps: ['اكتب عنواناً واضحاً ووصفاً مختصراً.', 'حدد السعر أو نسبة الخصم وتاريخ الانتهاء.', 'فعّل العرض وراجعه قبل نشره.'],
    tip: 'اذكر شروط العرض والخدمات المشمولة حتى لا يحصل التباس عند المريض.',
  },
  {
    title: 'الرسائل',
    description: 'التواصل المباشر مع المرضى والإجابة عن استفساراتهم من داخل النظام.',
    icon: 'mdi-message-text-outline', color: 'info', category: 'التواصل', path: '/messages',
    steps: ['افتح المحادثة غير المقروءة.', 'راجع سياق الرسائل قبل الإجابة.', 'لا ترسل معلومات حساسة إلا عند الضرورة.'],
    tip: 'اجعل الرد مختصراً وواضحاً، ووجّه الحالات الطارئة إلى الرعاية المناسبة.',
  },
  {
    title: 'الإشعارات',
    description: 'تنبيهات الحجوزات والرسائل والتحديثات المهمة المرتبطة بحساب الطبيب.',
    icon: 'mdi-bell-outline', color: 'primary', category: 'التواصل', path: '/notifications',
    steps: ['راجع التنبيهات الجديدة بانتظام.', 'افتح الإشعار للانتقال إلى تفاصيله.', 'علّم الإشعارات التي عالجتها كمقروءة.'],
    tip: 'فعّل إشعارات المتصفح حتى لا يفوتك حجز أو رسالة جديدة.',
  },
  {
    title: 'التقييمات',
    description: 'قراءة تقييمات المرضى ومتابعة مستوى رضاهم عن تجربتهم مع العيادة.',
    icon: 'mdi-star-outline', color: 'warning', category: 'التواصل', path: '/reviews',
    steps: ['راجع متوسط التقييم والتعليقات الحديثة.', 'لاحظ الملاحظات المتكررة.', 'حوّل الملاحظات المفيدة إلى تحسينات في الخدمة.'],
    tip: 'التقييمات أداة تطوير وليست مجرد رقم؛ تابع أسباب الرضا وعدم الرضا.',
  },
  {
    title: 'مميزات الاشتراك',
    description: 'معرفة المزايا التي تشملها باقتك وتشغيل أو إيقاف المزايا المتاحة مثل الحجز والرسائل.',
    icon: 'mdi-crown-outline', color: 'success', category: 'الحساب والاشتراك', path: '/features',
    steps: ['راجع اسم الباقة ومدة الاشتراك المتبقية.', 'تعرف على المزايا المتاحة في باقتك.', 'فعّل فقط المزايا التي تريد إظهارها للمرضى.'],
    tip: 'إيقاف ميزة من هنا قد يخفيها عن المرضى حتى لو كانت ضمن باقتك.',
  },
  {
    title: 'الإبلاغ عن مشكلة',
    description: 'إرسال بلاغ للدعم عند مواجهة خلل، مع وصف يساعد الفريق على تشخيصه بسرعة.',
    icon: 'mdi-lifebuoy', color: 'error', category: 'الحساب والاشتراك', path: '/problem-report',
    steps: ['اكتب عنواناً يصف المشكلة.', 'اذكر الصفحة والخطوات التي سبقت ظهورها.', 'أرفق التفاصيل ثم أرسل البلاغ وتابع الرد.'],
    tip: 'كلما كان الوصف أدق، كان حل المشكلة أسرع.',
  },
]

const filteredItems = computed(() => {
  const query = search.value.trim().toLowerCase()
  return guideItems.filter((item) => {
    const inCategory = selectedCategory.value === 'الكل' || item.category === selectedCategory.value
    const inSearch = !query || `${item.title} ${item.description} ${item.steps.join(' ')}`.toLowerCase().includes(query)
    return inCategory && inSearch
  })
})

function goTo(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="guide-page">
    <section class="guide-hero">
      <div class="hero-content">
        <v-chip color="primary" variant="flat" size="small" prepend-icon="mdi-school-outline">مركز تعليم الطبيب</v-chip>
        <h1>كل ما تحتاجه لإدارة عيادتك بثقة</h1>
        <p>دليل عملي يشرح صلاحيات الطبيب ومميزات النظام خطوة بخطوة، من إعداد الملف والعيادة إلى إدارة الحجوزات والتواصل مع المرضى.</p>
        <div class="hero-actions">
          <v-btn color="primary" size="large" prepend-icon="mdi-rocket-launch-outline" @click="goTo('/profile')">ابدأ بإكمال ملفك</v-btn>
          <v-btn variant="outlined" size="large" prepend-icon="mdi-calendar-check" @click="goTo('/appointments')">اذهب إلى الحجوزات</v-btn>
        </div>
      </div>
      <div class="hero-visual" aria-hidden="true">
        <div class="visual-orbit"><v-icon icon="mdi-stethoscope" size="54" /></div>
        <span class="mini-icon one"><v-icon icon="mdi-calendar-check" /></span>
        <span class="mini-icon two"><v-icon icon="mdi-message-text" /></span>
        <span class="mini-icon three"><v-icon icon="mdi-hospital-building" /></span>
      </div>
    </section>

    <section class="quick-start">
      <div class="section-heading">
        <div><span class="eyebrow">ابدأ من هنا</span><h2>جهّز حسابك بثلاث خطوات</h2></div>
        <span class="duration"><v-icon icon="mdi-clock-outline" size="18" /> يحتاج تقريباً 10 دقائق</span>
      </div>
      <div class="steps-grid">
        <button class="step-card" @click="goTo('/profile')"><span class="step-number">١</span><v-icon icon="mdi-account-edit-outline" size="28"/><div><h3>أكمل ملفك</h3><p>الاسم، الاختصاص، الصورة والنبذة</p></div><v-icon icon="mdi-arrow-left" class="step-arrow" /></button>
        <button class="step-card" @click="goTo('/clinics')"><span class="step-number">٢</span><v-icon icon="mdi-hospital-marker" size="28"/><div><h3>أضف عيادتك</h3><p>العنوان، الموقع وأوقات الدوام</p></div><v-icon icon="mdi-arrow-left" class="step-arrow" /></button>
        <button class="step-card" @click="goTo('/features')"><span class="step-number">٣</span><v-icon icon="mdi-toggle-switch-outline" size="28"/><div><h3>فعّل المميزات</h3><p>اختر الخدمات التي تظهر للمرضى</p></div><v-icon icon="mdi-arrow-left" class="step-arrow" /></button>
      </div>
    </section>

    <section class="guide-library">
      <div class="section-heading library-heading">
        <div><span class="eyebrow">دليل المميزات</span><h2>تعلّم كل جزء في النظام</h2></div>
        <label class="guide-search">
          <v-icon icon="mdi-magnify" size="22" />
          <input v-model="search" type="search" placeholder="ابحث عن ميزة أو مهمة..." aria-label="البحث في دليل الطبيب" />
          <button v-if="search" type="button" aria-label="مسح البحث" @click="search = ''"><v-icon icon="mdi-close" size="18" /></button>
        </label>
      </div>
      <div class="category-list" role="tablist">
        <button v-for="category in categories" :key="category" :class="{ active: selectedCategory === category }" @click="selectedCategory = category">{{ category }}</button>
      </div>

      <div v-if="filteredItems.length" class="guide-grid">
        <article v-for="(item, index) in filteredItems" :key="item.title" class="guide-card">
          <div class="card-top">
            <div class="card-icon" :class="`icon-${item.color}`"><v-icon :icon="item.icon" size="27" /></div>
            <v-chip size="x-small" variant="tonal">{{ item.category }}</v-chip>
          </div>
          <h3>{{ item.title }}</h3>
          <p class="card-description">{{ item.description }}</p>
          <details class="steps-panel" :open="index === 0">
            <summary><span><v-icon icon="mdi-format-list-checks" size="19" /> طريقة الاستخدام</span><v-icon class="summary-chevron" icon="mdi-chevron-down" size="20" /></summary>
            <div class="steps-content"><ol><li v-for="step in item.steps" :key="step">{{ step }}</li></ol><div class="tip"><v-icon icon="mdi-lightbulb-on-outline" size="18"/><span>{{ item.tip }}</span></div></div>
          </details>
          <v-btn variant="text" color="primary" append-icon="mdi-arrow-left" class="open-btn" @click="goTo(item.path)">افتح الصفحة وطبّق الآن</v-btn>
        </article>
      </div>
      <div v-else class="empty-result"><v-icon icon="mdi-book-search-outline" size="52" /><h3>ما لقينا نتيجة مطابقة</h3><p>جرّب كلمة ثانية أو اختر «الكل».</p><v-btn color="primary" variant="tonal" @click="search = ''; selectedCategory = 'الكل'">عرض كل الدليل</v-btn></div>
    </section>

    <section class="help-banner">
      <div class="help-icon"><v-icon icon="mdi-headset" size="32" /></div>
      <div><h2>واجهتك مشكلة أثناء التطبيق؟</h2><p>أرسل وصف المشكلة من داخل النظام وسيتمكن فريق الدعم من متابعتها معك.</p></div>
      <v-btn color="primary" variant="flat" prepend-icon="mdi-message-alert-outline" @click="goTo('/problem-report')">إرسال بلاغ</v-btn>
    </section>
  </div>
</template>

<style scoped>
.guide-page{display:flex;flex-direction:column;gap:32px;max-width:1400px;margin:0 auto}.guide-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(260px,.7fr);align-items:center;min-height:330px;padding:48px;border-radius:24px;background:linear-gradient(135deg,#073f39 0%,#0c6c60 56%,#159181 100%);color:#fff;box-shadow:var(--shadow-lg)}.guide-hero:before{content:"";position:absolute;width:420px;height:420px;border:1px solid rgba(255,255,255,.12);border-radius:50%;left:-120px;top:-210px}.hero-content{position:relative;z-index:1}.hero-content h1{max-width:700px;margin:18px 0 10px;font-size:clamp(30px,4vw,48px);line-height:1.25;font-weight:800}.hero-content p{max-width:720px;margin:0;color:rgba(255,255,255,.82);font-size:17px;line-height:1.9}.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}.hero-actions :deep(.v-btn--variant-outlined){color:#fff;border-color:rgba(255,255,255,.5)}.hero-visual{position:relative;height:230px}.visual-orbit{position:absolute;inset:30px;margin:auto;display:grid;place-items:center;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);box-shadow:0 0 0 28px rgba(255,255,255,.05),0 0 0 58px rgba(255,255,255,.035)}.mini-icon{position:absolute;display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:#fff;color:var(--color-primary);box-shadow:var(--shadow-lg)}.mini-icon.one{top:8px;right:34px}.mini-icon.two{bottom:15px;left:30px}.mini-icon.three{bottom:8px;right:44px}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:18px}.eyebrow{display:block;color:var(--color-primary);font-size:12px;font-weight:800;margin-bottom:4px}.section-heading h2,.help-banner h2{margin:0;font-size:24px;color:var(--color-text)}.duration{display:flex;align-items:center;gap:6px;color:var(--color-text-muted);font-size:13px;font-weight:700}.steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.step-card{position:relative;display:grid;grid-template-columns:auto auto 1fr auto;align-items:center;gap:13px;width:100%;padding:20px;border:1px solid var(--color-border);border-radius:16px;background:var(--color-surface);color:var(--color-primary);text-align:right;box-shadow:var(--shadow-sm);transition:.2s}.step-card:hover{transform:translateY(-3px);border-color:var(--color-primary-light);box-shadow:var(--shadow-md)}.step-number{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--color-primary-soft);font-weight:800}.step-card h3{margin:0 0 4px;color:var(--color-text);font-size:16px}.step-card p{margin:0;color:var(--color-text-muted);font-size:12px}.step-arrow{opacity:.55}.guide-library{padding-top:4px}.library-heading{align-items:center}.guide-search{display:flex;align-items:center;gap:9px;width:370px;max-width:100%;height:48px;padding:0 14px;border:1px solid var(--color-border);border-radius:12px;background:var(--color-surface);color:var(--color-text-muted);transition:.2s}.guide-search:focus-within{border-color:var(--color-primary);box-shadow:0 0 0 3px rgba(19,121,107,.12)}.guide-search input{flex:1;min-width:0;width:100%;height:100%;padding:0;border:0!important;outline:0!important;background:transparent!important;color:var(--color-text);box-shadow:none!important}.guide-search input::placeholder{color:#9aaba8}.guide-search input::-webkit-search-cancel-button{display:none}.guide-search button{display:grid;place-items:center;flex:0 0 28px;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:var(--color-background);color:var(--color-text-muted)}.category-list{display:flex;gap:8px;overflow-x:auto;padding:2px 0 18px}.category-list button{white-space:nowrap;padding:9px 16px;border:1px solid var(--color-border);border-radius:99px;background:var(--color-surface);color:var(--color-text-secondary);font-weight:700}.category-list button.active{border-color:var(--color-primary);background:var(--color-primary);color:#fff}.guide-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.guide-card{display:flex;flex-direction:column;min-height:360px;padding:20px;border:1px solid var(--color-border);border-radius:18px;background:var(--color-surface);box-shadow:var(--shadow-sm);transition:.2s}.guide-card:hover{border-color:#badbd5;box-shadow:var(--shadow-md)}.card-top{display:flex;align-items:center;justify-content:space-between}.card-icon{display:grid;place-items:center;width:50px;height:50px;border-radius:14px}.icon-primary{background:var(--color-primary-soft);color:var(--color-primary)}.icon-success{background:var(--color-success-light);color:var(--color-success)}.icon-info{background:var(--color-info-light);color:var(--color-info)}.icon-warning{background:var(--color-warning-light);color:var(--color-warning)}.icon-error{background:var(--color-error-light);color:var(--color-error)}.guide-card>h3{margin:16px 0 7px;font-size:18px;color:var(--color-text)}.card-description{min-height:66px;margin:0 0 12px;color:var(--color-text-muted);font-size:13px;line-height:1.75}.steps-panel{margin-top:auto;border-top:1px solid var(--color-border-light)}.steps-panel summary{display:flex;align-items:center;justify-content:space-between;min-height:48px;padding:10px 2px;color:var(--color-text);font-size:13px;font-weight:800;cursor:pointer;list-style:none;user-select:none}.steps-panel summary::-webkit-details-marker{display:none}.steps-panel summary span{display:flex;align-items:center;gap:8px}.summary-chevron{transition:transform .2s}.steps-panel[open] .summary-chevron{transform:rotate(180deg)}.steps-content{padding:0 2px 10px}.steps-panel ol{margin:0;padding:0 22px 0 0;color:var(--color-text-secondary);font-size:12px;line-height:1.8}.tip{display:flex;align-items:flex-start;gap:7px;margin-top:10px;padding:10px;border-radius:10px;background:var(--color-warning-light);color:#7d4a20;font-size:11px;line-height:1.6}.open-btn{align-self:flex-start;margin-top:8px;padding-inline:0}.empty-result{display:grid;place-items:center;min-height:320px;padding:30px;border:1px dashed var(--color-border);border-radius:18px;color:var(--color-text-muted);text-align:center}.empty-result h3{margin:12px 0 4px;color:var(--color-text)}.empty-result p{margin:0 0 16px}.help-banner{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:18px;padding:24px;border:1px solid #b9ddd6;border-radius:18px;background:linear-gradient(90deg,var(--color-primary-soft),#f7fcfb)}.help-icon{display:grid;place-items:center;width:58px;height:58px;border-radius:16px;background:#fff;color:var(--color-primary)}.help-banner p{margin:5px 0 0;color:var(--color-text-muted)}
@media(max-width:1100px){.guide-grid{grid-template-columns:repeat(2,1fr)}.guide-hero{grid-template-columns:1fr .5fr;padding:36px}.steps-grid{grid-template-columns:1fr}}
@media(max-width:700px){.guide-page{gap:24px}.guide-hero{display:block;min-height:auto;padding:28px 22px}.hero-visual{display:none}.hero-content p{font-size:14px}.hero-actions>*{width:100%}.section-heading,.library-heading{align-items:stretch;flex-direction:column}.guide-search{width:100%}.guide-grid{grid-template-columns:1fr}.help-banner{grid-template-columns:auto 1fr}.help-banner .v-btn{grid-column:1/-1}.duration{align-self:flex-start}.content-container{padding:16px!important}}
</style>
