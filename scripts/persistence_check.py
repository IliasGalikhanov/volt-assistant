"""Smoke test against a local synthetic demo; restarts only this Compose project's services."""
import http.cookiejar
import json
import os
import subprocess
import time
import urllib.request

base = os.environ.get("BASE_URL", "http://127.0.0.1:8080")
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def request(path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(base + "/api" + path, data=data,
                                 headers={"Content-Type": "application/json", "X-Volt-Request": "1"})
    with client.open(req, timeout=10) as response:
        return json.load(response)


request("/datasets")
proposal = request("/cart/proposals", {"items": [{"sku": "DEMO-MCB-002", "quantity": 2, "warehouse": "central"}]})
before = request("/cart/proposals/" + proposal["id"] + "/confirm", {"confirmed": True})
subprocess.run(["docker", "compose", "restart", "app", "worker", "db"], check=True)
for attempt in range(40):
    try:
        request("/health")
        break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("Application did not recover after restart")
after = request("/cart")
assert before == after, "Cart changed after restart"
print("PASS: confirmed cart survives app, worker and database restart")
