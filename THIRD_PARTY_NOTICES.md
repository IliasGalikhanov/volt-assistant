# Third-party components

Original project code and synthetic fixtures are under [MIT](LICENSE). This does not relicense third-party components, supplier data, trademarks or model weights. No supplier images, certificates, private source documents or model weights are bundled in this repository.

| Component | Role | Upstream license / source |
| --- | --- | --- |
| Go | Backend toolchain and standard library | BSD-style, https://go.dev/LICENSE |
| pgx v5 | PostgreSQL driver | MIT, https://github.com/jackc/pgx |
| Excelize v2 | XLSX input/output | BSD-3-Clause, https://github.com/qax-os/excelize |
| React / React DOM | Interface | MIT, https://github.com/facebook/react |
| Vite | Frontend build/dev server | MIT, https://github.com/vitejs/vite |
| TypeScript | Type checking | Apache-2.0, https://github.com/microsoft/TypeScript |
| Lucide | SVG icons | ISC, https://github.com/lucide-icons/lucide |
| Playwright | Browser tests | Apache-2.0, https://github.com/microsoft/playwright |
| Prettier | Source formatting | MIT, https://github.com/prettier/prettier |
| PostgreSQL | Durable storage | PostgreSQL License, https://www.postgresql.org/about/licence/ |
| Poppler | Separate `pdftotext` executable in runtime container | GPL-2.0-or-later; distribution package copyright applies, https://poppler.freedesktop.org/ |
| Ollama | Optional local model server | MIT, https://github.com/ollama/ollama |
| Qwen3.5-4B / 2B | Optional downloaded model weights | Apache-2.0, https://huggingface.co/Qwen/Qwen3.5-4B and https://huggingface.co/Qwen/Qwen3.5-2B |

Exact application versions and transitive dependency resolution are recorded in `backend/go.mod`, `backend/go.sum` and `frontend/package-lock.json`. Runtime images and operating-system packages have their own notices; retain `/usr/share/doc/*/copyright` when distributing the image. Poppler is invoked as an external program and remains governed by its own license. If redistributing binary images, comply with all bundled components' license and corresponding-source obligations.

The model is downloaded separately from the [official Ollama library](https://ollama.com/library/qwen3.5:4b-q4_K_M). No fine-tuning was performed. Model license metadata was checked on the publisher's model card; the publisher's evaluation numbers are not this project's evaluation results.
