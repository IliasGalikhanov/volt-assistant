"""Run Go checks against a separate local test database; never print credentials."""
from pathlib import Path
import os
import subprocess
import sys
from urllib.parse import urlsplit, urlunsplit

root = Path(__file__).resolve().parent.parent
env = os.environ.copy()
if not env.get("TEST_DATABASE_URL"):
    config = dict(line.split("=", 1) for line in (root / ".env").read_text().splitlines()
                  if line and not line.startswith("#") and "=" in line)
    parsed = urlsplit(config["DATABASE_URL"])
    env["TEST_DATABASE_URL"] = urlunsplit((parsed.scheme, parsed.netloc, "/volt_test", parsed.query, ""))
args = sys.argv[1:] or ["./..."]
subprocess.run(["go", "vet", "./..."], cwd=root / "backend", env=env, check=True)
subprocess.run(["go", "test", "-count=1", "-timeout=120s", *args], cwd=root / "backend", env=env, check=True)

