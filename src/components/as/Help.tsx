'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Calculator, CreditCard, Share2, Wallet, Star, Truck } from 'lucide-react';
import { useAs } from './store';
import { t } from './i18n';

export default function Help() {
  const { lang } = useAs();
  const isFa = lang === 'fa';

  const faq: { q: string; a: string }[] = isFa
    ? [
        { q: 'سفارش را چطور ثبت کنم؟', a: 'از صفحهٔ خدمات، یک یا چند خدمت را با دکمهٔ «افزودن» انتخاب کنید، دکمهٔ راهنمای کنار هر خدمت شرح کامل آن را نشان می‌دهد. سپس مشخصات، آدرس و نحوهٔ انجام را تکمیل کنید؛ پیش‌فاکتور شفاف می‌گیرید و پس از پرداخت، کد رهگیری AS-XXXXXX دریافت می‌کنید.' },
        { q: 'قیمت چطور محاسبه می‌شود؟', a: 'قیمت = نرخ پایه × ضریب روز هفته (شنبه تا چهارشنبه ×۱، پنجشنبه ×۱٫۱، جمعه ×۱٫۲) × ضریب ساعت (۸–۱۷ ×۱، ۱۷–۲۲ ×۱٫۱، ۲۲–۸ ×۱٫۲۵) × نرخ روز خدمت (تعطیلات رسمی از پنل ادمین) × حالت انجام (در محل ×۱، از راه دور ×۰٫۷) − ۵٪ تخفیف معرف. همهٔ محاسبات سمت سرور انجام می‌شود.' },
        { q: 'گزینهٔ «متفرقه» چگونه قیمت می‌گیرد؟', a: 'نیاز خود را می‌نویسید؛ هوش مصنوعی نرخ انجام پروژه را برآورد می‌کند و اگر کار نیاز به بررسی داشته باشد، برچسب «نیاز به بررسی و کارشناسی» می‌خورد. پس از تعیین تکلیف کارشناس، قیمت قطعی می‌شود و کار استارت می‌خورد.' },
        { q: 'پرداخت چگونه است؟', a: 'پرداخت فقط از طریق میز خدمات و فقط به حساب‌های شرکت (با نام ألو شتاب) انجام می‌شود: درگاه اینترنتی شاپرک/شتاب (کارت ← رمز دوم ← OTP) یا کارت‌به‌کارت با ثبت رسید و تأیید ادمین. کل مبلغ ابتدا در کیف پول شرکت امانت می‌ماند.' },
        { q: 'تسویهٔ انجام‌دهنده چگونه است؟', a: 'پس از اعلام رضایت شما، تسویهٔ انجام‌دهنده به‌صورت خودکار و در همان لحظه انجام می‌شود؛ جزئیات سهم‌ها مطابق قرارداد، نزد ألو شتاب محرمانه می‌ماند و حق معرف (در صورت وجود) نیز طبق فرایند داخلی واریز می‌شود.' },
        { q: 'کد معرف چیست؟', a: 'هر کد ملی، یک کد معرفی یکتاست. اگر دوستانتان کد ملی شما را هنگام سفارش وارد کنند، ۵٪ تخفیف می‌گیرند و حق معرفی نیز برای شما ثبت و طبق فرایند داخلی واریز می‌شود. مشتری و معرف نمی‌توانند یک نفر باشند.' },
        { q: 'چطور سفارشم را پیگیری کنم؟', a: 'در صفحهٔ «پیگیری سفارش» کد رهگیری AS-XXXXXX و شمارهٔ همراهِ سفارش را وارد کنید؛ خط زمانی وضعیت را می‌بینید و پس از پایان کار می‌توانید رضایت و امتیاز (۵ مهارت + ۵ اخلاق) ثبت کنید.' },
        { q: 'امتیازدهی همکاران چگونه است؟', a: 'پس از پایان کار، ۵ امتیاز مهارت و ۵ امتیاز اخلاق (هر کدام ۰ تا ۵ ستاره) ثبت می‌کنید. همکاران بر اساس امتیاز تجمعی، سطح برنزی، نقره‌ای یا طلایی می‌گیرند و از مزایا بهره‌مند می‌شوند.' },
        { q: 'چطور همکار ألو شتاب شوم؟', a: 'از منو گزینهٔ «جذب همکار» را باز کنید و نام، کد ملی، موبایل، شهر، رشتهٔ تخصصی و سوابق خود را ثبت کنید؛ اطلاعات مستقیماً در پنل ادمین الو شتاب ثبت می‌شود و پس از تأیید، در تسویهٔ سفارش‌ها قابل انتخاب خواهید بود.' },
      ]
    : [
        { q: 'How do I place an order?', a: 'From the Services page, add one or more services; the help button next to each shows the full description. Then fill in your details, address and mode. You get a transparent proforma and receive an AS-XXXXXX tracking code after payment.' },
        { q: 'How is pricing calculated?', a: 'Price = base rate × weekday factor (Sat–Wed ×1, Thu ×1.1, Fri ×1.2) × hour factor (8–17 ×1, 17–22 ×1.1, 22–8 ×1.25) × special day rate (holidays set by admin) × mode (on-site ×1, remote ×0.7) − 5% referral discount. All calculations run server-side.' },
        { q: 'How does "Miscellaneous" get priced?', a: 'Describe your need; AI estimates the project rate, or the system flags it "needs expert review". Once the expert sets the final price, the work starts.' },
        { q: 'How do I pay?', a: 'Payment only through the Service Desk to company accounts named "Alo Shetab": Shaparak/Shetab gateway (card → PIN2 → OTP) or card-to-card with a receipt confirmed by admin. The full amount is held in the company wallet first.' },
        { q: 'How is the worker settled?', a: 'After you declare satisfaction, the worker settlement runs automatically and instantly; share details stay confidential to Alo Shetab per the contract, and the referral fee (if any) is paid per the internal process.' },
        { q: 'What is a referral code?', a: 'Every national ID is a unique referral code. Friends entering it get 5% off and a referral fee is recorded for you, paid per the internal process. Customer and referrer cannot be the same person.' },
        { q: 'How do I track my order?', a: 'On the Track page, enter the AS-XXXXXX code and the order mobile; you see the status timeline and can submit skill/ethics ratings after completion.' },
        { q: 'How are workers rated?', a: 'After completion you submit 5 skill + 5 ethics points (0–5 stars each). Workers earn cumulative points and reach Bronze, Silver or Gold levels with benefits.' },
        { q: 'How do I become a worker?', a: 'Open "Join as worker" from the menu and submit your name, national ID, mobile, city, specialty and experience; it goes straight to the Alo Shetab admin panel and, after approval, you become selectable for order settlement.' },
      ];

  const rules = [
    { icon: Calculator, title: isFa ? 'قیمت‌گذاری پویا' : 'Dynamic pricing', text: isFa ? 'نرخ پایه × ضرایب روز/ساعت/نرخ روز خدمت × حالت انجام، منهای تخفیف معرف — با نمایش ریز محاسبات در پیش‌فاکتور.' : 'Base rate × weekday/hour/day-rate factors × mode, minus referral discount — itemized in the proforma.' },
    { icon: Wallet, title: isFa ? 'کیف پول امانی' : 'Escrow wallet', text: isFa ? 'کل مبلغ ابتدا دریافت و تا اطلاع ثانوی در کیف پول شرکت نگه داشته می‌شود.' : 'The full amount is collected first and held in the company wallet until settlement.' },
    { icon: Share2, title: isFa ? 'حق معرفی مشتری' : 'Referral fee', text: isFa ? 'در صورت معرفی مشتری جدید، حق معرفی به حساب شما ثبت و طبق فرایند داخلی واریز می‌شود.' : 'When you refer a new customer, a referral fee is recorded for you and paid per the internal process.' },
    { icon: Star, title: isFa ? 'امتیاز ۵+۵' : '5+5 rating', text: isFa ? '۵ امتیاز مهارت + ۵ امتیاز اخلاق پس از پایان کار؛ مبنای سطح‌بندی برنزی/نقره‌ای/طلایی.' : '5 skill + 5 ethics points after completion; the basis of Bronze/Silver/Gold levels.' },
    { icon: Truck, title: isFa ? 'حالت از راه دور' : 'Remote mode', text: isFa ? 'خدماتِ بدون نیاز به حضور فیزیکی با ضریب تخفیف ۰٫۷ انجام می‌شوند.' : 'Services that need no physical visit run with the ×0.7 discount factor.' },
    { icon: CreditCard, title: isFa ? 'پرداخت فقط به شرکت' : 'Pay only the company', text: isFa ? 'پرداخت فقط از طریق میز خدمات به حساب‌های «ألو شتاب»؛ هیچ دادهٔ کارت شما ذخیره نمی‌شود.' : 'Payments only via the desk to "Alo Shetab" accounts; your card data is never stored.' },
  ];

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-4 pb-16">
      <div className="mt-8">
        <h1 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          {t('helpTitlePage', lang)}
        </h1>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {rules.map((r) => (
          <Card key={r.title}>
            <CardContent className="p-4">
              <r.icon className="h-5 w-5 text-primary" />
              <p className="mt-2 font-bold text-sm">{r.title}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-5">{r.text}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-extrabold">{t('faq', lang)}</h2>
        <Accordion type="single" collapsible className="mt-3">
          {faq.map((f, i) => (
            <AccordionItem key={i} value={`q${i}`}>
              <AccordionTrigger className="text-sm font-bold text-start">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-6">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <Card className="mt-8 bg-primary text-primary-foreground">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm font-bold">{isFa ? 'سؤال دیگری دارید؟ پشتیبانی هوشمند و کارشناسان ما در دسترس‌اند. تلفن تماس پشتیبانی در پایین صفحهٔ سایت (فوتر) درج شده است.' : 'More questions? Our smart support and experts are available. The support phone number is listed in the site footer.'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
