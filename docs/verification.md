# Verification record

All functional data is synthetic. This record establishes implementation behavior, not real supplier accuracy or production capacity.

## Current application

Code checkpoint: `37dad80`. [GitHub Actions run 39127050510](https://github.com/IliasGalikhanov/volt-assistant/actions/runs/39127050510) completed successfully, including both backend and application jobs.

- All 30 Go test functions are included in CI's `go test -race -count=1 -timeout=120s ./...`, with an isolated PostgreSQL database. Local `go vet` and Go tests passed; Poppler-dependent unit coverage is also exercised by the Docker document pipeline.
- New migration tests upgrade the original version-one schema without losing a session, serialize concurrent startup, roll back invalid migration SQL and reject unsupported newer schemas.
- Worker integration tests cancel an active model-backed job, expire its lease and recover it; race eight claimers; reject a late worker's overwrite; and fail exhausted attempts. The recovery tests control lease timestamps instead of waiting for a real lease to expire. This is not a claim that every possible process/OS failure was tested.
- Draft tests cover session isolation, stale revisions, invalid quantities, preservation of the original extraction and an unchanged cart.
- Five Playwright scenarios passed against the final local Docker image in **41.0 seconds**: specification/substitution/confirmation/export; languages/theme/mobile/offline chat; isolated catalogue import; draft restoration and stale-tab conflict; 10,000 products with pagination, exact numeric search and bounded review choices.
- Four core browser scenarios also passed through Vite in 32.3 seconds after fixing its Host forwarding. CI separately runs a development-proxy scenario so CSRF protection stays enabled in both modes.
- Docker rebuilt successfully and app/database healthchecks passed. The image contains the current Go server, worker and compiled frontend.
- The enhanced persistence script compared the exact confirmed cart and the exact saved draft/revision before and after restarting **app, worker and PostgreSQL**. Both were unchanged.
- Manual inspection in the built-in browser confirmed that the rebuilt application's `автомат 16А` search returned only the two 16A demo articles.
- The recorded browser walkthrough checked that the cart was empty before explicit confirmation, then contained the expected lines, exported CSV and restored its state after reload. It is a recording of actual UI interactions, with synthetic data only.

The CPU-vision deadline fix (`37dad80`) adds a transport-level deadline test for text, images and an earlier parent deadline, including context cancellation on completion. The final rebuilt image passed all 14 expected document outcomes: six deterministic cases and four images for each model. 4B images took 70–80 seconds; 2B took 46–61 seconds. The cart was unchanged. The original eight 55-second image failures are retained alongside the repeat.

## Evaluation and measurements

See the [evaluation report](evaluation.md), [raw query responses](../evaluation/results/local.json), [document results](../evaluation/results/documents.json) and [catalogue measurements](../evaluation/results/catalogue-benchmark.json).

The 72-query comparison used backend `3d5fa62` before the later independent numeric-search fix. It is retained as a versioned baseline rather than presented as an unperformed rerun of the final code. The final search has its own 10,000-record regression and end-to-end browser check.

Model measurements use local Ollama, without paid APIs or model training. Both primary and fallback tags were actually downloaded and evaluated. No claim is made about unseen real customer traffic. The evaluation retains incorrect matches and timeout fallbacks.

## Public-artifact review

The repository contains only newly generated synthetic document fixtures. Original hackathon documents, supplier credentials, local `.env`, database files/dumps and model weights remain excluded. The source restrictions are described in [data rights](data-rights.md). API and worker logs omit request bodies, queries, cookies and uploaded filenames.

The screenshot and video examples use the synthetic catalogue. The purchase list is not a real order. Shared-machine timing, a bounded catalogue, anonymous local sessions, limited free-layout document parsing and mandatory manual review remain explicit constraints.
