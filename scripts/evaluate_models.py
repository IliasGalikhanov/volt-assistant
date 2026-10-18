"""Evaluate actual application responses. Only the built-in synthetic dataset is used."""
import argparse
import datetime
import hashlib
import http.cookiejar
import json
import math
from pathlib import Path
import statistics
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument("--modes", nargs="+", default=["off", "primary", "fallback"], choices=["off", "primary", "fallback"])
parser.add_argument("--base-url", default="http://127.0.0.1:8080")
parser.add_argument("--ollama-url", default="http://127.0.0.1:11434")
parser.add_argument("--output", default="evaluation/results/local.json")
args = parser.parse_args()
fixture = ROOT / "evaluation/queries.json"
cases = json.loads(fixture.read_text(encoding="utf-8"))["cases"]
report = {"synthetic": True, "started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
          "working_tree_dirty": bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).strip()),
          "fixture_sha256": hashlib.sha256(fixture.read_bytes()).hexdigest(), "modes": {}}
out = ROOT / args.output
out.parent.mkdir(parents=True, exist_ok=True)
def checkpoint():
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
def percentile(values, p):
    return sorted(values)[max(0, math.ceil(len(values) * p) - 1)]
def direct(path, payload=None, timeout=240):
    request = urllib.request.Request(args.ollama_url + path, data=None if payload is None else json.dumps(payload).encode(),
                                     headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)
for mode in args.modes:
    client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def api(path, payload=None, method=None):
        request = urllib.request.Request(args.base_url + "/api" + path,
            data=None if payload is None else json.dumps(payload).encode(),
            method=method, headers={"Content-Type": "application/json", "X-Volt-Request": "1"})
        with client.open(request, timeout=90) as response:
            return json.load(response)
    api("/datasets")
    catalogue = {p["sku"]: p for p in api("/products")}
    before = api("/cart")
    result = {"records": [], "status": "running"}
    report["modes"][mode] = result
    if mode != "off":
        config = api("/model")
        model = config["primary" if mode == "primary" else "fallback"]
        result["model"] = model
        tags = direct("/api/tags")["models"]
        result["model_digest"] = next((x["digest"] for x in tags if x["name"] == model), None)
        # Explicitly unload other models: compare one model at a time on limited RAM.
        for loaded in direct("/api/ps").get("models", []):
            direct("/api/generate", {"model": loaded["name"], "keep_alive": 0})
        start = time.monotonic()
        warmup = direct("/api/chat", {"model": model, "messages": [{"role": "user", "content": "Return JSON: {\"ready\":true}"}],
            "stream": False, "think": False, "format": "json", "keep_alive": "30m",
            "options": {"num_gpu": 0, "num_ctx": 4096, "num_predict": 32, "temperature": 0}})
        result["cold_warmup_seconds"] = round(time.monotonic() - start, 3)
        result["ollama_load_seconds"] = round(warmup.get("load_duration", 0) / 1e9, 3)
    for case in cases:
        api("/history", method="DELETE")  # Every query has an independent conversation.
        start = time.monotonic()
        record = {"id": case["id"], "language": case["language"], "category": case["category"],
                  "query": case["query"], "expected_skus": case["expected_skus"], "expected_intent": case["expected_intent"]}
        try:
            reply = api("/chat", {"text": case["query"], "language": case["language"], "mode": mode})
            products = reply.get("products") or []
            actual = {p["sku"] for p in products}
            expected = set(case["expected_skus"])
            conditions = ("Демонстрационные условия:", "Демо шарттары:", "Demo terms:")
            intent = "conditions" if reply["text"].startswith(conditions) else "search"
            record.update(actual_skus=sorted(actual), actual_intent=intent,
                exact_match=actual == expected and intent == case["expected_intent"],
                precision=len(actual & expected) / len(actual) if actual else (1.0 if not expected else 0.0),
                recall=len(actual & expected) / len(expected) if expected else (1.0 if not actual else 0.0),
                warning=reply.get("warning"), actual_mode=reply.get("mode"),
                grounded=all(p == catalogue.get(p["sku"]) for p in products),
                text=reply["text"])
        except Exception as error:
            record.update(error=type(error).__name__, exact_match=False, precision=0, recall=0, grounded=False)
        record["seconds"] = round(time.monotonic() - start, 3)
        result["records"].append(record)
        checkpoint()
        print(mode, len(result["records"]), "/", len(cases), case["id"], record["exact_match"], record["seconds"], flush=True)
    records = result["records"]
    result["summary"] = {"cases": len(records), "exact_match_rate": sum(r["exact_match"] for r in records)/len(records),
        "intent_accuracy": sum(r.get("actual_intent") == r["expected_intent"] for r in records)/len(records),
        "macro_precision": statistics.mean(r["precision"] for r in records), "macro_recall": statistics.mean(r["recall"] for r in records),
        "p50_seconds": statistics.median(r["seconds"] for r in records), "p95_seconds": percentile([r["seconds"] for r in records], .95),
        "errors": sum("error" in r for r in records), "fallbacks": sum(bool(r.get("warning")) for r in records),
        "ungrounded_responses": sum("error" not in r and not r["grounded"] for r in records), "cart_unchanged": api("/cart") == before}
    result["by_language"] = {lang: {"cases": sum(r["language"] == lang for r in records),
        "exact_matches": sum(r["language"] == lang and r["exact_match"] for r in records)} for lang in ["ru", "kk", "en"]}
    result["status"] = "complete"
    checkpoint()
report["finished_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
checkpoint()
print("Saved", out)

