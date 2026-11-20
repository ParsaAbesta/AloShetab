# -*- coding: utf-8 -*-
"""تست دود پیام ۴ — اسکلت پروژه الو شتاب"""
import sys

sys.path.insert(0, "/home/z/my-project/alo-shetab")

from fastapi.testclient import TestClient  # noqa: E402
from app.config import PUBLIC_FIELD_WHITELIST  # noqa: E402
from app.main import app  # noqa: E402

c = TestClient(app)

r = c.get("/health")
assert r.status_code == 200
print("1) health:", r.json())

cats = c.get("/api/v1/categories").json()
print("2) categories:", len(cats), "| first:", cats[0]["name"], cats[0]["service_count"])

svcs = c.get("/api/v1/services").json()
print("3) services total:", len(svcs), "| sample:", svcs[0]["name"], "->", svcs[0]["alo_rate_text"])

r = c.post("/api/v1/orders", json={"phone": "09121234567", "name": "مشتری آزمون",
                                   "service_id": svcs[0]["id"]})
assert r.status_code == 201, r.text
o = r.json()
print("4) order created:", o["code"], "| status:", o["status"])

g = c.get(f"/api/v1/orders/{o['code']}").json()
print("5) public order fields:", sorted(g.keys()))
print("   whitelist            :", sorted(PUBLIC_FIELD_WHITELIST))
leak = [k for k in g if ("share" in k.lower() or "سهم" in k or "executor" in k.lower()
                         or "referrer" in k.lower() or "settlement" in k.lower())]
print("6) share-leak check:", "FAILED: " + str(leak) if leak else "CLEAN (بدون هیچ سهمی)")

h = {"X-Admin-Token": "alo-admin-1405"}
r = c.post(f"/api/v1/admin/orders/{o['code']}/estimate", json={"amount": 2500000}, headers=h)
print("7) estimate:", r.json())
r = c.post(f"/api/v1/admin/orders/{o['code']}/dispatch", headers=h)
print("8) dispatch:", r.json())
r = c.post(f"/api/v1/admin/orders/{o['code']}/dispatch", headers={})
print("9) admin without token:", r.status_code, "(باید 401 باشد)")

print("SMOKE_OK")
