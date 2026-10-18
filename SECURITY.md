# Security and local data

Volt is intended to run on the user's computer. Compose publishes ports only on 127.0.0.1. Do not expose this installation to the internet: it has browser sessions, not user accounts or roles.

`scripts/init_env.py` generates a random database password in ignored `.env`. GitHub Actions generates a fresh masked password for each test database. Credentials are not embedded in images. The earliest commits contained deliberately public, disposable demo database passwords; these were replaced with generated credentials. They were not supplier credentials or account tokens.

The Compose expression `${POSTGRES_PASSWORD:?Run python scripts/init_env.py first}` is an error message for a missing variable, not a password. Generic secret detectors can misclassify its `?Run` fragment. Do not disable scanning globally because of this false positive.

Private source documents, supplier responses, uploads, conversations, databases, model weights and credentials must stay outside Git. `.gitignore` and `.dockerignore` cover local data directories; review any new location before adding it. Never paste actual secrets into an issue, screenshot or test fixture.

Mutations require a same-origin request and a custom CSRF header. Session cookies are HttpOnly/SameSite=Strict. Dataset ownership is checked server-side. Cart confirmations revalidate prices and stock in a transaction. Uploads use generated filenames and size limits. CSV export escapes spreadsheet formulas. The model has no tools that can mutate the cart or call arbitrary URLs.

Files and chat history remain on disk until deleted; volumes are not encrypted by the application. A session cookie is a bearer credential. Losing it does not erase its data. Uploaded content and model output are untrusted. File parsing has size/time limits but is not a malware sandbox; use files you are allowed to process locally.

For a security report, use GitHub's private vulnerability reporting if enabled, or contact the repository owner without including the secret itself. Include affected version, reproducible steps and impact. Revoke any real exposed credential before cleaning history; deleting a line alone does not revoke it.
