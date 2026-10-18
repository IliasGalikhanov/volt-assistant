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
for text, language in [
    ("Нужен автомат 16А для щитка", "ru"),
    ("Покажи DEMO-MCB-002", "ru"),
    ("Қандай жеткізу шарттары бар?", "kk"),
    ("Find a 16A breaker", "en"),
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
