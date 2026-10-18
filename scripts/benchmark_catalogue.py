"""Measure an invented 10k catalogue against the separate local test DB."""
from pathlib import Path
import json
import os
import platform
import subprocess
from urllib.parse import urlsplit, urlunsplit

root = Path(__file__).resolve().parent.parent
env = os.environ.copy()
if not env.get("TEST_DATABASE_URL"):
    config = dict(line.split("=", 1) for line in (root / ".env").read_text().splitlines()
                  if line and not line.startswith("#") and "=" in line)
    url = urlsplit(config["DATABASE_URL"])
    env["TEST_DATABASE_URL"] = urlunsplit((url.scheme, url.netloc, "/volt_test", url.query, ""))
dest = root / "evaluation/results"
dest.mkdir(parents=True, exist_ok=True)
raw = subprocess.check_output(["go", "test", "./internal/catalog", "-run", "^$", "-bench", "BenchmarkSearch10000", "-benchtime=10x", "-benchmem"], cwd=root/"backend",env=env,text=True)
(dest/"search-benchmark.txt").write_text(raw,encoding="utf-8")
result = json.loads(subprocess.check_output(["go", "run", "./cmd/benchmark"],cwd=root/"backend",env=env,text=True))
result["commit"] = subprocess.check_output(["git", "rev-parse", "HEAD"],cwd=root,text=True).strip()
result["working_tree_dirty"] = bool(subprocess.check_output(["git", "status", "--porcelain"],cwd=root,text=True).strip())
result["machine"] = {"system": platform.system(), "processor": platform.processor()}
(dest/"catalogue-benchmark.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
print(raw)
print(json.dumps(result,indent=2))

