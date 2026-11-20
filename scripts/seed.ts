// ─── سید اولیه: خدمات + تنظیمات ─────────────────────────────
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const SERVICES = [
  {
    key: 'computer', nameFa: 'تعمیرات و خدمات کامپیوتر', nameEn: 'Computer Repair & Services',
    descFa: 'عیب‌یابی، تعمیر سخت‌افزار و نرم‌افزار، نصب ویندوز و برنامه‌ها، ارتقای سیستم، رفع مشکلات سرعت و ویروس، پشتیبانی از راه دور کامپیوتر و لپ‌تاپ.',
    descEn: 'Diagnosis, hardware & software repair, Windows and app installation, system upgrades, speed/virus troubleshooting, and remote support for PCs and laptops.',
    baseRate: 800000, remoteCapable: true, sortOrder: 1,
  },
  {
    key: 'cctv', nameFa: 'دوربین مداربسته', nameEn: 'CCTV Cameras',
    descFa: 'نصب و راه‌اندازی دوربین مداربسته، تنظیم ضبط و دید در شب، اتصال به موبایل، سرویس و تعمیر انواع سیستم‌های نظارتی (هی‌ویژن، داهوا و…).',
    descEn: 'CCTV installation and setup, recording and night-vision configuration, mobile connectivity, and service/repair of surveillance systems (Hikvision, Dahua, etc.).',
    baseRate: 1500000, remoteCapable: false, sortOrder: 2,
  },
  {
    key: 'network', nameFa: 'شبکه', nameEn: 'Networking',
    descFa: 'کابل‌کشی و پسیو شبکه، راه‌اندازی مودم، روتر، سوییچ و وایرلس، تنظیم سرور و فایروال، اشکال‌زدایی شبکه خانگی و سازمانی (حضوری و از راه دور).',
    descEn: 'Structured cabling, modem/router/switch/wireless setup, server & firewall configuration, troubleshooting for home and enterprise networks (on-site and remote).',
    baseRate: 1200000, remoteCapable: true, sortOrder: 3,
  },
  {
    key: 'tv', nameFa: 'تلویزیون', nameEn: 'TV Services',
    descFa: 'تعمیر تلویزیون‌های LED/LCD/اسمارت، نصب دیواری، تنظیم کانال‌ها و اینترنت تلویزیون، عوض‌کردن پنل و بک‌لایت، رفع مشکلات صدا و تصویر.',
    descEn: 'LED/LCD/Smart TV repair, wall mounting, channel and internet setup, panel and backlight replacement, audio/video troubleshooting.',
    baseRate: 700000, remoteCapable: false, sortOrder: 4,
  },
  {
    key: 'antenna', nameFa: 'آنتن', nameEn: 'Antenna Services',
    descFa: 'نصب و تنظیم آنتن مرکزی و خانگی، تقویت سیگنال، رفع برفک و نویز، نصب رسیور و سیستم‌های دریافت ماهواره‌ای مجاز.',
    descEn: 'Central and home antenna installation, signal boosting, noise/static troubleshooting, receiver setup for legal satellite systems.',
    baseRate: 600000, remoteCapable: false, sortOrder: 5,
  },
  {
    key: 'fridge', nameFa: 'یخچال', nameEn: 'Refrigerator Repair',
    descFa: 'تعمیر یخچال و فریزر و ساید‌بای‌ساید، شارژ گاز، تعویض ترموستات و کمپرسور، رفع نشتی و مشکلات سرمایش، سرویس دوره‌ای.',
    descEn: 'Repair of refrigerators, freezers and side-by-side units, gas recharge, thermostat/compressor replacement, leak and cooling troubleshooting, periodic service.',
    baseRate: 900000, remoteCapable: false, sortOrder: 6,
  },
  {
    key: 'microwave', nameFa: 'مایکروویو', nameEn: 'Microwave Repair',
    descFa: 'تعمیر مایکروویو و فر برقی، تعویض مگنترون و دیود، رفع مشکلات گرم‌نکردن و جرقه، سرویس کلیدها و نمایشگر.',
    descEn: 'Microwave and electric oven repair, magnetron/diode replacement, heating/spark troubleshooting, keypad and display service.',
    baseRate: 500000, remoteCapable: false, sortOrder: 7,
  },
  {
    key: 'painting', nameFa: 'نقاشی ساختمان', nameEn: 'Building Painting',
    descFa: 'نقاشی داخلی و خارجی ساختمان، مولتی‌کالر، پتینه، بلکا و رنگ روغنی، گچ‌کاری و ترمیم ترک‌ها، مشاورهٔ رنگ و اجرای تمیز.',
    descEn: 'Interior/exterior painting, multicolor, patina, Blakeh and oil paint, plastering and crack repair, color consultation and clean execution.',
    baseRate: 2000000, remoteCapable: false, sortOrder: 8,
  },
  {
    key: 'tattoo', nameFa: 'تتو', nameEn: 'Tattoo',
    descFa: 'تتو هنری و بدن‌آرتیست، طراحی اختصاصی، کاور و رفع تتوی قدیمی با تجهیزات بهداشتی استریل و جوهرهای استاندارد (فقط حضوری).',
    descEn: 'Artistic body tattoo, custom design, cover-up and old tattoo removal with sterile hygienic equipment and standard inks (on-site only).',
    baseRate: 1500000, remoteCapable: false, sortOrder: 9,
  },
  {
    key: 'beauty', nameFa: 'زیبایی', nameEn: 'Beauty Services',
    descFa: 'میکاپ، کوتاهی و رنگ مو، پوست و مژه و ابرو، ناخن و خدمات آرایشگاهی در محل شما با متخصصین تأییدشده.',
    descEn: 'Makeup, hair cut and coloring, skin/lash/brow services, nails and salon services at your location with verified specialists.',
    baseRate: 1000000, remoteCapable: false, sortOrder: 10,
  },
  {
    key: 'legal', nameFa: 'خدمات حقوقی', nameEn: 'Legal Services',
    descFa: 'مشاورهٔ حقوقی و وکالت، تنظیم قرارداد، شکایات و دعاوی، پیگیری پرونده‌های ثبتی، خانواده، ملکی و کیفری (حضوری و آنلاین).',
    descEn: 'Legal consultation and representation, contract drafting, complaints and claims, registry/family/property/criminal case follow-up (in-person and online).',
    baseRate: 800000, remoteCapable: true, sortOrder: 11,
  },
  {
    key: 'medical', nameFa: 'خدمات پزشکی/پرستاری', nameEn: 'Medical / Nursing Services',
    descFa: 'پرستاری و مراقبت در منزل، تزریقات و وصل سرم، مشاورهٔ پزشکی و ویزیت آنلاین، مراقبت از سالمند و بیمار با کادر مجرب.',
    descEn: 'Home nursing and care, injections and IV setup, medical consultation and online visits, elderly/patient care by experienced staff.',
    baseRate: 1200000, remoteCapable: true, sortOrder: 12,
  },
  {
    key: 'mechanic', nameFa: 'مکانیک خودرو', nameEn: 'Car Mechanics',
    descFa: 'عیب‌یابی و تعمیر خودرو، سرویس دوره‌ای، تعویض روغن و فیلتر، دیاگ و برق‌کاری، کمک‌های جاده‌ای (حضوری).',
    descEn: 'Vehicle diagnosis and repair, periodic service, oil/filter change, ECU diagnostics and electrical work, roadside assistance (on-site).',
    baseRate: 800000, remoteCapable: false, sortOrder: 13,
  },
  {
    key: 'pdr', nameFa: 'صافکاری PDR', nameEn: 'PDR Paintless Dent Repair',
    descFa: 'صافکاری بدون رنگ فرورفتگی بدنه، بدون خدشه به رنگ کارخانه، مناسب تورفتگی‌های ریز و متوسط، در محل شما.',
    descEn: 'Paintless dent removal (PDR) without damaging factory paint, ideal for small/medium dents, at your location.',
    baseRate: 1800000, remoteCapable: false, sortOrder: 14,
  },
  {
    key: 'web', nameFa: 'طراحی سایت', nameEn: 'Website Design',
    descFa: 'طراحی سایت شرکتی، فروشگاهی و شخصی، سئو و سرعت، پنل مدیریت، ریسپانسیو، دامنه و هاست، پشتیبانی پس از تحویل.',
    descEn: 'Corporate, e-commerce and personal website design, SEO and speed, admin panel, responsive layout, domain & hosting, post-delivery support.',
    baseRate: 25000000, remoteCapable: true, sortOrder: 15,
  },
  {
    key: 'app', nameFa: 'طراحی اپلیکیشن', nameEn: 'App Development',
    descFa: 'طراحی اپلیکیشن اندروید و iOS، اتصال به API، پنل ادمین، انتشار در استورها، طراحی UI/UX مدرن و پشتیبانی.',
    descEn: 'Android & iOS app development, API integration, admin panel, store publishing, modern UI/UX design and support.',
    baseRate: 45000000, remoteCapable: true, sortOrder: 16,
  },
  {
    key: 'misc', nameFa: 'متفرقه', nameEn: 'Miscellaneous',
    descFa: 'هر نیاز دیگری که در فهرست نیست — نیاز خود را توضیح دهید؛ هوش مصنوعی قیمت اولیه را برآورد می‌کند و در صورت نیاز کارشناسی، کارشناس ما نرخ قطعی را اعلام می‌کند.',
    descEn: 'Any other need not in the list — describe it; AI estimates the initial price, or our expert sets the final rate after review.',
    baseRate: 0, remoteCapable: true, sortOrder: 42,
  },
  // ─── خدمات آموزشی و مشاوره‌ای ───
  {
    key: 'education', nameFa: 'آموزش و تدریس خصوصی', nameEn: 'Private Tutoring',
    descFa: 'تدریس خصوصی دروس مدرسه و دانشگاه، آمادگی کنکور، زبان انگلیسی و زبان‌های خارجی، آنلاین و حضوری با مدرسان تأییدشده.',
    descEn: 'Private tutoring for school/university courses, entrance exam prep, English and foreign languages, online or in person with verified teachers.',
    baseRate: 600000, remoteCapable: true, sortOrder: 18,
  },
  {
    key: 'music', nameFa: 'آموزش موسیقی و ساز', nameEn: 'Music Lessons',
    descFa: 'آموزش ساز (پیانو، گیتار، تار، سنتور و…)، آواز و تئوری موسیقی برای کودکان و بزرگسالان، حضوری و آنلاین.',
    descEn: 'Instrument lessons (piano, guitar, tar, santoor, etc.), vocals and music theory for kids and adults, on-site or online.',
    baseRate: 700000, remoteCapable: true, sortOrder: 19,
  },
  {
    key: 'fitness', nameFa: 'مربیگری ورزشی و تناسب اندام', nameEn: 'Fitness Coaching',
    descFa: 'برنامهٔ تمرینی و غذایی اختصاصی، مربیگری بدنسازی، ایروبیک، شنا و ورزش‌های خانگی، همراهی آنلاین یا حضوری.',
    descEn: 'Custom workout and diet plans, bodybuilding, aerobics, swimming and home-workout coaching, online or in person.',
    baseRate: 700000, remoteCapable: true, sortOrder: 20,
  },
  {
    key: 'translation', nameFa: 'ترجمهٔ رسمی و غیررسمی', nameEn: 'Translation Services',
    descFa: 'ترجمهٔ متون تخصصی، مقالات، کتب و مدارک، ترجمهٔ همزمان و کتبی با تأییدیهٔ دارالترجمه، از و به زبان‌های مختلف.',
    descEn: 'Specialized text, article, book and document translation, simultaneous and written interpretation with certified-office validation, to/from major languages.',
    baseRate: 500000, remoteCapable: true, sortOrder: 21,
  },
  {
    key: 'accounting', nameFa: 'حسابداری و امور مالی', nameEn: 'Accounting & Finance',
    descFa: 'حسابداری شرکت‌ها، تنظیم اظهارنامهٔ مالیاتی، صورت‌های مالی، ثبت اسناد، مشاورهٔ مالی و بهینه‌سازی هزینه‌ها.',
    descEn: 'Company bookkeeping, tax declaration filing, financial statements, document recording, financial consulting and cost optimization.',
    baseRate: 1000000, remoteCapable: true, sortOrder: 22,
  },
  {
    key: 'printing', nameFa: 'چاپ و تبلیغات', nameEn: 'Printing & Advertising',
    descFa: 'طراحی و چاپ کارت ویزیت، بروشور، بنر، ست اداری، تابلو، تبلیغات محیطی و اینترنتی با کیفیت و تحویل سریع.',
    descEn: 'Design & print of business cards, brochures, banners, stationery sets, signage, outdoor and online advertising with fast delivery.',
    baseRate: 1500000, remoteCapable: true, sortOrder: 23,
  },
  // ─── املاک، فروش و بیمه ───
  {
    key: 'realestate-rent', nameFa: 'رهن و اجاره املاک', nameEn: 'Real Estate Rent & Mortgage',
    descFa: 'مشاوره و معاملهٔ رهن و اجارهٔ آپارتمان، مغازه، دفتر و ویلا؛ بازدید، تنظیم قرارداد رسمی و پیگیری تا تحویل ملک.',
    descEn: 'Mortgage & rental brokerage for apartments, shops, offices and villas; visits, official contract drafting and follow-up until handover.',
    baseRate: 3000000, remoteCapable: true, sortOrder: 24,
  },
  {
    key: 'realestate-sale', nameFa: 'خرید و فروش املاک', nameEn: 'Real Estate Sale & Purchase',
    descFa: 'مشاورهٔ خرید و فروش خانه، زمین و کلنگی؛ ارزیابی قیمت، بازاریابی ملک، تنظیم قولنامه و سند رسمی در دفترخانه.',
    descEn: 'Home, land and old-property buying/selling consulting; price appraisal, property marketing, preliminary deed and official notary transfer.',
    baseRate: 5000000, remoteCapable: true, sortOrder: 25,
  },
  {
    key: 'sales', nameFa: 'فروش و تأمین کالا', nameEn: 'Sales & Procurement',
    descFa: 'خرید، فروش و تأمین انواع کالا (لوازم خانگی، دیجیتال، صنعتی و…) با گارانتی معتبر؛ استعلام قیمت و تحویل در محل.',
    descEn: 'Buying, selling and sourcing all kinds of goods (home appliances, digital, industrial, etc.) with valid warranty; price inquiry and door delivery.',
    baseRate: 1000000, remoteCapable: true, sortOrder: 26,
  },
  {
    key: 'carsale', nameFa: 'خرید و فروش خودرو', nameEn: 'Car Buying & Selling',
    descFa: 'کارشناسی و ارزیابی خودرو، خرید و فروش نقد و اقساطی، معاوضه، تنظیم قرارداد و نقل‌وانتقال رسمی در محل.',
    descEn: 'Car inspection and appraisal, cash and installment buying/selling, trade-in, contract drafting and official ownership transfer on-site.',
    baseRate: 2000000, remoteCapable: true, sortOrder: 27,
  },
  {
    key: 'insurance', nameFa: 'خدمات بیمه', nameEn: 'Insurance Services',
    descFa: 'صدور و تمدید بیمهٔ شخص ثالث، بدنه، درمان، عمر و آتش‌سوزی؛ مشاورهٔ پوشش‌ها، پیگیری خسارت و پرداخت غرامت.',
    descEn: 'Issuance and renewal of third-party, body, health, life and fire insurance; coverage consulting, claim follow-up and compensation.',
    baseRate: 800000, remoteCapable: true, sortOrder: 28,
  },
  {
    key: 'travel', nameFa: 'خدمات مسافرتی و بلیط', nameEn: 'Travel & Ticketing',
    descFa: 'رزرو بلیط هواپیما، قطار و اتوبوس، هتل و تورهای داخلی و خارجی؛ ویزا، بیمهٔ مسافرتی و برنامه‌ریزی سفر.',
    descEn: 'Flight, train and bus tickets, hotel and domestic/international tour booking; visa, travel insurance and trip planning.',
    baseRate: 800000, remoteCapable: true, sortOrder: 29,
  },
  // ─── حمل‌ونقل و نظافت ───
  {
    key: 'transport', nameFa: 'حمل‌ونقل و باربری', nameEn: 'Transport & Freight',
    descFa: 'حمل بار سبک و سنگین درون‌شهری و برون‌شهری، نیسان و کامیون، باربری مبلمان و اجناس تجاری با بیمهٔ بار.',
    descEn: 'Light and heavy cargo transport within/between cities, pickup and truck freight for furniture and commercial goods, insured shipping.',
    baseRate: 1500000, remoteCapable: false, sortOrder: 30,
  },
  {
    key: 'moving', nameFa: 'اسباب‌کشی و جابه‌جایی', nameEn: 'Moving & Relocation',
    descFa: 'بسته‌بندی حرفه‌ای اثاثیه، بارگیری و تخلیهٔ منزل و دفتر، کارگر ماهر و تجهیزات کامل، بیمهٔ آسیب جابه‌جایی.',
    descEn: 'Professional packing, loading and unloading for homes and offices, skilled labor and full equipment, moving-damage insurance.',
    baseRate: 2500000, remoteCapable: false, sortOrder: 31,
  },
  {
    key: 'cleaning', nameFa: 'نظافت منزل، ساختمان و شرکت', nameEn: 'Home & Office Cleaning',
    descFa: 'نظافت منزل، شرکت، راه‌پله و پس از ساخت؛ شست‌وشوی موکت، مبلمان و شیشه با نیروی آموزش‌دیده و مواد استاندارد.',
    descEn: 'Cleaning of homes, offices, stairways and post-construction; carpet, sofa and window washing with trained staff and standard materials.',
    baseRate: 800000, remoteCapable: false, sortOrder: 32,
  },
  // ─── ساختمان و تأسیسات ───
  {
    key: 'plumbing', nameFa: 'لوله‌کشی و تأسیسات', nameEn: 'Plumbing & Utilities',
    descFa: 'لوله‌کشی آب و گاز و فاضلاب، رفع نشتی و گرفتگی، نصب پکیج و رادیاتور، تشخیص ترکیدگی لوله با دستگاه.',
    descEn: 'Water, gas and sewer piping, leak and clog repair, package-unit and radiator installation, pipe-burst detection with equipment.',
    baseRate: 900000, remoteCapable: false, sortOrder: 33,
  },
  {
    key: 'electric', nameFa: 'برق‌کاری ساختمان', nameEn: 'Building Electrical',
    descFa: 'سیم‌کشی و برق‌کشی ساختمان، نصب پریز و کلید و فیوز، رفع اتصالی، تابلو برق و کف‌خواب با ایمنی کامل.',
    descEn: 'Building wiring, outlet/switch/breaker installation, short-circuit repair, distribution panels and floor ducts with full safety.',
    baseRate: 900000, remoteCapable: false, sortOrder: 34,
  },
  {
    key: 'hvac', nameFa: 'کولر و تهویه مطبوع', nameEn: 'AC & HVAC',
    descFa: 'نصب و سرویس کولر گازی و آبی، شارژ گاز کولر، رفع نشتی، اسپلیت و داکت اسپلیت، تنظیم و شست‌وشوی فیلترها.',
    descEn: 'Split and evaporative cooler installation and service, gas recharge, leak repair, split/duct systems, filter cleaning and tuning.',
    baseRate: 1200000, remoteCapable: false, sortOrder: 35,
  },
  {
    key: 'carpentry', nameFa: 'نجاری، کابینت و مبلمان', nameEn: 'Carpentry & Furniture',
    descFa: 'ساخت و نصب کابینت، کمد دیواری، تعمیر مبلمان و درب و پنجرهٔ چوبی، ساخت سفارشی چوبی با طراحی دلخواه.',
    descEn: 'Cabinet and walk-in closet making, sofa/wooden door repair, custom wooden furniture with your own design.',
    baseRate: 1500000, remoteCapable: false, sortOrder: 36,
  },
  {
    key: 'glass', nameFa: 'شیشه، آینه و قاب', nameEn: 'Glass & Mirror Works',
    descFa: 'برش و نصب انواع شیشه و آینه، شیشهٔ سکوریت و دوجداره، قاب‌سازی عکس و لوح، تعویض شیشهٔ شکسته.',
    descEn: 'Cutting and installation of glass and mirrors, tempered and double-glazed glass, photo/plaque framing, broken-glass replacement.',
    baseRate: 1000000, remoteCapable: false, sortOrder: 37,
  },
  {
    key: 'greenery', nameFa: 'باغبانی و فضای سبز', nameEn: 'Gardening & Landscaping',
    descFa: 'طراحی و اجرای فضای سبز، چمن‌کاری، درخت‌کاری و هرس، آبیاری قطره‌ای، نگهداری گل و گیاه در محل شما.',
    descEn: 'Green-space design and build, grass planting, tree planting and pruning, drip irrigation, plant care at your location.',
    baseRate: 800000, remoteCapable: false, sortOrder: 38,
  },
  // ─── شخصی و رویدادها ───
  {
    key: 'tailoring', nameFa: 'خیاطی و دوخت لباس', nameEn: 'Tailoring & Sewing',
    descFa: 'دوخت لباس سفارشی مردانه و زنانه، اصلاح و تنگ و گشادکردن، تعمیر و اتوی حرفه‌ای، پرده و روتختی سفارشی.',
    descEn: 'Custom men’s/women’s clothing, alterations (taking in/letting out), repair and professional pressing, custom curtains and bedspreads.',
    baseRate: 800000, remoteCapable: false, sortOrder: 39,
  },
  {
    key: 'photography', nameFa: 'عکاسی و فیلم‌برداری', nameEn: 'Photography & Videography',
    descFa: 'عکاسی و فیلم‌برداری مراسم، تبلیغاتی، صنعتی و پرتره؛ تدوین، رتوش و تحویل فایل‌های باکیفیت و آلبوم.',
    descEn: 'Event, advertising, industrial and portrait photo/video; editing, retouching and delivery of quality files and albums.',
    baseRate: 3000000, remoteCapable: false, sortOrder: 40,
  },
  {
    key: 'catering', nameFa: 'تشریفات، پذیرایی و آشپزی', nameEn: 'Catering & Events',
    descFa: 'پذیرایی و کیترینگ مراسم و مجالس، پخت غذای خانگی و رستورانی سفارشی، چیدمان میز و سرویس کامل تشریفات.',
    descEn: 'Event catering and hospitality, custom home/restaurant-style cooking, table setting and full service staff.',
    baseRate: 4000000, remoteCapable: false, sortOrder: 41,
  },
];

