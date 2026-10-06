# Agent Log

## Key Prompts Used
1. *"run the frotnend backedn database and eveyrthing and give me the perfectly 100% workin local host link"* (Stage 0: Rejected due to constraints, shifted focus to documentation audit).
2. *"wt to do for option 3 and where to go to take 3 screenshorts... Which screen is this, and which file renders it? Who is the user here, and what are they trying to do? What happens when they press the main button..."* (Stage 6: Screenshots and User Journey).
3. *"Review this codebase like a senior code reviewer. List gaps in a table: # | Type | What is wrong | Evidence path:line | Who it hurts | Suggested fix | Severity"* (Stage 7: Gaps identification).
4. *"Now verify everything you have told me in this conversation: every claim, every diagram arrow, every gap. For each one: Open the file you cited and check that the line number exists and says what you claim it says."* (Stage 8: Verification).
5. *"STAGE 9: WRITE THE 7 DOCS FOR MY REBUILD. Write exactly these 7 files... Clean-room rules: no pasting code. Describe it in words. No secrets. Don't tell the rebuild to use Bigcapital's packages."* (Stage 9: Documentation synthesis).

## Investigation Summary
During the documentation generation for the Double-Entry Accounting Ledger rebuild, I performed a comprehensive audit of the original `bigcapital` repository.

1. **Format Remediation**: Initially, I formatted evidence paths as absolute markdown links with round line numbers (e.g., `:1-50`), which violated the strict 2-line format required for the playbook. A global regex script was used, which inadvertently stripped valid text from some tables. I systematically rebuilt `stage1.md` through `stage8.md` manually to ensure strict compliance with the format:
   - `<claim>`
     Evidence: `path:line [Confirmed]`

2. **Schema Verification**: I executed precise `grep_search` operations over the database migration files in `packages/server/src/database/tenant/migrations`. I discovered that out of the 11 claimed unique constraints, 0 of them used a `.unique()` constraint (except for contact code and a documents key added much later). They all used `.index()`, leaving the database vulnerable to duplicate records. This informed the strict `UNIQUE` constraint requirement in `DATA_MODEL.md`.

3. **Concurrency and Correctness Analysis**: I analyzed `CreateSaleInvoice.service.ts` and `LedgerStorage.service.ts` and confirmed three critical flaws:
   - `validateInvoiceNumberUnique` executing outside the transaction block.
   - Missing `sum(debits) === sum(credits)` verification for automated transactions.
   - The absence of `.forUpdate()` locks when mutating account balances.
   These findings became the foundational acceptance criteria for the new PRD.

4. **Security Audit Corrections**: I corrected a hallucination from earlier stages regarding missing authorization. I verified that a global `MixedAuthGuard` prevents unauthenticated access entirely. However, controllers like `StripePayment.controller.ts` lacked the specific `AuthorizationGuard` and `PermissionGuard`, meaning the attacker profile was upgraded from "unauthenticated actor" to "any logged-in tenant user".

5. **Scope Refinement**: Originally, the documentation falsely claimed "GST-Ready Accounting Ledger" as a feature despite no GST/Tax modeling existing in the DB schema or API payload. Following strict inspection of the `DATA_MODEL.md` (no `gstin`, `state_code`, or `tax_rate` fields) and `API.md` invoice payloads, GST/Tax features were formally dropped to match the card's actual Brief, renaming the product simply to "Double-Entry Accounting Ledger".

6. **Pre-Build Gap Closure**: Before starting the rebuild, we identified and resolved ambiguities a fresh build agent would otherwise have to invent: the default chart-of-accounts seed, first-user bootstrapping, partial-payment status handling, the KT3 concurrency test mechanism, and the UNIQUE-vs-indexed inconsistency on `accounts.code`. These are now specified explicitly in PRD.md, DATA_MODEL.md, API.md, and ARCHITECTURE.md.

All 7 required output files were generated cleanly with no pasted source code, fully preparing the next AI agent for the clean-room Doc Test rebuild.

---

## Clean-Room Rebuild Implementation Log

1. **Phases 2–6 Completed**:
   - **Phase 2 (Foundation & Database)**: Built TypeScript project configuration, SQLite database engine with foreign key enforcement and immediate transactions (`BEGIN IMMEDIATE`) for ACID guarantees and exclusive write locks, applied schema from `DATA_MODEL.md` with strict `CHECK` constraints on `accounts_transactions` and `UNIQUE` indices on all document identifiers. Seeded default chart of accounts (codes 1000, 1100, 2000, 2100, 3000, 4000, 5000) and initial Admin user.
   - **Phase 3 (Accounting Core)**: Centralized double-entry accounting in `LedgerService`. Enforced in-memory balance assertions (`sum(debits) === sum(credits)`), single-sided debit/credit checks, integer cents representation, atomic transaction unit of work, balance updates by account type, and real-time Trial Balance derivation.
   - **Phase 4 (Invoice Lifecycle & Reversal)**: Implemented Sales Invoice creation (Draft state with zero ledger footprint), delivery/posting (Debit A/R, Credit Sales Revenue & Tax Payable), and semantic voiding (reversing original persisted ledger entries, creating inverse debit/credit pairs, updating status to `Voided` without executing SQL `DELETE`, and rejecting voiding if payments exist with `ERR_HAS_PAYMENTS` or if already voided with `ERR_ALREADY_VOIDED`).
   - **Phase 5 (Reporting & REST API)**: Implemented full REST API surface specified in `API.md` (`/api/auth/login`, `/api/users`, `/api/accounts`, `/api/contacts`, `/api/sale-invoices`, `/api/payments-received`, `/api/bills`, `/api/bill-payments`, `/api/manual-journals`, `/api/reports/journal`, `/api/reports/trial-balance-sheet`, `/api/reports/balance-sheet`, `/api/reports/profit-loss-sheet`, `/api/test/seed-random`). Implemented role guards for `Admin`, `Accountant`, and `Staff`.
   - **Phase 6 (The Three Killer Tests & Hardening)**:
     - **Killer Test 1 (Journal Balance)**: Verified unbalanced journals (Debit 10000, Credit 8000) are rejected with HTTP 400, transaction rolled back, zero rows persisted, balances unchanged.
     - **Killer Test 2 (Invoice Reversal)**: Verified complete reversal creates exact inverse ledger entries, returns balances to pre-invoice state, marks invoice `Voided` with row retained, leaves unrelated accounts unchanged.
     - **Killer Test 3 (Trial Balance & Concurrency)**: Implemented randomized operation test harness (`POST /api/test/seed-random`), verified 20 concurrent operations with seeded PRNG maintain strict zero-discrepancy Trial Balance.
   - **Differentiator 1 Implemented**: Built duplicate/unusual payment alert heuristics in `PaymentService` (`DUPLICATE_PAYMENT_WARNING` for identical customer payments within 10 minutes, `UNUSUAL_AMOUNT_WARNING` for payments $\ge 5\times$ historical average).
   - **Zero Code Contamination**: Implementation was constructed 100% clean-room from the frozen `./docs/` files with zero imports, clones, copies, or dependencies from the original repository.

