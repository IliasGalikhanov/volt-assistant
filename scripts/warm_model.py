"""Warm the selected local model before using the interactive request timeout."""
import json
import os
from pathlib import Path
import time
import urllib.request

env_file = Path(__file__).resolve().parent.parent / ".env"
config = {}
if env_file.exists():
    config = dict(line.split("=", 1) for line in env_file.read_text(encoding="utf-8").splitlines()
                  if "=" in line and not line.startswith("#"))
config.update(os.environ)
model = config.get("OLLAMA_MODEL", "qwen3.5:4b-q4_K_M")
options = {"num_ctx": 4096}
gpu = config.get("OLLAMA_NUM_GPU", "")
if gpu:
    options["num_gpu"] = int(gpu)
body = {"model": model, "prompt": "", "stream": False, "keep_alive": "10m", "options": options}
url = config.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
print(f"Warming {model}; first load may take several minutes", flush=True)
started = time.monotonic()
request = urllib.request.Request(url + "/api/generate", data=json.dumps(body).encode(),
                                headers={"Content-Type": "application/json"})
with urllib.request.urlopen(request, timeout=300) as response:
    result = json.load(response)
if not result.get("done"):
    raise SystemExit("Model did not report readiness")
print(f"Model loaded in {time.monotonic() - started:.1f}s")
