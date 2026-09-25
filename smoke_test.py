"""Smoke test: extract (road/building/water) -> buffer -> dissolve -> local mode -> exports."""
import requests

BASE = "http://127.0.0.1:5000"
bbox = {"south": 28.625, "west": 77.205, "north": 28.632, "east": 77.218}  # CP, Delhi

r = requests.post(f"{BASE}/api/extract", json=bbox, timeout=200)
print("extract roads (broad):", r.status_code, r.json()["meta"])

r = requests.post(f"{BASE}/api/extract-poly", json={**bbox, "kind": "building"}, timeout=200)
print("extract buildings:", r.status_code, r.json()["meta"])

r = requests.post(f"{BASE}/api/extract-poly", json={**bbox, "kind": "water"}, timeout=200)
print("extract water (poly+line):", r.status_code, r.json()["meta"])
water = r.json()

r = requests.post(f"{BASE}/api/buffer", json={"geojson": water, "width": 5000, "unit": "mm"}, timeout=200)
print("buffer (water, 5000 mm = 5 m):", r.status_code, r.json()["meta"])

r = requests.post(f"{BASE}/api/dissolve", json={"geojson": r.json()}, timeout=200)
print("dissolve:", r.status_code, r.json()["meta"])

# local mode
r = requests.post(f"{BASE}/api/local/download", json=bbox, timeout=300)
print("local download:", r.status_code, {**r.json(), "id": r.json()["id"][:20] + "…"})
cid = r.json()["id"]
r = requests.get(f"{BASE}/api/local/get", params={"id": cid}, timeout=60)
print("local get:", r.status_code, {k: len(v["features"]) for k, v in r.json().items() if isinstance(v, dict) and "features" in v})
r = requests.get(f"{BASE}/api/local/list", timeout=60)
print("local list:", r.status_code, len(r.json()), "cache entries")

# exports
r = requests.post(f"{BASE}/api/export/shp", json={"geojson": water, "name": "water_test"}, timeout=120)
print("export shp:", r.status_code, r.headers.get("Content-Type"), len(r.content), "bytes")

r = requests.post(f"{BASE}/api/export/svg", json={"geojson": water, "name": "water_test"}, timeout=120)
print("export svg:", r.status_code, r.headers.get("Content-Type"), len(r.content), "bytes")

print("OK")