const PRODUCTS = [
  {
    key: 'cctv-kit', nameFa: 'پکیج دوربین مداربسته ۴ دوربین', nameEn: '4-Camera CCTV Kit',
    descFa: 'ست کامل ۴ دوربین دام + NVR + هارد ۱ ترابایت + کابل و نصب؛ مناسب منزل، مغازه و شرکت با دید در شب و دسترسی موبایل.',
    descEn: 'Complete 4-dome camera kit + NVR + 1TB HDD + cabling and installation; ideal for homes, shops and offices with night vision and mobile access.',
    price: 12500000, icon: 'cctv', warranty: '۱۸ ماه گارانتی', sortOrder: 1,
  },
  {
    key: 'cctv-camera', nameFa: 'دوربین مداربسته دام', nameEn: 'Dome CCTV Camera',
    descFa: 'دوربین دام ۲ مگاپیکسل دید در شب، مقاوم در برابر نفوذ و شرایط سخت؛ مناسب فضای داخلی و خارجی.',
    descEn: '2MP dome camera with night vision, vandal-resistant and weatherproof; suitable for indoor and outdoor use.',
    price: 2800000, icon: 'camera', warranty: '۱۲ ماه گارانتی', sortOrder: 2,
  },
  {
    key: 'nvr', nameFa: 'دستگاه NVR ضبط تصاویر', nameEn: 'NVR Recorder',
    descFa: 'دستگاه ضبط ۴ و ۸ کاناله با پشتیبانی هارد تا ۸ ترابایت، خروجی HDMI و دسترسی از راه دور با موبایل.',
    descEn: '4/8-channel recorder supporting up to 8TB HDD, HDMI output and remote mobile access.',
    price: 6900000, icon: 'harddrive', warranty: '۱۸ ماه گارانتی', sortOrder: 3,
  },
  {
    key: 'router', nameFa: 'روتر بی‌سیم دوهزبند', nameEn: 'Dual-Band Wi-Fi Router',
    descFa: 'روتر AC1200 دوهزبند با آنتن‌های پرقدرت، پوشش کامل منزل و دفتر، پورت گیگابیت و تنظیم آسان.',
    descEn: 'AC1200 dual-band router with high-gain antennas, full home/office coverage, gigabit ports and easy setup.',
    price: 3200000, icon: 'router', warranty: '۱۲ ماه گارانتی', sortOrder: 4,
  },
  {
    key: 'switch', nameFa: 'سوییچ شبکه ۸ پورت', nameEn: '8-Port Network Switch',
    descFa: 'سوییچ ۸ پورت گیگابیت فلزی با پلاگ‌اند‌پلی؛ مناسب شبکه‌های خانگی و اداری با نصب روی دیوار.',
    descEn: '8-port gigabit metal switch, plug-and-play; ideal for home and office networks with wall mounting.',
    price: 1900000, icon: 'cable', warranty: '۱۲ ماه گارانتی', sortOrder: 5,
  },
  {
    key: 'laptop', nameFa: 'لپ‌تاپ اداری و دانشجویی', nameEn: 'Office & Student Laptop',
    descFa: 'لپ‌تاپ اقتصادی با پردازندهٔ نسل جدید، رم ۱۶ گیگ، SSD ۵۱۲، نمایشگر فول‌اچ‌دی و وزن سبک — مناسب کار روزمره و درس.',
    descEn: 'Budget laptop with latest-gen CPU, 16GB RAM, 512GB SSD, Full-HD display and light weight — great for daily work and study.',
    price: 28000000, icon: 'laptop', warranty: '۲۴ ماه گارانتی', sortOrder: 6,
  },
  {
    key: 'desktop', nameFa: 'کامپیوتر اداری آماده', nameEn: 'Ready Office Desktop',
    descFa: 'کیس کامل اداری با پردازندهٔCore i5، رم ۱۶ گیگ، SSD ۵۱۲ و مانیتور ۲۲ اینچ؛ نصب و راه‌اندازی رایگان در محل.',
    descEn: 'Complete office PC with Core i5, 16GB RAM, 512GB SSD and a 22-inch monitor; free on-site setup.',
    price: 22000000, icon: 'monitor', warranty: '۲۴ ماه گارانتی', sortOrder: 7,
  },
  {
    key: 'printer', nameFa: 'پرینتر لیزری', nameEn: 'Laser Printer',
    descFa: 'پرینتر لیزری سیاه‌وسفید شبکه‌ای و وای‌فای، چاپ دوطرفهٔ خودکار؛ مناسب دفتر و منزل با کارتریج اقتصادی.',
    descEn: 'Network & Wi-Fi mono laser printer with automatic duplex; ideal for office and home with economical toner.',
    price: 7500000, icon: 'printer', warranty: '۱۲ ماه گارانتی', sortOrder: 8,
  },
  {
    key: 'ups', nameFa: 'منبع تغذیهٔ اضطراری UPS', nameEn: 'UPS Power Supply',
    descFa: 'UPS 1200VA با باتری قابل تعویض؛ حفاظت از مودم، دوربین، کامپیوتر و تجهیزات حساس در قطعی برق.',
    descEn: '1200VA UPS with replaceable battery; protects modem, CCTV, PC and sensitive equipment during outages.',
    price: 4800000, icon: 'plugzap', warranty: '۱۸ ماه گارانتی', sortOrder: 9,
  },
  {
    key: 'smartlock', nameFa: 'قفل هوشمند درب', nameEn: 'Smart Door Lock',
    descFa: 'قفل هوشمند با بازکردن از راه دور، رمز، کارت و اثر انگشت؛ مناسب خانه، آپارتمان و محل کار.',
    descEn: 'Smart lock with remote unlock, PIN, card and fingerprint; ideal for homes, apartments and offices.',
    price: 5500000, icon: 'lock', warranty: '۱۲ ماه گارانتی', sortOrder: 10,
  },
  {
    key: 'smartbulb', nameFa: 'لامپ هوشمند رنگی', nameEn: 'Smart Color Bulb',
    descFa: 'لامپ LED هوشمند ۱۶ میلیون رنگ، کنترل با موبایل و صدا، زمان‌بندی روشنایی و صرفهٔ انرژی.',
    descEn: 'Smart LED bulb with 16M colors, mobile & voice control, lighting schedules and energy saving.',
    price: 850000, icon: 'lightbulb', warranty: '۶ ماه گارانتی', sortOrder: 11,
  },
  {
    key: 'powerbank', nameFa: 'پاوربانک ۲۰,۰۰۰', nameEn: '20,000mAh Power Bank',
    descFa: 'پاوربانک ۲۰,۰۰۰ میلی‌آمپر با شارژ سریع ۲۲.۵ وات و دو خروجی؛ مناسب سفر و کار در بیرون.',
    descEn: '20,000mAh power bank with 22.5W fast charging and dual outputs; great for travel and outdoor work.',
    price: 1200000, icon: 'battery', warranty: '۶ ماه گارانتی', sortOrder: 12,
  },
];

