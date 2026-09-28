"""Prueba de integración local. Crea dos cuentas ficticias para probar aislamiento."""
import http.cookiejar
import json
import urllib.request
import urllib.error
import uuid
from concurrent.futures import ThreadPoolExecutor

BASE = "http://localhost:5173"

def client():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

def call(c, path, data=None, expected=200, origin=BASE):
    request = urllib.request.Request(BASE + "/api/" + path, data=json.dumps(data).encode() if data is not None else None, headers={"Content-Type": "application/json", "Origin": origin})
    try:
        response = c.open(request, timeout=20)
        status, payload = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, payload = error.code, error.read()
    assert status == expected, (path, status, payload)
    return json.loads(payload) if payload else None

a, b, anonymous = client(), client(), client()
for c in (a, b):
    data = {"name": "QA Dispositivo", "email": "device-" + uuid.uuid4().hex[:12] + "@example.com", "password": "PruebaSalud2026!"}
    call(c, "auth/register", data, 201)
    call(c, "auth/login", data)
call(anonymous, "device", expected=401)
call(anonymous, "dashboard", expected=401)
call(anonymous, "device/sync", {}, 401)
assert call(a, "device") is None
assert call(a, "dashboard")["metrics"] == []
call(a, "device/sync", {}, 409)
call(a, "device", {"name": "  ", "brand": "Demo", "model": "Fit"}, 422)
body = {"name": "Pulsera de prueba", "brand": "Demo", "model": "FitBand"}
call(a, "device", body, 403, "http://otro.example")
device = call(a, "device", body, 201)
assert device["source"] == "simulated"
call(a, "device", body, 409)
# Las dos sincronizaciones simultáneas deben insertar siete días una sola vez.
with ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(lambda _: call(a, "device/sync", {}), range(2)))
assert sum(r["created"] for r in results) == 7
first = call(a, "dashboard")
assert len(first["metrics"]) == 7
assert first["latest"] == first["metrics"][-1]
assert all(m["source"] == "simulated" and m["steps"] >= 0 for m in first["metrics"])
assert call(a, "device/sync", {})["created"] == 0
assert call(a, "dashboard")["metrics"] == first["metrics"]
assert call(b, "device") is None
assert call(b, "dashboard")["metrics"] == []
call(b, "device/sync", {}, 409)
for c in (a,b):
    call(c, "auth/logout", {}, 204)
print("PASS: registro, validacion, sesion, aislamiento, persistencia y sincronizacion concurrente sin duplicados")
