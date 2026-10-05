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
