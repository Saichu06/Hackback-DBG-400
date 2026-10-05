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

## 3. Scope (MoSCoW)

### Must Have
- Chart of Accounts with hierarchical structure (Assets, Liabilities, Equity, Revenue, Expenses).
- Double-entry Journal System requiring absolute balance (debits == credits).
- Sales Module: Creating Invoices, recording Payments Received, and marking accounts receivable.
- Purchasing Module: Creating Bills, recording Payments Made, and tracking accounts payable.
- Financial Reporting: Balance Sheet, Profit & Loss, Trial Balance, and Journal Sheet.
- Fixed roles (Admin, Accountant, Staff) controlling access to the ledger.

### Should Have
- Soft-deletes and Reversals (Voiding) via offsetting journal entries for finalized transactions.
- Manual Journals for accountant adjustments.

### Could Have
- Future multi-currency conversions and foreign exchange rate syncing.

### Won't Have (Out of Scope)
- Full statutory GST tracking (CGST/SGST/IGST state-based splitting, HSN codes, GSTIN validation) is out of scope for this MVP — but see "GST Readiness" note below.
- Inventory management, warehouse tracking, and COGS calculations.
- Bank feeds integration and automated transaction matching (e.g., Plaid).
- Third-party payment gateway processing (e.g., Stripe, PayPal).
- Custom dynamic CASL roles.

## 3b. GST Readiness Note
Per Card DBG-400's title, this ledger is built to be GST-ready even though full statutory GST computation is not in this MVP's Must-Have list. The schema (see DATA_MODEL.md) includes a `tax_rate` and `tax_amount` field on every invoice line item and a dedicated `Tax Payable` account in the chart of accounts, so GST percentage calculation and posting can be added without any schema migration — it is a pure business-logic addition on top of an already GST-aware data model.

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
