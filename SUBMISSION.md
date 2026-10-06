Team ID:    DBG-400
Team:       Cache Me If You Can
Card:       GST-Ready Double-Entry Accounting Ledger (DBG-400)
Original:   https://github.com/bigcapitalhq/bigcapital
Commit studied: fb21220
Run:        npm install && npm run migrate && npm run seed && npm run dev
Improvements we built:
  1. Fix: Server-assigned, gap-free invoice/bill/payment/journal numbers and account codes, backed by true database UNIQUE constraints and assigned inside the same transaction that posts the record. This closes the original's race condition, where invoice-number uniqueness is checked before its transaction opens (packages/server/src/modules/SaleInvoices/commands/CreateSaleInvoice.service.ts:93-97), so two concurrent requests could both pass the check before either commits.
  2. Differentiator: Built a monthly GST Filing Pack — a tax-by-rate table (with intra-state CGST/SGST vs. inter-state IGST split), an HSN-code summary, a ledger tie-out against three dedicated GST Payable accounts, and a CSV export. The original has only a generic tax-rate report with no GST fields (no GSTIN, no state code, no HSN, no CGST/SGST/IGST split) to build any of this from.
Libraries / AI used: Antigravity IDE / Gemini (Code Assistant)
Deck:       deck.pdf (repo root)
