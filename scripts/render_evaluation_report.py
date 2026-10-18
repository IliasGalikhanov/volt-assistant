"""Render the published report from saved observations; never invent missing runs."""
from pathlib import Path
import json

root=Path(__file__).resolve().parent.parent
load=lambda name:json.loads((root/"evaluation/results"/name).read_text(encoding="utf-8"))
queries=load("local.json")
documents=load("documents.json")
benchmark=load("catalogue-benchmark.json")
assert all(v["status"]=="complete" for v in queries["modes"].values())
assert "finished_at" in documents
lines=["# Evaluation: synthetic evidence and limits","",
"All queries, catalogues and document fixtures are invented. These measurements are not accuracy on supplier data, real customer requests, phone photos or handwriting.","",
"## Query comparison","",
"72 authored cases: 24 scenarios translated into Russian, Kazakh and English. They cover articles, units, polite queries, typos, material constraints, missing products, ambiguous categories, delivery/payment and instruction injection. Translations are correlated cases, not 72 independent real-world situations. Labels were frozen before the comparison; no model was trained.","",
"Every case uses the actual application API with cleared conversation history. Exact match means both the complete SKU set and intent match the label. Macro precision/recall average per-query SKU sets; an empty expected and predicted set counts as 1. Intent is inferred from the application's fixed localized delivery template. All modes run the same server rules; 4B/2B scores measure the application with that mode selected, including any fallback.","",
"| Mode | Exact cases | Intent accuracy | Precision / recall | p50 / p95 seconds | Model fallbacks |",
"| --- | ---: | ---: | ---: | ---: | ---: |"]
for mode,label in [("off","No model"),("primary","Qwen3.5-4B"),("fallback","Qwen3.5-2B")]:
 data=queries["modes"][mode];s=data["summary"]
 lines.append(f"| {label} | {sum(r['exact_match'] for r in data['records'])}/{s['cases']} | {s['intent_accuracy']:.1%} | {s['macro_precision']:.1%} / {s['macro_recall']:.1%} | {s['p50_seconds']:.3f} / {s['p95_seconds']:.3f} | {s['fallbacks']} |")
lines+=["","Observed model warmups (separate from request timing):", ""]
for mode in ["primary","fallback"]:
 data=queries["modes"][mode]
 lines.append(f"- {data['model']}: {data['cold_warmup_seconds']:.2f} s total, {data['ollama_load_seconds']:.2f} s reported model loading. Digest: `{data['model_digest']}`.")
lines+=["",
"A catalogue-grounded product is not necessarily relevant or technically suitable. Compare the failures below: the model can omit a material constraint or choose the wrong intent. Keep manual review mandatory. The selected default remains 4B; 2B is an explicit resource fallback.","",
"Failed exact-match cases:", ""]
for mode,data in queries["modes"].items():
 lines.append("- " + mode + ": " + (", ".join(r["id"] for r in data["records"] if not r["exact_match"]) or "none"))
lines += ["", f"Catalogue-object mismatches: {sum(v['summary']['ungrounded_responses'] for v in queries['modes'].values())}. Carts unchanged in all modes: {all(v['summary']['cart_unchanged'] for v in queries['modes'].values())}. This checks data integrity, not engineering suitability. Errors and fallbacks remain in the raw records.", "",
f"Comparison started at {queries['started_at']}; recorded checkout: `{queries['commit'][:7]}`; working tree dirty: {queries['working_tree_dirty']}.", ""]
if queries["commit"].startswith("3d5fa62"):
 lines += ["This baseline used backend 3d5fa62 before the independent 16A/116A fix; concurrent working-tree changes concerned evaluation and UI work. The final numeric-search behavior is covered by the large-catalogue regression and browser test. These responses are not relabelled as a rerun of the final commit.", ""]
