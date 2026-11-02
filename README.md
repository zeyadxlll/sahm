# منظومة مساعدات التداول الذكية والتحليل الكمي | Multi-Platform Trading Copilots ⚡

تمت إعادة هيكلة بيئة العمل إلى **4 مشاريع برمجية مستقلة ومعزولة كلياً**، لكل منها إضافة كروم مخصصة وخادم بايثون كمي يعمل على منفذ شبكي (Port) خاص به:

```
ai/
├── 1-sahm-spx-options/   # (Port 8000) مساعد عقود أوبشن SPX لمنصة سهم (النسخة العاملة الأصلية محفوظة 100%)
├── 2-sahm-saudi-pro/     # (Port 8001) مساعد الأسهم السعودية (تاسي ونمو) لمنصة سهم
├── 3-derayah-global-spx/ # (Port 8002) مساعد عقود أوبشن SPX لمنصة دراية جلوبل (Derayah Global)
└── 4-derayah-saudi-pro/  # (Port 8003) مساعد الأسهم السعودية لمنصة دراية المالية (Derayah Saudi)
```

---

## 📁 تفاصيل المشاريع الأربعة (4 Isolated Projects):

### 1. `1-sahm-spx-options/` 🇺🇸
* **المنصة المستهدفة:** منصة سهم ويب (Sahm Web Trader).
* **التخصص:** عقود أوبشن مؤشر SPX (0DTE)، مسح الـ 300 عقد، حاسبة الاحتمالية الحقيقية، والتدوير الذكي للعقود.
* **منفذ الخادم (Port):** `8000` (`http://localhost:8000` / `ws://localhost:8000/ws`).
* **التشغيل:** عبر `1-sahm-spx-options/start_server.bat`.
* **الحالة:** كود محرك SPX وملفات الـ DOM محفوظة 100% بدون أي تعديل.

### 2. `2-sahm-saudi-pro/` 🇸🇦
* **المنصة المستهدفة:** منصة سهم ويب (سوق الأسهم السعودية).
* **التخصص:** تاسي ونمو، التحليل الرباعي 4D، رادار تدفق الأوامر، وتوقعات مزاد الإغلاق.
* **منفذ الخادم (Port):** `8001` (`http://localhost:8001` / `ws://localhost:8001/ws`).
* **التشغيل:** عبر `2-sahm-saudi-pro/start_sahm_saudi.bat`.
* **الإضافة:** `2-sahm-saudi-pro/chrome-extension/` مهيأة تلقائياً للسوق السعودي والمنفذ 8001.

### 3. `3-derayah-global-spx/` 🇺🇸
* **المنصة المستهدفة:** دراية جلوبل (Derayah Global / Interactive Brokers Web).
* **التخصص:** عقود أوبشن SPX الأمريكية على منصة دراية جلوبل.
* **منفذ الخادم (Port):** `8002` (`http://localhost:8002` / `ws://localhost:8002/ws`).
* **التشغيل:** عبر `3-derayah-global-spx/start_derayah_spx.bat`.
* **الإضافة:** `3-derayah-global-spx/chrome-extension/` مهيأة لنطاقات دراية جلوبل والمنفذ 8002.

### 4. `4-derayah-saudi-pro/` 🇸🇦
* **المنصة المستهدفة:** دراية المالية (Derayah Saudi Market).
* **التخصص:** أسهم السوق السعودي (تاسي ونمو)، قراءة سجل الأوامر والصفقات، ومزاد الإغلاق عبر دراية.
* **منفذ الخادم (Port):** `8003` (`http://localhost:8003` / `ws://localhost:8003/ws`).
* **التشغيل:** عبر `4-derayah-saudi-pro/start_derayah_saudi.bat`.
* **الإضافة:** `4-derayah-saudi-pro/chrome-extension/` مهيأة لنطاقات دراية السعودية والمنفذ 8003.

---

## 🚀 كيفية تثبيت وتشغيل أي من المشاريع:

1. **تشغيل خادم بايثون:**
   - ادخل إلى مجلد المشروع المطلوب وشغّل ملف `.bat` الخاص به:
     * `1-sahm-spx-options/start_server.bat` (Port 8000)
     * `2-sahm-saudi-pro/start_sahm_saudi.bat` (Port 8001)
     * `3-derayah-global-spx/start_derayah_spx.bat` (Port 8002)
     * `4-derayah-saudi-pro/start_derayah_saudi.bat` (Port 8003)

2. **تحميل إضافة كروم:**
   - افتح متصفح Google Chrome واذهب إلى `chrome://extensions/`.
   - فعّل وضع المطور (**Developer mode**).
   - اضغط على **Load unpacked** (تحميل إضافة تم فك حزمتها).
   - اختر مجلد `chrome-extension/` الخاص بالمشروع الذي ترغب باستخدامه.
