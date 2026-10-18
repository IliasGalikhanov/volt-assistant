"""Create a private local configuration without overwriting an existing installation."""
from pathlib import Path
import os
import secrets

root = Path(__file__).resolve().parent.parent
target = root / ".env"
if target.exists():
    raise SystemExit(".env already exists; kept unchanged")
password = secrets.token_hex(24)
template = (root / ".env.example").read_text(encoding="utf-8")
template = template.replace("POSTGRES_PASSWORD=\n", f"POSTGRES_PASSWORD={password}\n")
template = template.replace("DATABASE_URL=\n", f"DATABASE_URL=postgres://volt:{password}@127.0.0.1:55432/volt?sslmode=disable\n")
fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as config:
    config.write(template)
print("Created .env with a random local database password. Keep this file private.")
