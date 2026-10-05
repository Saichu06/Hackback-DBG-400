# Gaps, Fix, and Differentiator

Section 1 is a new capability the original lacks (our Differentiator). Section 2 is a critical flaw in the original that our rebuild fixes. Section 3 lists additional gaps found during the audit that are out of scope for this build.

## 1. Differentiator: Duplicate / Unusual Payment Alert
- **The Gap**: The original Bigcapital has no detection for a staff member accidentally recording the same customer payment twice, or for a payment that is unusually large compared to that customer's typical pattern. Both are easy to miss during fast daily data entry and are only caught later during reconciliation, if at all.
- **The Addition**: The rebuild adds a rule-based check that runs when a payment is recorded: if the same customer has an existing payment of the same amount within a configurable time window (e.g. 10 minutes), or if the amount is a large multiple of that customer's average payment, the system flags it for review before (or immediately after) posting, without blocking the transaction.
- **Why it matters to the Business Owner**: A wholesale shop owner recording dozens of payments a day by hand is exposed to exactly this kind of duplicate-entry error. Each unflagged duplicate silently inflates a customer's recorded payments and corrupts their outstanding balance — an error that often isn't caught until the customer disputes their statement weeks later.

## 2. Unsafe Concurrency (Missing Row Locks)
- **The Gap**: The original system read account balances and validated invoice numbers purely in application memory, sometimes even outside the database transaction boundaries. Balance updates lacked pessimistic locks (`SELECT ... FOR UPDATE`), causing silent data clobbering when multiple transactions updated the same account simultaneously.
- **Evidence**: `packages/server/src/modules/SaleInvoices/commands/CreateSaleInvoice.service.ts:94` and `packages/server/src/modules/Ledger/LedgerStorage.service.ts:50` (missing lock during update) [Confirmed]
- **The Fix**: The rebuild enforces uniqueness at the schema level using actual `UNIQUE` constraints. Any operation that reads a balance with the intent to update it performs a `SELECT ... FOR UPDATE` inside an ACID transaction to acquire an exclusive row lock.
- **Why it matters to the Business Owner**: Without row locks, if two staff members record a payment of 10000 cents ($100.00) simultaneously on a busy day, the Business Owner's bank account balance will incorrectly increase by only 10000 cents instead of 20000 cents, leading to a catastrophic loss of revenue tracking.

---

## 3. Other gaps identified (not built)
During the audit, we identified additional security flaws in the original system that fall outside the scope of our core accounting rebuild, but illustrate the need for strict guardrails:
- **Missing Authorization Guards**: Controllers like `StripeIntegrationController` (`packages/server/src/modules/StripePayment/StripePayment.controller.ts:12`), `UsersController`, and `WarehousesController` were found to be missing `@UseGuards(AuthorizationGuard, PermissionGuard)`. This allowed any logged-in tenant user (regardless of their assigned role) to create payment links or edit system users.
- **Missing Endpoint Guards**: The `closeSaleReceipt` endpoint is missing `@RequirePermission` (`packages/server/src/modules/SaleReceipts/SaleReceipts.controller.ts:277`), allowing any authenticated user to close sale receipts regardless of their assigned role capabilities.
- **Race Condition in Validation**: `validatePaymentReceiveNoExistance` is called inside the validation pipeline but is not passed the transaction (`trx`), meaning it runs outside the transaction and is vulnerable to race conditions (`packages/server/src/modules/PaymentReceived/commands/CreatePaymentReceived.serivce.ts:105`).
- **Validation Conflicts**: `paymentReceiveNo` is decorated with conflicting decorators (`@ToNumber()` and `@IsString()`), causing coercion errors when an alphanumeric string is provided (`packages/server/src/modules/PaymentReceived/dtos/PaymentReceived.dto.ts:93`).
- **UI Error Swallowing**: The `InvoicesDataTable` component checks for empty and loading states but silently ignores `isError`, leaving the user with a blank table on query failures instead of an explicit error message (`packages/webapp/src/containers/Sales/Invoices/InvoicesLanding/InvoicesDataTable.tsx:128`).

