import { config } from '../../config/env.js';
import { UserRole } from '../../types/index.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatbotError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number = 502) {
    super(message);
    this.name = 'ChatbotError';
    this.statusCode = statusCode;
  }
}

/**
 * Role-specific briefing injected into the system instruction so the assistant
 * answers "what can I do / how do I do my job" questions accurately for the
 * signed-in user, without ever exposing functionality the role cannot access.
 */
const ROLE_BRIEFS: Record<UserRole, string> = {
  Admin: `This user is an ADMIN. They have full access: manage system users
(create Admin/Accountant/Staff accounts via "Users"), everything an
Accountant can do (journals, reports), everything Staff can do (invoices,
bills, payments, contacts), and the KT3 Concurrency Test Harness page for
verifying the ledger stays balanced under 20 simultaneous operations.`,
  Accountant: `This user is an ACCOUNTANT. They can view the Chart of
Accounts, Contacts, Journal Sheet, Trial Balance, Balance Sheet and Profit &
Loss reports, and post Manual Journal adjustments (which must always balance:
total debits = total credits). They do NOT create sales invoices, bills, or
payments, and cannot manage system users.`,
  Staff: `This user is STAFF. They handle day-to-day operations: creating
sales invoices (Draft, then "Deliver" to post to the ledger), recording
customer payments received, creating vendor bills, and recording bill
payments. They can view Contacts and the Chart of Accounts, but cannot see
the Journal/Trial Balance/Financial Reports pages, post manual journals, or
manage system users.`,
};

/**
 * Condensed knowledge base describing how this specific application works,
 * so the assistant can answer concrete "how do I...” questions about THIS
 * product rather than generic accounting trivia.
 */
const KNOWLEDGE_BASE = `
APP: "Ledger Core" — a GST-ready double-entry accounting ledger web app.

CORE CONCEPT: Every financial event posts a balanced journal entry (total
debits must exactly equal total credits) into the General Ledger. Nothing is
ever hard-deleted — correcting a mistake means "Voiding" a record, which
posts an exact offsetting reversal entry and marks the record's status as
Voided, preserving full audit history.

DEFAULT CHART OF ACCOUNTS:
- 1000 Bank (Asset)
- 1100 Accounts Receivable / A/R (Asset)
- 2000 Accounts Payable / A/P (Liability)
- 2100 Tax Payable (Liability)
- 3000 Owner's Equity (Equity)
- 4000 Sales Revenue (Revenue)
- 5000 General Expenses (Expense)

SALES INVOICE LIFECYCLE (Sales Invoices page): Draft -> Delivered -> Partially
Paid -> Paid, or Voided from any non-Voided state (only if no payments have
been applied yet). Creating an invoice saves it as a Draft with zero ledger
impact. Clicking "Deliver & Post to Ledger" posts Debit A/R (1100), Credit
Sales Revenue (4000) [and Credit Tax Payable (2100) if a line has tax].
Voiding a Delivered invoice posts the exact reverse entries.

PAYMENTS RECEIVED (Payments page): Recording a customer payment against a
Delivered/Partially Paid invoice posts Debit Bank (1000), Credit A/R (1100).
The system also runs a differentiator safety check: it flags (but does not
block) the payment if the same customer had an identical-amount payment in
the last 10 minutes (DUPLICATE_PAYMENT_WARNING), or if the amount is 5x or
more their historical average (UNUSUAL_AMOUNT_WARNING).

VENDOR BILLS (Bills page): Creating a bill immediately posts Debit General
Expenses (5000), Credit Accounts Payable (2000), moving it to "Open" status.
Paying a bill posts Debit A/P (2000), Credit Bank (1000).

MANUAL JOURNALS (Journal Sheet page, Admin/Accountant only): Lets an
Accountant post a direct adjustment between any two accounts. The form
requires picking a debit account, a credit account, and an amount — the two
sides are always equal by construction, satisfying the double-entry rule.

REPORTS: Trial Balance (every account's debit/credit totals — must net to
zero discrepancy), Balance Sheet (Assets = Liabilities + Equity), Profit &
Loss (Revenue - Expenses = Net Income), Journal Sheet (full chronological
list of every ledger line ever posted).

USERS page (Admin only): create new Accountant/Staff/Admin accounts with
email + password + role.

KT3 TEST HARNESS page (Admin only): runs N randomized invoice/payment/bill
operations concurrently to prove the ledger never goes out of balance.

MONEY FORMAT: all amounts are stored as integer cents and displayed as
currency (e.g. 15000 cents = $150.00).
`.trim();

function buildSystemInstruction(role: UserRole, email: string): string {
  return `You are "Ledger Assistant", a friendly, concise in-app help bot embedded in the
bottom-right corner of a double-entry accounting ledger web application.

Your job: help the signed-in user understand THEIR role, what THEY can do in
this app, and how core accounting concepts (debits/credits, trial balance,
voiding, etc.) work — in plain language. Keep answers SHORT (2-6 sentences,
or a tight bullet list). Use the app's own terminology and page names so the
user can act on your answer immediately. If asked something outside this
app's accounting domain, politely redirect to what you can help with. Never
invent API routes, account codes, or features not listed below.

${KNOWLEDGE_BASE}

CURRENT USER: ${email} — Role: ${role}.
${ROLE_BRIEFS[role]}
If the user asks to do something their role does not permit, say so plainly
and name which role(s) can do it instead.`;
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
  }[];
}

export class ChatbotService {
  public static async sendMessage(
    message: string,
    history: ChatMessage[],
    role: UserRole,
    email: string
  ): Promise<string> {
    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new ChatbotError('message is required', 400);
    }
    if (!config.gemini.apiKey) {
      throw new ChatbotError(
        'The chatbot is not configured on the server (missing GEMINI_API_KEY).',
        503
      );
    }

    const safeHistory = Array.isArray(history) ? history.slice(-10) : [];

    const contents = [
      ...safeHistory
        .filter((h) => h && typeof h.content === 'string' && h.content.trim())
        .map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
      { role: 'user', parts: [{ text: message.trim() }] },
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: buildSystemInstruction(role, email) }] },
          contents,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 400,
          },
        }),
      });
    } catch (networkErr: any) {
      throw new ChatbotError(
        `Could not reach the AI service: ${networkErr?.message || 'network error'}`,
        502
      );
    }

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new ChatbotError(
        `AI service error (HTTP ${res.status}): ${bodyText.slice(0, 300) || res.statusText}`,
        502
      );
    }

    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';

    if (!text.trim()) {
      throw new ChatbotError('The AI service returned an empty response. Please try again.', 502);
    }

    return text.trim();
  }
}
