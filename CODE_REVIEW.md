# HACKBACK code review · DBG-400 · GST-ready Accounting Ledger
- Reviewed at: 2026-10-06T08:38:15Z (2026-10-06T14:08:15 IST)
- Judged commit: fb1564a0ef198affb9eb63108a835f1e07e13277 (2026-10-06T12:36:25+05:30) · the last commit before the code freeze
- Reviewer: AI agent run by a HACKBACK judge

### DBG-400 · GST-ready Accounting Ledger
Commit: fb1564a0ef198affb9eb63108a835f1e07e13277 · 2026-10-06T12:36:25+05:30 · Clean-room: OK

| Section | Score | Why (path:line) |
|---|---|---|
| A. Core flow | 30/30 | Chart of accounts, invoices, payments, voiding, and reporting all work end-to-end via REST APIs and DB (`src/app.ts:162-355`, `src/modules/accounting/ledger.service.ts`). |
| B. Killer Tests | 30/30 | Journal invariant validated and tested (`src/modules/accounting/ledger.service.ts:28-81`, `tests/integration/killer_tests.test.ts:32-100`). Voiding reverses entries and retains row (`src/modules/invoices/invoice.service.ts:315`). TB computes from transactions dynamically and balances after random ops (`tests/integration/killer_tests.test.ts:184-200`). |
| C. Two improvements | 20/20 | Gap-Free unique numbers built with DB constraints and transactions (`src/database/schema.sql:35`, `src/modules/invoices/invoice.service.ts:108-111`). GST filing pack fully built with rate splits, HSN summary, and CSV export (`src/modules/reports/gst-report.service.ts:83-225`). |
| D. Built from their docs | 10/10 | Code strictly follows `DATA_MODEL.md` (e.g. `items_entries` GST columns added via schema migration) and `API.md` endpoints. |
| E. Engineering | 10/10 | Consistent input validation, strict RBAC guards (`requireRoles`) on every endpoint, immutable journal logic, and solid SQLite transaction handling. |
| Total | 100/100 | |

Killer Tests:
1. READY · 10/10 · `src/modules/accounting/ledger.service.ts:75` enforces debits = credits check inside `withTransaction`. Proved by `tests/integration/killer_tests.test.ts:32` which fails unbalanced inserts with HTTP 400.
2. READY · 10/10 · `src/modules/invoices/invoice.service.ts:280-329` voids by setting `status = 'Voided'` (no hard delete) and posts offsetting entries via `LedgerService.reverseTransaction`. Proved by `tests/integration/killer_tests.test.ts:105`.
3. READY · 10/10 · `LedgerService.getTrialBalance` (`ledger.service.ts:211`) calculates directly from `accounts_transactions` `SUM()`, ignoring `accounts.balance`. Odd paise splits are accounted for safely in `splitGst()`. Proved by concurrency harness in `killer_tests.test.ts:183`.

Improvements:
1. Gap-Free, Server-Assigned Invoice Numbers · 10/10 · Implemented via `UNIQUE` database constraints (`schema.sql:35`) and checked inside atomic `withTransaction` blocks (`invoice.service.ts:108-111`), eliminating the race condition.
2. GST Filing Pack · 10/10 · Fully built in `gst-report.service.ts:83`, parsing line items into intra/inter-state tax splits, HSN summaries, and providing a ledger tie-out and CSV export.

Flags: none.

3 questions for the judges to ask this team in their Defence:
1. Your Trial Balance query calculates balances directly from the `accounts_transactions` table every time. How will query performance scale as the database grows to hundreds of thousands of ledger entries, and what would you change to optimize it?
2. You use SQLite's `BEGIN IMMEDIATE` for your transactions, which locks the database for all other writers. How would you redesign your `withTransaction` pattern if the business migrated to Postgres to allow concurrent writers while still avoiding the invoice number race condition you fixed?
3. In `splitGst()`, you handle the rounding of odd paise tax amounts by assigning the remainder to SGST (e.g., a 5 paise tax splits into 2 paise CGST and 3 paise SGST). How would you address a scenario where a tax auditor requires both CGST and SGST to be rounded symmetrically on every line?

SCORE core=30 kt=30 imp=20 docs=10 eng=10 total=100
