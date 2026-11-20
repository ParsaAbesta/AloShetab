#!/usr/bin/env python3
"""AloShetab — حساب‌سنجی دقیق شبا (mod-97) و کارت‌بانکی (Luhn)
مطابق دستور کاربر: «شماره شبا و پل هر دو حساب را با دقت بررسی، و در صورت نیاز اطلاع بده و اصلاح کن»
"""
import json

IR_BANK_CODES = {
    "017": "بانک مهر ایران",
    "012": "بانک ملت", "013": "بانک ملی ایران", "015": "بانک سپه",
    "016": "بانک صادرات", "018": "بانک توسعه صادرات", "019": "بانک پست بانک",
    "020": "بانک توسعه", "021": "بانک پارسیان", "022": "بانک سامان",
    "023": "بانک پاسارگاد", "024": "بانک اقتصاد نوین", "025": "بانک پارسیان (قدیم)",
    "030": "بانک آینده", "031": "بانک شهر", "005": "بانک تجارت",
    "006": "بانک سرمایه", "007": "بانک حکمت ایرانیان", "008": "بانک ایران زمین",
    "010": "بانک کشاورزی", "011": "بانک رفاه", "014": "بانک مسکن",
    "051": "بانک مهر ایران (قدیم)", "052": "بانک ایله‌دام? - نادر", "053": "بانک کوثر",
    "054": "بانک خاورمیانه?", "055": "بانک گردشگری", "056": "بانک ایران و ونزوئلا",
    "057": "بانک قرض‌الحسنه مهر ایران", "058": "بانک مهر اقتصاد", "059": "بانک غدیر",
}

CARD_BINS = {
    "603799": "بانک ملی ایران",
    "606373": "بانک قرض‌الحسنه مهر ایران",
    "610433": "بانک ملت", "606256": "بانک ملت", "991975": "بانک ملت",
    "627353": "بانک تجارت", "585983": "بانک تجارت",
    "621986": "بانک سامان",
    "639347": "بانک پاسارگاد",
    "627412": "بانک اقتصاد نوین",
    "627488": "بانک کارآفرین", "502910": "بانک کارآفرین",
    "502806": "بانک شهر", "502972": "بانک کوثر",
    "603769": "بانک صادرات", "603764": "بانک سینا",
    "603770": "بانک کشاورزی", "585910": "بانک کشاورزی",
    "589210": "بانک سپه",
    "639217": "بانک توسعه ملی", "639599": "بانک قوامین (منحل)",
    "627381": "بانک انصار", "505410": "بانک انصار",
    "502938": "بانک توسعه صادرات", "504172": "بانک رسالت",
    "505416": "بانک ایران زمین", "505785": "بانک ایران زمین (قدیم)",
    "627648": "بانک توسعه تعاون", "504194": "بانک گردشگری",
    "603796": "بانک مسکن", "627760": "بانک پست بانک",
    "620685": "بانک مشترک ایران-اروپا? - نادر",
}


def iban_mod97(iban: str) -> dict:
    s = iban.replace(" ", "").replace("-", "").upper()
    info = {"input": iban, "length": len(s), "country": s[:2]}
    if s[:2] != "IR":
        info["error"] = "country code != IR"
        info["valid"] = False
        return info
    body = s[2:]
    if not body.isdigit():
        info["error"] = "non-digit characters"
        info["valid"] = False
        return info
    info["valid_length_ir26"] = (len(s) == 26)
    check = body[:2]
    bban = body[2:]
    # الگوریتم: BBAN + (I=18,R=27) + check  → mod 97 == 1
    rearranged = bban + "1827" + check
    r = int(rearranged) % 97
    info["mod97_remainder"] = r
    info["mod97_valid"] = (r == 1)
    info["check_digits"] = check
    info["bank_code"] = bban[:3]
    info["bank"] = IR_BANK_CODES.get(bban[:3], "نامشخص")
    if not info["mod97_valid"]:
        n = int(bban + "1827" + "00")
        correct = 98 - (n % 97)
        info["correct_check_digits"] = f"{correct:02d}"
        info["corrected_iban"] = "IR" + f"{correct:02d}" + bban
    info["valid"] = bool(info["valid_length_ir26"] and info["mod97_valid"])
    return info


def luhn(card: str) -> dict:
    card = card.replace(" ", "").replace("-", "")
    info = {"input": card, "length": len(card)}
    if len(card) != 16 or not card.isdigit():
        info["error"] = "card must be 16 digits"
        info["valid"] = False
        return info
    digits = [int(d) for d in card]
    total = 0
    for i, d in enumerate(digits):
        if i % 2 == 0:  # از سمت چپ: موقعیت‌های 1,3,5,... (کارت ۱۶ رقمی)
            d *= 2
            if d > 9:
                d -= 9
        total += d
    info["luhn_sum"] = total
    info["luhn_valid"] = (total % 10 == 0)
    info["bin"] = card[:6]
    info["bank"] = CARD_BINS.get(card[:6], "نامشخص")
    # اگر نامعتبر بود، رقم آخر صحیح را حساب کن
    if not info["luhn_valid"]:
        for last in range(10):
            test = digits[:-1] + [last]
            t = 0
            for i, d in enumerate(test):
                if i % 2 == 0:
                    d *= 2
                    if d > 9:
                        d -= 9
                t += d
            if t % 10 == 0:
                info["corrected_card"] = card[:-1] + str(last)
                break
    info["valid"] = info["luhn_valid"]
    return info


def main():
    accounts = {
        "shaba_receiving_payment": iban_mod97("IR430170000000345884841004"),
        "card_tasavun_mohases_hoghoghi (تسهیم/حق معرفی)": luhn("6037998140974550"),
        "card_company_share_sahme_sherkat": luhn("6063731121468624"),
    }
    print(json.dumps(accounts, ensure_ascii=False, indent=2))

    print("\n=== خلاصه ===")
    sh = accounts["shaba_receiving_payment"]
    print(f"شبا دریافت: {'معتبر ✓ (mod-97 برابر ۱)' if sh['valid'] else 'نامعتبر ✗'}"
          f" | بانک: {sh.get('bank')} | طول: {sh['length']}"
          + (f" | شبا صحیح: {sh.get('corrected_iban')}" if not sh["valid"] else ""))
    for k in list(accounts.keys())[1:]:
        c = accounts[k]
        print(f"کارت {c['input']}: {'معتبر ✓ (Luhn)' if c['valid'] else 'نامعتبر ✗'}"
              f" | بانک: {c.get('bank')}"
              + (f" | کارت صحیح احتمالی: {c.get('corrected_card')}" if not c["valid"] else ""))


if __name__ == "__main__":
    main()
