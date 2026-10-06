# Product Requirements Document (PRD)

## 1. Goal
Build a robust, scalable, GST-Ready Double-Entry Accounting Ledger (Card DBG-400).
**Problem Statement**: For the Business Owner who struggles with mathematically inconsistent books and race conditions during high-volume invoicing, this Accounting Ledger ensures strict double-entry balancing and ACID-compliant concurrency locking, unlike typical flat-file or lightweight bookkeeping apps that allow silent data corruption.

## 2. Core Flow
1. **Login**: User authenticates and receives a JWT.
2. **Create Invoice**: Business Owner creates a sales invoice (the creator chooses Draft or Delivered when submitting the form; only Delivered invoices trigger step 3).
3. **Post to Ledger**: On delivery, the invoice automatically posts balanced entries to Accounts Receivable and Sales Revenue.
4. **Record Payment**: Customer pays; system creates a receipt and posts the offsetting journal entry (debiting Bank, crediting A/R).
5. **Void (if needed)**: Erroneous invoices are voided (soft-deleted), creating reverse ledger entries.
6. **Trial Balance check**: The Accountant reviews the Trial Balance report to ensure total organizational debits strictly equal credits.

## 2b. Default Chart of Accounts (seeded at setup)

| Code | Name | Type |
|---|---|---|
| 1000 | Bank | Asset |
| 1100 | Accounts Receivable | Asset |
| 2000 | Accounts Payable | Liability |
| 2100 | Tax Payable | Liability |
| 3000 | Owner's Equity | Equity |
| 4000 | Sales Revenue | Revenue |
| 5000 | General Expenses | Expense |

These 6 accounts are the minimum required for the Core Flow and all 3 Killer Tests to run. Additional accounts (sub-accounts under these via `parent_account_id`) may be created by an Admin after setup, but the seed MUST include these six so the build has something to post invoices/payments against on day one.

## 2c. First User / Bootstrapping

There is no public signup endpoint. The seed script creates exactly one default Admin user (e.g. `admin@example.com` / a seeded password, documented in `.env.example` as `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`). All other users (Accountant, Staff) are created by that Admin via `POST /api/users` (see API.md).

## 2d. GST Fields (for the GST Filing Pack)
To support the GST Filing Pack (see Must Have and API.md), the product needs a small set of
GST-specific fields that the original has no equivalent of:
- **Shop settings**: a single GSTIN and state code for the business itself, used to decide
  whether a given sale is intra-state (CGST+SGST) or inter-state (IGST).
- **Customer**: an optional GSTIN and state code. If the customer's state code matches the
  shop's, the sale is intra-state; otherwise it is inter-state.
- **Invoice line**: an optional HSN code, the tax rate in basis points, and the computed
  CGST/SGST/IGST amounts, stored at the moment the line is created — never recomputed later from
  the rate. Full field-level detail is in DATA_MODEL.md.
- **Ledger**: three dedicated liability accounts — CGST Payable, SGST Payable, IGST Payable — so
  the GST Filing Pack's tie-out has something concrete in the general ledger to check itself
  against.

## 3. Scope (MoSCoW)

### Must Have
- Chart of Accounts with hierarchical structure (Assets, Liabilities, Equity, Revenue, Expenses).
- Double-entry Journal System requiring absolute balance (debits == credits).
- Sales Module: Creating Invoices, recording Payments Received, and marking accounts receivable.
- Purchasing Module: Creating Bills, recording Payments Made, and tracking accounts payable.
- Financial Reporting: Balance Sheet, Profit & Loss, Trial Balance, and Journal Sheet.
- Fixed roles (Admin, Accountant, Staff) controlling access to the ledger.
- CGST/SGST/IGST tax split stored per invoice line (see §2d) — not just a flat tax percentage.
- Voiding (soft-delete + reversal) of finalized invoices and bills (see §4, Killer Test 2).
- **GST Filing Pack**: a monthly report screen (see §2d and API.md) summarizing GST by rate and by
  HSN code, tied out against the ledger's GST payable accounts, with a CSV export.

