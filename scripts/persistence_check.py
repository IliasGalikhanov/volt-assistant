"""Smoke test against a local synthetic demo; restarts only this Compose project's services."""
import http.cookiejar
import json
import os
import subprocess
import time
import urllib.request

base = os.environ.get("BASE_URL", "http://127.0.0.1:8080")
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def request(path, body=None, method=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(base + "/api" + path, data=data, method=method,
                                 headers={"Content-Type": "application/json", "X-Volt-Request": "1"})
    with client.open(req, timeout=10) as response:
        return json.load(response)


request("/datasets")
proposal = request("/cart/proposals", {"items": [{"sku": "DEMO-MCB-002", "quantity": 2, "warehouse": "central"}]})
before = request("/cart/proposals/" + proposal["id"] + "/confirm", {"confirmed": True})
boundary = "volt-persistence-check"
file_body = (f'--{boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\nspecification\r\n'
             f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic.csv"\r\nContent-Type: text/csv\r\n\r\n'
             f'sku,quantity\nDEMO-MCB-002,2\r\n--{boundary}--\r\n').encode()
req = urllib.request.Request(base + "/api/uploads", data=file_body,
    headers={"Content-Type": "multipart/form-data; boundary="+boundary, "X-Volt-Request": "1"})
with client.open(req, timeout=10) as response:
    job_id = json.load(response)["id"]
for attempt in range(30):
    job = next(j for j in request("/jobs") if j["id"] == job_id)
    if job["status"] == "review": break
    if job["status"] == "failed": raise SystemExit("Synthetic upload failed")
    time.sleep(1)
else:
    raise SystemExit("Synthetic upload did not finish")
draft_path = "/jobs/"+job_id+"/draft"
draft_before = request(draft_path, {"revision": 0, "draft": {"rows": [{"query": "corrected", "sku": "DEMO-MCB-002", "quantity": 5}], "warehouse": "central", "reviewed": True}}, "PUT")
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
assert request(draft_path) == draft_before, "Saved draft changed after restart"
print("PASS: confirmed cart and versioned review draft survive app, worker and database restart")
