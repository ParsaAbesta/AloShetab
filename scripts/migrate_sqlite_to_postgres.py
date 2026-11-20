#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
migrate_sqlite_to_postgres.py — انتقال کامل دادهٔ SQLite الو شتاب به Postgres ابری (Neon و…)
— پیام استقرار هاست رایگان (v3.1.0) ────────────────────────────────────────────────────────

اسکیمای Postgres را می‌خواند (prisma/schema.postgres.prisma)، مدل‌ها، فیلدهای Boolean
و کلیدهای خارجی را تشخیص می‌دهد، ترتیب درج را طوری می‌چیند که قید مرجع نشکند،
و از پایگاه دادهٔ SQLite یک فایل SQL سازگار با psql می‌سازد.

استفاده:
    python3 scripts/migrate_sqlite_to_postgres.py [db.sqlite] [schema.prisma] [out.sql]

پیش‌فرض‌ها:
    db       = db/custom.db
    schema   = prisma/schema.postgres.prisma
    out      = alo_shetab_migration.sql

پس از ساخت:
    psql "$DATABASE_URL" -f alo_shetab_migration.sql
    (در Neon: Connection String با ?sslmode=require)

نکته‌ها:
  • Boolean در SQLite به‌صورت 0/1 ذخیره شده و در Postgres به TRUE/FALSE تبدیل می‌شود.
  • درج‌ها ON CONFLICT ("id") DO NOTHING دارند؛ اجرای تکراری امن است.
  • دادهٔ کاتالوگ را می‌توان به‌جای مهاجرت، با زنجیرهٔ seed از نو ساخت (راهنمای بسته).
