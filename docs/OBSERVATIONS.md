# OBSERVATIONS

## Stack / Versions
- `package.json` specifies engines `"16.x || 17.x || 18.x"`, and the `.nvmrc` specifies `18.16.1`.
  Evidence: `.nvmrc:1` [Confirmed]
- The frontend is a React 18 single-page application using Vite, Redux Toolkit, and BlueprintJS.
  Evidence: `packages/webapp/package.json:42` [Confirmed]
- The backend is a NestJS application interacting with a MariaDB database and Redis.
  Evidence: `packages/server/src/main.ts:33` [Confirmed]

## How to Run
- `CONTRIBUTING.md` suggests a dockerized local development environment (`docker compose up -d`) to run MariaDB, Redis, and Gotenberg.
  Evidence: `docker-compose.yml:1` [Confirmed]
- Local development requires proxying the Vite dev server (`:4000`) to the NestJS backend (`:3000`).
  Evidence: `packages/webapp/vite.config.ts:23` [Confirmed]

## Documentation vs Code (Discrepancies)
- `CONTRIBUTING.md` lists `bigcapital-mongo` container on port `27017` in sample `docker-compose ps` output. However, MongoDB does not exist anywhere in dependencies or services.
  Evidence: `CONTRIBUTING.md:66` vs `docker-compose.yml:8` [Confirmed]
- The `README.md` claims "Headless Accounting" with a Postman collection link, but the repository relies primarily on OpenAPI (Swagger) rather than a local Postman suite.
  Evidence: `README.md:12` [Likely]

## Core Verification
- Screenshot 1: Invoices List is served by the `/invoices` route.
  Evidence: `packages/webapp/src/routes/dashboard.tsx:847` [Confirmed]
- Screenshot 1 Main Action (Fetch Data): Fetches the list of invoices to display in the table via query hook.
  Evidence: `packages/webapp/src/hooks/query/invoices/queries.ts:173` [Confirmed]
- Screenshot 2: Accounts Chart is served by the `/accounts` route.
  Evidence: `packages/webapp/src/routes/dashboard.tsx:23` [Confirmed]
- Screenshot 3: Journal Sheet Report is served by the `/financial-reports/journal-sheet` route.
  Evidence: `packages/webapp/src/routes/dashboard.tsx:322` [Confirmed]
- User Journey Record Payment Server Handler: The `@Post()` `createPaymentReceived` controller.
  Evidence: `packages/server/src/modules/PaymentReceived/PaymentsReceived.controller.ts:122` [Confirmed]
- User Journey Delete Invoice Server Handler: The `@Delete(':id')` `deleteSaleInvoice` controller.
  Evidence: `packages/server/src/modules/SaleInvoices/SaleInvoices.controller.ts:163` [Confirmed]

## Data Constraints
- correctness: `validateInvoiceNumberUnique` is called outside the DB transaction (`uow.withTransaction`), creating a race condition where concurrent requests could bypass the check.
  Evidence: `packages/server/src/modules/SaleInvoices/commands/CreateSaleInvoice.service.ts:94` [Confirmed]
- correctness: Floating-point arithmetic is used across the codebase (including DB schemas) instead of integer cents or arbitrary-precision libraries (`decimal.js`), leading to precision loss on fractional totals.
  Evidence: `packages/server/src/modules/Ledger/LedgerStorage.service.ts:37` [Likely]
- correctness: The `LedgerStorage.commit()` method does not assert that total debits == total credits before writing the `accounts_transactions` rows for automatic journal entries.
  Evidence: `packages/server/src/modules/Ledger/LedgerStorage.service.ts:42` [Likely]
- correctness: Operations modifying account balances or concurrent invoice writes are missing `FOR UPDATE` row locks in their transactions, meaning parallel operations will silently overwrite balances.
  Evidence: `packages/server/src/modules/Ledger/LedgerStorage.service.ts:50` [Likely]
