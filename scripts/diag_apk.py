#!/usr/bin/env python3
"""تشخیص سلامت ساختاری APK: روش فشرده‌سازی، تراز resources.arsc، جادوی dex، sha256"""
import sys, zipfile, struct, hashlib

def apk_report(path):
    print(f"== {path} ==")
    try:
        z = zipfile.ZipFile(path)
    except Exception as e:
        print("  ZIP INVALID:", e)
        return False
    issues = []
    arsc_off = None
    for i in z.infolist():
        method = 'STORED ' if i.compress_type == 0 else 'DEFLATE'
        print(f"  {i.filename:42s} {i.compress_size:>9d} {method}")
        if i.filename == 'resources.arsc':
            f = open(path, 'rb')
            f.seek(i.header_offset + 28)
            nl, el = struct.unpack('<HH', f.read(4))
            data_off = i.header_offset + 30 + nl + el
            f.close()
            arsc_off = data_off
    if arsc_off is not None:
        aligned = (arsc_off % 4) == 0
        print(f"  resources.arsc data_offset={arsc_off} aligned4={'OK' if aligned else 'MISALIGNED !!!'}")
        if not aligned:
            issues.append("arsc misaligned (Android 11+ rejects)")
    if 'classes.dex' not in z.namelist():
        issues.append("classes.dex missing")
    else:
        d = z.read('classes.dex')
        magic_ok = d[:4] == b'dex\n' and d[7:8] == b'\x00'
        print(f"  dex: magic={'OK' if magic_ok else 'BAD'} version={d[4:7].decode('ascii','replace')} size={len(d)}")
        if not magic_ok:
            issues.append("dex magic bad")
    with open(path, 'rb') as f:
        sha = hashlib.sha256(f.read()).hexdigest()
    print(f"  sha256: {sha}")
    print("  VERDICT:", "STRUCT-OK" if not issues else "ISSUES: " + "; ".join(issues))
    z.close()
    return not issues

if __name__ == '__main__':
    for p in sys.argv[1:]:
        apk_report(p)
        print()