"""

import datetime as _dt
import os
import re
import sqlite3
import sys

BASE_TYPES = {"String", "Int", "Float", "Boolean", "DateTime", "Json"}
DEFAULT_DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "db", "custom.db")
DEFAULT_SCHEMA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "prisma", "schema.postgres.prisma")
DEFAULT_OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alo_shetab_migration.sql")


def parse_schema(path):
    """مدل‌ها را از فایل اسکیمای Prisma استخراج می‌کند."""
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    models = {}
    for m in re.finditer(r"model\s+(\w+)\s*\{([^}]*)\}", text):
        name, body = m.group(1), m.group(2)
        fields = []          # [(name, scalarType)]
        bools = set()        # نام فیلدهای Boolean
        pk = "id"            # کلید اصلی (پیش‌فرض id)
        deps = set()         # مدل‌های مرجع (FK)
        for line in body.splitlines():
            line = line.strip()
            if not line or line.startswith("//") or line.startswith("@@"):
                continue
            fm = re.match(r"^(\w+)\s+(\w+)(\?)?(\[\])?\s*(.*)$", line)
            if not fm:
                continue
            fname, ftype, nullable, is_list, attrs = fm.groups()
            if is_list:
                continue  # سمت لیستی رابطه
            if ftype in BASE_TYPES:
                fields.append((fname, ftype, nullable == "?"))
                if ftype == "Boolean":
                    bools.add(fname)
                if "@id" in attrs:
                    pk = fname
            else:
                # فیلد رابطه؛ فقط وقتی FK سمت این مدل است (@relation(fields:)) وابستگی دارد
                if "fields:" in attrs and ftype != name:
                    deps.add(ftype)
        models[name] = {"fields": fields, "bools": bools, "pk": pk, "deps": deps}
    return models


def topo_sort(models):
    """مرتب‌سازی توپولوژیک مدل‌ها بر پایهٔ وابستگی FK (Kahn؛ ضمیمهٔ حروفی)."""
    indeg = {m: 0 for m in models}
    rev = {m: set() for m in models}
    for name, spec in models.items():
        for dep in spec["deps"]:
            if dep in models and dep != name:
                indeg[name] += 1
                rev[dep].add(name)
    ready = sorted([m for m, d in indeg.items() if d == 0])
    order = []
    while ready:
        cur = ready.pop(0)
        order.append(cur)
        for nxt in sorted(rev[cur]):
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                ready.append(nxt)
                ready.sort()
    # هر چه باقی مانده (چرخهٔ فرضی) در انتها به ترتیب حروف
    rest = sorted(set(models) - set(order))
    return order + rest


def epoch_to_iso(v):
    """مقدار عددی epoch (میلی‌ثانیه/ثانیه) را به رشتهٔ ISO UTC تبدیل می‌کند."""
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    if n >= 1e12:            # میلی‌ثانیه
        n = n / 1000.0
    elif n < 1e10:           # ثانیه
        pass
    else:                    # عدد عجیب — بازگرداندن همان رشته
        return None
    dt = _dt.datetime.utcfromtimestamp(n)
    return dt.strftime("%Y-%m-%d %H:%M:%S.") + f"{int(dt.microsecond / 1000):03d}"


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def row_to_values(row, spec):
    out = []
    for (fname, ftype, nullable) in spec["fields"]:
        v = row[fname]
        if v is None:
            out.append("NULL")
        elif ftype == "Boolean":
            out.append("TRUE" if v in (1, "1", True, "true") else "FALSE")
        elif ftype == "Int":
            out.append(str(int(v)))
        elif ftype == "Float":
            out.append(str(float(v)))
        elif ftype == "DateTime":
            if isinstance(v, (int, float)) or (isinstance(v, str) and re.fullmatch(r"\d{10,16}", v.strip())):
                iso = epoch_to_iso(v)
                out.append(q(iso) if iso else q(v))
            else:
                out.append(q(v))
        else:  # String / Json
            out.append(q(v))
    return out


def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DB
    schema_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_SCHEMA
    out_path = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_OUT

    if not os.path.exists(db_path):
        print(f"خطا: فایل پایگاه داده یافت نشد: {db_path}")
        sys.exit(1)
    models = parse_schema(schema_path)
    if not models:
        print("خطا: هیچ مدلی از اسکیما خوانده نشد.")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    order = topo_sort(models)

    lines = [
        "-- ─── الو شتاب — مهاجرت دادهٔ SQLite → Postgres (v3.1.0) ───────────",
        "-- ساخت خودکار با scripts/migrate_sqlite_to_postgres.py",
        "-- اجرا: psql \"$DATABASE_URL\" -f alo_shetab_migration.sql",
        "",
        "BEGIN;",
    ]
    total_rows = 0
    total_stmts = 0
    for name in order:
        spec = models[name]
        try:
            rows = conn.execute(f'SELECT * FROM "{name}"').fetchall()
        except sqlite3.OperationalError:
            print(f"  هشدار: جدول {name} در SQLite نیست — رد شد.")
            continue
        if not rows:
            continue
        cols = ", ".join(f'"{f}"' for (f, _, _) in spec["fields"])
        # فیلدهایی که در SQLite هستند ولی در اسکیما ردیف‌بندی نشده‌اند نادیده گرفته می‌شوند
        colset = {f for (f, _, _) in spec["fields"]}
        dbcols = {d[0] for d in conn.execute(f'SELECT * FROM "{name}" LIMIT 1').description}
        if not colset <= dbcols:
            missing = colset - dbcols
            print(f"  هشدار: فیلد(های) {name}: {missing} در SQLite نیست — رد شد.")
            fields_use = [(f, t, n) for (f, t, n) in spec["fields"] if f in dbcols]
            spec = dict(spec)
            spec["fields"] = fields_use
            cols = ", ".join(f'"{f}"' for (f, _, _) in fields_use)
        chunk = 200
        for i in range(0, len(rows), chunk):
            part = rows[i:i + chunk]
            stmt_vals = []
            for r in part:
                rd = dict(r)
                stmt_vals.append("(" + ", ".join(row_to_values(rd, spec)) + ")")
            lines.append(
                f'INSERT INTO "{name}" ({cols}) VALUES\n' + ",\n".join(stmt_vals) +
                f'\n  ON CONFLICT ("{spec["pk"]}") DO NOTHING;'
            )
            total_stmts += 1
        total_rows += len(rows)
        print(f"  {name}: {len(rows)} ردیف")
    lines.append("COMMIT;")
    lines.append("")

    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    print(f"\nOK — {total_rows} ردیف در {total_stmts} دستور INSERT → {out_path}")
    print("مرحلهٔ بعد: psql \"$DATABASE_URL\" -f " + os.path.basename(out_path))


if __name__ == "__main__":
    main()