### GST Filing Pack — Acceptance Criteria (Given/When/Then)

1. **Correct per-rate and per-line-type totals**
   - **Given** three issued invoices in October 2026 — one with a 5% intra-state line, one with an
     18% intra-state line, and one with an 18% inter-state line,
   - **When** an Accountant requests `GET /api/v1/reports/gst?month=2026-10`,
   - **Then** the 5% row and the two 18% rows (intra-state and inter-state reported separately)
     each show the correct taxable value, and correct CGST/SGST (intra-state) or IGST
     (inter-state) amounts, summed from the stored per-line tax — never recomputed from the
     percentage at report time.

2. **Voided invoices are excluded, and the tie-out still passes**
   - **Given** one of the three invoices above is voided after being delivered,
   - **When** the report is requested again for the same month,
   - **Then** that invoice's taxable value and tax no longer appear in Block A or Block B, and
     Block C's tie-out (ledger GST-payable movement vs. report totals) still shows ✓ for CGST,
     SGST, and IGST, because the void posted an exact offsetting reversal.

3. **Missing HSN code is surfaced, not dropped**
   - **Given** an invoice line with no HSN code recorded,
   - **When** the HSN summary (Block B) is generated,
   - **Then** that line's taxable value and tax appear under a row labeled `(missing HSN)` rather
     than being silently omitted from the total.

4. **Empty month is explicit, not a blank page**
   - **Given** a month with zero issued, partially-paid, or paid invoices,
   - **When** the report is requested for that month,
   - **Then** all totals show as zero and the page displays a clear "No invoices this month"
     message instead of an empty table.

### Should Have
- Manual Journals for accountant adjustments.

### Could Have
- Future multi-currency conversions and foreign exchange rate syncing.

### Won't Have (Out of Scope)
- Filing GST returns directly with the government GST portal — the GST Filing Pack (§2d, Must
  Have) prepares the numbers; it does not submit them anywhere.
- GSTIN format/checksum validation against government rules — GSTIN is stored as entered, not
  verified.
- Inventory management, warehouse tracking, and COGS calculations.
- Bank feeds integration and automated transaction matching (e.g., Plaid).
- Third-party payment gateway processing (e.g., Stripe, PayPal).
- Custom dynamic CASL roles.

## 3b. GST Readiness Note
Card DBG-400's title promised a GST-ready ledger, and this rebuild's schema (§2d; see
DATA_MODEL.md) was deliberately designed so GST computation could be layered on without a schema
migration: integer basis-point tax rates and a dedicated payable account were there from day one.
The GST Filing Pack is that promise delivered — CGST/SGST/IGST split, HSN summary, ledger tie-out,
and CSV export are now in the Must Have list above, not deferred to a future release.

## 4. Acceptance Criteria (Killer Tests)

1. **Transaction Balancing**
   - **Given** an automated or manual journal entry payload,
   - **When** the Ledger Engine attempts to persist it,
   - **Then** the system MUST strictly assert that `sum(debits) === sum(credits)` in-memory, and abort the transaction (HTTP 400) if imbalanced.

2. **Voiding**
   - **Given** an invoice with posted ledger entries,
   - **When** the Business Owner voids it,
   - **Then** the system creates exact offsetting journal entries (e.g., debiting Sales, crediting A/R), sets the invoice status to Voided, and does NOT execute a SQL `DELETE`.

3. **Trial Balance & Concurrency**
   - **Given** 20 random automated operations (invoices and payments) firing simultaneously,
   - **When** the Accountant runs the Trial Balance report,
   - **Then** the system must strictly balance to 0, proving that `FOR UPDATE` row locks prevented any race conditions or silent overwrites of account balances.

### KT3 Execution Mechanism
The 20 concurrent operations are triggered via a test harness endpoint `POST /api/test/seed-random` (see API.md), which spawns 20 parallel async calls to the create-invoice and record-payment logic using a seeded random generator (seed value from `TEST_SEED` env var). This endpoint is available only when `NODE_ENV=test`.
