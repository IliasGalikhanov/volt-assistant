# ADR 001: Go modular monolith and a PostgreSQL queue

Status: accepted.

The workflow combines catalogue validation, file processing and transactional purchase lists. It runs on one local workstation. Go was the project owner's chosen backend language; standard net/http and pgx keep dependencies and deployment understandable. React handles interactive review.

The server and worker share domain packages and one database, but run as separate processes. Slow extraction does not occupy an upload request. PostgreSQL already holds ownership and import state, so its row locks and SKIP LOCKED support this bounded queue without a second broker.

This is at-least-once execution, not exactly-once delivery. A cancelled worker leaves a lease to be recovered. Attempts fence late writers; import confirmation is independently transactional and idempotent. A single worker is the default. External side effects would need their own idempotency keys/outbox.

Costs: database load from polling, no priority scheduling and a fixed processing budget. A separate broker becomes justified by measured throughput or operational requirements, not by the portfolio's component count.

