# Architecture

Volt uses a modular Go monolith with two entry points: HTTP server and background worker. React communicates with the server on the same origin. PostgreSQL stores catalogues, sessions, specifications, proposals, carts and durable jobs; uploads use a separate volume. Ollama runs independently and is called over HTTP.

Business modules own catalogue search, category-specific alternatives, specification review and confirmed cart changes. Model output and uploaded content are untrusted input. Prices and stock always come from catalogue records. A cart proposal binds the exact lines, dataset, session and cart revision; confirmation revalidates it transactionally and is idempotent.

Demo, uploaded and supplier catalogues are separate datasets. Supplier access is read-only. A local cart does not reserve supplier stock or create an order.

Documents are processed asynchronously with bounded size and execution time. Failed imports must not replace an active catalogue. Database migrations and persistent Docker volumes make restarts reproducible.

No accounts, payment processing, public deployment or training on private supplier data are in scope.
