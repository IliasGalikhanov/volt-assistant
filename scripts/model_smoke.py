"""Small synthetic smoke check, not a real-world quality benchmark."""
import http.cookiejar
import json
import os
import time
import urllib.request

base = os.environ.get("BASE_URL", "http://127.0.0.1:8080") + "/api"
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
with client.open(base + "/datasets") as response:
    response.read()
with client.open(base + "/cart") as response:
    cart_before = json.load(response)
failures = []
for text, language, expected in [
    ("Нужен автомат 16А для щитка", "ru", {"DEMO-MCB-001", "DEMO-MCB-002"}),
    ("Покажи DEMO-MCB-002", "ru", {"DEMO-MCB-002"}),
    ("Қандай жеткізу шарттары бар?", "kk", set()),
    ("Find a 16A breaker", "en", {"DEMO-MCB-001", "DEMO-MCB-002"}),
]:
    body = json.dumps({"text": text, "language": language, "mode": "primary"}).encode()
    request = urllib.request.Request(base + "/chat", data=body,
        headers={"Content-Type": "application/json", "X-Volt-Request": "1"})
    started = time.monotonic()
    with client.open(request, timeout=90) as response:
        reply = json.load(response)
    print(json.dumps({"query": text, "seconds": round(time.monotonic() - started, 2),
        "mode": reply.get("mode"), "warning": reply.get("warning"),
        "skus": [p["sku"] for p in reply.get("products", [])], "text": reply["text"]}, ensure_ascii=False), flush=True)
    if reply.get("warning") or reply.get("mode") == "search":
        failures.append(f"Model did not answer: {language}")
    if {p["sku"] for p in reply.get("products", [])} != expected:
        failures.append(f"Unexpected synthetic catalogue matches: {language}")
    if language == "kk" and "Демо шарттары" not in reply["text"]:
        failures.append("Kazakh delivery intent was not recognized")
with client.open(base + "/cart") as response:
    if json.load(response) != cart_before:
        failures.append("Chat changed the cart")
if failures:
    raise SystemExit("FAIL: " + "; ".join(failures))
print("PASS: four synthetic model requests; cart unchanged. Not a real-world quality metric.")
