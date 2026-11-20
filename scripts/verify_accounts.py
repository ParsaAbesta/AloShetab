# -*- coding: utf-8 -*-
"""بررسی صحت شبا و شماره کارت‌های پیام ۱۱ — Sheba (IBAN mod-97) + Luhn"""
import json

def iban_check(iban: str):
    iban_clean = iban.replace(' ', '').replace('-', '').upper()
    out = {'input': iban, 'length': len(iban_clean), 'valid_length': False, 'mod97': None, 'valid': False}
    # ایران = ۲۶ کاراکتر: IR + ۲ رقم کنترل + ۲۴ رقم BBAN (۳ رقم بانک + ۲۱ رقم حساب)
    if len(iban_clean) == 26:
        out['valid_length'] = True
    if len(iban_clean) >= 6:
        rearranged = iban_clean[4:] + iban_clean[:4]
        num = ''.join(str(ord(c) - 55) if c.isalpha() else c for c in rearranged)
        try:
            m = int(num) % 97
            out['mod97'] = m
            out['valid'] = (m == 1)
        except Exception as e:
            out['error'] = str(e)
    if iban_clean.startswith('IR') and len(iban_clean) == 26:
        out['bank_code'] = iban_clean[4:7]
    return out

BANKS = {
    '010': 'بانک مرکزی', '011': 'بانک صنعت و معدن', '012': 'بانک تجارت', '013': 'بانک رفاه',
    '014': 'بانک مسکن', '015': 'بانک سپه', '016': 'بانک کشاورزی', '017': 'بانک ملت',
    '018': 'بانک اقتصاد نوین', '019': 'بانک صادرات', '020': 'بانک پارسیان', '021': 'بانک پاسارگاد',
    '022': 'بانک سامان', '023': 'بانک سرمایه', '024': 'بانک پارسیان?', '025': 'بانک خاورمیانه (مید)', '026': 'بانک مهر ایران',
}

def luhn(card: str):
    digits = card.replace(' ', '').replace('-', '')
    out = {'input': card, 'digits': len(digits), 'luhn': None, 'valid': False}
    if len(digits) == 16:
        s = 0
        for i, c in enumerate(reversed(digits)):
            d = int(c)
            if i % 2 == 1:
                d *= 2
                if d > 9:
                    d -= 9
            s += d
        out['luhn'] = s
        out['valid'] = (s % 10 == 0)
    if digits.startswith('603799'): out['bank'] = 'بانک ملی ایران'
    elif digits.startswith('606373'): out['bank'] = 'بانک قرض‌الحسنه مهر ایران'
    elif digits.startswith('585983'): out['bank'] = 'بانک تجارت'
    elif digits.startswith('610433'): out['bank'] = 'بانک ملت'
    elif digits.startswith('621986'): out['bank'] = 'بانک سامان'
    elif digits.startswith('589210'): out['bank'] = 'بانک سپه'
    elif digits.startswith('627353'): out['bank'] = 'بانک تجارت'
    elif digits.startswith('585949'): out['bank'] = 'بانک خاورمیانه'
    return out

results = {
    'sheba_receiving': iban_check('IR430170000000345884841004'),
    'card_division': luhn('6037998140974550'),
    'card_company': luhn('6063731121468624'),
}

for k, v in results.items():
    print(f"--- {k} ---")
    print(json.dumps(v, ensure_ascii=False, indent=1))

# شبای ثبت‌شده چند رقم کم دارد؟ کمبود طول:
s = results['sheba_receiving']
print()
print("SUMMARY:")
print(f"  Sheba length = {s['length']} (Iranian standard = 26) -> valid_length={s['valid_length']}, mod97={s['mod97']}")
print(f"  Card division (6037998140974550): Luhn={results['card_division']['luhn']} valid={results['card_division']['valid']} bank={results['card_division'].get('bank')}")
print(f"  Card company  (6063731121468624): Luhn={results['card_company']['luhn']} valid={results['card_company']['valid']} bank={results['card_company'].get('bank')}")
