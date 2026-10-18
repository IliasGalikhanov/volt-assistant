# ADR 002: A constrained model, authoritative business rules

Status: accepted.

Qwen rewrites a search query or extracts visible document rows. It cannot create prices, reserve stock or confirm a cart. Product records supply business facts; the server renders localized replies. Explicit known SKUs and recognized purchase terms override a conflicting model plan.

The catalogue does not require training a language model. There is no task-labelled real training set and no established right to publish supplier data. The public evaluation is synthetic and compares the actual application with the model disabled, with 4B, and with 2B. Its labels were authored before the comparison; they are not representative customer traffic.

This boundary trades conversational flexibility for inspectable failure modes. A structured response can still be wrong. Empty matches, model fallback and manual document review remain visible. Longer conversations, numeric constraints and material synonyms are future scope only when their quality can be demonstrated.

A real regression informed this decision: Qwen replaced a correctly detected Kazakh delivery question with a product search. A server precedence rule and a mocked-model regression test protect that case.