const SETTINGS = {
  ACCOUNT_NAME: 'ألو شتاب',
  CARD_1: '6037-9981-4097-4550',
  CARD_2: '6063-7311-2146-8624',
  SUPPORT_PHONE: '09014700109',
  EMAIL_1: 'AloShetabOwner@Gmail.com',
  EMAIL_2: 'AloShetabAdmin@Gmail.com',
  REFERRAL_PERCENT: '8',
  REMOTE_FACTOR: '0.7',
  ADMIN_PASSWORD: 'AloShetab1404',
  VERSION: 'v1.0-IR',
};

async function main() {
  for (const s of SERVICES) {
    await db.service.upsert({
      where: { key: s.key },
      update: { nameFa: s.nameFa, nameEn: s.nameEn, descFa: s.descFa, descEn: s.descEn, sortOrder: s.sortOrder, remoteCapable: s.remoteCapable },
      create: { ...s, isMisc: s.key === 'misc' },
    });
  }
  for (const [key, value] of Object.entries(SETTINGS)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  for (const p of PRODUCTS) {
    await db.product.upsert({
      where: { key: p.key },
      update: { nameFa: p.nameFa, nameEn: p.nameEn, descFa: p.descFa, descEn: p.descEn, price: p.price, icon: p.icon, warranty: p.warranty, sortOrder: p.sortOrder },
      create: p,
    });
  }
  console.log('Seed OK:', SERVICES.length, 'services,', PRODUCTS.length, 'products,', Object.keys(SETTINGS).length, 'settings');
}

main().finally(() => db.$disconnect());
