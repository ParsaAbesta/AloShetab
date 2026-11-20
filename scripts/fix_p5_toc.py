# -*- coding: utf-8 -*-
"""رفع اشکال فهرست مطالب سند پیام ۵

docx-js نسخه ۹ کل فیلد TOC را در یک پاراگراف می‌سازد و اسکریپت placeholder
اولین مدخل را داخل همان پاراگراف تزریق می‌کند؛ نتیجه یک سطر تکراری
«خلاصه اجرایی» بدون شماره صفحه است. این اسکریپت همه بلوک‌های hyperlink
داخل پاراگراف فیلد TOC را حذف می‌کند تا پاراگراف فیلد مانند سند پیام ۳
خالی بماند و ۱۱ مدخل مستقل باقی بمانند.
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

DOC = Path(sys.argv[1])
TMP = DOC.with_suffix(".tmp.docx")

with zipfile.ZipFile(DOC) as zin:
    names = zin.namelist()
    data = {n: zin.read(n) for n in names}

xml = data["word/document.xml"].decode("utf-8")

paras = re.split(r"(<w:p\b.*?</w:p>)", xml, flags=re.S)
fixed = 0
for i, chunk in enumerate(paras):
    if not chunk.startswith("<w:p"):
        continue
    if "TOC \\h" not in chunk and "TOC \\o" not in chunk:
        continue
    if "<w:hyperlink" not in chunk:
        continue
    # حذف همه بلوک‌های hyperlink داخل پاراگراف فیلد TOC
    new_chunk = re.sub(r"<w:hyperlink\b.*?</w:hyperlink>", "", chunk, flags=re.S)
    if new_chunk != chunk:
        paras[i] = new_chunk
        fixed += 1

xml = "".join(paras)
data["word/document.xml"] = xml.encode("utf-8")

with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for n in names:
        zout.writestr(n, data[n])
shutil.move(TMP, DOC)
print(f"FIXED: {fixed} TOC field paragraph(s) cleaned in {DOC.name}")
