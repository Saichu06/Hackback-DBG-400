# Gaps, Fix, and Differentiator

Section 1 ("My 2 Improvements") is exactly the two things we built on top of the
clean-room rebuild: one fix to a confirmed flaw in the original, and one new
capability the original lacks entirely (our differentiator). Section 2 lists
additional gaps found during the audit that are out of scope for this build.

Note on an earlier draft of this file: an earlier pass claimed the original had
no row locks anywhere in its balance-update path. Re-checking the original
codebase shows that claim was too broad — the original *does* use row-level
locking in a number of places. The real, narrowly-confirmed flaw is the
specific race condition described in 1(a) below: invoice-number uniqueness is
checked *before* the transaction that inserts the invoice opens, not inside
it, so the check and the insert are not atomic with each other.

## 1. My 2 Improvements

### (a) FIX: Gap-Free, Server-Assigned Invoice Numbers
- **The Gap**: The original validates an invoice number's uniqueness before
  its database transaction begins, not inside it. The uniqueness read and the
  later insert are two separate round-trips with no shared lock between them,
  so two concurrent requests for the same number can both pass the
  pre-transaction check and then both attempt to commit.
  Evidence: `packages/server/src/modules/SaleInvoices/commands/CreateSaleInvoice.service.ts:93-97` [Confirmed]
- **The Fix**: The rebuild assigns the invoice number inside the same
  transaction that posts the invoice, backed by a true schema-level `UNIQUE`
  constraint on `sales_invoices.invoice_no` (and equivalently on
  `bill_number`, `payment_receive_no`, `payment_number`, and
  `journal_number` for their respective documents). If a concurrent insert
  collides, the database rejects the second writer with a unique-constraint
  violation inside the same atomic unit of work — there is no window where
  two requests can both believe a number is free. No application-memory
  counter or pre-transaction `SELECT` is trusted for uniqueness; the
  constraint is the source of truth.
- **Why it matters to the Business Owner**: A gap-free, collision-free invoice
  series is itself a GST filing requirement — tax authorities expect invoice
  numbers to be sequential and unique per series. A race condition that lets
  two invoices share a number (or silently skips/duplicates a number under
  load) turns into a reconciliation and compliance problem at month end,
  exactly when the business can least afford to re-check hundreds of rows by
  hand.

### (b) DIFFERENTIATOR: GST Filing Pack
- **The Gap**: The original ships a generic tax-rate report but has no
  GST-specific fields anywhere in its server, webapp, or shared source — no
  GSTIN, no state code, no HSN code, and no CGST/SGST/IGST split (searched the
  original's source for these terms; none were found). A shop raising dozens
  of GST invoices a month has no way to see tax broken out by rate or by
  product code, and no way to confirm those totals agree with what actually
  posted to the ledger.
- **The Addition**: The rebuild adds a monthly **GST Filing Pack** screen built
  entirely from data already in our ledger: a tax-by-rate table (taxable
  value, CGST, SGST, IGST per rate, split by intra-state vs. inter-state), an
  HSN-code summary, and a ledger tie-out that sums credit-minus-debit on the
  three GST payable accounts for the month and compares that to the report's
  own totals, showing a check or cross per tax type. A CSV export lets the
  accountant take the numbers into their filing workflow.
- **Why it matters to the Business Owner**: At month end, the accountant
  today must export invoices and add them up by hand to get rate-wise and
  HSN-wise totals, then separately verify those sums against the books.
  Manual summation is exactly where rate-mixing mistakes and transcription
  errors creep in — and a mistake here means the wrong tax amount gets filed,
  which risks a notice from the tax department. This screen turns that
  hand-count into a single page that is provably consistent with the ledger.
- **Honest limits**: This prepares numbers for filing; it does not file
  returns with the GST portal itself. The CSV is a simplified layout for the
  accountant's own use, not the exact government upload format. The original
  Bigcapital does have a generic `SalesTaxLiabilitySummary`-style report — the
  gap we are filling is specifically the GST-shaped parts it lacks: the
  CGST/SGST/IGST split, the HSN summary, the ledger tie-out, and the CSV
  export.

---

## 2. Other gaps identified (not built)
During the audit, we identified additional security flaws in the original system that fall outside the scope of our core accounting rebuild, but illustrate the need for strict guardrails:
- **Missing Authorization Guards**: Controllers like `StripeIntegrationController` (`packages/server/src/modules/StripePayment/StripePayment.controller.ts:12`), `UsersController`, and `WarehousesController` were found to be missing `@UseGuards(AuthorizationGuard, PermissionGuard)`. This allowed any logged-in tenant user (regardless of their assigned role) to create payment links or edit system users.
- **Missing Endpoint Guards**: The `closeSaleReceipt` endpoint is missing `@RequirePermission` (`packages/server/src/modules/SaleReceipts/SaleReceipts.controller.ts:277`), allowing any authenticated user to close sale receipts regardless of their assigned role capabilities.
- **Race Condition in Validation**: `validatePaymentReceiveNoExistance` is called inside the validation pipeline but is not passed the transaction (`trx`), meaning it runs outside the transaction and is vulnerable to race conditions (`packages/server/src/modules/PaymentReceived/commands/CreatePaymentReceived.serivce.ts:105`).
- **Validation Conflicts**: `paymentReceiveNo` is decorated with conflicting decorators (`@ToNumber()` and `@IsString()`), causing coercion errors when an alphanumeric string is provided (`packages/server/src/modules/PaymentReceived/dtos/PaymentReceived.dto.ts:93`).
- **UI Error Swallowing**: The `InvoicesDataTable` component checks for empty and loading states but silently ignores `isError`, leaving the user with a blank table on query failures instead of an explicit error message (`packages/webapp/src/containers/Sales/Invoices/InvoicesLanding/InvoicesDataTable.tsx:128`).
