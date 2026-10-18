# Evaluation: synthetic evidence and limits

All queries, catalogues and document fixtures are invented. These measurements are not accuracy on supplier data, real customer requests, phone photos or handwriting.

## Query comparison

72 authored cases: 24 scenarios translated into Russian, Kazakh and English. They cover articles, units, polite queries, typos, material constraints, missing products, ambiguous categories, delivery/payment and instruction injection. Translations are correlated cases, not 72 independent real-world situations. Labels were frozen before the comparison; no model was trained.

Every case uses the actual application API with cleared conversation history. Exact match means both the complete SKU set and intent match the label. Macro precision/recall average per-query SKU sets; an empty expected and predicted set counts as 1. Intent is inferred from the application's fixed localized delivery template. All modes run the same server rules; 4B/2B scores measure the application with that mode selected, including any fallback.

| Mode | Exact cases | Intent accuracy | Precision / recall | p50 / p95 seconds | Model fallbacks |
| --- | ---: | ---: | ---: | ---: | ---: |
| No model | 64/72 | 100.0% | 88.9% / 88.9% | 0.016 / 0.032 | 0 |
| Qwen3.5-4B | 69/72 | 100.0% | 96.8% / 97.2% | 6.961 / 15.984 | 1 |
| Qwen3.5-2B | 64/72 | 95.8% | 89.6% / 90.3% | 4.406 / 8.063 | 0 |

Observed model warmups (separate from request timing):

- qwen3.5:4b-q4_K_M: 64.66 s total, 61.23 s reported model loading. Digest: `d8b0f5e9760cd1682034f292d7ef72ec46f432149be0df7574bf2d6e92e38c04`.
- qwen3.5:2b: 50.38 s total, 48.81 s reported model loading. Digest: `0689d44085e06d165161a8a9a1731344278cfb5aade63a3c3dbdb48ab54b130a`.

A catalogue-grounded product is not necessarily relevant or technically suitable. Compare the failures below: the model can omit a material constraint or choose the wrong intent. Keep manual review mandatory. The selected default remains 4B; 2B is an explicit resource fallback.

Failed exact-match cases:

- off: polite-ru, polite-kk, polite-en, typo-ru, typo-kk, typo-en, copper_cable-ru, copper_cable-kk
- primary: polite-ru, copper_cable-ru, copper_cable-kk
- fallback: polite-ru, polite-kk, polite-en, cable-ru, cable-kk, copper_cable-ru, copper_cable-kk, cable_section-ru

Catalogue-object mismatches: 0. Carts unchanged in all modes: True. This checks data integrity, not engineering suitability. Errors and fallbacks remain in the raw records.

Comparison started at 2026-10-18T11:50:00.969194+00:00; recorded checkout: `3d5fa62`; working tree dirty: True.

This baseline used backend 3d5fa62 before the independent 16A/116A fix; concurrent working-tree changes concerned evaluation and UI work. The final numeric-search behavior is covered by the large-catalogue regression and browser test. These responses are not relabelled as a rerun of the final commit.

For the checked-in baseline: Ryzen 5 5600H, Windows + Docker Desktop, approximately 14 GiB host RAM / 6.7 GiB Docker RAM, Ollama 0.40.6, CPU-only inference, context 4096, generation budget 700 tokens, temperature 0, thinking disabled. Models ran sequentially, but development builds and browser checks also occurred on the workstation. Latency numbers are observations under that mixed workload, not a controlled model-speed comparison. Repeat with an idle workstation for hardware comparisons and record its configuration separately.

## Document pipeline

Actual upload → stored job → worker → review/failed status, with exact article/quantity pairs as labels. Six deterministic cases cover CSV, JSON, XLSX, DOCX, text PDF and an intentionally invalid quantity. Four image variants cover clean print, rotation, low contrast and an untrusted instruction outside the table. Images are rendered synthetic pages, not photographs.

| Mode | Exact expected outcomes | Observed elapsed seconds |
| --- | ---: | --- |
| off | 6/6 | 1.047, 1.062, 1.078, 1.031, 1.063, 1.047 |
| primary | 4/4 | 80.11, 75.86, 74.86, 70.141 |
| fallback | 4/4 | 61.344, 50.735, 46.438, 49.078 |

Image requests now have a 120-second model timeout inside a 150-second worker task and a 180-second lease. Text warmup does not establish warm vision performance. These four images cannot justify a general OCR-quality claim. Manual review remains mandatory; any failed or partial extraction must be corrected or uploaded as a structured table.

Final document run: `37dad80`, 2026-10-18T12:25:40.220662+00:00 to 2026-10-18T12:35:23.595051+00:00; cart unchanged: True.

The earlier [55-second baseline](../evaluation/results/documents-55s-baseline.json) retained all eight image timeouts (both models), while all six deterministic outcomes passed. These observations motivated the separate image budget. Earlier text-model comparisons are unchanged because their chat budget is unchanged.

## 10,000-product catalogue

Sequential PostgreSQL load + Go search: **p50 351.4 ms**, **p95 401.9 ms**, 60 samples. Import: 14276.4 ms. Catalogue JSON: 2,619,201 bytes. Average allocated bytes per load/search: 34,029,212.

The benchmark uses an isolated synthetic dataset in TEST_DATABASE_URL and removes its own session afterwards. Three queries cover exact SKU, 16A and a missing 999A value. Allocations are cumulative allocation volume per operation, not peak resident memory. This is not HTTP latency, concurrent throughput or a production capacity claim. Browser CI separately imports 10,000 records, pages through 24 cards, searches the last SKU and verifies bounded specification choices.

Substring search originally returned 100 records for 16A because it also matched 116A. The corrected test expects exactly 50. Search still loads the complete bounded dataset; pagination limits rendered cards, not network transfer. Larger catalogues need measured server pagination/indexing work.

## Reproduce and inspect

Run from the project root after starting Compose and downloading both model tags. Do not run evaluations concurrently or restart services during them.

```sh
python scripts/evaluate_models.py
python scripts/evaluate_documents.py
python scripts/benchmark_catalogue.py
python scripts/render_evaluation_report.py
```

- [Query labels](../evaluation/queries.json) and [actual responses](../evaluation/results/local.json).
- [Document labels](../evaluation/documents/manifest.json) and [actual extraction results](../evaluation/results/documents.json).
- [Database/search measurements](../evaluation/results/catalogue-benchmark.json) and [Go microbenchmarks](../evaluation/results/search-benchmark.txt).
- [Verification and CI evidence](verification.md).
