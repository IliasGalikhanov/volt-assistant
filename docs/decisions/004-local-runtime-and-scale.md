# ADR 004: Measure local inference and bounded catalogue search

Status: accepted.

The target laptop has an RTX 3050 Laptop with 4 GiB VRAM and limited Docker RAM. The observed hybrid GPU/CPU run was slower than CPU-only inference and hit the request timeout. OLLAMA_NUM_GPU=0 is therefore the documented option for this installation, not a universal recommendation. Model warmup is separate from normal request latency; 2B remains a manual fallback.

The catalogue limit is 10,000 records. Search currently loads one dataset and evaluates deterministic rules in Go. The browser delegates query semantics to that endpoint and renders 24 cards per page. It still downloads the catalogue for review/selection: pagination limits DOM work, not transfer size.

A large synthetic fixture exposed substring matching of 16A inside 116A. Numeric search now matches complete normalized tokens, and a regression test checks all 10,000 products. Exact SKU lookup in the search algorithm returns immediately.

Use the reproducible benchmark before introducing indexes or caching. The recorded allocation count is cumulative allocated memory per operation, not peak resident memory. Measurements on one developer laptop do not establish production capacity, concurrency limits or business impact.

