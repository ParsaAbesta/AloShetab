#!/usr/bin/env python3
# Post-process docx per toc.md + Persian RTL fixes:
# 1. remove empty <w:pgNumType/>
# 2. patch footer PAGE field with \* arabic switch
# 3. strip duplicate first-entry content from the TOC field-begin paragraph
# 4. add <w:bidi/> to TOC1/TOC2/TOC3 styles so placeholder entries render RTL
import re, shutil, sys, zipfile, os

DOCX = sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/download/پیام-۳-نقشه-راه-Production.docx"
TMP = DOCX + ".tmp.zip"

def patch_document(text, patched):
    # 1. remove empty pgNumType (WPS confusion)
    text, n = re.subn(r"<w:pgNumType/>", "", text)
    patched["pgnum"] = n
    # 3. TOC field-begin paragraph: keep [begin][instrText TOC][separate], drop the rest
    i = text.find("TOC \\h")
    if i != -1:
        pstart = max(text.rfind("<w:p ", 0, i), text.rfind("<w:p>", 0, i))
        pend = text.find("</w:p>", i) + 6
        p = text[pstart:pend]
        sep = p.find('fldCharType="separate"')
        if sep != -1:
            rend = p.find("</w:r>", sep) + len("</w:r>")
            text = text[:pstart] + p[:rend] + "</w:p>" + text[pend:]
            patched["toc-dup"] = 1
    return text

def patch_styles(text, patched):
    # 4. bidi on TOC styles (before spacing/ind per CT_PPrBase order)
    count = 0
    for sid in ("TOC1", "TOC2", "TOC3"):
        m = re.search(r'(<w:style [^>]*w:styleId="%s".*?<w:pPr>)(.*?)(</w:pPr>)' % sid, text, re.S)
        if m and "<w:bidi/>" not in m.group(2):
            text = text[:m.start()] + m.group(1) + "<w:bidi/>" + m.group(2) + m.group(3) + text[m.end():]
            count += 1
    patched["toc-bidi"] = count
    return text

def main():
    src = zipfile.ZipFile(DOCX, "r")
    out = zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED)
    patched = {"pgnum": 0, "footer": 0, "toc-dup": 0, "toc-bidi": 0}
    for item in src.infolist():
        data = src.read(item.filename)
        name = item.filename
        if name == "word/document.xml":
            data = patch_document(data.decode("utf-8"), patched).encode("utf-8")
        elif name == "word/styles.xml":
            data = patch_styles(data.decode("utf-8"), patched).encode("utf-8")
        elif re.match(r"word/footer\d*\.xml$", name):
            text = data.decode("utf-8")
            new_text, n = re.subn(
                r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
                r"\1 PAGE \\* arabic \\* MERGEFORMAT \2",
                text,
            )
            if n:
                patched["footer"] += n
            data = new_text.encode("utf-8")
        out.writestr(item, data)
    src.close()
    out.close()
    shutil.move(TMP, DOCX)
    print("patched:", patched)

if __name__ == "__main__":
    main()
