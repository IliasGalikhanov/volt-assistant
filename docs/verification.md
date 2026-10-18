# Verification record

All functional data below is synthetic. These checks demonstrate implementation behavior, not accuracy on the supplier's real catalog or real customer requests.

## Verified application

Application commit: `89da7ac`. [GitHub Actions run 39123155229](https://github.com/IliasGalikhanov/volt-assistant/actions/runs/39123155229) completed successfully on 18 October 2026. It includes technical-unit normalization, stale-fetch cancellation, exact-article precedence and the multilingual purchase-intent regression fix.

- Go formatting, `go vet` and `go test -race` passed in CI with PostgreSQL integration tests enabled.
- CI built the frontend, ran npm audit, built and started the Docker services, passed Playwright and verified data after restart.
- Local Docker build and healthchecks passed after Docker Desktop was updated.
- All three Playwright scenarios passed locally against the rebuilt Docker app (23.6 seconds in that run): reviewed specification/substitution/confirmation/export; three languages/theme/mobile/offline chat; isolated catalogue import. The subsequent chat-only regression fix also passed the same application suite in CI.
- The manual browser workflow selected `DEMO-MCB-002` as a replacement, confirmed 3 breakers, 10 metres of cable and 4 lamps, and produced a 15 890 KZT cart. Reloading the same browser after the service restart retained these exact lines. See [cart screenshot](screenshots/cart.png).
- `scripts/persistence_check.py` confirmed an exact cart snapshot before and after restarting app, worker and PostgreSQL. This script is run separately from browser tests because restarting the application intentionally interrupts requests.

The backend contains 21 test functions. Integration coverage includes concurrent duplicate confirmation, price/revision conflicts, session isolation, CSRF rejection, atomic/idempotent catalogue import, unavailable-model fallback, CSV formula escaping, read-only supplier products, upload filename traversal and preservation of explicit articles/delivery intent against an incorrect model plan. Unit coverage includes category compatibility, quantity/pack checks, multilingual search, structured-document parsing and malformed Ollama responses.

## Local model observations

Hardware used: Windows with Docker Desktop Linux containers, NVIDIA RTX 3050 Laptop 4 GiB VRAM, approximately 14 GiB host RAM; Docker had approximately 6.7 GiB available. Ollama 0.40.6, model `qwen3.5:4b-q4_K_M`, digest prefix `d8b0f5e9760c`, context 4096.

- The real model was downloaded successfully, separate from Git.
- Automatic offload reported 44% CPU / 56% GPU. Initial warmup took 150.6 seconds; subsequent application requests still reached the 55-second timeout in the observed hybrid run.
- A direct CPU request with `num_gpu: 0` returned valid JSON for a synthetic search instruction. Total duration was 116.22 seconds, of which 106.11 seconds was loading (about 10 seconds for the remainder).
- With the integrated CPU configuration and a warm model, `scripts/model_smoke.py` passed all four assertions below and verified that the cart remained unchanged. Every response reported the actual Qwen model, with no unavailable-model warning.

| Synthetic query | Verified result | Observed seconds |
| --- | --- | --- |
| Нужен автомат 16А для щитка | DEMO-MCB-001 and DEMO-MCB-002 | 7.27 |
| Покажи DEMO-MCB-002 | Exact article only | 7.62 |
| Қандай жеткізу шарттары бар? | Grounded Kazakh demo delivery terms, no products | 7.05 |
| Find a 16A breaker | DEMO-MCB-001 and DEMO-MCB-002 | 5.59 |

The first integrated run exposed an incorrect model search intent for the Kazakh delivery question. The fix keeps explicit server-recognized delivery/payment intent authoritative and has a mocked-model integration regression test. The model interprets the query; response wording and business facts still come from localized server templates and catalogue records.

The same Russian query was sent manually through the browser interface after the final rebuild; both correct product cards appeared without a fallback warning. See [Qwen chat screenshot](screenshots/qwen-chat.png).

These are isolated smoke observations, not a benchmark. No claim is made about general Kazakh language quality, arbitrary document-recognition accuracy, throughput or business impact. 2B is selectable but has not been downloaded or evaluated on this installation.

## Practical limits

Final Docker rebuild and healthchecks passed, and the persisted cart survived another app/worker/database restart. The earlier automatic-approval connection failure was resolved after restarting Codex; it is no longer a validation blocker. Restart checks must not overlap active model or browser requests, since stopping the server intentionally interrupts connections.

Image extraction was checked through upload → persisted worker job → Qwen vision → review result using [this explicitly synthetic image](fixtures/specification.png). In 49.41 seconds it returned exactly `DEMO-MCB-002 × 3` and `DEMO-CBL-002 × 10`, with `review_required: true`. This clean printed fixture does not establish quality on phone photos, handwriting or arbitrary real specifications; CPU image requests may approach the 55-second timeout.

Arbitrary real specifications and the full supplier adapter have not passed a representative end-to-end evaluation. Two source API reads were checked during analysis; that limited connectivity check is not validation of the entire supplier catalog. Text PDF support requires Poppler, scanned PDFs are unsupported, and free-layout DOCX/PDF extraction requires careful human review.