lines += ["For the checked-in baseline: Ryzen 5 5600H, Windows + Docker Desktop, approximately 14 GiB host RAM / 6.7 GiB Docker RAM, Ollama 0.40.6, CPU-only inference, context 4096, generation budget 700 tokens, temperature 0, thinking disabled. Models ran sequentially, but development builds and browser checks also occurred on the workstation. Latency numbers are observations under that mixed workload, not a controlled model-speed comparison. Repeat with an idle workstation for hardware comparisons and record its configuration separately.", "",
"## Document pipeline","",
"Actual upload → stored job → worker → review/failed status, with exact article/quantity pairs as labels. Six deterministic cases cover CSV, JSON, XLSX, DOCX, text PDF and an intentionally invalid quantity. Four image variants cover clean print, rotation, low contrast and an untrusted instruction outside the table. Images are rendered synthetic pages, not photographs.","",
"| Mode | Exact expected outcomes | Observed elapsed seconds |",
"| --- | ---: | --- |"]
for mode in ["off","primary","fallback"]:
 records=[r for r in documents["records"] if r["mode"]==mode]
 if records:lines.append(f"| {mode} | {sum(r['exact_match'] for r in records)}/{len(records)} | "+", ".join(str(r["seconds"]) for r in records)+" |")
for r in documents["records"]:
 if not r["exact_match"]:lines.append(f"- Failure retained: {r['mode']} / {r['file']}: status `{r['actual_status']}`, code `{r.get('error_code')}`; actual rows are in the raw report.")
lines+=["","Image requests now have a 120-second model timeout inside a 150-second worker task and a 180-second lease. Text warmup does not establish warm vision performance. These four images cannot justify a general OCR-quality claim. Manual review remains mandatory; any failed or partial extraction must be corrected or uploaded as a structured table.","",
f"Final document run: `{documents['commit'][:7]}`, {documents['started_at']} to {documents['finished_at']}; cart unchanged: {documents['cart_unchanged']}.", "",
"The earlier [55-second baseline](../evaluation/results/documents-55s-baseline.json) retained all eight image timeouts (both models), while all six deterministic outcomes passed. These observations motivated the separate image budget. Earlier text-model comparisons are unchanged because their chat budget is unchanged.", "",
"## 10,000-product catalogue","",
f"Sequential PostgreSQL load + Go search: **p50 {benchmark['load_and_search_p50_ms']:.1f} ms**, **p95 {benchmark['load_and_search_p95_ms']:.1f} ms**, {benchmark['samples']} samples. Import: {benchmark['import_ms']:.1f} ms. Catalogue JSON: {benchmark['catalogue_json_bytes']:,} bytes. Average allocated bytes per load/search: {benchmark['allocated_bytes_per_load_search']:,}.",
"",
"The benchmark uses an isolated synthetic dataset in TEST_DATABASE_URL and removes its own session afterwards. Three queries cover exact SKU, 16A and a missing 999A value. Allocations are cumulative allocation volume per operation, not peak resident memory. This is not HTTP latency, concurrent throughput or a production capacity claim. Browser CI separately imports 10,000 records, pages through 24 cards, searches the last SKU and verifies bounded specification choices.","",
"Substring search originally returned 100 records for 16A because it also matched 116A. The corrected test expects exactly 50. Search still loads the complete bounded dataset; pagination limits rendered cards, not network transfer. Larger catalogues need measured server pagination/indexing work.","",
"## Reproduce and inspect","",
"Run from the project root after starting Compose and downloading both model tags. Do not run evaluations concurrently or restart services during them.","",
"```sh",
"python scripts/evaluate_models.py",
"python scripts/evaluate_documents.py",
"python scripts/benchmark_catalogue.py",
"python scripts/render_evaluation_report.py",
"```","",
"- [Query labels](../evaluation/queries.json) and [actual responses](../evaluation/results/local.json).",
"- [Document labels](../evaluation/documents/manifest.json) and [actual extraction results](../evaluation/results/documents.json).",
"- [Database/search measurements](../evaluation/results/catalogue-benchmark.json) and [Go microbenchmarks](../evaluation/results/search-benchmark.txt).",
"- [Verification and CI evidence](verification.md).",""]
(root/"docs/evaluation.md").write_text("\n".join(lines),encoding="utf-8")
print("Rendered docs/evaluation.md from recorded results.")

