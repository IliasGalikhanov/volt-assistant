# ADR 003: Durable review drafts and forward-only schema upgrades

Status: accepted.

A purchaser's corrected rows are separate from the original extraction. Drafts store text, SKU, quantity, warehouse and review acknowledgement on the owning job. Saving a draft never changes a cart. The UI offers an explicit Save draft action, warns about unsaved changes and saves before preparing a proposal.

A compare-and-swap revision prevents two tabs from silently replacing each other's work. Conflicts preserve the editor's local values and ask the user to reopen; there is no automatic merge. A different warehouse invalidates review acknowledgement. Server quantity, price and stock validation still runs when preparing and confirming.

Numbered, embedded SQL migrations run under one transaction advisory lock. They apply in order, atomically, and refuse a database newer than the binary understands. Version-one installations retain their existing data. Published migrations are immutable. No destructive automatic down migrations are provided; backups and an explicit recovery plan are required before future destructive upgrades.

Tests exercise old-schema upgrade, concurrent startup, rollback on failed SQL, newer-version rejection, draft isolation and stale edits.

