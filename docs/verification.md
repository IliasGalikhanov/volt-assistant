# Verification record

All functional data below is synthetic. These checks demonstrate implementation behavior, not accuracy on the supplier's real catalog or real customer requests.

## Verified baseline

Baseline commit: `378194f`. [GitHub Actions run 39121722674](https://github.com/IliasGalikhanov/volt-assistant/actions/runs/39121722674) completed successfully on 18 October 2026.

- Go formatting, `go vet` and `go test -race` passed in CI with PostgreSQL integration tests enabled.
- CI built the frontend, ran npm audit, built and started the Docker services, passed Playwright and verified data after restart.
- Local Docker build and healthchecks passed after Docker Desktop was updated.
- All three Playwright scenarios passed locally against Docker (19.1 seconds in that run): reviewed specification/substitution/confirmation/export; three languages/theme/mobile/offline chat; isolated catalogue import.
- The manual browser workflow selected `DEMO-MCB-002` as a replacement, confirmed 3 breakers, 10 metres of cable and 4 lamps, and produced a 15 890 KZT cart. Reloading the same browser after the service restart retained these exact lines. See [cart screenshot](screenshots/cart.png).
- `scripts/persistence_check.py` confirmed an exact cart snapshot before and after restarting app, worker and PostgreSQL. This script is run separately from browser tests because restarting the application intentionally interrupts requests.

Integration coverage includes concurrent duplicate confirmation, price/revision conflicts, session isolation, CSRF rejection, atomic/idempotent catalogue import, unavailable-model fallback, CSV formula escaping, read-only supplier products and upload filename traversal. Unit coverage includes category compatibility, quantity/pack checks, multilingual search and structured-document parsing.

## Local model observations

Hardware used: Windows with Docker Desktop Linux containers, NVIDIA RTX 3050 Laptop 4 GiB VRAM, approximately 14 GiB host RAM; Docker had approximately 6.7 GiB available. Ollama 0.40.6, model `qwen3.5:4b-q4_K_M`, digest prefix `d8b0f5e9760c`, context 4096.

- The real model was downloaded successfully, separate from Git.
- Automatic offload reported 44% CPU / 56% GPU. Initial warmup took 150.6 seconds; subsequent application requests still reached the 55-second timeout in the observed hybrid run.
- A direct CPU request with `num_gpu: 0` returned valid JSON for a synthetic search instruction. Total duration was 116.22 seconds, of which 106.11 seconds was loading (about 10 seconds for the remainder).
- These are isolated smoke observations, not a benchmark. No claim is made about Kazakh answer accuracy, document-recognition accuracy, throughput or business impact. 2B is selectable but has not been downloaded or evaluated on this installation.

## Pending validation of later changes

After the verified baseline, local commits added technical-unit normalization, stale-fetch cancellation, exact-article precedence, CPU configuration, warmup scripts, OpenAPI and documentation. Frontend build passed. At the time of this record, final Docker rebuild, integrated CPU-mode checks and publication of these later commits were interrupted by an automatic-approval service connection failure. They must be rerun before treating the latest local checkout as fully verified. The successful baseline CI above is not evidence for unrun later changes.

Image recognition, arbitrary real specifications and the full supplier adapter have not passed a representative end-to-end evaluation. Two source API reads were checked during analysis; that limited connectivity check is not validation of the entire supplier catalog. Text PDF support requires Poppler, scanned PDFs are unsupported, and free-layout DOCX/PDF extraction requires careful human review.
