Team ID:    DBG-400
Team:       Cache Me If You Can
Card:       GST-Ready Double-Entry Accounting Ledger (DBG-400)
Original:   https://github.com/bigcapitalhq/bigcapital
Commit studied: fb21220
Run:        npm install && npm run migrate && npm run seed && npm run dev
Improvements we built:
  1. Fix: Added pessimistic row locking (SELECT ... FOR UPDATE) and true database UNIQUE constraints on account codes and document numbers, eliminating the race conditions in the original where concurrent requests could silently clobber account balances.
  2. Differentiator: Built a Duplicate / Unusual Payment Alert that flags payments for review if they match recent amounts or wildly exceed a customer's average.
Libraries / AI used: Antigravity IDE / Gemini (Code Assistant)
Deck:       deck.pdf (repo root)
