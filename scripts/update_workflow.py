# -*- coding: utf-8 -*-
"""درج فرآیند ۶ مرحله‌ای سفارش‌گیری (اصلاحیه کاربر) در فایل کاتالوگ الو شتاب"""
import json

P = "/home/z/my-project/download/alo_shetab_services_rates_1405-08-24.json"
d = json.load(open(P, encoding="utf-8"))

d["order_workflow"] = [
    {"step": 1, "title": "ثبت سفارش توسط مشتری", "state": "ثبت‌شده"},
    {"step": 2, "title": "کارشناسی توسط همکار مربوطه و اعلام برآورد هزینه",
     "state": "در حال کارشناسی ← برآورد اعلام‌شده",
     "note": "کارشناسی توسط همکار همان دسته خدمت انجام می‌شود؛ در صورت عدم پذیرش برآورد، سفارش بدون پرداخت بسته می‌شود"},
    {"step": 3, "title": "پرداخت توسط مشتری", "state": "پرداخت‌شده",
     "note": "در این مرحله کد معرف وارد و تخفیف ۵٪ روی مبلغ برآورد اعمال می‌شود"},
    {"step": 4, "title": "اعزام همکار مربوطه", "state": "اعزام‌شده / در حال انجام"},
    {"step": 5, "title": "اعلام رضایت مشتری", "state": "رضایت تأییدشده",
     "note": "در صورت عدم رضایت: اصلاح کار یا مرجوعی (قابل تنظیم)"},
    {"step": 6, "title": "واریز سهم همکار انجام‌دهنده", "state": "تسویه‌شده",
     "note": "فقط پس از تأیید رضایت مشتری انجام می‌شود؛ سهم معرف مشتری (۱/۷ مبلغ کل سفارش) نیز در همین فاز تسویه محاسبه و پرداخت می‌شود"},
]

d["share_model"]["settlement_rule"] = (
    "واریز سهم همکار انجام‌دهنده صرفاً پس از اعلام رضایت مشتری (مرحله ۵ فرآیند سفارش‌گیری)؛ "
    "جز سهم معرف (۱/۷) و تخفیف کد معرف (۵٪) هیچ سهم دیگری ذکر یا محاسبه نمی‌شود"
)

json.dump(d, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# راستی‌آزمایی
chk = json.load(open(P, encoding="utf-8"))
print("WORKFLOW_STEPS:", len(chk["order_workflow"]))
print("STATES:", " | ".join(s["state"] for s in chk["order_workflow"]))
print("SETTLEMENT_RULE_OK:", "settlement_rule" in chk["share_model"])
print("CATEGORIES_INTACT:", len(chk["categories"]))
