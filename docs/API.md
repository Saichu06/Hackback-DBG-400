# API Surface

## 1. Core Endpoints

All endpoints (except login) require JWT Bearer authentication.

| Method | Path | Request Payload (JSON) | Description | Who may call it | Errors | Response (200/201) |
|---|---|---|---|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` | Authenticate user and receive JWT. | Anyone | 400, 401 | `200 OK: { token, user: { id, email, role } }` |
| POST | `/api/users` | `{ email, password, role }` | Create a new system user (Admin only). | Admin | 400, 409 | `201 Created: { id, email, role }` |
| GET | `/api/users` | none | List system users. | Admin | 400 | `[{ id, email, role }]` |
| POST | `/api/test/seed-random` | `{ seed, count }` | Test-only harness: runs `count` randomized create/pay/void operations for KT3. Available only when `NODE_ENV=test`. | Admin (test env only) | 403 (if not test env) | `200 OK: { operations_run, final_trial_balance }` |
| GET | `/api/accounts` | none | Retrieve the chart of accounts and balances. | Admin, Accountant, Staff | 400 | `[{ id, code, name, type, balance }]` |
| GET | `/api/contacts` | none | Retrieve the list of customers and vendors. | Admin, Staff | 400 | `[{ id, name, contact_type }]` |
| GET | `/api/sale-invoices` | none | Retrieve the list of sales invoices. | Admin, Staff | 400 | `[{ id, invoice_no, total_amount, status }]` |
| POST | `/api/sale-invoices` | `{ customer_id, invoice_no, total_amount, entries }` | Create a new invoice. A draft does not post to ledger. | Admin, Staff | 400, 409 | `201 Created: { id, status }` |
| PUT | `/api/sale-invoices/:id/deliver` | none | Marks an invoice as delivered and posts to the ledger. | Admin, Staff | 400 | `200 OK: { id, status: 'Delivered' }` |
| DELETE | `/api/sale-invoices/:id` | none | Voids the invoice. Reverses the ledger entries. | Admin, Staff | 409 (`ERR_HAS_PAYMENTS` if unpaid portion ≠ full amount, `ERR_ALREADY_VOIDED` if already voided) | `200 OK: { id, status: 'Voided' }` |
| POST | `/api/payments-received` | `{ customer_id, amount, payment_receive_no, entries }` | Receive payment against an invoice and post to ledger. | Admin, Staff | 400, 409, 422 | `201 Created: { id }` |
| GET | `/api/bills` | none | Retrieve the list of vendor bills. | Admin, Staff | 400 | `[{ id, bill_number, total_amount, status }]` |
| POST | `/api/bills` | `{ vendor_id, bill_number, total_amount, entries }` | Create a new vendor bill. | Admin, Staff | 400, 409 | `201 Created: { id }` |
| DELETE | `/api/bills/:id` | none | Voids the vendor bill. Reverses the ledger entries. | Admin, Staff | 409 (`ERR_HAS_PAYMENTS` if unpaid portion ≠ full amount, `ERR_ALREADY_VOIDED` if already voided) | `200 OK: { id, status: 'Voided' }` |
| POST | `/api/bill-payments` | `{ vendor_id, amount, payment_number, entries }` | Pay a vendor bill and post to ledger. | Admin, Staff | 400, 409, 422 | `201 Created: { id }` |
| POST | `/api/manual-journals` | `{ journal_number, date, entries: [{ account_id, debit, credit }] }` | Post manual adjustments. Must strictly balance. | Admin, Accountant | 400, 409 | `201 Created: { id }` |
| GET | `/api/reports/journal` | none | Retrieve all double-entry journal transactions. | Admin, Accountant | 400 | `[{ date, account, debit, credit }]` |
| GET | `/api/reports/trial-balance-sheet` | none | Summarizes all account balances to verify debits == credits. | Admin, Accountant | 400 | `{ accounts: [...], total_debit, total_credit }` |
| GET | `/api/reports/balance-sheet` | none | Generates the Balance Sheet report (Assets vs Liabilities/Equity). | Admin, Accountant | 400 | `{ assets, liabilities, equity }` |
| GET | `/api/reports/profit-loss-sheet` | none | Generates the Profit & Loss statement (Revenue vs Expenses). | Admin, Accountant | 400 | `{ revenue, expenses, net_income }` |

## 2. API Design Principles
- **No Hard Deletes**: The `DELETE` HTTP verb on financial records acts as a semantic "Void". It alters the status and creates reverse ledger transactions.
- **Error Handling**: 
  - `400 Bad Request`: Validation failure (e.g., unbalanced manual journal submitted).
  - `409 Conflict`: Unique constraint violation (e.g., duplicate invoice number) or invalid state mutation (`ERR_ALREADY_VOIDED`, or "cannot void if payments exist"). Uniqueness is handled by "insert + catch DB unique-violation + retry" rather than external series tables.
  - `422 Unprocessable Entity`: Business logic failure (e.g., applying payment greater than invoice balance).
- **Format**: All money amounts are transmitted as integers (cents) in snake_case format.
